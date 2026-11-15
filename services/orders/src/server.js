import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const dataFile = path.join(root, 'data', 'orders.json');
const token = process.env.INTERNAL_SERVICE_TOKEN || '';
const storeUrl = process.env.STORE_SERVICE_URL || 'http://127.0.0.1:3010';

function atomicWrite(data) {
  const temp = `${dataFile}.${randomUUID()}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(temp, dataFile);
}
function sameToken(value) {
  if (!token || typeof value !== 'string') return false;
  const a = Buffer.from(value); const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
function requireInternal(req, res, next) {
  if (!sameToken(req.get('x-bunker-service-token'))) return res.status(403).json({ error: 'Acceso interno no autorizado.' });
  next();
}
function readOrders() {
  try { const value = JSON.parse(fs.readFileSync(dataFile, 'utf8')); return Array.isArray(value) ? value : []; }
  catch { return []; }
}
async function storeCall(pathname, body) {
  const response = await fetch(`${storeUrl}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Bunker-Service-Token': token },
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'No fue posible consultar el inventario.');
  return result;
}
function validateCustomer(input) {
  const customer = {
    name: String(input?.name || '').trim().slice(0, 100),
    email: String(input?.email || '').trim().toLowerCase().slice(0, 150),
    phone: String(input?.phone || '').trim().slice(0, 35),
    address: String(input?.address || '').trim().slice(0, 180),
    city: String(input?.city || '').trim().slice(0, 90),
    notes: String(input?.notes || '').trim().slice(0, 500)
  };
  if (customer.name.length < 3) throw new Error('Escribe el nombre completo del comprador.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) throw new Error('Escribe un correo electrónico válido.');
  if (customer.phone.replace(/\D/g, '').length < 7) throw new Error('Escribe un teléfono válido.');
  if (customer.address.length < 6 || customer.city.length < 2) throw new Error('Completa la dirección y la ciudad.');
  return customer;
}
fs.mkdirSync(path.dirname(dataFile), { recursive: true });
if (!fs.existsSync(dataFile)) atomicWrite([]);

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '30kb' }));
app.get('/health', (_req, res) => res.json({ service: 'orders', status: 'ok' }));
app.get('/api/orders/health', (_req, res) => res.json({
  service: 'orders',
  status: 'ok',
  title: 'PEDIDOS Y COMPRAS',
  label: 'COMERCIO DIGITAL',
  description: 'Registro y seguimiento de pedidos de la tienda virtual.',
  href: '#tienda',
  action: 'HACER UN PEDIDO'
}));

app.post('/api/orders/checkout', async (req, res) => {
  let reserved;
  try {
    const customer = validateCustomer(req.body?.customer);
    reserved = await storeCall('/internal/reserve', { items: req.body?.items });
    const now = new Date();
    const folio = `BG-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const order = {
      id: randomUUID(),
      folio,
      createdAt: now.toISOString(),
      customer,
      items: reserved.items,
      total: reserved.total,
      status: 'RECIBIDO',
      paymentMethod: 'SIMULACIÓN · PAGO AL RECIBIR',
      paymentStatus: 'NO SE REALIZÓ NINGÚN COBRO'
    };
    const orders = readOrders();
    orders.unshift(order);
    try {
      atomicWrite(orders);
    } catch (error) {
      await storeCall('/internal/restock', { items: reserved.items });
      throw error;
    }
    res.status(201).json({
      verified: true,
      simulated: true,
      message: 'Pedido verificado y registrado en modo de simulación. No se realizó ningún cobro.',
      order: { folio: order.folio, createdAt: order.createdAt, items: order.items, total: order.total, status: order.status, paymentStatus: order.paymentStatus }
    });
  } catch (error) {
    const message = error.message || 'No fue posible registrar el pedido.';
    const code = /inventario insuficiente/i.test(message) ? 409 : /producto|disponible/i.test(message) ? 409 : 400;
    res.status(code).json({ error: message });
  }
});

app.get('/internal/orders', requireInternal, (_req, res) => res.json({ orders: readOrders() }));
app.patch('/internal/orders/:id', requireInternal, async (req, res) => {
  const allowed = ['RECIBIDO', 'CONFIRMADO', 'PREPARANDO', 'ENVIADO', 'ENTREGADO', 'CANCELADO'];
  const nextStatus = String(req.body?.status || '').toUpperCase();
  if (!allowed.includes(nextStatus)) return res.status(400).json({ error: 'Estado de pedido no válido.' });
  const orders = readOrders();
  const order = orders.find(item => item.id === req.params.id || item.folio === req.params.id);
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado.' });
  if (order.status === 'CANCELADO' && nextStatus !== 'CANCELADO') {
    return res.status(409).json({ error: 'Un pedido cancelado no puede reactivarse. Registra un pedido nuevo.' });
  }
  if (order.status !== 'CANCELADO' && nextStatus === 'CANCELADO') {
    await storeCall('/internal/restock', { items: order.items.map(item => ({ productId: item.productId, quantity: item.quantity })) });
  }
  order.status = nextStatus;
  order.updatedAt = new Date().toISOString();
  atomicWrite(orders);
  res.json({ order });
});

const port = Number(process.env.PORT || 3011);
app.listen(port, '127.0.0.1', () => console.log(`orders-service escuchando en ${port}`));