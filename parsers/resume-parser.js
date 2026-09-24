(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ResumeQuickFillParser = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const DATE = /(\d{4}[./年-]\s*\d{1,2}(?:[./月-]\s*\d{1,2})?\s*[–—~-]\s*(?:\d{4}[./年-]\s*\d{1,2}(?:[./月-]\s*\d{1,2})?|至今|现在)|\d{4}[./年-]\s*\d{1,2}(?:[./月-]\s*\d{1,2})?|至今|现在)/;
  const BULLET = /^[•·●▪▸▶\-—]+\s*/;
  const SECTION_LABELS = {
    education: [/^(教育(?:经历|背景)?|学历经历|校园经历)$/i, /^(education|educational background)$/i],
    experience: [/^(工作(?:经历|经验)?|实习经历|职业经历)$/i, /^(work experience|employment history|professional experience)$/i],
    projects: [/^(项目(?:经历)?|项目经验)$/i, /^(project experience|projects?)$/i],
    skills: [/^(技能|专业技能|证书|资格证书|自我评价|个人总结|竞赛与证书|个人优势)$/i, /^(core skills|skills|awards?(?:\s*&\s*certifications?)?|certifications?|professional summary)$/i],
  };
  function clean(value) { return String(value || '').replace(BULLET, '').replace(/\s+/g, ' ').trim(); }
  function cleanInferredName(value) { return clean(value).replace(/\s*(?:个人简历|个人履历|简历|CV|Resume)\s*$/i, '').trim(); }
  function linesOf(input) { return String(input || '').split(/\r?\n/).map(clean).filter(Boolean); }
  function labelledBasicFields(lines) {
    const fields = {}; const labels = { 姓名: '姓名', 性别: '性别', 学历: '学历', 专业: '专业', 手机: '手机号', 手机号: '手机号', 联系电话: '手机号', 邮箱: '邮箱' };
    const matcher = /(姓名|性别|学历|专业|手机号|手机|联系电话|邮箱)\s*[:：]/g;
    for (const line of lines) {
      const matches = [...String(line || '').matchAll(matcher)];
      for (let index = 0; index < matches.length; index += 1) {
        const match = matches[index]; const next = matches[index + 1]; const value = clean(line.slice(match.index + match[0].length, next ? next.index : undefined));
        if (!value) continue;
        const key = labels[match[1]];
        if (key === '手机号') { const digits = value.replace(/[^\d]/g, ''); if (/^1[3-9]\d{9}$/.test(digits)) fields[key] = digits; }
        else if (key === '邮箱') { const email = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i); if (email) fields[key] = email[0]; }
        else fields[key] = value;
      }
    }
    return fields;
  }
  function hasCjk(value) { return /[\u3400-\u9fff]/.test(value); }
  function heading(line) {
    const labels = clean(line).split(/[|｜]/).map(clean).filter(Boolean);
    for (const [kind, patterns] of Object.entries(SECTION_LABELS)) if (labels.some((label) => patterns.some((pattern) => pattern.test(label)))) return kind;
    return null;
  }
  function datePart(line) { const match = String(line || '').match(DATE); return match ? clean(match[1]) : ''; }
  function stripDate(line) { return clean(String(line || '').replace(DATE, '').replace(/[|｜,，]+/g, ' ')); }
  function fieldsOf(line, preservePlainText) { const value = clean(String(line || '').replace(DATE, '')); const separated = value.split(/\s*[|｜]\s*/).filter(Boolean); return separated.length > 1 ? separated : preservePlainText ? [value].filter(Boolean) : value.split(/\s{2,}|\s+/).filter(Boolean); }
  function isTranslation(record, previous) { return Boolean(previous && !record.bullet && !hasCjk(record.text) && hasCjk(previous.text) && !heading(record.text) && !datePart(record.text)); }
  function addDescription(entry, key, line) { entry[key] = entry[key] ? `${entry[key]}\n${line}` : line; }
  function projectTitle(record) {
    const line = record.text;
    if (record.bullet || !line || !hasCjk(line) || /[。；;]$/.test(line) || /^(完成|负责|参与|协助|基于|使用|通过|针对|开展|优化|设计并|实现)/.test(line)) return false;
    return /^项目/.test(line) || /(项目|设计|系统|平台|研究|开发|HT\d|无人机)/i.test(line);
  }
  function sectionRecords(input) {
    const sections = { education: [], experience: [], projects: [], skills: [] }; let current = null;
    for (const raw of String(input || '').split(/\r?\n/)) { const text = clean(raw); if (!text) continue; const kind = heading(text); if (kind) { current = kind; continue; } if (current) sections[current].push({ text, bullet: BULLET.test(String(raw || '').trim()) }); }
    return sections;
  }
  function parseEducation(records) {
    const out = {}; let index = 0; let current = null; let previous = null;
    const save = () => { if (current) out[`教育经历${++index}`] = current; };
    for (const record of records) {
      if (isTranslation(record, previous)) { previous = record; continue; }
      const date = datePart(record.text); const parts = fieldsOf(record.text);
      if (!current || (!record.bullet && date)) { save(); current = {}; if (parts[0]) current.学校 = parts[0]; if (parts[1]) current.专业 = parts[1]; if (parts[2]) current.学历 = parts[2]; if (date) current.时间 = date; }
      previous = record;
    }
    save(); return out;
  }
  function parseEntries(records, kind) {
    const out = {}; let index = 0; let current = null; let previous = null; const prefix = kind === 'experience' ? '工作经历' : '项目经历'; const descriptionKey = kind === 'experience' ? '职责描述' : '项目职责';
    const save = () => { if (current) out[`${prefix}${++index}`] = current; };
    for (const record of records) {
      if (isTranslation(record, previous)) { previous = record; continue; }
      const date = datePart(record.text); const startsNew = !current || (!record.bullet && (kind === 'experience' ? Boolean(date) : projectTitle(record)));
      if (startsNew) {
        save(); current = {}; const parts = fieldsOf(record.text, kind === 'projects');
        if (kind === 'experience') { if (parts[0]) current.公司名称 = parts[0]; if (parts[1]) current.职位名称 = parts[1]; if (date) current.工作时间 = date; }
        else { if (parts[0]) current.项目名称 = parts[0]; if (parts[1] && !date) current.项目角色 = parts[1]; if (date) current.项目时间 = date; }
      } else if (current) addDescription(current, descriptionKey, record.text);
      previous = record;
    }
    save(); return out;
  }
  function parseResumeText(input) {
    const lines = linesOf(input); const result = {}; const combined = lines.join(' '); const firstSection = lines.findIndex((line) => heading(line)); const headerLines = firstSection < 0 ? lines : lines.slice(0, firstSection); const basic = labelledBasicFields(headerLines); const phone = combined.match(/1[3-9]\d{9}/); const email = combined.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (!basic.手机号 && phone) basic.手机号 = phone[0]; if (!basic.邮箱 && email) basic.邮箱 = email[0];
    if (!basic.姓名) { const candidate = headerLines.find((line) => !heading(line) && !/\d{4}|@|1[3-9]\d{9}/.test(line) && line.length <= 20 && !/[：:]/.test(line)); const inferredName = cleanInferredName(candidate); if (inferredName) basic.姓名 = inferredName; }
    if (Object.keys(basic).length) result.基本信息 = basic;
    const sections = sectionRecords(input); Object.assign(result, parseEducation(sections.education), parseEntries(sections.experience, 'experience'), parseEntries(sections.projects, 'projects'));
    if (sections.skills.length) result.技能 = { 技能: sections.skills.map((record) => record.text).join('、') };
    return result;
  }
  return { parseResumeText, linesOf };
});
