(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../control-adapter.js'), require('../dropdown-utils.js'));
  else root.ResumeQuickFillSearchableSelectAdapter = factory(root.ResumeQuickFillControlAdapter, root.ResumeQuickFillDropdown);
})(typeof window !== 'undefined' ? window : globalThis, function (controlAdapter, dropdownTools) {
  'use strict';
  const dropdown = dropdownTools || {};
  const text = (value) => String(value == null ? '' : value).trim();
  const normal = (value) => text(value).replace(/\s+/g, '').toLocaleLowerCase();
  function visibleOptions(plan, document) {
    return dropdown.visibleOptions ? dropdown.visibleOptions(dropdown.contextFor(plan && plan.element, document)) : [];
  }
  function searchInput(plan, document) {
    const context = dropdown.contextFor && dropdown.contextFor(plan && plan.element, document);
    return context && typeof context.querySelector === 'function'
      ? context.querySelector('[data-rqf-search-input="true"], input[role="searchbox"], input[aria-autocomplete="list"], input[type="search"]')
      : null;
  }
  function dispatch(node, type) {
    if (!node || typeof node.dispatchEvent !== 'function') return;
    const EventCtor = node.ownerDocument && node.ownerDocument.defaultView && node.ownerDocument.defaultView.Event || (typeof Event === 'function' ? Event : null);
    node.dispatchEvent(EventCtor ? new EventCtor(type, { bubbles: true }) : { type, bubbles: true });
  }
  function tryFill(plan, document, alreadyPrepared = false) {
    if (!plan || !plan.element) return { status: 'UNSUPPORTED_CONTROL', reason: '未找到可搜索下拉控件' };
    if (typeof plan.element.click !== 'function') return { status: 'UNSUPPORTED_CONTROL', reason: '下拉控件不可安全操作' };
    if (!alreadyPrepared) plan.element.click();
    const input = searchInput(plan, document);
    if (!input) return { status: 'UNSUPPORTED_CONTROL', reason: '未找到下拉搜索输入框' };
    if (!alreadyPrepared) { if (typeof input.focus === 'function') input.focus(); input.value = text(plan.value); dispatch(input, 'input'); dispatch(input, 'change'); }
    const equivalents = controlAdapter && controlAdapter.equivalents ? controlAdapter.equivalents(plan.value, plan.semantic) : [plan.value];
    const match = dropdown.uniqueOption ? dropdown.uniqueOption(visibleOptions(plan, document), equivalents) : { status: 'VALUE_NOT_FOUND' };
    if (match.status !== 'SUCCESS') return { status: match.status, reason: match.status === 'NEEDS_CONFIRMATION' ? '搜索结果存在多个明确匹配选项' : '搜索结果中没有唯一匹配选项' };
    if (typeof match.option.click !== 'function') return { status: 'UNSUPPORTED_CONTROL', reason: '搜索结果不可安全操作' };
    match.option.click();
    const actual = text(plan.element && (plan.element.value || plan.element.getAttribute && plan.element.getAttribute('aria-valuetext') || plan.element.textContent));
    const candidates = [...equivalents, match.option.textContent || match.option.innerText, match.option.value];
    return dropdown.postFillMatches && dropdown.postFillMatches(actual, candidates)
      ? { status: 'SUCCESS', matchedText: text(match.option.textContent || match.option.innerText) }
      : { status: 'POST_FILL_VALIDATION_FAILED', reason: '网页搜索下拉未接受所选值' };
  }
  async function tryFillAsync(plan, document, settings = {}) {
    if (!plan || !plan.element || typeof plan.element.click !== 'function') return { status: 'UNSUPPORTED_CONTROL', reason: '未找到可搜索下拉控件' };
    plan.element.click(); const input = searchInput(plan, document);
    if (!input) return { status: 'DYNAMIC_RENDER_TIMEOUT', reason: '下拉搜索输入框未在短时间内出现' };
    if (typeof input.focus === 'function') input.focus(); input.value = text(plan.value); dispatch(input, 'input'); dispatch(input, 'change');
    const options = await dropdown.waitForOptions(() => visibleOptions(plan, document), { ...settings, observeTarget: settings.observeTarget || document && document.body });
    if (!options) return { status: 'DYNAMIC_RENDER_TIMEOUT', reason: '搜索候选未在短时间内出现' };
    return tryFill(plan, document, true);
  }
  return { tryFill, tryFillAsync, visibleOptions, searchInput };
});
