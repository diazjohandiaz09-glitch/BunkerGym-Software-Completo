import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const dataFile = path.join(root, 'data', 'site-settings.json');
const token = process.env.INTERNAL_SERVICE_TOKEN || '';
const defaults = {
  announcementEnabled: true,
  announcement: 'VIEJA ESCUELA. FUERZA QUE PERMANECE. · CONOCE LA EXPERIENCIA BUNKER.',
  heroEyebrow: 'GIRARDOT · CUNDINAMARCA',
  heroTitle: 'FORJADOS',
  heroAccent: 'EN HIERRO.',
  heroLead: 'Entrenamiento de vieja escuela. Hierro, técnica, disciplina y fuerza real.',
  aboutTitle: 'UN LUGAR PARA LOS QUE',
  aboutAccent: 'ENTRENAN DE VERDAD.',
  aboutText: 'Bunker Gym es un espacio construido alrededor de la cultura del hierro. Nuestra identidad está inspirada en los gimnasios de vieja escuela: lugares donde lo importante es presentarse, trabajar con disciplina y progresar. Creemos que cada persona tiene un punto de partida distinto. Por eso valoramos el aprendizaje, la ejecución consciente y el respeto por el proceso individual.',
  shopTitle: 'EQUÍPATE PARA',
  shopAccent: 'EL PROCESO.',
  shopDescription: 'Suplementos deportivos, ropa y accesorios para entrenar. Fotografías de referencia; precios y existencias de demostración pendientes de confirmar antes de una venta real.'
};

function sameToken(value) {
  if (!token || typeof value !== 'string') return false;
  const a = Buffer.from(value); const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
function requireInternal(req, res, next) {
  if (!sameToken(req.get('x-bunker-service-token'))) return res.status(403).json({ error: 'Acceso interno no autorizado.' });
  next();
}
function atomicWrite(value) {
  const temp = `${dataFile}.${randomUUID()}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(temp, dataFile);
}
function readSettings() {
  try { return { ...defaults, ...JSON.parse(fs.readFileSync(dataFile, 'utf8')) }; }
  catch { return { ...defaults }; }
}
function validateSettings(input) {
  const previous = readSettings();
  const keys = Object.keys(defaults);
  const next = { ...previous };
  for (const key of keys) {
    if (key === 'announcementEnabled') {
      next[key] = input?.[key] === true;
    } else if (input?.[key] !== undefined) {
      const value = String(input[key]).trim();
      if (value.length > 500 || (key !== 'aboutText' && value.length < 3)) throw new Error(`El campo ${key} está vacío o supera el límite permitido.`);
      next[key] = value;
    }
  }
  return next;
}
fs.mkdirSync(path.dirname(dataFile), { recursive: true });
if (!fs.existsSync(dataFile)) atomicWrite(defaults);

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '20kb' }));
app.get('/health', (_req, res) => res.json({ service: 'site-settings', status: 'ok' }));
app.get('/api/site/settings', (_req, res) => res.json(readSettings()));
app.get('/internal/settings', requireInternal, (_req, res) => res.json(readSettings()));
app.put('/internal/settings', requireInternal, (req, res) => {
  try {
    const next = validateSettings(req.body);
    atomicWrite(next);
    res.json({ settings: next, message: 'Configuración del sitio guardada.' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
const port = Number(process.env.PORT || 3012);
app.listen(port, '127.0.0.1', () => console.log(`site-settings-service escuchando en ${port}`));