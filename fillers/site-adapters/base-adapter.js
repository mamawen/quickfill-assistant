(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ResumeQuickFillBaseSiteAdapter = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  function createBaseAdapter(config = {}) {
    return { id: config.id || 'base', matches: config.matches || (() => false), scan: config.scan || (() => null), resolveControl: config.resolveControl || ((control) => control), tryFill: config.tryFill || null, tryFillAsync: config.tryFillAsync || null };
  }
  return { createBaseAdapter };
});
