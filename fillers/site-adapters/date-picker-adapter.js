(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../dropdown-utils.js'));
  else root.ResumeQuickFillDatePickerAdapter = factory(root.ResumeQuickFillDropdown);
})(typeof window !== 'undefined' ? window : globalThis, function (dropdownTools) {
  'use strict';
  const dropdown = dropdownTools || {};
  const text = (value) => String(value == null ? '' : value).trim();
  const normal = (value) => text(value).replace(/[\s./年月日-]/g, '');
  function variants(value) {
    const match = text(value).match(/^(\d{4})[-/.年](\d{1,2})(?:[-/.月](\d{1,2}))?/);
    if (!match) return [text(value)];
    const [, year, month, day] = match; const paddedMonth = month.padStart(2, '0'); const paddedDay = day && day.padStart(2, '0');
    return day ? [`${year}-${paddedMonth}-${paddedDay}`, `${year}/${paddedMonth}/${paddedDay}`, `${year}.${paddedMonth}.${paddedDay}`, `${year}年${Number(month)}月${Number(day)}日`] : [`${year}-${paddedMonth}`, `${year}/${paddedMonth}`, `${year}.${paddedMonth}`, `${year}年${Number(month)}月`];
  }
  function tryFill(plan, document, alreadyOpened = false) {
    if (!plan || !plan.element || typeof plan.element.click !== 'function') return { status: 'UNSUPPORTED_CONTROL', reason: '日期组件不可安全操作' };
    if (!alreadyOpened) plan.element.click();
    const options = dropdown.visibleOptions ? dropdown.visibleOptions(dropdown.contextFor(plan.element, document)) : [];
    if (!options.length) return { status: 'DYNAMIC_RENDER_TIMEOUT', reason: '日期选项未在短时间内出现' };
    const wanted = new Set(variants(plan.value).map(normal));
    const matches = options.filter((option) => wanted.has(normal(option && (option.textContent || option.innerText || option.value))));
    const match = matches.length === 1 ? { status: 'SUCCESS', option: matches[0] } : matches.length ? { status: 'NEEDS_CONFIRMATION' } : { status: 'VALUE_NOT_FOUND' };
    if (match.status !== 'SUCCESS') return { status: match.status, reason: match.status === 'NEEDS_CONFIRMATION' ? '日期组件存在多个明确匹配日期' : '日期组件中没有唯一匹配日期' };
    if (typeof match.option.click !== 'function') return { status: 'UNSUPPORTED_CONTROL', reason: '日期选项不可安全操作' };
    match.option.click();
    const actual = text(plan.element.value || plan.element.getAttribute && plan.element.getAttribute('aria-valuetext') || plan.element.textContent);
    return dropdown.postFillMatches && dropdown.postFillMatches(actual, [...variants(plan.value), match.option.textContent || match.option.innerText, match.option.value])
      ? { status: 'SUCCESS', matchedText: text(match.option.textContent || match.option.innerText) }
      : { status: 'POST_FILL_VALIDATION_FAILED', reason: '网页日期控件未接受所选日期' };
  }
  async function tryFillAsync(plan, document, settings = {}) {
    if (!plan || !plan.element || typeof plan.element.click !== 'function') return { status: 'UNSUPPORTED_CONTROL', reason: '日期组件不可安全操作' };
    plan.element.click();
    const options = await dropdown.waitForOptions(() => dropdown.visibleOptions(dropdown.contextFor(plan.element, document)), { ...settings, observeTarget: settings.observeTarget || document && document.body });
    return options ? tryFill(plan, document, true) : { status: 'DYNAMIC_RENDER_TIMEOUT', reason: '日期选项未在短时间内出现' };
  }
  return { tryFill, tryFillAsync, variants };
});
