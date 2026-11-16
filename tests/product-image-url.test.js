import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const helperSource = readFileSync(
  new URL('../assets/js/product-image-url.js', import.meta.url),
  'utf8'
);

function loadSafeProductImageUrl() {
  const window = { location: { origin: 'https://bunkergym.test' } };
  vm.runInNewContext(helperSource, { window, URL });
  return window.safeProductImageUrl;
}

test('acepta recursos locales dentro de /assets/', () => {
  const safeProductImageUrl = loadSafeProductImageUrl();
  assert.equal(
    safeProductImageUrl('/assets/products/shirt.svg'),
    'https://bunkergym.test/assets/products/shirt.svg'
  );
});

test('resuelve rutas relativas contra el origen local', () => {
  const safeProductImageUrl = loadSafeProductImageUrl();
  assert.equal(
    safeProductImageUrl('assets/products/shirt.svg'),
    'https://bunkergym.test/assets/products/shirt.svg'
  );
});

test('acepta imágenes remotas servidas por HTTPS', () => {
  const safeProductImageUrl = loadSafeProductImageUrl();
  assert.equal(
    safeProductImageUrl('https://cdn.example.com/product.png'),
    'https://cdn.example.com/product.png'
  );
});

test('rechaza imágenes remotas servidas por HTTP', () => {
  const safeProductImageUrl = loadSafeProductImageUrl();
  assert.equal(
    safeProductImageUrl('http://cdn.example.com/product.png'),
    '/assets/products/shirt.svg'
  );
});

test('rechaza URL HTTPS que incluyen credenciales', () => {
  const safeProductImageUrl = loadSafeProductImageUrl();
  assert.equal(
    safeProductImageUrl('https://user:secret@cdn.example.com/product.png'),
    '/assets/products/shirt.svg'
  );
});

test('rechaza rutas locales fuera del directorio permitido', () => {
  const safeProductImageUrl = loadSafeProductImageUrl();
  assert.equal(
    safeProductImageUrl('/private/product.png'),
    '/assets/products/shirt.svg'
  );
});

test('usa la imagen predeterminada para entradas no válidas o demasiado largas', () => {
  const safeProductImageUrl = loadSafeProductImageUrl();
  assert.equal(safeProductImageUrl(null), '/assets/products/shirt.svg');
  assert.equal(safeProductImageUrl(42), '/assets/products/shirt.svg');
  assert.equal(safeProductImageUrl('x'.repeat(2049)), '/assets/products/shirt.svg');
});

test('rechaza protocolos no destinados a imágenes web', () => {
  const safeProductImageUrl = loadSafeProductImageUrl();
  assert.equal(
    safeProductImageUrl('javascript:alert(1)'),
    '/assets/products/shirt.svg'
  );
});
