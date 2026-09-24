(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ResumeQuickFillDynamicFormMap = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  function observe(document, cache, options = {}) {
    const Observer = options.MutationObserver || (typeof MutationObserver === 'function' ? MutationObserver : null);
    if (!document || !document.body || !Observer || !cache || typeof cache.markDirty !== 'function') return { disconnect() {} };
    let timer = null;
    const root = document.documentElement || document.body;
    const observer = new Observer((mutations) => { if (timer) return; timer = setTimeout(() => { timer = null; const changed = (mutations || []).some((mutation) => cache.markDirty(mutation)); if (changed && typeof options.onDirty === 'function') options.onDirty(mutations || []); }, Number(options.debounceMs || 80)); });
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-expanded', 'aria-controls', 'aria-owns', 'hidden'] });
    return { disconnect() { if (timer) clearTimeout(timer); observer.disconnect(); } };
  }
  return { observe };
});
