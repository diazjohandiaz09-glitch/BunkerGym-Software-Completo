import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const dataFile = path.join(root, 'data', 'store-products.json');
const token = process.env.INTERNAL_SERVICE_TOKEN || '';

function atomicWrite(file, data) {
  const temp = `${file}.${randomUUID()}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(temp, file);
}
function sameToken(value) {
  if (!token || typeof value !== 'string') return false;
  const a = Buffer.from(value);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
function requireInternal(req, res, next) {
  if (!sameToken(req.get('x-bunker-service-token'))) {
    return res.status(403).json({ error: 'Acceso interno no autorizado.' });
  }
  next();
}
const seed = [
  { id: 'camiseta-bunker', name: 'Camiseta Bunker · Vieja Escuela', category: 'Ropa', description: 'Camiseta negra de estilo clásico para representar la cultura del hierro dentro y fuera del gimnasio.', price: 68000, stock: 18, image: '/assets/products/shirt.svg', active: true },
  { id: 'shaker-bunker', name: 'Shaker Bunker 750 ml', category: 'Accesorios', description: 'Botella mezcladora de entrenamiento con diseño negro y acento amarillo. Imagen ilustrativa.', price: 35000, stock: 25, image: '/assets/products/shaker.svg', active: true },
  { id: 'straps-fuerza', name: 'Straps de levantamiento', category: 'Accesorios', description: 'Correas de agarre para acompañar tus sesiones de fuerza. Imagen ilustrativa.', price: 42000, stock: 15, image: '/assets/products/straps.svg', active: true },
  { id: 'gorra-bunker', name: 'Gorra Bunker', category: 'Ropa', description: 'Gorra negra de inspiración old school con identidad Bunker. Imagen ilustrativa.', price: 48000, stock: 12, image: '/assets/products/cap.svg', active: true },
  { id: 'whey-protein-demo', name: 'Whey Protein · Presentación demo', category: 'Suplementos', description: 'Fotografía de referencia de proteína whey. Producto, marca, presentación, precio y disponibilidad pendientes de confirmación comercial.', price: 159000, stock: 12, image: '/assets/products/whey-protein.jpg', active: true },
  { id: 'creatina-demo', name: 'Creatina monohidratada · Presentación demo', category: 'Suplementos', description: 'Fotografía de referencia de creatina monohidratada. Producto, marca, presentación, precio y disponibilidad pendientes de confirmación comercial.', price: 79000, stock: 15, image: '/assets/products/creatina.jpg', active: true },
  { id: 'preworkout-demo', name: 'Pre-entreno · Presentación demo', category: 'Suplementos', description: 'Fotografía de referencia de suplemento pre-entreno. Producto, marca, presentación, precio y disponibilidad pendientes de confirmación comercial.', price: 95000, stock: 8, image: '/assets/products/preworkout.jpg', active: true }
];
fs.mkdirSync(path.dirname(dataFile), { recursive: true });
if (!fs.existsSync(dataFile)) atomicWrite(dataFile, seed);

function readProducts() {
  try {
    const products = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    return Array.isArray(products) ? products : seed;
  } catch {
    return seed;
  }
}
function writeProducts(products) {
  atomicWrite(dataFile, products);
}
function cleanProduct(input, previous = {}) {
  const name = String(input?.name ?? previous.name ?? '').trim().slice(0, 90);
  const category = String(input?.category ?? previous.category ?? 'General').trim().slice(0, 40);
  const description = String(input?.description ?? previous.description ?? '').trim().slice(0, 500);
  const image = String(input?.image ?? previous.image ?? '/assets/products/shirt.svg').trim().slice(0, 220);
  const price = Number(input?.price ?? previous.price);
  const stock = Number(input?.stock ?? previous.stock);
  const active = input?.active === undefined ? previous.active !== false : input.active === true;
  if (!name || !description || !Number.isSafeInteger(price) || price < 100 || price > 50000000) {
    throw new Error('Revisa el nombre, la descripción y el precio del producto.');
  }
  if (!Number.isInteger(stock) || stock < 0 || stock > 100000) {
    throw new Error('El inventario debe ser un número entero entre 0 y 100000.');
  }
  if (!image.startsWith('/assets/') && !image.startsWith('https://')) {
    throw new Error('La imagen debe pertenecer a /assets/ o usar una dirección HTTPS.');
  }
  return { name, category, description, price, stock, image, active };
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '30kb' }));
app.get('/health', (_req, res) => res.json({ service: 'store', status: 'ok' }));
app.get('/api/store/products', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ products: readProducts().filter(product => product.active && product.stock > 0) });
});

app.get('/internal/products', requireInternal, (_req, res) => res.json({ products: readProducts() }));
app.post('/internal/products', requireInternal, (req, res) => {
  try {
    const product = cleanProduct(req.body);
    const products = readProducts();
    const id = String(req.body?.id || randomUUID()).toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 55);
    if (!id || products.some(item => item.id === id)) return res.status(409).json({ error: 'El identificador del producto ya existe.' });
    const created = { id, ...product, createdAt: new Date().toISOString() };
    products.push(created);
    writeProducts(products);
    res.status(201).json({ product: created });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
app.put('/internal/products/:id', requireInternal, (req, res) => {
  const products = readProducts();
  const index = products.findIndex(item => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Producto no encontrado.' });
  try {
    products[index] = { ...products[index], ...cleanProduct(req.body, products[index]), updatedAt: new Date().toISOString() };
    writeProducts(products);
    res.json({ product: products[index] });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
app.delete('/internal/products/:id', requireInternal, (req, res) => {
  const products = readProducts();
  const index = products.findIndex(item => item.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Producto no encontrado.' });
  products[index].active = false;
  products[index].updatedAt = new Date().toISOString();
  writeProducts(products);
  res.json({ product: products[index], message: 'Producto desactivado.' });
});

app.post('/internal/reserve', requireInternal, (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!items.length || items.length > 30) return res.status(400).json({ error: 'El carrito está vacío o contiene demasiados artículos.' });
  const requested = new Map();
  for (const item of items) {
    const productId = String(item?.productId || '');
    const quantity = Number(item?.quantity);
    if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      return res.status(400).json({ error: 'Hay una cantidad de producto no válida.' });
    }
    requested.set(productId, (requested.get(productId) || 0) + quantity);
  }
  const products = readProducts();
  const lines = [];
  for (const [productId, quantity] of requested) {
    const product = products.find(item => item.id === productId && item.active);
    if (!product) return res.status(404).json({ error: 'Uno de los productos ya no está disponible.' });
    if (product.stock < quantity) return res.status(409).json({ error: `Inventario insuficiente para ${product.name}. Disponibles: ${product.stock}.` });
    lines.push({ productId: product.id, name: product.name, image: product.image, unitPrice: product.price, quantity, subtotal: product.price * quantity });
  }
  for (const line of lines) {
    const product = products.find(item => item.id === line.productId);
    product.stock -= line.quantity;
  }
  writeProducts(products);
  res.json({ items: lines, total: lines.reduce((sum, item) => sum + item.subtotal, 0) });
});

app.post('/internal/restock', requireInternal, (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const products = readProducts();
  for (const item of items) {
    const product = products.find(entry => entry.id === item.productId);
    if (product && Number.isInteger(item.quantity) && item.quantity > 0) product.stock += item.quantity;
  }
  writeProducts(products);
  res.json({ restocked: true });
});

const port = Number(process.env.PORT || 3010);
app.listen(port, '127.0.0.1', () => console.log(`store-service escuchando en ${port}`));