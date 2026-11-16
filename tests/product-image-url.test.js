import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.window = {
  location: { origin: 'https://bunkergym.test' }
};
await import('../assets/js/product-image-url.js');
const safeProductImageUrl = globalThis.window.safeProductImageUrl;

test('acepta recursos locales dentro de /assets/', () => {
  assert.equal(
    safeProductImageUrl('/assets/products/shirt.svg'),
    'https://bunkergym.test/assets/products/shirt.svg'
  );
});

test('resuelve rutas relativas contra el origen local', () => {
  assert.equal(
    safeProductImageUrl('assets/products/shirt.svg'),
    'https://bunkergym.test/assets/products/shirt.svg'
  );
});

test('acepta imágenes remotas servidas por HTTPS', () => {
  assert.equal(
    safeProductImageUrl('https://cdn.example.com/product.png'),
    'https://cdn.example.com/product.png'
  );
});

test('acepta URL HTTPS del mismo origen aunque no esté bajo /assets/', () => {
  assert.equal(
    safeProductImageUrl('/private/product.png'),
    'https://bunkergym.test/private/product.png'
  );
});

test('rechaza imágenes remotas servidas por HTTP', () => {
  assert.equal(
    safeProductImageUrl('http://cdn.example.com/product.png'),
    '/assets/products/shirt.svg'
  );
});

test('rechaza URL HTTPS que incluyen credenciales', () => {
  assert.equal(
    safeProductImageUrl('https://user:secret@cdn.example.com/product.png'),
    '/assets/products/shirt.svg'
  );
});

test('usa la imagen predeterminada para entradas no válidas o demasiado largas', () => {
  assert.equal(safeProductImageUrl(null), '/assets/products/shirt.svg');
  assert.equal(safeProductImageUrl(42), '/assets/products/shirt.svg');
  assert.equal(safeProductImageUrl('x'.repeat(2049)), '/assets/products/shirt.svg');
});

test('rechaza protocolos no destinados a imágenes web', () => {
  assert.equal(
    safeProductImageUrl('javascript:alert(1)'),
    '/assets/products/shirt.svg'
  );
});
