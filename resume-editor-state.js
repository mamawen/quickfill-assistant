(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./standard-resume.js'));
  else root.ResumeQuickFillEditorState = factory(root.ResumeQuickFillStandardResume);
})(typeof window !== 'undefined' ? window : globalThis, function (standardResume) {
  'use strict';

  const standard = standardResume || {};
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const text = (value) => String(value == null ? '' : value);
  const pathParts = (path) => String(path || '').replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);

  function readTarget(resume, path, create) {
    const parts = pathParts(path);
    if (!parts.length) throw new Error('编辑路径不能为空');
    let target = resume;
    for (let index = 0; index < parts.length - 1; index += 1) {
      const key = parts[index];
      if (target[key] == null && create) target[key] = /^\d+$/.test(parts[index + 1]) ? [] : {};
      target = target[key];
      if (target == null || typeof target !== 'object') throw new Error(`无效编辑路径：${path}`);
    }
    return { target, key: parts[parts.length - 1] };
  }

  function setValue(resume, path, value) {
    const { target, key } = readTarget(resume, path, true);
    target[key] = text(value);
    return resume;
  }

  function getValue(resume, path) {
    const { target, key } = readTarget(resume, path, false);
    return target == null ? undefined : target[key];
  }

  function setListValue(resume, path, value) {
    const { target, key } = readTarget(resume, path, true);
    target[key] = text(value).split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    return resume;
  }

  function listValue(resume, path) {
    const value = getValue(resume, path);
    return Array.isArray(value) ? value.join('\n') : '';
  }

  function emptyRecord(section) {
    const factories = {
      education: standard.createEmptyEducation,
      work: standard.createEmptyWork,
      projects: standard.createEmptyProject,
      campus: standard.createEmptyCampus,
      awards: () => ({ name: '', detail: '' }),
      family: () => ({ relationship: '', name: '', employer: '', position: '' }),
    };
    const factory = factories[section];
    if (!factory) throw new Error(`不支持的经历类型：${section}`);
    return factory();
  }

  function addRecord(resume, section) {
    if (!Array.isArray(resume[section])) throw new Error(`无效经历类型：${section}`);
    const item = clone(emptyRecord(section));
    resume[section].push(item);
    return item;
  }

  function removeRecord(resume, section, index) {
    if (!Array.isArray(resume[section]) || !Number.isInteger(index) || index < 0 || index >= resume[section].length) throw new Error('无效经历索引');
    return resume[section].splice(index, 1)[0];
  }

  function snapshot(resume) { return JSON.stringify(resume || null); }
  function isDirty(resume, savedSnapshot) { return snapshot(resume) !== String(savedSnapshot == null ? '' : savedSnapshot); }

  return { pathParts, getValue, setValue, setListValue, listValue, emptyRecord, addRecord, removeRecord, snapshot, isDirty };
});
