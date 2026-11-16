import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after, before } from 'node:test';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const testWorkspace = fs.mkdtempSync(path.join(projectRoot, '.bunker-integration-'));
const runtimeRoot = path.join(testWorkspace, 'runtime');
fs.mkdirSync(runtimeRoot, { recursive: true });
const runtimeServices = path.join(runtimeRoot, 'services');
const privateDir = path.resolve(runtimeRoot, '..', 'bunker_gym_web - copia.private');
const token = 'integration-test-token-0123456789-abcdefghijklmnopqrstuvwxyz';
const children = new Map();
const baseUrls = new Map();

async function freePort() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise(resolve => server.close(resolve));
  return port;
}

function copyService(name) {
  const source = path.join(projectRoot, 'services', name);
  const destination = path.join(runtimeServices, name);
  fs.cpSync(source, destination, { recursive: true });
}

async function waitForHealth(name, port, child) {
  const url = `http://127.0.0.1:${port}/health`;
  let lastError;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) throw new Error(`${name} terminó antes de iniciar (código ${child.exitCode}).`);
    try {
      const response = await fetch(url);
      if (response.ok) {
        const body = await response.json();
        assert.equal(body.status, 'ok');
        return body;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`No respondió el health check de ${name}: ${lastError?.message || 'timeout'}`);
}

async function startService(name, extraEnv = {}) {
  const existing = children.get(name);
  if (existing && existing.exitCode === null) return baseUrls.get(name);
  copyService(name);
  const port = await freePort();
  const env = {
    ...process.env,
    PORT: String(port),
    INTERNAL_SERVICE_TOKEN: token,
    ...extraEnv
  };
  const child = spawn(process.execPath, [path.join(runtimeServices, name, 'src', 'server.js')], {
    cwd: runtimeRoot,
    env,
    stdio: 'ignore'
  });
  children.set(name, child);
  baseUrls.set(name, `http://127.0.0.1:${port}`);
  await waitForHealth(name, port, child);
  return baseUrls.get(name);
}

async function request(name, pathname, options = {}) {
  const response = await fetch(`${baseUrls.get(name)}${pathname}`, options);
  const body = await response.json().catch(() => null);
  return { response, body };
}

function internalHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    'X-Bunker-Service-Token': token,
    ...extra
  };
}

before(async () => {
  fs.mkdirSync(runtimeServices, { recursive: true });
  fs.mkdirSync(path.join(runtimeRoot, 'data'), { recursive: true });
  // El plano de control se prueba aislado: no debe iniciar los procesos hijos reales.
  fs.writeFileSync(
    path.join(runtimeRoot, 'data', 'microservices.json'),
    JSON.stringify({
      gym: false, training: false, recovery: false, community: false,
      contact: false, plans: false, facilities: false, faq: false,
      store: false, orders: false, site: false, gallery: false
    })
  );
});

after(async () => {
  await Promise.all([...children.values()].map(child => new Promise(resolve => {
    if (child.exitCode !== null) return resolve();
    child.once('exit', resolve);
    child.kill('SIGTERM');
    setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL');
    }, 2000).unref();
  })));
  fs.rmSync(testWorkspace, { recursive: true, force: true });
});

test('microservicios de contenido: health y endpoint público responden JSON', async t => {
  const services = [
    ['gym', '/api/gym'],
    ['training', '/api/training'],
    ['recovery', '/api/recovery'],
    ['community', '/api/community'],
    ['contact', '/api/contact'],
    ['plans', '/api/plans'],
    ['facilities', '/api/facilities'],
    ['faq', '/api/faq']
  ];
  for (const [name, endpoint] of services) {
    await t.test(name, async () => {
      await startService(name);
      const health = await request(name, '/health');
      assert.equal(health.response.status, 200);
      assert.equal(health.body.service, name);
      const data = await request(name, endpoint);
      assert.equal(data.response.status, 200);
      assert.ok(data.body !== null && typeof data.body === 'object');
      assert.equal(data.response.headers.get('x-powered-by'), null);
    });
  }
});

