(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../dropdown-utils.js'));
  else root.ResumeQuickFillCascaderAdapter = factory(root.ResumeQuickFillDropdown);
})(typeof window !== 'undefined' ? window : globalThis, function (dropdownTools) {
  'use strict';
  const dropdown = dropdownTools || {};
  const text = (value) => String(value == null ? '' : value).trim();
  const normal = (value) => text(value).replace(/\s+/g, '');
  function parts(value) {
    const raw = text(value);
    const separated = raw.split(/[\/|,，>]/).map(text).filter(Boolean);
    if (separated.length > 1) return separated;
    const compact = raw.replace(/\s+/g, '');
    const result = [];
    let remainder = compact;
    while (remainder) {
      const match = remainder.match(/^(.+?(?:特别行政区|自治区|省|市))/);
      if (!match) break;
      result.push(match[1]);
      remainder = remainder.slice(match[1].length);
    }
    return result;
  }
  function optionsAt(plan, document, level) {
    const context = dropdown.contextFor ? dropdown.contextFor(plan && plan.element, document) : null;
    return dropdown.visibleOptions ? dropdown.visibleOptions(context).filter((node) => text(node.getAttribute && node.getAttribute('data-rqf-cascader-level')) === String(level)) : [];
  }
  function tryFill(plan, document, alreadyOpened = false) {
    if (!plan || !plan.element) return { status: 'UNSUPPORTED_CONTROL', reason: '未找到级联控件' };
    if (!alreadyOpened && typeof plan.element.click === 'function') plan.element.click();
    const location = parts(plan.value); if (!location.length) return { status: 'NEEDS_CONFIRMATION', reason: '地点信息不足' };
    for (let level = 0; level < location.length; level += 1) {
      const candidates = optionsAt(plan, document, level).filter((node) => normal(node.textContent || node.innerText) === normal(location[level]));
      if (candidates.length !== 1) return { status: 'NEEDS_CONFIRMATION', reason: level === 2 ? '区县信息缺失或不唯一' : '省市选项未找到唯一匹配' };
      if (typeof candidates[0].click !== 'function') return { status: 'UNSUPPORTED_CONTROL', reason: '级联选项不可安全操作' };
      candidates[0].click();
    }
    const actual = text(plan.element.value || plan.element.getAttribute && plan.element.getAttribute('aria-valuetext') || plan.element.textContent);
    return dropdown.postFillMatches && dropdown.postFillMatches(actual, [plan.value, location.join('/'), location.join(' ')])
      ? { status: 'SUCCESS', levels: location.length }
      : { status: 'POST_FILL_VALIDATION_FAILED', reason: '网页级联控件未接受已选省市' };
  }
  async function tryFillAsync(plan, document, settings = {}) {
    if (!plan || !plan.element || typeof plan.element.click !== 'function') return { status: 'UNSUPPORTED_CONTROL', reason: '未找到级联控件' };
    plan.element.click();
    const initial = await dropdown.waitForOptions(() => optionsAt(plan, document, 0), { ...settings, observeTarget: settings.observeTarget || document && document.body });
    return initial ? tryFill(plan, document, true) : { status: 'DYNAMIC_RENDER_TIMEOUT', reason: '级联省级选项未在短时间内出现' };
  }
  return { tryFill, tryFillAsync, parts, optionsAt };
});
