(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./control-adapter.js'));
  else root.ResumeQuickFillControlDetector = factory(root.ResumeQuickFillControlAdapter);
})(typeof window !== 'undefined' ? window : globalThis, function (controlAdapter) {
  'use strict';
  const text = (value) => String(value == null ? '' : value).trim();
  const attr = (node, name) => text(node && node.getAttribute && node.getAttribute(name));
  const legacyToPublic = {
    select: 'native-select', date: 'date-picker', 'custom-searchable-select': 'searchable-select',
    'province-city-district-cascade': 'cascader', unknown: 'unsupported', 'radio-group': 'radio-group', 'checkbox-group': 'checkbox-group'
  };
  function detect(control) {
    const node = control && control.element || control;
    if (control && control.controlType && legacyToPublic[control.controlType]) return legacyToPublic[control.controlType];
    if (!node) return 'unsupported';
    const type = text(node.type).toLocaleLowerCase();
    if (type === 'file') return 'file-upload';
    if (type === 'month') return 'month-picker';
    const legacy = controlAdapter && controlAdapter.classifyControl ? controlAdapter.classifyControl(control) : 'unknown';
    return legacyToPublic[legacy] || legacy;
  }
  function framework(control) {
    const node = control && control.element || control;
    const explicit = attr(node, 'data-rqf-framework');
    if (explicit === 'antd' || explicit === 'element-plus') return explicit;
    return 'generic';
  }
  return { detect, framework, legacyToPublic };
});