test('gallery: entrega contenido visual y estructura de elementos', async () => {
  await startService('gallery');
  const { response, body } = await request('gallery', '/api/gallery');
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(body.items));
  assert.ok(body.items.length > 0);
  for (const item of body.items) {
    assert.equal(typeof item.id, 'string');
    assert.equal(typeof item.image, 'string');
    assert.equal(typeof item.alt, 'string');
  }
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('store: protege operaciones internas, valida productos y controla inventario', async () => {
  await startService('store');
  const publicCatalog = await request('store', '/api/store/products');
  assert.equal(publicCatalog.response.status, 200);
  assert.ok(publicCatalog.body.products.length > 0);

  const denied = await request('store', '/internal/products');
  assert.equal(denied.response.status, 403);

  const unauthorizedCreate = await request('store', '/internal/products', {
    method: 'POST',
    headers: internalHeaders({ 'X-Bunker-Service-Token': 'incorrect-token' }),
    body: JSON.stringify({ name: 'Test', description: 'Producto de prueba', price: 1000, stock: 5 })
  });
  assert.equal(unauthorizedCreate.response.status, 403);

  const invalid = await request('store', '/internal/products', {
    method: 'POST',
    headers: internalHeaders(),
    body: JSON.stringify({ id: 'bad-product', name: '', description: '', price: -1, stock: -2, image: 'http://unsafe.test/a.png' })
  });
  assert.equal(invalid.response.status, 400);

  const created = await request('store', '/internal/products', {
    method: 'POST',
    headers: internalHeaders(),
    body: JSON.stringify({ id: 'integration-product', name: 'Producto integración', description: 'Producto para pruebas', price: 12000, stock: 4, image: '/assets/products/shirt.svg' })
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.product.stock, 4);

  const reserved = await request('store', '/internal/reserve', {
    method: 'POST',
    headers: internalHeaders(),
    body: JSON.stringify({ items: [{ productId: 'integration-product', quantity: 2 }] })
  });
  assert.equal(reserved.response.status, 200);
  assert.equal(reserved.body.total, 24000);
  assert.equal(reserved.body.items[0].quantity, 2);

  const insufficient = await request('store', '/internal/reserve', {
    method: 'POST',
    headers: internalHeaders(),
    body: JSON.stringify({ items: [{ productId: 'integration-product', quantity: 3 }] })
  });
  assert.equal(insufficient.response.status, 409);

  const products = await request('store', '/internal/products', { headers: internalHeaders() });
  assert.equal(products.response.status, 200);
  assert.equal(products.body.products.find(item => item.id === 'integration-product').stock, 2);

  const restocked = await request('store', '/internal/restock', {
    method: 'POST',
    headers: internalHeaders(),
    body: JSON.stringify({ items: [{ productId: 'integration-product', quantity: 2 }] })
  });
  assert.equal(restocked.response.status, 200);
  assert.equal(restocked.body.restocked, true);
});

test('orders + store: checkout, persistencia privada, cancelación y reposición', async () => {
  await startService('store');
  await startService('orders', { STORE_SERVICE_URL: baseUrls.get('store') });

  const invalidCustomer = await request('orders', '/api/orders/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customer: { name: 'A', email: 'mal-correo', phone: '12', address: 'x', city: 'y' }, items: [{ productId: 'camiseta-bunker', quantity: 1 }] })
  });
  assert.equal(invalidCustomer.response.status, 400);

  const checkout = await request('orders', '/api/orders/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer: { name: 'Cliente Integración', email: 'integration@example.com', phone: '+573001234567', address: 'Calle 10 # 5-20', city: 'Girardot', notes: 'Pedido automatizado' },
      items: [{ productId: 'camiseta-bunker', quantity: 1 }]
    })
  });
  assert.equal(checkout.response.status, 201);
  assert.equal(checkout.body.verified, true);
  assert.equal(checkout.body.simulated, true);
  assert.equal(checkout.body.order.total, 68000);
  assert.equal(checkout.body.order.status, 'RECIBIDO');
  const folio = checkout.body.order.folio;

  const forbidden = await request('orders', '/internal/orders');
  assert.equal(forbidden.response.status, 403);

  const list = await request('orders', '/internal/orders', { headers: internalHeaders() });
  assert.equal(list.response.status, 200);
  const order = list.body.orders.find(item => item.folio === folio);
  assert.ok(order);
  assert.equal(order.customer.email, 'integration@example.com');

  const invalidStatus = await request('orders', `/internal/orders/${encodeURIComponent(folio)}`, {
    method: 'PATCH',
    headers: internalHeaders(),
    body: JSON.stringify({ status: 'PAGADO' })
  });
  assert.equal(invalidStatus.response.status, 400);

  const cancelled = await request('orders', `/internal/orders/${encodeURIComponent(folio)}`, {
    method: 'PATCH',
    headers: internalHeaders(),
    body: JSON.stringify({ status: 'CANCELADO' })
  });
  assert.equal(cancelled.response.status, 200);
  assert.equal(cancelled.body.order.status, 'CANCELADO');

  const cannotReactivate = await request('orders', `/internal/orders/${encodeURIComponent(folio)}`, {
    method: 'PATCH',
    headers: internalHeaders(),
    body: JSON.stringify({ status: 'ENTREGADO' })
  });
  assert.equal(cannotReactivate.response.status, 409);

  const products = await request('store', '/internal/products', { headers: internalHeaders() });
  assert.equal(products.body.products.find(item => item.id === 'camiseta-bunker').stock, 18);
  assert.equal(fs.existsSync(path.join(runtimeRoot, 'data', 'orders.json')), false);
  assert.equal(fs.existsSync(path.join(privateDir, 'orders.json')), true);
});

