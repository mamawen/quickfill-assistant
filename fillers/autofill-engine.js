(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../field-adapter.js'), require('./value-normalizer.js'), require('./control-adapter.js'), require('./site-adapters/generic-adapter.js'), require('./fill-validator.js'));
  else root.ResumeQuickFillAutofill = factory(root.ResumeQuickFillField, root.ResumeQuickFillValue, root.ResumeQuickFillControlAdapter, root.ResumeQuickFillGenericSiteAdapter, root.ResumeQuickFillValidator);
})(typeof window !== 'undefined' ? window : globalThis, function (defaultAdapter, values, controlAdapter, genericSiteAdapter, validator) {
  'use strict';

  const asText = (value) => String(value == null ? '' : value);
  const normalize = values && values.normalizedComparable || ((value) => asText(value).trim().toLocaleLowerCase());
  function dispatch(target, type) { if (target && typeof target.dispatchEvent === 'function') { const EventCtor = target.ownerDocument?.defaultView?.Event || (typeof Event === 'function' ? Event : null); target.dispatchEvent(EventCtor ? new EventCtor(type, { bubbles: true }) : { type, bubbles: true }); } }
  function currentValue(target) { return target && target.isContentEditable ? asText(target.textContent) : target && (target.type === 'checkbox' || target.type === 'radio') ? Boolean(target.checked) : asText(target && target.value); }
  function isEmpty(plan) { if (plan.semantic === 'gender' && plan.elements) return !plan.elements.some((item) => item.checked); const current = currentValue(plan.element); return typeof current === 'boolean' ? !current : !String(current).trim(); }
  function snapshot(plan) { return (plan.elements || [plan.element]).map((element) => ({ element, value: asText(element.value), checked: Boolean(element.checked), text: asText(element.textContent), editable: Boolean(element.isContentEditable) })); }
  function writePlan(plan, adapter) {
    if (!controlAdapter || typeof controlAdapter.writePlan !== 'function') throw new Error('控件填写适配器未加载');
    return controlAdapter.writePlan(plan, adapter);
  }
  function isComplex(plan) {
    return ['custom-select', 'custom-searchable-select', 'province-city-district-cascade', 'cascader', 'autocomplete', 'date-picker'].includes(plan && plan.controlType);
  }
  function record(plan, status, reason) { return { ...plan, status, result: status, reason: reason || '' }; }
  function executePlans(plans, options = {}) {
    const adapter = options.adapter || defaultAdapter; const filled = [], skipped = [], manual = [], undoBatch = [];
    (plans || []).forEach((plan) => {
      if (!plan || !plan.element || !adapter || !adapter.isSupportedTarget(plan.element)) { skipped.push(record(plan, 'UNSUPPORTED_CONTROL', '当前控件不支持填写')); return; }
      if (!options.allowOverwrite && !isEmpty(plan)) { skipped.push(record(plan, 'SKIPPED_EXISTING', '当前字段已有内容')); return; }
      if (isComplex(plan)) {
        const siteAdapter = options.siteAdapter || genericSiteAdapter;
        const outcome = siteAdapter && typeof siteAdapter.tryFill === 'function' ? siteAdapter.tryFill(plan, options.document || plan.element.ownerDocument) : { status: 'UNSUPPORTED_CONTROL', reason: '站点适配器未加载' };
        if (outcome.status === 'SUCCESS') { const verified = validator && validator.validate ? validator.validate(plan) : { status: 'FILLED_UNCONFIRMED' }; if (verified.status === 'FILLED_VERIFIED') filled.push({ ...record(plan, 'SUCCESS', outcome.reason), fillStatus: verified.status }); else manual.push({ ...record(plan, verified.status === 'VALUE_MISMATCH' ? 'VALUE_MISMATCH' : 'NEEDS_CONFIRMATION', verified.reason || outcome.reason), fillStatus: verified.status }); }
        else manual.push(record(plan, outcome.status || 'NEEDS_CONFIRMATION', outcome.reason || '需要人工确认'));
        return;
      }
      const before = snapshot(plan);
      try {
        const outcome = writePlan(plan, adapter);
        if (!outcome.ok) { manual.push(record(plan, outcome.status || 'POST_FILL_VALIDATION_FAILED', outcome.reason || '网页未接受该值')); return; }
        undoBatch.push(before); const verified = validator && validator.validate ? validator.validate(plan) : { status: 'FILLED_UNCONFIRMED' }; filled.push({ ...record(plan, 'SUCCESS'), fillStatus: verified.status, validationReason: verified.reason || '' });
      }
      catch (error) { manual.push(record(plan, /没有明确匹配|需要手动确认/.test(error && error.message || '') ? 'NEEDS_CONFIRMATION' : 'POST_FILL_VALIDATION_FAILED', error && error.message || '需要手动确认')); }
    });
    return { filled, skipped, manual, undoBatch };
  }
  async function executePlansAsync(plans, options = {}) {
    const adapter = options.adapter || defaultAdapter; const filled = [], skipped = [], manual = [], undoBatch = [];
    for (const plan of (plans || [])) {
      if (!plan || !plan.element || !adapter || !adapter.isSupportedTarget(plan.element)) { skipped.push(record(plan, 'UNSUPPORTED_CONTROL', '当前控件不支持填写')); continue; }
      if (!options.allowOverwrite && !isEmpty(plan)) { skipped.push(record(plan, 'SKIPPED_EXISTING', '当前字段已有内容')); continue; }
      if (isComplex(plan)) {
        const siteAdapter = options.siteAdapter || genericSiteAdapter;
        const outcome = siteAdapter && typeof siteAdapter.tryFillAsync === 'function'
          ? await siteAdapter.tryFillAsync(plan, options.document || plan.element.ownerDocument, options.dropdownOptions || {})
          : siteAdapter && typeof siteAdapter.tryFill === 'function' ? siteAdapter.tryFill(plan, options.document || plan.element.ownerDocument) : { status: 'UNSUPPORTED_CONTROL', reason: '站点适配器未加载' };
        if (outcome.status === 'SUCCESS') { const verified = validator && validator.validate ? validator.validate(plan) : { status: 'FILLED_UNCONFIRMED' }; if (verified.status === 'FILLED_VERIFIED') filled.push({ ...record(plan, 'SUCCESS', outcome.reason), fillStatus: verified.status }); else manual.push({ ...record(plan, verified.status === 'VALUE_MISMATCH' ? 'VALUE_MISMATCH' : 'NEEDS_CONFIRMATION', verified.reason || outcome.reason), fillStatus: verified.status }); }
        else manual.push(record(plan, outcome.status || 'NEEDS_CONFIRMATION', outcome.reason || '需要人工确认'));
        continue;
      }
      const before = snapshot(plan);
      try {
        const outcome = writePlan(plan, adapter);
        if (!outcome.ok) { manual.push(record(plan, outcome.status || 'POST_FILL_VALIDATION_FAILED', outcome.reason || '网页未接受该值')); continue; }
        undoBatch.push(before); const verified = validator && validator.validate ? validator.validate(plan) : { status: 'FILLED_UNCONFIRMED' }; filled.push({ ...record(plan, 'SUCCESS'), fillStatus: verified.status, validationReason: verified.reason || '' });
      } catch (error) { manual.push(record(plan, /没有明确匹配|需要手动确认/.test(error && error.message || '') ? 'NEEDS_CONFIRMATION' : 'POST_FILL_VALIDATION_FAILED', error && error.message || '需要手动确认')); }
    }
    return { filled, skipped, manual, undoBatch };
  }
  function undoBatch(batch, options = {}) {
    const adapter = options.adapter || defaultAdapter;
    (batch || []).slice().reverse().forEach((snapshots) => snapshots.forEach((item) => {
      if (!item.element) return;
      if (item.editable) { item.element.textContent = item.text; dispatch(item.element, 'input'); dispatch(item.element, 'change'); }
      else if (item.element.type === 'checkbox' || item.element.type === 'radio') { item.element.checked = item.checked; dispatch(item.element, 'input'); dispatch(item.element, 'change'); }
      else adapter.writeTextValue(item.element, item.value);
    }));
  }
  return { executePlans, executePlansAsync, undoBatch };
});
