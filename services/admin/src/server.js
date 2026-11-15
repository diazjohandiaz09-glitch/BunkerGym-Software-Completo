import express from 'express';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createHmac, randomBytes, scryptSync, timingSafeEqual
} from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const dataDir = path.join(root, 'data');
const stateFile = path.join(dataDir, 'microservices.json');
// Las credenciales se guardan fuera del document root de Vite.
const privateDir = path.resolve(root, '..', 'bunker_gym_web - copia.private');
const authFile = path.join(privateDir, 'admin-auth.json');
// Archivo temporal de entrega: queda fuera del directorio público y se elimina
// automáticamente después del primer inicio de sesión correcto.
const initialCredentialsFile = path.join(privateDir, 'admin-initial-credentials.txt');
const sessionCookieName = 'bunker_admin_session';
const sessionTtlMs = 8 * 60 * 60 * 1000;
const passwordSaltBytes = 16;
const passwordHashBytes = 64;

function persistAuthConfig(nextConfig) {
  const temporaryFile = `${authFile}.${randomBytes(8).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(temporaryFile, JSON.stringify(nextConfig, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx'
    });
    fs.renameSync(temporaryFile, authFile);
  } catch (error) {
    try { fs.rmSync(temporaryFile, { force: true }); } catch {}
    throw error;
  }
}

function loadOrCreateAuth() {
  fs.mkdirSync(privateDir, { recursive: true });
  if (fs.existsSync(authFile)) {
    const saved = JSON.parse(fs.readFileSync(authFile, 'utf8'));
    if (
      typeof saved.username !== 'string' ||
      typeof saved.passwordSalt !== 'string' ||
      typeof saved.passwordHash !== 'string' ||
      typeof saved.sessionSecret !== 'string'
    ) {
      throw new Error('El archivo privado de credenciales está incompleto. No se inicia el panel por seguridad.');
    }
    if (typeof saved.internalServiceToken !== 'string' || saved.internalServiceToken.length < 32) {
      saved.internalServiceToken = randomBytes(48).toString('base64url');
      persistAuthConfig(saved);
    }
    return saved;
  }

  const initialPassword = randomBytes(20).toString('base64url');
  const passwordSalt = randomBytes(passwordSaltBytes).toString('hex');
  const passwordHash = scryptSync(initialPassword, passwordSalt, passwordHashBytes).toString('hex');
  const created = {
    username: 'admin',
    passwordSalt,
    passwordHash,
    sessionSecret: randomBytes(48).toString('base64url'),
    internalServiceToken: randomBytes(48).toString('base64url'),
    createdAt: new Date().toISOString()
  };
  fs.writeFileSync(authFile, JSON.stringify(created, null, 2), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  // No imprimir secretos en stdout/stderr: la contraseña se entrega una sola
  // vez mediante un archivo privado legible por el usuario del sistema.
  try {
    fs.writeFileSync(
      initialCredentialsFile,
      `Usuario: admin\\nContraseña inicial: ${initialPassword}\\n\\nInicia sesión en el panel y este archivo se eliminará automáticamente.\\n`,
      { encoding: 'utf8', mode: 0o600, flag: 'wx' }
    );
  } catch (error) {
    // Evita dejar una instalación creada sin un medio de acceso recuperable.
    try { fs.rmSync(authFile, { force: true }); } catch {}
    throw new Error(`No se pudo crear el archivo privado de credenciales iniciales: ${error.message}`);
  }
  console.log('Credenciales iniciales creadas en un archivo privado fuera del directorio público.');
  console.log(`Consulta el archivo: ${initialCredentialsFile}`);
  console.log('El archivo se elimina automáticamente después del primer inicio de sesión correcto.');
  return created;
}

const authConfig = loadOrCreateAuth();
const sessions = new Map();
const loginFailures = new Map();
const loginWindowMs = 15 * 60 * 1000;
const loginBlockMs = 15 * 60 * 1000;
const maxLoginAttempts = 6;
const allowedOrigins = new Set(
  (process.env.PANEL_ALLOWED_ORIGINS || 'http://127.0.0.1:5173,http://localhost:5173')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
);

function verifyPassword(candidate) {
  if (typeof candidate !== 'string' || candidate.length > 512) return false;
  const actual = scryptSync(candidate, authConfig.passwordSalt, passwordHashBytes);
  const expected = Buffer.from(authConfig.passwordHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function signSession(payload) {
  return createHmac('sha256', authConfig.sessionSecret).update(payload).digest('base64url');
}

function readCookie(req, name) {
  const cookies = (req.headers.cookie || '').split(';');
  for (const item of cookies) {
    const separator = item.indexOf('=');
    if (separator < 0) continue;
    if (item.slice(0, separator).trim() === name) {
      return decodeURIComponent(item.slice(separator + 1).trim());
    }
  }
  return null;
}

function createSessionCookie() {
  const sessionId = randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + sessionTtlMs;
  sessions.set(sessionId, expiresAt);
  const payload = `${sessionId}.${expiresAt}`;
  const signature = signSession(payload);
  return `${payload}.${signature}`;
}

function getValidSessionId(req) {
  const token = readCookie(req, sessionCookieName);
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [sessionId, expiresText, signature] = parts;
  const expiresAt = Number(expiresText);
  if (!sessionId || !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) return null;
  const storedExpiry = sessions.get(sessionId);
  if (!storedExpiry || storedExpiry !== expiresAt) return null;
  const expected = Buffer.from(signSession(`${sessionId}.${expiresAt}`));
  const provided = Buffer.from(signature || '');
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;
  return sessionId;
}

function setSessionCookie(res, value, maxAgeSeconds) {
  const secure = process.env.ADMIN_COOKIE_SECURE === 'true' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${sessionCookieName}=${value}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${secure}`
  );
}

