import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.window = { location: { origin: 'https://bunkergym.test' } };
await import('../assets/js/product-image-url.js');

const safeProductImageUrl = globalThis.window.safeProductImageUrl;
const cases = [
  ['acepta recursos locales dentro de /assets/', '/assets/products/shirt.svg', 'https://bunkergym.test/assets/products/shirt.svg'],
  ['resuelve rutas relativas contra el origen local', 'assets/products/shirt.svg', 'https://bunkergym.test/assets/products/shirt.svg'],
  ['acepta imágenes remotas servidas por HTTPS', 'https://cdn.example.com/product.png', 'https://cdn.example.com/product.png'],
  ['acepta URL HTTPS del mismo origen fuera de /assets/', '/private/product.png', 'https://bunkergym.test/private/product.png'],
  ['rechaza imágenes remotas servidas por HTTP', 'http://cdn.example.com/product.png', '/assets/products/shirt.svg'],
  ['rechaza URL HTTPS que incluyen credenciales', 'https://user:secret@cdn.example.com/product.png', '/assets/products/shirt.svg'],
  ['rechaza protocolos no destinados a imágenes web', 'javascript:alert(1)', '/assets/products/shirt.svg']
];

for (const [name, input, expected] of cases) {
  test(name, () => assert.equal(safeProductImageUrl(input), expected));
}

test('usa la imagen predeterminada para entradas inválidas o demasiado largas', () => {
  for (const value of [null, 42, 'x'.repeat(2049)]) {
    assert.equal(safeProductImageUrl(value), '/assets/products/shirt.svg');
  }
});
