(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ResumeQuickFillField = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const BANNED = new Set(['password', 'hidden', 'file', 'submit', 'button', 'reset', 'image']);
  const text = (value) => String(value == null ? '' : value);
  const attr = (target, name) => text(target && target.getAttribute && target.getAttribute(name)).trim();
  function isExplicitCustomSelect(target) {
    const role = attr(target, 'role');
    const className = `${text(target && target.className)} ${attr(target, 'data-rqf-control')}`;
    const hasPopup = attr(target, 'aria-haspopup') === 'listbox';
    const hasRelation = Boolean(attr(target, 'aria-controls') || attr(target, 'aria-owns'));
    const expanded = attr(target, 'aria-expanded');
    const selectClass = /(?:^|[\s_-])(?:select|dropdown|combobox)(?:$|[\s_-])/i.test(className);
    return role === 'combobox' || hasPopup || (expanded && (hasRelation || selectClass)) || (hasRelation && selectClass);
  }

  function isSupportedTarget(target) {
    if (!target) return false;
    if (target.isContentEditable || isExplicitCustomSelect(target)) return true;
    const tag = String(target.tagName || '').toUpperCase();
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (tag !== 'INPUT') return false;
    return !BANNED.has(String(target.type || 'text').toLowerCase());
  }

  function targetLabel(target) {
    return target ? (target.getAttribute?.('aria-label') || target.placeholder || target.name || target.id || '当前字段') : '请先点击网页中的输入框';
  }

  function findSelectOption(options, value) {
    const wanted = text(value).trim().toLocaleLowerCase();
    return [...(options || [])].find((option) => text(option.value).toLocaleLowerCase() === wanted || text(option.text).trim().toLocaleLowerCase() === wanted) || null;
  }

  function dispatch(target, type) {
    if (typeof target.dispatchEvent === 'function') {
      const EventCtor = target.ownerDocument?.defaultView?.Event || (typeof Event === 'function' ? Event : null);
      target.dispatchEvent(EventCtor ? new EventCtor(type, { bubbles: true }) : { type, bubbles: true });
    }
  }

  function writeTextValue(target, value) {
    if (!target) return { ok: false, reason: '请先点击网页中的输入框。' };
    if (!isSupportedTarget(target)) return { ok: false, reason: '当前控件不支持填写。' };
    const oldValue = target.value;
    const tag = String(target.tagName || '').toUpperCase();
    const view = target.ownerDocument?.defaultView;
    const proto = tag === 'TEXTAREA' ? view?.HTMLTextAreaElement?.prototype : tag === 'SELECT' ? view?.HTMLSelectElement?.prototype : view?.HTMLInputElement?.prototype;
    const setter = proto && Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(target, text(value));
    else target.value = text(value);
    dispatch(target, 'input');
    dispatch(target, 'change');
    dispatch(target, 'blur');
    return { ok: text(target.value) === text(value), oldValue, value: target.value };
  }

  return { isSupportedTarget, targetLabel, findSelectOption, writeTextValue };
});