function requireSameOrigin(req, res, next) {
  const origin = req.get('origin');
  if (!origin || !allowedOrigins.has(origin)) {
    return res.status(403).json({ error: 'Origen no permitido para esta operación.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  const sessionId = getValidSessionId(req);
  if (!sessionId) {
    return res.status(401).json({ error: 'Debes iniciar sesión para administrar los microservicios.' });
  }
  req.adminSessionId = sessionId;
  next();
}

function checkLoginLimit(key) {
  const now = Date.now();
  const record = loginFailures.get(key);
  if (!record) return { allowed: true };
  if (record.blockedUntil > now) {
    return { allowed: false, retryAfter: Math.ceil((record.blockedUntil - now) / 1000) };
  }
  if (now - record.startedAt >= loginWindowMs || record.blockedUntil) {
    loginFailures.delete(key);
    return { allowed: true };
  }
  return { allowed: true };
}

function recordLoginFailure(key) {
  const now = Date.now();
  let record = loginFailures.get(key);
  if (!record || now - record.startedAt >= loginWindowMs || record.blockedUntil) {
    record = { startedAt: now, count: 0, blockedUntil: 0 };
  }
  record.count += 1;
  if (record.count >= maxLoginAttempts) record.blockedUntil = now + loginBlockMs;
  loginFailures.set(key, record);
  return record;
}

const definitions = [
  { id: 'gym', name: 'Espacio Bunker', description: 'Información general del gimnasio.', port: 3001, group: 'Experiencia' },
  { id: 'training', name: 'Entrenamiento', description: 'Método, técnica y progresión.', port: 3002, group: 'Experiencia' },
  { id: 'recovery', name: 'Acompañamiento', description: 'Contenido del módulo de recuperación.', port: 3003, group: 'Experiencia' },
  { id: 'community', name: 'Comunidad', description: 'Contenido de comunidad y redes.', port: 3004, group: 'Experiencia' },
  { id: 'contact', name: 'Contacto', description: 'Canales de contacto y ubicación.', port: 3005, group: 'Experiencia' },
  { id: 'plans', name: 'Planes', description: 'Modalidades de acceso y orientación.', port: 3006, group: 'Nuevos módulos' },
  { id: 'facilities', name: 'Instalaciones', description: 'Espacios y cultura del entrenamiento.', port: 3007, group: 'Nuevos módulos' },
  { id: 'faq', name: 'Preguntas frecuentes', description: 'Respuestas para nuevos visitantes.', port: 3008, group: 'Nuevos módulos' },
  { id: 'store', name: 'Tienda virtual', description: 'Catálogo, precios e inventario de productos.', port: 3010, group: 'Comercio digital' },
  { id: 'orders', name: 'Pedidos y compras', description: 'Registro de pedidos y seguimiento de compras.', port: 3011, group: 'Comercio digital' },
  { id: 'site', name: 'Configuración del sitio', description: 'Contenido y textos administrables de la página web.', port: 3012, group: 'Comercio digital' },
  { id: 'gallery', name: 'Galería y cultura visual', description: 'Fotografías y contenido visual de la experiencia Bunker.', port: 3013, group: 'Contenido visual' }
];

fs.mkdirSync(dataDir, { recursive: true });
const defaults = Object.fromEntries(definitions.map(item => [item.id, true]));
let desiredState = defaults;
try {
  desiredState = { ...defaults, ...JSON.parse(fs.readFileSync(stateFile, 'utf8')) };
} catch {
  fs.writeFileSync(stateFile, JSON.stringify(defaults, null, 2));
}

const children = new Map();
function persistState() {
  fs.writeFileSync(stateFile, JSON.stringify(desiredState, null, 2));
}
function running(child) {
  return Boolean(child && child.exitCode === null && !child.killed);
}

function startService(definition) {
  const current = children.get(definition.id);
  if (running(current)) return Promise.resolve(current);
  const script = path.join(root, 'services', definition.id, 'src', 'server.js');
  const child = spawn(process.execPath, [script], {
    cwd: path.dirname(path.dirname(script)),
    env: {
      ...process.env,
      PORT: String(definition.port),
      INTERNAL_SERVICE_TOKEN: authConfig.internalServiceToken,
      STORE_SERVICE_URL: 'http://127.0.0.1:3010'
    },
    stdio: 'ignore',
    windowsHide: true
  });
  children.set(definition.id, child);
  child.once('error', error => {
    console.error(`No se pudo iniciar ${definition.id}:`, error.message);
    if (children.get(definition.id) === child) children.delete(definition.id);
  });
  child.once('exit', (code, signal) => {
    if (children.get(definition.id) === child) children.delete(definition.id);
    if (desiredState[definition.id]) console.warn(`${definition.id} terminó (código ${code ?? 'n/a'}, señal ${signal ?? 'n/a'}).`);
  });
  return new Promise(resolve => {
    child.once('spawn', async () => {
      for (let attempt = 0; attempt < 15 && running(child); attempt++) {
        try {
          const response = await fetch(`http://127.0.0.1:${definition.port}/health`);
          if (response.ok) return resolve(child);
        } catch {}
        await new Promise(done => setTimeout(done, 200));
      }
      resolve(running(child) ? child : null);
    });
    child.once('error', () => resolve(null));
  });
}
function stopService(id) {
  const child = children.get(id);
  if (!child || child.exitCode !== null) {
    children.delete(id);
    return Promise.resolve();
  }
  return new Promise(resolve => {
    const finish = () => {
      children.delete(id);
      resolve();
    };
    const timeout = setTimeout(finish, 2500);
    child.once('exit', () => {
      clearTimeout(timeout);
      finish();
    });
    child.kill();
  });
}
function snapshot() {
  return definitions.map(item => {
    const active = running(children.get(item.id));
    const enabled = Boolean(desiredState[item.id]);
    return { ...item, enabled, running: active, status: !enabled ? 'disabled' : active ? 'online' : 'offline' };
  });
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '20kb' }));
app.use((_req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Cache-Control', 'no-store');
  next();
});

// Endpoint liviano de salud; no entrega estado operativo ni permite cambios.
app.get('/api/admin/health', requireAdmin, (_req, res) => res.json({ service: 'admin', status: 'ok' }));

app.get('/api/admin/auth/session', (req, res) => {
  res.json({ authenticated: Boolean(getValidSessionId(req)) });
});

app.post('/api/admin/auth/login', requireSameOrigin, (req, res) => {
  const clientKey = req.ip || req.socket.remoteAddress || 'unknown';
  const limit = checkLoginLimit(clientKey);
  if (!limit.allowed) {
    res.set('Retry-After', String(limit.retryAfter));
    return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos antes de volver a intentarlo.' });
  }

  const username = typeof req.body?.username === 'string' ? req.body.username : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const validUser = username === authConfig.username;
  const validPassword = verifyPassword(password);

  if (!validUser || !validPassword) {
    const record = recordLoginFailure(clientKey);
    if (record.blockedUntil > Date.now()) {
      res.set('Retry-After', String(Math.ceil((record.blockedUntil - Date.now()) / 1000)));
    }
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  }

  loginFailures.delete(clientKey);
  // La contraseña inicial deja de existir en texto claro tras el primer acceso válido.
  try {
    fs.rmSync(initialCredentialsFile, { force: true });
  } catch (error) {
    console.error('No se pudo eliminar el archivo temporal de credenciales iniciales:', error.message);
  }
  const now = Date.now();
  for (const [id, expiry] of sessions) if (expiry <= now) sessions.delete(id);
  setSessionCookie(res, createSessionCookie(), Math.floor(sessionTtlMs / 1000));
  return res.json({ authenticated: true, username: authConfig.username });
});

app.post('/api/admin/auth/logout', requireSameOrigin, (req, res) => {
  const sessionId = getValidSessionId(req);
  if (sessionId) sessions.delete(sessionId);
  setSessionCookie(res, '', 0);
  return res.json({ authenticated: false });
});

app.post('/api/admin/auth/change-password', requireAdmin, requireSameOrigin, (req, res) => {
  const failureKey = `password-change:${req.ip || req.socket.remoteAddress || 'unknown'}:${req.adminSessionId}`;
  const limit = checkLoginLimit(failureKey);
  if (!limit.allowed) {
    res.set('Retry-After', String(limit.retryAfter));
    return res.status(429).json({ error: 'Demasiados intentos de verificación. Espera 15 minutos y vuelve a intentarlo.' });
  }

  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  const confirmPassword = typeof req.body?.confirmPassword === 'string' ? req.body.confirmPassword : '';

  if (!verifyPassword(currentPassword)) {
    recordLoginFailure(failureKey);
    return res.status(401).json({ error: 'La contraseña actual no es correcta.' });
  }
  loginFailures.delete(failureKey);

  if (newPassword.length < 12) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 12 caracteres.' });
  }
  if (newPassword.length > 128) {
    return res.status(400).json({ error: 'La nueva contraseña no puede superar los 128 caracteres.' });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'La confirmación no coincide con la nueva contraseña.' });
  }
  if (newPassword === currentPassword) {
    return res.status(400).json({ error: 'La nueva contraseña debe ser diferente de la actual.' });
  }

  const nextSalt = randomBytes(passwordSaltBytes).toString('hex');
  const nextConfig = {
    ...authConfig,
    passwordSalt: nextSalt,
    passwordHash: scryptSync(newPassword, nextSalt, passwordHashBytes).toString('hex'),
    sessionSecret: randomBytes(48).toString('base64url'),
    passwordUpdatedAt: new Date().toISOString()
  };

  try {
    persistAuthConfig(nextConfig);
  } catch (error) {
    console.error('No se pudo guardar la nueva contraseña:', error.message);
    return res.status(500).json({ error: 'No se pudo guardar la nueva contraseña. No se modificaron tus credenciales.' });
  }

  Object.assign(authConfig, nextConfig);
  // Revoca todas las sesiones antiguas y crea una sesión nueva para este navegador.
  sessions.clear();
  loginFailures.clear();
  setSessionCookie(res, createSessionCookie(), Math.floor(sessionTtlMs / 1000));
  return res.json({
    changed: true,
    authenticated: true,
    message: 'Contraseña actualizada. Las demás sesiones se cerraron.'
  });
});

