(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ResumeQuickFillFrameworkAdapters = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const text = (value) => String(value == null ? '' : value).trim();
  const attr = (node, name) => text(node && node.getAttribute && node.getAttribute(name));
  function componentType(node) { if (attr(node, 'aria-autocomplete')) return 'searchable-select'; if (attr(node, 'role') === 'combobox' || attr(node, 'aria-haspopup') === 'listbox') return 'custom-select'; return 'unsupported'; }
  function adapter(id) { return { id, classify: componentType, matches: (node) => attr(node, 'data-rqf-framework') === id }; }
  const generic = adapter('generic'); const antd = adapter('antd'); const elementPlus = adapter('element-plus');
  function detect(node) { const id = attr(node, 'data-rqf-framework'); return id === 'antd' ? antd : id === 'element-plus' ? elementPlus : generic; }
  return { detect, generic, antd, elementPlus };
});
