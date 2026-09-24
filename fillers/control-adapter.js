(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./value-normalizer.js'), require('./dropdown-utils.js'));
  else root.ResumeQuickFillControlAdapter = factory(root.ResumeQuickFillValue, root.ResumeQuickFillDropdown);
})(typeof window !== 'undefined' ? window : globalThis, function (valueTools, dropdownTools) {
  'use strict';
  const values = valueTools || {};
  const dropdown = dropdownTools || {};
  const asText = (value) => String(value == null ? '' : value).trim();
  const normalize = values.normalizeText || ((value) => asText(value).toLocaleLowerCase());
  const attr = (node, name) => asText(node && node.getAttribute && node.getAttribute(name));
  const yes = new Set(['是', 'yes', 'y', 'true', '1', '同意', '接受']);
  const no = new Set(['否', 'no', 'n', 'false', '0', '不同意', '不接受']);
  const genders = { '男': ['男', '男性', 'male', 'm', '1'], '女': ['女', '女性', 'female', 'f', '0'] };
  const degrees = { '本科': ['本科', '大学本科', '本科生', 'bachelor', 'undergraduate'], '硕士': ['硕士', '研究生', 'master'], '博士': ['博士', 'doctor', 'phd'], '大专': ['大专', '专科', 'associate'] };

  function hasCompositeSignal(node) { return node && (attr(node, 'role') === 'combobox' || attr(node, 'aria-haspopup') === 'listbox' || attr(node, 'aria-controls') || attr(node, 'aria-owns') || attr(node, 'data-rqf-control')); }
  function childSignal(node) { return Array.from(node && node.children || []).find((child) => hasCompositeSignal(child) || attr(child, 'aria-haspopup') === 'dialog' || /日历|calendar|date/i.test(`${attr(child, 'aria-label')} ${attr(child, 'title')}`)) || null; }
  function compositeOwner(node) {
    if (!node) return null;
    if (hasCompositeSignal(node)) return node;
    const direct = node.closest && node.closest('[role="combobox"], [aria-haspopup="listbox"], [aria-controls], [aria-owns], [data-rqf-control]'); if (direct) return direct;
    let parent = node.parentElement;
    for (let depth = 0; parent && depth < 3; depth += 1, parent = parent.parentElement) if (hasCompositeSignal(parent) || childSignal(parent)) return parent;
    return null;
  }

  function classifyControl(control) {
    const node = control && control.element || control; if (!node) return 'unknown';
    const owner = compositeOwner(node) || node;
    const trigger = childSignal(owner);
    const clue = `${asText(node.name)} ${asText(node.placeholder)} ${attr(node, 'aria-label')} ${asText(owner.name)} ${asText(owner.placeholder)} ${attr(owner, 'aria-label')}`;
    const role = attr(owner, 'role');
    const hinted = attr(owner, 'data-rqf-control');
    const className = `${asText(owner.className)} ${hinted}`;
    const hasPopup = attr(owner, 'aria-haspopup') === 'listbox' || attr(trigger, 'aria-haspopup') === 'listbox';
    const hasRelation = Boolean(attr(owner, 'aria-controls') || attr(owner, 'aria-owns') || attr(trigger, 'aria-controls') || attr(trigger, 'aria-owns'));
    const expanded = attr(owner, 'aria-expanded');
    const selectClass = /(?:^|[\s_-])(?:select|dropdown|combobox)(?:$|[\s_-])/i.test(className);
    const dateHint = hinted === 'date-picker' || attr(node, 'type') === 'date' || attr(node, 'type') === 'month' || attr(owner, 'aria-haspopup') === 'dialog' || Boolean(trigger && (attr(trigger, 'aria-haspopup') === 'dialog' || /日历|calendar|date/i.test(`${attr(trigger, 'aria-label')} ${attr(trigger, 'title')}`)));
    if (dateHint) return 'date-picker';
    if (hinted === 'custom-select' || hinted === 'autocomplete') return hinted;
    if (hinted === 'radio-dropdown') return 'custom-select';
    if (hinted === 'cascader') return 'province-city-district-cascade';
    if (role === 'combobox' && /省市区|省.*市|城市|地区/.test(clue)) return 'province-city-district-cascade';
    if (attr(node, 'aria-autocomplete')) return 'custom-searchable-select';
    if (role === 'combobox') return 'custom-select';
    if (hasPopup || (expanded && (hasRelation || selectClass)) || (hasRelation && selectClass)) return 'custom-select';
    if (node.isContentEditable) return 'contenteditable';
    const tag = asText(node.tagName).toUpperCase(); const type = asText(node.type).toLocaleLowerCase();
    if (tag === 'INPUT' && type === 'file') return 'file-upload';
    if (tag === 'INPUT' && /(?:上传|选择).*(?:文件|附件)|(?:upload|choose).*(?:file|attachment)/i.test(asText(node.placeholder))) return 'file-upload-proxy';
    if (tag === 'TEXTAREA') return 'textarea'; if (tag === 'SELECT') return 'select';
    if (type === 'radio') return 'radio'; if (type === 'checkbox') return 'checkbox';
    if (type === 'date' || type === 'month') return 'date'; if (tag === 'INPUT') return 'text-input';
    return 'unknown';
  }
  function controlFamily(type) {
    return ({ 'text-input': 'TEXT', textarea: 'TEXTAREA', select: 'SELECT', radio: 'RADIO', checkbox: 'CHECKBOX', date: 'DATE', contenteditable: 'CONTENTEDITABLE', 'custom-select': 'CUSTOM_SELECT', 'custom-searchable-select': 'SEARCHABLE_SELECT', 'province-city-district-cascade': 'CASCADER', autocomplete: 'AUTOCOMPLETE', 'date-picker': 'DATE_PICKER', 'file-upload': 'FILE_UPLOAD', 'file-upload-proxy': 'FILE_UPLOAD', unknown: 'UNKNOWN' })[type] || 'UNKNOWN';
  }
  function equivalents(value, semantic) {
    const raw = asText(value); const normalized = normalize(raw);
    if (semantic === 'gender') return Object.entries(genders).find(([, list]) => list.some((item) => normalize(item) === normalized))?.[1] || [raw];
    if (semantic === 'degree') return Object.entries(degrees).find(([, list]) => list.some((item) => normalize(item) === normalized))?.[1] || [raw];
    if (semantic === 'acceptsTransfer') return yes.has(normalized) ? [...yes] : no.has(normalized) ? [...no] : [raw];
    return [raw];
  }
  function optionFor(select, value, semantic, adapter) {
    const choices = equivalents(value, semantic).map(normalize);
    const options = [...(select.options || [])];
    return dropdown.uniqueOption ? dropdown.uniqueOption(options, choices) : { status: 'VALUE_NOT_FOUND', option: null };
  }
  function radioChoice(plan) {
    const choices = equivalents(plan.value, plan.semantic).map(normalize);
    return (plan.elements || [plan.element]).find((node) => choices.includes(normalize(node.value)) || choices.includes(normalize(attr(node, 'aria-label'))) || choices.includes(normalize(node.labels && node.labels[0] && node.labels[0].textContent))) || null;
  }
  function dispatch(node, type) {
    if (!node || typeof node.dispatchEvent !== 'function') return;
    const EventCtor = node.ownerDocument && node.ownerDocument.defaultView && node.ownerDocument.defaultView.Event || (typeof Event === 'function' ? Event : null);
    node.dispatchEvent(EventCtor ? new EventCtor(type, { bubbles: true }) : { type, bubbles: true });
  }
  function writePlan(plan, adapter) {
    const type = classifyControl(plan); const node = plan.element;
    if (type === 'custom-searchable-select' || type === 'province-city-district-cascade' || type === 'file-upload' || type === 'file-upload-proxy' || type === 'unknown') throw new Error('复杂控件需要手动确认');
    if (type === 'contenteditable') { node.textContent = asText(plan.value); dispatch(node, 'input'); dispatch(node, 'change'); dispatch(node, 'blur'); return { ok: asText(node.textContent) === asText(plan.value), controlType: type }; }
    if (type === 'radio' || type === 'radio-group') { const choice = radioChoice(plan); if (!choice) throw new Error('单选项中没有明确匹配'); choice.checked = true; dispatch(choice, 'input'); dispatch(choice, 'change'); dispatch(choice, 'blur'); return { ok: Boolean(choice.checked), controlType: type }; }
    if (type === 'checkbox') { const choice = equivalents(plan.value, plan.semantic); if (!choice.length || (plan.semantic !== 'acceptsTransfer' && !/^(是|否|yes|no|y|n|true|false|1|0|同意|不同意|接受|不接受)$/i.test(asText(plan.value)))) throw new Error('复选控件需要明确选项，已跳过'); node.checked = yes.has(normalize(plan.value)); dispatch(node, 'input'); dispatch(node, 'change'); dispatch(node, 'blur'); return { ok: Boolean(node.checked) === yes.has(normalize(plan.value)), controlType: type }; }
    if (type === 'select') {
      const match = optionFor(node, plan.value, plan.semantic, adapter);
      if (match.status === 'NEEDS_CONFIRMATION') return { ok: false, status: 'NEEDS_CONFIRMATION', reason: '下拉框存在多个明确匹配选项', controlType: type };
      if (!match.option) return { ok: false, status: 'VALUE_NOT_FOUND', reason: '下拉框中没有唯一匹配选项', controlType: type };
      const result = adapter.writeTextValue(node, match.option.value);
      const candidates = [...equivalents(plan.value, plan.semantic), match.option.value, match.option.text];
      const actual = [...(node.options || [])].find((option) => String(option.value) === String(node.value)) || { value: node.value, text: node.value };
      const accepted = dropdown.postFillMatches ? dropdown.postFillMatches(actual.text || actual.value, candidates) : result.ok;
      return accepted ? { ok: Boolean(result.ok), controlType: type } : { ok: false, status: 'POST_FILL_VALIDATION_FAILED', reason: '网页下拉框未接受预期值', controlType: type };
    }
    if (type === 'date' && plan.semantic === 'dateRange' && new Set(asText(plan.value).match(/(19|20)\d{2}/g) || []).size > 1) throw new Error('日期范围需要手动确认');
    const value = type === 'date' ? (values.normalizeDate ? values.normalizeDate(plan.value, node.type) : asText(plan.value)) : asText(plan.value);
    if (/^(至今|现在|present)$/i.test(value) && type === 'date') throw new Error('日期控件需要手动确认');
    const result = adapter.writeTextValue(node, value); return { ok: result.ok, controlType: type };
  }
  function primaryElement(control) { const node = control && control.element || control; return compositeOwner(node) || node || null; }
  return { classifyControl, primaryElement, controlFamily, equivalents, optionFor, radioChoice, writePlan };
});
