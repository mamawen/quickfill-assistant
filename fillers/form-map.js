(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./control-detector.js'));
  else root.ResumeQuickFillFormMap = factory(root.ResumeQuickFillControlDetector);
})(typeof window !== 'undefined' ? window : globalThis, function (detector) {
  'use strict';
  const text = (value) => String(value == null ? '' : value).trim();
  const sectionTypes = { basic: 'basicInfo', education: 'education', experience: 'workExperience', project: 'projectExperience', skills: 'skills', other: 'other' };
  function evidenceFor(control) {
    const evidence = control.evidence || {};
    const sourceMap = [[text(evidence.labelSource) || 'label', evidence.label], ['aria-label', evidence.aria], ['placeholder', evidence.placeholder], ['name', text(control.element && control.element.name)], ['id', text(control.element && control.element.id)], ['fieldset/legend', evidence.legend], ['short row title', evidence.nearby]];
    return {
      label: text(evidence.label), labelSource: text(evidence.labelSource) || 'none', ariaLabel: text(evidence.aria), placeholder: text(evidence.placeholder),
      name: text(control.element && control.element.name), id: text(control.element && control.element.id), nameIdEvidence: [text(control.element && control.element.name), text(control.element && control.element.id)].filter(Boolean), controlHint: text(evidence.controlHint || evidence.placeholder),
      fieldsetLegend: text(evidence.legend), shortRowTitle: text(evidence.nearby), sectionTitle: text(evidence.context), fieldContext: evidence.fieldContext || null, optionEvidence: evidence.optionEvidence || { count: 0, samples: [] },
      relationship: control.elements && control.elements.length > 1 ? 'grouped-controls' : '',
      sources: sourceMap.filter(([, value]) => text(value)).map(([source]) => source),
    };
  }
  function sectionFor(control) {
    const evidence = control.evidence || {};
    const repeat = evidence.repeatGroup || null;
    const context = repeat && repeat.kind || evidence.context || 'unknown';
    return { type: sectionTypes[context] || 'unknown', repeatIndex: repeat && Number.isInteger(repeat.index) ? repeat.index : null };
  }
  function labelFor(control) {
    const evidence = control.evidence || {};
    return text(evidence.label || evidence.aria);
  }
  function build(input = {}) {
    const sections = []; const index = new Map(); const ownerIds = new WeakMap(); let ownerSequence = 0;
    (input.controls || []).forEach((control, position) => {
      const section = sectionFor(control); const key = `${section.type}:${section.repeatIndex == null ? '' : section.repeatIndex}`;
      let target = index.get(key);
      if (!target) { target = { id: `section-${sections.length + 1}`, type: section.type, repeatIndex: section.repeatIndex, items: [] }; index.set(key, target); sections.push(target); }
      const evidence = evidenceFor(control); const label = labelFor(control); const owner = control.formItemOwner; let ownerKey = '';
      if (owner && typeof owner === 'object') { if (!ownerIds.has(owner)) ownerIds.set(owner, `owner-${++ownerSequence}`); ownerKey = ownerIds.get(owner); }
      const addressKey = /^mailing(?:province|city|district)$|^(?:postaddr|mailingdetailaddress)$/i.test(evidence.nameIdEvidence.join(' ')) ? 'mailing-address' : '';
      const itemKey = `${ownerKey || addressKey || label || `unlabeled-${position}`}:${section.type}:${section.repeatIndex == null ? '' : section.repeatIndex}`;
      let item = target.items.find((candidate) => candidate._key === itemKey);
      const created = !item;
      if (!item) { item = { _key: itemKey, id: `item-${target.items.length + 1}-${position + 1}`, label, required: /[＊*]\s*$/.test(label), sectionType: section.type, repeatIndex: section.repeatIndex, controls: [], evidence, confidence: evidence.sources.length ? Math.min(1, evidence.sources.length / 3) : 0, domRef: control.element || null }; target.items.push(item); }
      item.controls.push({ element: control.element || null, elements: control.elements || [control.element], internalControls: control.internalControls || [], evidence, type: detector && detector.detect ? detector.detect(control) : control.controlType || 'unsupported', legacyType: control.controlType || '', fieldCategory: control.fieldCategory || 'UNKNOWN_APPLICATION', outsideApplicationRoot: Boolean(control.outsideApplicationRoot), framework: detector && detector.framework ? detector.framework(control) : 'generic' });
      evidence.sources.forEach((source) => { if (!item.evidence.sources.includes(source)) item.evidence.sources.push(source); });
      if (!created && evidence.optionEvidence.count) { const prior = item.evidence.optionEvidence || { count: 0, samples: [] }; item.evidence.optionEvidence = { count: prior.count + evidence.optionEvidence.count, samples: [...prior.samples, ...evidence.optionEvidence.samples].slice(0, 3) }; }
    });
    function addressRole(control) { const source = `${text(control.element && control.element.name)} ${text(control.element && control.element.id)} ${text(control.element && control.element.placeholder)}`.toLocaleLowerCase(); if (/mailingprovince|province|省/.test(source)) return 'province'; if (/mailingcity|city|市/.test(source)) return 'city'; if (/mailingdistrict|district|county|区|县/.test(source)) return 'district'; if (/postaddr|mailingdetailaddress|detail|详细|地址/.test(source)) return 'detail'; return ''; }
    sections.forEach((section) => section.items.forEach((item) => { if (section.type === 'education' && /学习时间|就读时间|教育时间/.test(item.label) && item.controls.length === 2 && item.controls.every((control) => ['date-picker', 'month-picker'].includes(control.type))) { item.semanticGroup = 'educationPeriod'; item.controls[0].role = 'startDate'; item.controls[1].role = 'endDate'; } const roles = item.controls.map(addressRole); const explicitMailing = item.controls.every((control) => /^mailing(?:province|city|district)$|^(?:postaddr|mailingdetailaddress)$/i.test((control.evidence && control.evidence.nameIdEvidence || []).join(' '))); if ((item.label.includes('地址') || explicitMailing) && roles.length >= 3 && roles.every(Boolean) && new Set(roles).size === roles.length && roles.includes('province') && roles.includes('city')) { item.semanticGroup = explicitMailing ? 'mailingAddress' : 'address'; item.controls.forEach((control, index) => { control.role = roles[index]; }); } delete item._key; }));
    return { url: text(input.url), createdAt: input.createdAt || new Date().toISOString(), sections };
  }
  function controls(formMap) { return (formMap && formMap.sections || []).flatMap((section) => section.items.flatMap((item) => item.controls.map((control) => ({ element: control.element, elements: control.elements, controlType: control.legacyType || control.type, detectedControlType: control.type, fieldCategory: control.fieldCategory || 'UNKNOWN_APPLICATION', outsideApplicationRoot: Boolean(control.outsideApplicationRoot), evidence: { ...item.evidence, ...(control.evidence || {}), label: item.label, context: section.type === 'basicInfo' ? 'basic' : section.type === 'workExperience' ? 'experience' : section.type === 'projectExperience' ? 'project' : section.type, repeatGroup: section.repeatIndex == null ? null : { kind: section.type === 'workExperience' ? 'experience' : section.type === 'projectExperience' ? 'project' : section.type, index: section.repeatIndex } } })))); }
  function createCache() { let value = null; let dirty = true; return { get: () => value, set: (map) => { value = map; dirty = false; return map; }, isDirty: () => dirty, markDirty: (mutation) => { const target = mutation && mutation.target; if (target && target.closest && target.closest('#resume-quick-fill-host')) return false; dirty = true; return true; }, invalidate: () => { dirty = true; } }; }
  return { build, controls, createCache, evidenceFor };
});
