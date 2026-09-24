(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./generic-adapter.js'));
  else root.ResumeQuickFillSiteAdapters = factory(root.ResumeQuickFillGenericSiteAdapter);
})(typeof window !== 'undefined' ? window : globalThis, function (generic) {
  'use strict';
  function context(input = {}) { const location = input.location || {}; return { hostname: String(location.hostname || ''), pathname: String(location.pathname || ''), document: input.document || null }; }
  function createRegistry(adapters = []) {
    const candidates = [...adapters];
    return { detect(input) { const page = context(input); return candidates.find((adapter) => adapter && typeof adapter.matches === 'function' && adapter.matches(page)) || generic; }, adapters: candidates };
  }
  const defaultRegistry = createRegistry();
  return { createRegistry, detect: defaultRegistry.detect, generic };
});
