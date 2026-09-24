(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./control-adapter.js'), require('./form-map.js'), require('./field-category.js'), require('./field-context.js'));
  else root.ResumeQuickFillScanner = factory(root.ResumeQuickFillControlAdapter, root.ResumeQuickFillFormMap, root.ResumeQuickFillFieldCategory, root.ResumeQuickFillFieldContext);
})(typeof window !== 'undefined' ? window : globalThis, function (controlAdapter, formMapTools, fieldCategory, fieldContextTools) {
  'use strict';

  const BANNED = new Set(['password', 'hidden', 'file', 'submit', 'button', 'reset', 'image']);
  const asText = (value) => String(value == null ? '' : value).trim();
  const normalize = (value) => asText(value).toLocaleLowerCase().replace(/[：:（）()【】\[\]{}<>「」“”"'`、，,。；;！!?？\-_]/g, ' ').replace(/\s+/g, ' ').trim();

  function textOf(node) { return asText(node && (node.innerText || node.textContent || node.value)); }
  function attr(node, name) { return asText(node && node.getAttribute && node.getAttribute(name)); }
  function closestText(node, selector) { const found = node && node.closest && node.closest(selector); return textOf(found); }
  function fieldLabelText(node) {
    const directText = node && node.childNodes && containsFormControl(node)
      ? Array.from(node.childNodes).filter((child) => child && child.nodeType === 3).map((child) => asText(child.textContent)).join(' ')
      : textOf(node);
    return directText.replace(/[＊*]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  }
  function isCustomSelectEvidence(node) {
    const role = attr(node, 'role');
    const className = classText(node);
    const hasPopup = attr(node, 'aria-haspopup') === 'listbox';
    const hasRelation = Boolean(attr(node, 'aria-controls') || attr(node, 'aria-owns'));
    const expanded = attr(node, 'aria-expanded');
    const selectClass = /(?:^|[\s_-])(?:select|dropdown|combobox)(?:$|[\s_-])/i.test(className);
    return role === 'combobox' || hasPopup || (expanded && (hasRelation || selectClass)) || (hasRelation && selectClass);
  }
  function classText(node) { return `${asText(node && node.className)} ${attr(node, 'data-form-item')} ${attr(node, 'data-field-label')}`; }
  function isFieldContainer(node) { return /(?:^|[\s_-])(?:form|field|control)(?:[\s_-]?(?:item|group|row))|(?:^|[\s_-])(?:el|ant)-form-item|formitem/i.test(classText(node)); }
  function isFieldLabel(node) {
    const source = `${asText(node && node.tagName)} ${classText(node)} ${attr(node, 'role')}`;
    return /\bLABEL\b|(?:^|[\s_-])(?:form|field|control)-?label|\blabel\b/i.test(source);
  }
  function directChildFor(container, node) {
    let current = node;
    while (current && current.parentElement && current.parentElement !== container) current = current.parentElement;
    return current && current.parentElement === container ? current : null;
  }
  function containsFormControl(node) {
    if (!node) return false;
    const tag = asText(node.tagName).toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || attr(node, 'role') === 'combobox') return true;
    if (typeof node.querySelector === 'function' && node.querySelector('input, textarea, select, [role="combobox"]')) return true;
    return Array.from(node.children || []).some(containsFormControl);
  }
  function optionEvidenceFor(node) {
    const options = node && node.options ? Array.from(node.options) : node && node.querySelectorAll ? Array.from(node.querySelectorAll('option, [role="option"]')) : [];
    return { count: options.length, samples: options.slice(0, 3).map((option) => asText(option.textContent || option.label || option.value)).filter(Boolean).map((value) => value.slice(0, 40)) };
  }
  function labelCandidate(container, branch, doc) {
    const siblings = Array.from((container && container.children) || []);
    const controlBranches = siblings.filter(containsFormControl);
    if (controlBranches.length !== 1 || controlBranches[0] !== branch) return { rejectedReason: 'MULTIPLE_CONTROL_BRANCHES' };
    const candidates = siblings.filter((candidate) => candidate !== branch && !containsFormControl(candidate) && isVisible(candidate, doc)).map((candidate) => ({ node: candidate, raw: textOf(candidate), label: fieldLabelText(candidate) })).filter((candidate) => candidate.label && candidate.label.length <= 40 && !/[\r\n]/.test(candidate.raw) && !/(?:请选择|请输入|帮助|提示|说明|错误|必填)/.test(candidate.label));
    if (candidates.length !== 1) return { rejectedReason: candidates.length ? 'MULTIPLE_LABEL_CANDIDATES' : 'NO_LABEL_CANDIDATE' };
    const candidate = candidates[0];
    const semanticClass = /(?:^|[\s_-])(?:label|caption|title|fieldname|field-name|field_name)(?:$|[\s_-])/i.test(classText(candidate.node));
    const requiredCaption = /[＊*]\s*$/.test(candidate.raw);
    // Plain Grid/Flex columns are accepted only inside the smallest known
    // field row, with exactly one label branch and one control branch.
    if (!semanticClass && !requiredCaption && !isFieldContainer(container)) return { rejectedReason: 'ROW_NOT_TRUSTED' };
    return { label: candidate.label, source: 'sibling-field-label' };
  }
  function nearbyFieldLabel(node, doc) {
    let container = node && node.parentElement;
    // Ant Design's visible combobox is nested below the form-item wrapper:
    // select -> children -> control -> wrapper -> form-item.  Keep the
    // search bounded, but include that final form-item ancestor.
    let rejectedReason = 'NO_LABEL_CANDIDATE';
    for (let depth = 0; container && depth < 5; depth += 1, container = container.parentElement) {
      const branch = directChildFor(container, node);
      if (isFieldContainer(container)) {
        const labels = Array.from(container.children || []).filter((child) => child !== branch && isFieldLabel(child)).map(fieldLabelText).filter(Boolean);
        if (labels.length === 1) return { label: labels[0], source: 'current-form-item-title' };
      }
      const structural = labelCandidate(container, branch, doc);
      if (structural && structural.label) return structural;
      if (structural && structural.rejectedReason) rejectedReason = structural.rejectedReason;
    }
    return { label: '', source: 'none', rejectedReason: container ? 'ANCESTOR_DEPTH_LIMIT' : rejectedReason };
  }
  function isVisible(node, doc) {
    if (!node || node.hidden || attr(node, 'aria-hidden') === 'true') return false;
    if (typeof node.getClientRects === 'function' && !node.getClientRects().length) return false;
    const view = doc && doc.defaultView;
    if (view && typeof view.getComputedStyle === 'function') {
      const style = view.getComputedStyle(node);
      if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
    }
    return true;
  }
  function complexReason(node) {
    const clue = `${asText(node && node.name)} ${asText(node && node.placeholder)} ${attr(node, 'aria-label')}`;
    if (node && node.isContentEditable && node.closest && node.closest('[data-lexical-editor], [data-slate-editor], .ql-editor')) return '复杂富文本编辑器需要手动确认';
    const complex = attr(node, 'data-rqf-complex') === 'true' || isCustomSelectEvidence(node);
    if (!complex) return '';
    if (/城市|地区|省|市|区|city|location/i.test(clue)) return '城市/地区选择器需要手动确认';
    if (/日期|时间|date|time/i.test(clue)) return '日期控件需要手动确认';
    return '复杂控件需要手动确认';
  }  function isWritable(node, doc) {
    if (!node || node.disabled || node.readOnly || !isVisible(node, doc)) return false;
    if (node.closest && node.closest('#resume-quick-fill-host')) return false;
    if (node.isContentEditable || isCustomSelectEvidence(node)) return true;
    const tag = asText(node.tagName).toUpperCase();
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return tag === 'INPUT' && !BANNED.has(asText(node.type || 'text').toLocaleLowerCase());
  }
  function labelEvidenceFor(node, doc) {
    if (node && node.labels) {
      const label = [...node.labels].map(fieldLabelText).find(Boolean);
      if (label) return { label, source: 'label-for' };
    }
    const labelledBy = attr(node, 'aria-labelledby');
    if (labelledBy && doc && typeof doc.getElementById === 'function') {
      const label = labelledBy.split(/\s+/).filter(Boolean).map((reference) => fieldLabelText(doc.getElementById(reference))).filter(Boolean).join(' ');
      if (label) return { label, source: 'aria-labelledby' };
    }
    const id = asText(node && node.id);
    if (id && doc && typeof doc.querySelector === 'function') {
      const label = doc.querySelector(`label[for="${id.replace(/"/g, '\\"')}"]`);
      if (label && fieldLabelText(label)) return { label: fieldLabelText(label), source: 'label-for' };
    }
    const enclosing = fieldLabelText(node && node.closest && node.closest('label'));
    if (enclosing) return { label: enclosing, source: 'label-for' };
    const aria = attr(node, 'aria-label');
    if (aria) return { label: aria, source: 'aria-label' };
    return nearbyFieldLabel(node, doc) || { label: '', source: 'none', rejectedReason: 'NO_LABEL_CANDIDATE' };
  }
  function labelsFor(node, doc) {
    return labelEvidenceFor(node, doc).label;
  }
  function semanticClassHints(node) {
    return asText(node && node.className).split(/\s+/).filter((value) => /(?:field|form|control|label|row|grid|flex|group)/i.test(value)).slice(0, 6);
  }
  function debugLabelStructure(node) {
    const ancestors = [];
    let container = node && node.parentElement;
    for (let depth = 0; container && depth < 5; depth += 1, container = container.parentElement) {
      const siblings = Array.from(container.children || []);
      const branch = directChildFor(container, node);
      const shortLabels = siblings.filter((candidate) => candidate !== branch && !containsFormControl(candidate)).map(fieldLabelText).filter((value) => value && value.length <= 40 && !/(?:请选择|请输入|帮助|提示|说明|错误)/.test(value));
      ancestors.push({ depth, tag: asText(container.tagName).toUpperCase(), classHints: semanticClassHints(container), branchIndex: siblings.indexOf(branch), siblingCount: siblings.length, shortLabels });
    }
    return { control: { tag: asText(node && node.tagName).toUpperCase(), role: attr(node, 'role'), ariaLabelledby: attr(node, 'aria-labelledby'), ariaLabel: attr(node, 'aria-label'), classHints: semanticClassHints(node) }, ancestors };
  }
  function contextFor(node) {
    const fieldset = node && node.closest && node.closest('fieldset');
    const legend = fieldset && fieldset.querySelector && fieldset.querySelector('legend');
    const section = closestText(node, '[data-resume-section]');
    const nearby = node && node.parentElement && !containsFormControl(node.parentElement) ? textOf(node.parentElement) : '';
    const value = `${textOf(legend) || textOf(fieldset)} ${section} ${nearby}`;
    if (/项目/.test(value)) return 'project';
    if (/工作|实习|任职/.test(value)) return 'experience';
    if (/教育|学历|学校|院校/.test(value)) return 'education';
    if (/求职|应聘|意向|岗位/.test(value)) return 'job';
    if (/基本|个人|联系/.test(value)) return 'basic';
    return 'unknown';
  }
  function repeatGroupFor(node) {
    const fieldset = node && node.closest && node.closest('fieldset');
    const label = `${textOf(fieldset)} ${closestText(node, '[data-resume-section]')}`;
    const kind = /项目/.test(label) ? 'project' : /工作|实习|任职/.test(label) ? 'experience' : /教育|学历|学校|院校/.test(label) ? 'education' : '';
    const sequence = label.match(/(?:第\s*)?(\d+)\s*(?:段|条|项|经历)?/);
    return kind ? { kind, index: sequence ? Math.max(0, Number(sequence[1]) - 1) : null } : null;
  }
  function controlEvidence(node, doc) {
    const labelEvidence = labelEvidenceFor(node, doc);
    const label = labelEvidence.label;
    const aria = attr(node, 'aria-label');
    const placeholder = asText(node && node.placeholder);
    const name = asText(node && node.name); const id = asText(node && node.id); const title = attr(node, 'title');
    const attributes = [name, id, title].filter(Boolean).join(' ');
    const nearby = node && node.parentElement && !containsFormControl(node.parentElement) ? textOf(node.parentElement) : '';
    const legend = closestText(node, 'fieldset');
    const sectionText = `${legend} ${closestText(node, '[data-resume-section]')}`.trim();
    const context = contextFor(node);
    const nameIdEvidence = [name, id].filter(Boolean);
    const fieldContext = fieldContextTools && fieldContextTools.create ? fieldContextTools.create({ labelText: label, placeholder, name, id, ariaLabel: aria, title, nearbyText: nearby, sectionText, inputType: asText(node && node.type) || asText(node && node.tagName) }) : null;
    const evidence = { label, labelSource: labelEvidence.source, labelRejectedReason: labelEvidence.rejectedReason || '', nameIdEvidence, aria, placeholder, controlHint: placeholder, attributes, nearby, legend, sectionText, fieldContext, context, repeatGroup: repeatGroupFor(node), optionEvidence: optionEvidenceFor(node), text: normalize([label, aria, placeholder, attributes, nearby, legend].join(' ')) };
    if (typeof globalThis !== 'undefined' && globalThis.__RESUME_QUICK_FILL_DEBUG__ === true) evidence.labelDebug = debugLabelStructure(node);
    return evidence;
  }
  function groupOwnerFor(node, doc) {
    const roleGroup = node && node.closest && (node.closest('[role="radiogroup"]') || node.closest('fieldset'));
    if (roleGroup) return roleGroup;
    const trusted = trustedRowFor(node, doc); if (trusted) return trusted;
    const parent = node && node.parentElement;
    const siblings = Array.from(parent && parent.children || []);
    return siblings.filter((candidate) => asText(candidate && candidate.tagName).toUpperCase() === 'INPUT' && asText(candidate.type).toLocaleLowerCase() === asText(node.type).toLocaleLowerCase()).length > 1 ? parent : null;
  }
  function groupKey(node, index, kind, doc, ownerIds) { const owner = groupOwnerFor(node, doc); if (owner) { if (!ownerIds.has(owner)) ownerIds.set(owner, `${kind}:owner:${ownerIds.size + 1}`); return ownerIds.get(owner); } return asText(node.name) ? `${kind}:name:${node.name}` : `${kind}:index:${index}`; }
  function groupEvidence(group, doc) {
    const evidence = controlEvidence(group.elements[0], doc);
    const rowEvidence = labelEvidenceFor(group.elements[0], doc);
    if (rowEvidence.label) { evidence.label = rowEvidence.label; evidence.labelSource = rowEvidence.source; }
    const samples = group.elements.map((node) => asText(node.value || attr(node, 'aria-label') || (node.labels && node.labels[0] && node.labels[0].textContent))).filter(Boolean).slice(0, 3);
    evidence.optionEvidence = { count: group.elements.length, samples };
    evidence.text = normalize([evidence.label, evidence.aria, evidence.attributes].join(' '));
    return evidence;
  }
  function trustedRowFor(node, doc) { let container = node && node.parentElement; for (let depth = 0; container && depth < 5; depth += 1, container = container.parentElement) { const branch = directChildFor(container, node); const candidate = labelCandidate(container, branch, doc); if (isFieldContainer(container) && candidate && candidate.label) return container; } return null; }
  function uploadOwnerFor(node) { let parent = node && node.parentElement; for (let depth = 0; parent && depth < 2; depth += 1, parent = parent.parentElement) { const candidates = Array.from(parent.children || []); if (candidates.some((candidate) => asText(candidate && candidate.tagName).toUpperCase() === 'INPUT' && (asText(candidate.type).toLocaleLowerCase() === 'file' || /(?:上传|选择).*(?:文件|附件)|(?:upload|choose).*(?:file|attachment)/i.test(asText(candidate.placeholder))))) return parent; } return null; }
  function formFor(node) { return node && node.closest ? node.closest('form') : null; }
  function applicationRootFor(nodes) {
    const scores = new Map();
    (nodes || []).forEach((node) => { const form = formFor(node); if (!form) return; const clue = `${asText(node.type)} ${asText(node.name)} ${asText(node.placeholder)}`.toLocaleLowerCase(); const score = (scores.get(form) || 0) + (asText(node.type).toLocaleLowerCase() === 'file' ? 10 : /name|email|phone|resume|cv|申请|职位/.test(clue) ? 1 : 0); scores.set(form, score); });
    let selected = null; let best = 0; scores.forEach((score, form) => { if (score > best) { best = score; selected = form; } });
    return best >= 2 ? selected : null;
  }
  function utilityHidden(node) { if (!node || typeof node.getBoundingClientRect !== 'function') return false; const rect = node.getBoundingClientRect(); return rect && rect.width <= 1 && rect.height <= 1; }
  function assignCategory(record, applicationRoot) { record.outsideApplicationRoot = Boolean(applicationRoot && formFor(record.element) !== applicationRoot); record.applicationAssociation = record.outsideApplicationRoot ? 'outside' : 'inside-or-unknown'; record.utilityHidden = utilityHidden(record.element) && !asText(record.evidence && (record.evidence.label || record.evidence.aria || record.evidence.placeholder)); record.fieldCategory = fieldCategory && fieldCategory.classify ? fieldCategory.classify(record) : 'UNKNOWN_APPLICATION'; return record; }
  function scanDocument(doc) {
    const nodes = doc && typeof doc.querySelectorAll === 'function' ? [...doc.querySelectorAll('input, textarea, select, [contenteditable="true"], [role="combobox"], [aria-haspopup="listbox"], [aria-expanded][aria-controls], [aria-expanded][aria-owns], [data-rqf-control]')] : [];
    const applicationRoot = applicationRootFor(nodes); const radios = new Map(); const checkboxes = new Map(); const radioOwners = new Map(); const checkboxOwners = new Map();
    const controls = []; const skipped = []; const manualControls = []; const uploads = new Map(); const uploadOwners = new WeakMap(); let uploadSequence = 0;
    const uploadKey = (node, index) => { const owner = uploadOwnerFor(node); if (!owner) return `upload-${index}`; if (!uploadOwners.has(owner)) uploadOwners.set(owner, `upload-owner-${++uploadSequence}`); return uploadOwners.get(owner); };
    nodes.forEach((node, index) => {
      const primary = controlAdapter && controlAdapter.primaryElement ? controlAdapter.primaryElement(node) : node;
      // Prefer the semantic combobox wrapper as the actionable control, while
      // retaining its inner input only as evidence/internal structure.
      if (primary === node && nodes.some((candidate) => candidate !== node && controlAdapter && controlAdapter.primaryElement && controlAdapter.primaryElement(candidate) === node)) return;
      const initialType = controlAdapter && controlAdapter.classifyControl ? controlAdapter.classifyControl({ element: primary || node }) : 'unknown';
      if (initialType === 'file-upload' || initialType === 'file-upload-proxy') { const key = uploadKey(node, index); const group = uploads.get(key) || { elements: [] }; group.elements.push(node); uploads.set(key, group); return; }
      if (!isVisible(node, doc)) return;
      const reason = complexReason(node);
      if (reason) {
        const record = { element: primary || node, elements: [node], internalControls: primary && primary !== node ? [node] : [], reason, evidence: controlEvidence(node, doc), controlType: controlAdapter && controlAdapter.classifyControl ? controlAdapter.classifyControl({ element: primary || node }) : 'unknown' };
        record.controlFamily = controlAdapter && controlAdapter.controlFamily ? controlAdapter.controlFamily(record.controlType) : 'UNKNOWN';
        assignCategory(record, applicationRoot); skipped.push(record); manualControls.push(record); return;
      }
      if (!isWritable(node, doc)) return;
      const inputType = asText(node.type).toLocaleLowerCase();
      if (inputType === 'radio' || inputType === 'checkbox') {
        const groups = inputType === 'radio' ? radios : checkboxes; const ownerIds = inputType === 'radio' ? radioOwners : checkboxOwners; const key = groupKey(node, index, inputType, doc, ownerIds);
        const current = groups.get(key);
        if (current) current.elements.push(node);
        else groups.set(key, { element: node, elements: [node], tag: 'INPUT', type: inputType, formItemOwner: trustedRowFor(node, doc), evidence: controlEvidence(node, doc) });
        return;
      }
      const record = { element: primary || node, elements: [node], internalControls: primary && primary !== node ? [node] : [], formItemOwner: trustedRowFor(node, doc), tag: asText(node.tagName).toUpperCase(), type: inputType, evidence: controlEvidence(node, doc) };
      record.controlType = controlAdapter && controlAdapter.classifyControl ? controlAdapter.classifyControl(record) : 'unknown'; record.controlFamily = controlAdapter && controlAdapter.controlFamily ? controlAdapter.controlFamily(record.controlType) : 'UNKNOWN'; assignCategory(record, applicationRoot); controls.push(record);
    });
    [[radios, 'radio-group'], [checkboxes, 'checkbox-group']].forEach(([groups, type]) => groups.forEach((group) => { group.evidence = groupEvidence(group, doc); group.controlType = type; group.controlFamily = type === 'radio-group' ? 'RADIO' : 'CHECKBOX'; assignCategory(group, applicationRoot); controls.push(group); }));
    uploads.forEach((group) => { const file = group.elements.find((node) => asText(node.type).toLocaleLowerCase() === 'file'); const primary = file || group.elements[0]; const record = { element: primary, elements: file ? [file, ...group.elements.filter((node) => node !== file)] : group.elements, internalControls: file ? group.elements.filter((node) => node !== file) : [], formItemOwner: trustedRowFor(primary, doc), evidence: controlEvidence(primary, doc), controlType: file ? 'file-upload' : 'file-upload-proxy', controlFamily: 'FILE_UPLOAD', recognizedControl: true, autoFillSupported: false, reason: '上传文件需手动处理', status: 'MANUAL_FILE_UPLOAD' }; assignCategory(record, applicationRoot); controls.push(record); });
    const formMap = formMapTools && typeof formMapTools.build === 'function'
      ? formMapTools.build({ url: asText(doc && doc.location && doc.location.href), controls: [...controls, ...manualControls] }) : null;
    if (typeof globalThis !== 'undefined' && globalThis.__RESUME_QUICK_FILL_DEBUG__ === true) { const summary = {}; [...controls, ...manualControls].forEach((record) => { if (record.evidence && record.evidence.labelDebug) console.info('[ResumeQuickFill][LabelAssociation]', record.evidence.labelDebug); const reason = record.evidence && record.evidence.labelRejectedReason; if (reason) summary[reason] = (summary[reason] || 0) + 1; }); console.info('[ResumeQuickFill][LabelAssociationSummary]', summary); }
    return { controls, skipped, manualControls, formMap };
  }

  return { normalize, isVisible, isWritable, controlEvidence, repeatGroupFor, debugLabelStructure, scanDocument };
});