test('site settings: lectura pública, autenticación interna y validación de escritura', async () => {
  await startService('site');
  const publicSettings = await request('site', '/api/site/settings');
  assert.equal(publicSettings.response.status, 200);
  assert.equal(publicSettings.body.heroTitle, 'FORJADOS');

  const denied = await request('site', '/internal/settings');
  assert.equal(denied.response.status, 403);

  const updated = await request('site', '/internal/settings', {
    method: 'PUT',
    headers: internalHeaders(),
    body: JSON.stringify({ heroTitle: 'BUNKER TEST', announcementEnabled: false })
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.settings.heroTitle, 'BUNKER TEST');
  assert.equal(updated.body.settings.announcementEnabled, false);

  const invalid = await request('site', '/internal/settings', {
    method: 'PUT',
    headers: internalHeaders(),
    body: JSON.stringify({ heroTitle: 'x'.repeat(501) })
  });
  assert.equal(invalid.response.status, 400);
});

test('admin: sesión, protección de rutas y estado público del supervisor', async () => {
  copyService('admin');
  const state = {
    gym: false, training: false, recovery: false, community: false,
    contact: false, plans: false, facilities: false, faq: false,
    store: false, orders: false, site: false, gallery: false
  };
  fs.writeFileSync(path.join(runtimeRoot, 'data', 'microservices.json'), JSON.stringify(state));
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(runtimeServices, 'admin', 'src', 'server.js')], {
    cwd: runtimeRoot,
    env: { ...process.env, ADMIN_PORT: String(port), PORT: String(port) },
    stdio: 'ignore'
  });
  children.set('admin', child);
  baseUrls.set('admin', `http://127.0.0.1:${port}`);
  let adminReady = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) throw new Error('admin terminó antes de iniciar.');
    try {
      const ready = await fetch(`${baseUrls.get('admin')}/api/admin/auth/session`);
      if (ready.ok) { adminReady = true; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(adminReady, true, 'admin debe iniciar y responder el endpoint de sesión');

  const session = await request('admin', '/api/admin/auth/session');
  assert.equal(session.response.status, 200);
  assert.equal(session.body.authenticated, false);

  const protectedHealth = await request('admin', '/api/admin/health');
  assert.equal(protectedHealth.response.status, 401);

  const deniedLogin = await request('admin', '/api/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'not-a-real-password' })
  });
  assert.equal(deniedLogin.response.status, 403);

  const publicServices = await request('admin', '/api/public/services');
  assert.equal(publicServices.response.status, 200);
  assert.equal(publicServices.body.services.length, 12);
  assert.ok(publicServices.body.services.every(service => service.status === 'disabled'));

  const credentialsPath = path.join(privateDir, 'admin-initial-credentials.txt');
  const credentials = fs.readFileSync(credentialsPath, 'utf8');
  const initialPassword = credentials.match(/Contraseña inicial: (.+)/)?.[1];
  assert.ok(initialPassword, 'debe entregar una contraseña inicial en archivo privado');

  const login = await request('admin', '/api/admin/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:5173'
    },
    body: JSON.stringify({ username: 'admin', password: initialPassword })
  });
  assert.equal(login.response.status, 200);
  assert.equal(login.body.authenticated, true);
  const setCookie = login.response.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  const cookie = setCookie.split(';')[0];
  assert.equal(fs.existsSync(credentialsPath), false, 'debe borrar el archivo de contraseña inicial tras login');

  const authenticatedHealth = await request('admin', '/api/admin/health', {
    headers: { Cookie: cookie }
  });
  assert.equal(authenticatedHealth.response.status, 200);

  const protectedServices = await request('admin', '/api/admin/services', {
    headers: { Cookie: cookie }
  });
  assert.equal(protectedServices.response.status, 200);
  assert.equal(protectedServices.body.services.length, 12);

  const logout = await request('admin', '/api/admin/auth/logout', {
    method: 'POST',
    headers: { Origin: 'http://localhost:5173', Cookie: cookie }
  });
  assert.equal(logout.response.status, 200);
  assert.equal(logout.body.authenticated, false);

  const afterLogout = await request('admin', '/api/admin/services', {
    headers: { Cookie: cookie }
  });
  assert.equal(afterLogout.response.status, 401);
});
