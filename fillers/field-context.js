(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ResumeQuickFillFieldContext = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const SOURCE_PRIORITY = [
    ['labelText', 10], ['placeholder', 8], ['ariaLabel', 7], ['name', 6], ['id', 5], ['nearbyText', 4], ['sectionText', 3], ['title', 2],
  ];
  const FIELD_ALIASES = {
    PERSON_NAME: ['姓名', '名字', '真实姓名', 'name', 'full name'],
    PHONE: ['手机号', '手机号码', '联系电话', '电话', 'mobile', 'phone', 'tel', 'telephone'],
    EMAIL: ['邮箱', '电子邮箱', '电子邮件', 'email', 'e mail'],
    UNIVERSITY: ['学校', '学校名称', '毕业院校', '就读院校', '院校', '院校名称', 'university', 'school', 'college'],
    MAJOR: ['专业', '专业名称', '所学专业', 'major'],
    EDUCATION_LEVEL: ['学历', '学历层次', '最高学历', '学位', 'degree', 'education level'],
    COMPANY: ['公司', '公司名称', '单位名称', '工作单位', '任职公司', 'company', 'employer'],
    JOB_TITLE: ['职位', '职位名称', '岗位', '职务', 'job title', 'position'],
    EXPECTED_CITY: ['期望城市', '期望工作城市', '期望地点', '期望工作地点', 'expected city', 'expected location'],
    EXPECTED_SALARY: ['期望薪资', '期望工资', '期望月薪', '薪资要求', '薪酬要求', 'expected salary', 'salary expectation'],
  };
  const FIELD_CONTEXTS = {
    UNIVERSITY: /学校名称|毕业院校|就读院校|university|school/i,
    COMPANY: /公司名称|单位名称|工作单位|任职公司|company|employer/i,
  };
  const normalize = (value) => String(value == null ? '' : value)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLocaleLowerCase()
    .replace(/[：:（）()【】\[\]{}<>「」“”"'`、，,。；;！!?？_\-]/g, ' ')
    .replace(/\s+/g, ' ').trim();
  const text = (value) => String(value == null ? '' : value).trim();

  function create(input = {}) {
    return {
      labelText: text(input.labelText || input.label),
      placeholder: text(input.placeholder),
      name: text(input.name),
      id: text(input.id),
      ariaLabel: text(input.ariaLabel || input.aria),
      title: text(input.title),
      nearbyText: text(input.nearbyText || input.nearby),
      sectionText: text(input.sectionText || input.section),
      inputType: text(input.inputType || input.type || 'text').toLocaleLowerCase(),
    };
  }

  function sourceMatch(source, alias) {
    const value = normalize(source); const wanted = normalize(alias);
    if (!value || !wanted) return 0;
    return value === wanted ? 1 : wanted.length >= 3 && value.includes(wanted) ? 0.65 : 0;
  }
  function conflictReason(context, standardField) {
    const all = SOURCE_PRIORITY.map(([key]) => context[key]).join(' ');
    if ((standardField === 'PHONE' || standardField === 'PERSON_NAME') && /紧急联系人|emergency\s*contact/i.test(all)) return 'EMERGENCY_CONTACT_CONTEXT';
    const universityContext = FIELD_CONTEXTS.UNIVERSITY.test(all);
    const companyContext = FIELD_CONTEXTS.COMPANY.test(all);
    if ((standardField === 'UNIVERSITY' && companyContext) || (standardField === 'COMPANY' && universityContext) || (universityContext && companyContext)) return 'CONFLICTING_FIELD_CONTEXT';
    return '';
  }
  function scoreField(context, standardField) {
    const aliases = FIELD_ALIASES[standardField] || [];
    let score = 0; const matchedSources = [];
    SOURCE_PRIORITY.forEach(([key, weight]) => {
      const best = aliases.reduce((maximum, alias) => Math.max(maximum, sourceMatch(context[key], alias)), 0);
      if (best) { score += weight * best; matchedSources.push(key); }
    });
    if (matchedSources.length > 1) score += (matchedSources.length - 1) * 2;
    return { standardField, score, matchedSources };
  }
  function identify(input, locator = null) {
    const context = create(input);
    const candidates = Object.keys(FIELD_ALIASES).map((standardField) => scoreField(context, standardField)).filter((candidate) => candidate.score > 0).sort((a, b) => b.score - a.score);
    if (!candidates.length || candidates[0].score < 6) return { standardField: 'UNKNOWN', confidence: 0, locator, context, reason: 'INSUFFICIENT_CONTEXT' };
    const winner = candidates[0]; const conflict = conflictReason(context, winner.standardField);
    if (conflict || (candidates[1] && winner.score - candidates[1].score < 3)) return { standardField: 'UNKNOWN', confidence: 0, locator, context, reason: conflict || 'CONFLICTING_FIELD_CONTEXT' };
    return { standardField: winner.standardField, confidence: Math.min(0.98, winner.score / 18), locator, context, matchedSources: winner.matchedSources };
  }

  return { create, identify, scoreField, FIELD_ALIASES, SOURCE_PRIORITY };
});
