// Valida las URL de imágenes de productos para la tienda pública y el panel administrativo.
(function (global) {
  'use strict';

  global.safeProductImageUrl = function safeProductImageUrl(value) {
    const fallback = '/assets/products/shirt.svg';
    if (typeof value !== 'string' || value.length > 2048) return fallback;
    try {
      const parsed = new URL(value, global.location.origin);
      const isLocalAsset = parsed.origin === global.location.origin && parsed.pathname.startsWith('/assets/');
      const isSecureRemoteImage = parsed.protocol === 'https:' && !parsed.username && !parsed.password;
      return isLocalAsset || isSecureRemoteImage ? parsed.href : fallback;
    } catch {
      return fallback;
    }
  };
})(window);
