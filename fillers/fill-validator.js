(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./value-normalizer.js'), require('./control-adapter.js'));
  else root.ResumeQuickFillValidator = factory(root.ResumeQuickFillValue, root.ResumeQuickFillControlAdapter);
})(typeof window !== 'undefined' ? window : globalThis, function (values, controlAdapter) {
  'use strict';
  const text = (value) => String(value == null ? '' : value).trim();
  const comparable = values && values.normalizedComparable || ((value) => text(value).toLocaleLowerCase());
  function read(element) { return element && element.isContentEditable ? text(element.textContent) : element ? text(element.value) : ''; }
  function invalid(element) { if (text(element && element.getAttribute && element.getAttribute('aria-invalid')) === 'true') return true; const region = element && element.closest && element.closest('fieldset, [role="group"], [data-form-item], [data-field]'); if (!region) return false; if (text(region.getAttribute && region.getAttribute('aria-invalid')) === 'true') return true; return Boolean(region.querySelector && region.querySelector('[aria-invalid="true"], [role="alert"], [data-rqf-error="true"]')); }
  function equivalent(plan, actual) { const candidates = controlAdapter && controlAdapter.equivalents ? controlAdapter.equivalents(plan.value, plan.semantic) : [plan.value]; return candidates.some((candidate) => comparable(candidate) === comparable(actual)); }
  function validate(plan) { if (!plan || !plan.element) return { status: 'UNSUPPORTED_CONTROL', reason: '未找到填写控件' }; const actual = read(plan.element); if (!actual) return { status: 'FILLED_UNCONFIRMED', reason: '网页未提供可读取的填写结果' }; if (invalid(plan.element)) return { status: 'FILLED_UNCONFIRMED', actual, reason: '当前字段仍处于校验错误状态' }; return equivalent(plan, actual) ? { status: 'FILLED_VERIFIED', actual } : { status: 'VALUE_MISMATCH', actual, reason: '网页显示值与计划值不一致' }; }
  return { read, validate };
});