async function callInternalService(port, pathname, method = 'GET', body) {
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Bunker-Service-Token': authConfig.internalServiceToken
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || 'El microservicio no pudo completar la operación.');
    error.status = response.status;
    throw error;
  }
  return result;
}
function proxyResponse(res, promise) {
  return promise
    .then(result => res.json(result))
    .catch(error => {
      console.error('Error en operación administrativa de microservicio:', error.message);
      res.status(error.status || 503).json({
        error: error.status ? error.message : 'El microservicio no está disponible. Comprueba que esté encendido desde el supervisor.'
      });
    });
}

app.get('/api/admin/store/products', requireAdmin, (_req, res) =>
  proxyResponse(res, callInternalService(3010, '/internal/products')));
app.post('/api/admin/store/products', requireAdmin, requireSameOrigin, (req, res) =>
  proxyResponse(res, callInternalService(3010, '/internal/products', 'POST', req.body)));
app.put('/api/admin/store/products/:id', requireAdmin, requireSameOrigin, (req, res) =>
  proxyResponse(res, callInternalService(3010, `/internal/products/${encodeURIComponent(req.params.id)}`, 'PUT', req.body)));
app.delete('/api/admin/store/products/:id', requireAdmin, requireSameOrigin, (req, res) =>
  proxyResponse(res, callInternalService(3010, `/internal/products/${encodeURIComponent(req.params.id)}`, 'DELETE')));

