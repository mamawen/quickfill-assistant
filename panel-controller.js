(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ResumeQuickFillPanelController = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  function createPanelController(initialOpen) {
    let open = Boolean(initialOpen);
    return {
      isOpen: () => open,
      toggle: () => { open = !open; return open; },
      close: () => { open = false; return open; },
    };
  }
  return { createPanelController };
});
