(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./standard-resume.js'));
  else root.ResumeQuickFillUI = factory(root.ResumeQuickFillStandardResume);
})(typeof window !== 'undefined' ? window : globalThis, function (standardResume) {
  'use strict';

  function asText(value) { return String(value == null ? '' : value); }
  const standard = standardResume || { isStandardResume: () => false, labels: {} };

  function fieldEntries(fields) {
    if (Array.isArray(fields)) {
      return fields.flatMap((item) => fieldEntries(item));
    }
    if (!fields || typeof fields !== 'object') return [];
    return Object.entries(fields).map(([key, value]) => ({ key, value: asText(value) }));
  }

  function sectionKind(group) {
    const name = asText(group);
    if (/项目/.test(name)) return 'projects';
    if (/工作|实习/.test(name)) return 'experience';
    if (/教育|学历|本科|硕士|博士/.test(name)) return 'education';
    if (/技能|证书/.test(name)) return 'skills';
    if (/基本|个人/.test(name)) return 'basic';
    return 'other';
  }

  function buildResumeSections(groupedData) {
    if (standard.isStandardResume(groupedData)) return buildStandardSections(groupedData);
    const sections = { basic: [], education: [], experience: [], projects: [], skills: [], other: [] };
    Object.entries(groupedData || {}).forEach(([group, fields]) => {
      const card = { group, kind: sectionKind(group), fields: fieldEntries(fields) };
      if (card.fields.length) sections[card.kind].push(card);
    });
    return sections;
  }

  function standardFields(object, labels) { return Object.entries(object || {}).map(([key, value]) => { const rendered = Array.isArray(value) ? value.join('、') : asText(value); return { key: labels[key] || key, value: rendered, empty: !rendered.trim() }; }); }
  function cards(items, group, kind, labels) { return (items || []).map((item, index) => ({ group: `${group}${index + 1}`, kind, fields: standardFields(item, labels) })); }
  function buildStandardSections(resume) {
    const labelGroups = standard.labels || {}; const labelsFor = (group) => labelGroups[group] || {};
    const sections = { basic: [{ group: '基本信息', kind: 'basic', fields: standardFields(resume.basic, labelsFor('basic')) }], job: [{ group: '求职信息', kind: 'job', fields: standardFields(resume.job, labelsFor('job')) }], education: cards(resume.education, '教育经历', 'education', labelsFor('education')), experience: cards(resume.work, '工作经历', 'experience', labelsFor('work')), work: [], projects: cards(resume.projects, '项目经历', 'projects', labelsFor('projects')), campus: cards(resume.campus, '校园经历', 'campus', labelsFor('campus')), skills: [], awards: cards(resume.awards, '奖励与荣誉', 'awards', {}), family: cards(resume.family, '家庭成员', 'family', {}), other: [{ group: '其他信息', kind: 'other', fields: standardFields(resume.other, labelsFor('other')) }] };
    sections.work = sections.experience;
    sections.skills = [{ group: '证书与技能', kind: 'skills', fields: standardFields(resume.certificatesSkills, {}) }];
    return sections;
  }

  function searchResume(groupedData, query) {
    const keyword = asText(query).trim().toLocaleLowerCase();
    if (!keyword) return [];
    const matches = [];
    if (standard.isStandardResume(groupedData)) {
      const sections = buildStandardSections(groupedData); ['basic', 'job', 'education', 'experience', 'projects', 'campus', 'skills', 'awards', 'family', 'other'].flatMap((kind) => sections[kind] || []).forEach((card) => card.fields.filter((field) => !field.empty).forEach((field) => { if (`${card.group} ${field.key} ${field.value}`.toLocaleLowerCase().includes(keyword)) matches.push({ group: card.group, kind: card.kind, ...field }); }));
      return matches;
    }
    Object.entries(groupedData || {}).forEach(([group, fields]) => {
      fieldEntries(fields).forEach((field) => {
        if (`${group} ${field.key} ${field.value}`.toLocaleLowerCase().includes(keyword)) {
          matches.push({ group, kind: sectionKind(group), ...field });
        }
      });
    });
    return matches;
  }

  function createUiState(resume) {
    return { view: 'home', search: '', resume: resume || null, activeField: null, toast: null, panelOpen: true };
  }

  function setView(state, view) {
    if (!['home', 'resume', 'settings'].includes(view)) throw new Error('Unsupported view');
    state.view = view;
    return state;
  }

  function counts(groupedData) {
    const sections = buildResumeSections(groupedData);
    const countFields = (cards) => (cards || []).reduce((sum, card) => sum + card.fields.filter((field) => !field.empty && asText(field.value).trim()).length, 0);
    return {
      fields: countFields(Object.values(sections).flat()),
      basic: countFields(sections.basic),
      education: sections.education.length,
      experience: sections.experience.length,
      work: sections.experience.length,
      projects: sections.projects.length,
    };
  }

  return { asText, fieldEntries, sectionKind, buildResumeSections, searchResume, createUiState, setView, counts };
});