app.get('/api/admin/orders', requireAdmin, (_req, res) =>
  proxyResponse(res, callInternalService(3011, '/internal/orders')));
app.patch('/api/admin/orders/:id', requireAdmin, requireSameOrigin, (req, res) =>
  proxyResponse(res, callInternalService(3011, `/internal/orders/${encodeURIComponent(req.params.id)}`, 'PATCH', req.body)));

app.get('/api/admin/site-settings', requireAdmin, (_req, res) =>
  proxyResponse(res, callInternalService(3012, '/internal/settings')));
app.put('/api/admin/site-settings', requireAdmin, requireSameOrigin, (req, res) =>
  proxyResponse(res, callInternalService(3012, '/internal/settings', 'PUT', req.body)));

// Estado público de disponibilidad; no expone controles ni credenciales administrativas.
app.get('/api/public/services', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    services: snapshot().map(({ id, name, enabled, running: active, status }) => ({
      id, name, enabled, running: active, status
    }))
  });
});

app.get('/api/admin/services', requireAdmin, (_req, res) => {
  res.json({ services: snapshot() });
});

app.patch('/api/admin/services/:id', requireAdmin, requireSameOrigin, async (req, res) => {
  const definition = definitions.find(item => item.id === req.params.id);
  if (!definition) return res.status(404).json({ error: 'Microservicio no encontrado.' });
  if (typeof req.body?.enabled !== 'boolean') {
    return res.status(400).json({ error: 'El campo enabled debe ser booleano.' });
  }

  desiredState[definition.id] = req.body.enabled;
  persistState();
  if (req.body.enabled) {
    const child = await startService(definition);
    if (!child) return res.status(500).json({ error: 'No se pudo iniciar el microservicio.', services: snapshot() });
  } else {
    await stopService(definition.id);
  }
  return res.json({ service: snapshot().find(item => item.id === definition.id), services: snapshot() });
});

app.post('/api/admin/services/:id/restart', requireAdmin, requireSameOrigin, async (req, res) => {
  const definition = definitions.find(item => item.id === req.params.id);
  if (!definition) return res.status(404).json({ error: 'Microservicio no encontrado.' });
  desiredState[definition.id] = true;
  persistState();
  await stopService(definition.id);
  const child = await startService(definition);
  if (!child) return res.status(500).json({ error: 'No se pudo reiniciar el microservicio.' });
  return res.json({ service: snapshot().find(item => item.id === definition.id), services: snapshot() });
});

const port = Number(process.env.ADMIN_PORT || 3009);
const server = app.listen(port, '127.0.0.1', async () => {
  console.log(`Bunker control plane en http://127.0.0.1:${port}`);
  for (const definition of definitions) if (desiredState[definition.id]) await startService(definition);
  console.log('Supervisor listo:', snapshot().map(item => `${item.id}:${item.status}`).join(', '));
});
async function shutdown() {
  await Promise.all(definitions.map(item => stopService(item.id)));
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);