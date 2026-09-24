(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../control-adapter.js'), require('../dropdown-utils.js'));
  else root.ResumeQuickFillCustomSelectAdapter = factory(root.ResumeQuickFillControlAdapter, root.ResumeQuickFillDropdown);
})(typeof window !== 'undefined' ? window : globalThis, function (controls, dropdownTools) {
  'use strict';
  const dropdown = dropdownTools || {};
  const text = (value) => String(value == null ? '' : value).trim();
  const attr = (node, name) => text(node && node.getAttribute && node.getAttribute(name));
  const equivalents = (plan) => controls && controls.equivalents ? controls.equivalents(plan.value, plan.semantic) : [plan.value];
  const actualValue = (node) => text(node && (node.value || attr(node, 'aria-valuetext') || attr(node, 'data-rqf-selected') || node.textContent));
  function contextFor(plan, document, before) {
    return dropdown.resolveContext ? dropdown.resolveContext(plan.element, document, before) : { status: 'SUCCESS', context: dropdown.contextFor && dropdown.contextFor(plan.element, document) };
  }
  const optionsFor = (plan, document, before) => {
    const context = contextFor(plan, document, before);
    return { context, options: context.status === 'SUCCESS' && dropdown.visibleOptions ? dropdown.visibleOptions(context.context) : [] };
  };
  function validate(plan, option) {
    const candidates = [...equivalents(plan), option && (option.textContent || option.innerText || option.value), option && option.value];
    return dropdown.postFillMatches && dropdown.postFillMatches(actualValue(plan.element), candidates)
      ? { status: 'SUCCESS', optionText: text(option && (option.textContent || option.innerText)) }
      : { status: 'POST_FILL_VALIDATION_FAILED', reason: '网页下拉控件未接受所选值' };
  }
  function select(plan, options) {
    const match = dropdown.uniqueOption ? dropdown.uniqueOption(options, equivalents(plan)) : { status: 'VALUE_NOT_FOUND' };
    if (match.status !== 'SUCCESS') return { status: match.status, reason: match.status === 'NEEDS_CONFIRMATION' ? '当前下拉存在多个明确匹配选项' : '当前下拉中没有唯一匹配选项' };
    if (typeof match.option.click !== 'function') return { status: 'UNSUPPORTED_CONTROL', reason: '下拉选项不可安全操作' };
    match.option.click(); return validate(plan, match.option);
  }
  function tryFill(plan, document, alreadyOpened = false) {
    if (!plan || !plan.element || typeof plan.element.click !== 'function') return { status: 'UNSUPPORTED_CONTROL', reason: '未找到可操作下拉控件' };
    const before = dropdown.snapshotDropdowns ? dropdown.snapshotDropdowns(document) : [];
    if (!alreadyOpened) plan.element.click(); const result = optionsFor(plan, document, before);
    if (result.context.status === 'NEEDS_CONFIRMATION') return { status: 'NEEDS_CONFIRMATION', reason: '当前控件关联多个下拉弹层' };
    return result.options.length ? select(plan, result.options) : { status: 'DYNAMIC_RENDER_TIMEOUT', reason: '下拉选项未在短时间内出现' };
  }
  async function tryFillAsync(plan, document, settings = {}) {
    if (!plan || !plan.element || typeof plan.element.click !== 'function') return { status: 'UNSUPPORTED_CONTROL', reason: '未找到可操作下拉控件' };
    const before = dropdown.snapshotDropdowns ? dropdown.snapshotDropdowns(document) : [];
    plan.element.click(); let context = null;
    const options = await dropdown.waitForOptions(() => {
      const result = optionsFor(plan, document, before); context = result.context;
      return result.context.status === 'SUCCESS' ? result.options : [];
    }, { ...settings, observeTarget: settings.observeTarget || document && document.body });
    if (context && context.status === 'NEEDS_CONFIRMATION') return { status: 'NEEDS_CONFIRMATION', reason: '当前控件关联多个下拉弹层' };
    return options ? select(plan, options) : { status: 'DYNAMIC_RENDER_TIMEOUT', reason: '下拉选项未在短时间内出现' };
  }
  return { tryFill, tryFillAsync, optionsFor, select, validate };
});
