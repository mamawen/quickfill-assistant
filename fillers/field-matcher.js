(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./value-normalizer.js'), require('../standard-resume.js'), require('./web-field-aliases.js'), require('./control-adapter.js'), require('./form-map.js'), require('./field-context.js'));
  else root.ResumeQuickFillMatcher = factory(root.ResumeQuickFillValue, root.ResumeQuickFillStandardResume, root.ResumeQuickFillWebAliases, root.ResumeQuickFillControlAdapter, root.ResumeQuickFillFormMap, root.ResumeQuickFillFieldContext);
})(typeof window !== 'undefined' ? window : globalThis, function (valueTools, standardResume, webFieldAliases, controlAdapter, formMapTools, fieldContextTools) {
  'use strict';

  const values = valueTools || { aliases: {}, normalizeText: (value) => String(value || '').toLocaleLowerCase() };
  const asText = (value) => String(value == null ? '' : value).trim();
  const normalize = values.normalizeText;
  const standard = standardResume || { isStandardResume: () => false };
  const web = webFieldAliases || { fields: [], lookupBySemantic: () => null };
  const controlTypes = controlAdapter || { classifyControl: () => 'unknown' };
  const coreSemantic = { PERSON_NAME: 'name', PHONE: 'phone', EMAIL: 'email', UNIVERSITY: 'school', MAJOR: 'major', EDUCATION_LEVEL: 'degree', COMPANY: 'company', JOB_TITLE: 'position', EXPECTED_CITY: 'expectedLocation', EXPECTED_SALARY: 'monthlySalary' };
  const TEXT_FIRST_BASIC_FIELDS = new Set(['name', 'phone', 'email', 'address', 'postalCode', 'idNumber', 'height']);
  const contextFromGroup = (group) => /项目/.test(group) ? 'project' : /工作|实习|任职/.test(group) ? 'experience' : /教育|学历|学校|院校|本科|硕士|博士/.test(group) ? 'education' : /求职|应聘|意向/.test(group) ? 'job' : /基本|个人|联系/.test(group) ? 'basic' : /技能/.test(group) ? 'skills' : /证书/.test(group) ? 'certificates' : 'other';
  const expectedContext = { name: 'basic', firstName: 'basic', lastName: 'basic', namePinyin: 'basic', firstNamePinyin: 'basic', lastNamePinyin: 'basic', phone: 'basic', countryCode: 'basic', email: 'basic', gender: 'basic', ethnicity: 'basic', birthDate: 'basic', idType: 'basic', politicalStatus: 'basic', nationality: 'basic', countryRegion: 'basic', sourceRegion: 'basic', nativePlace: 'basic', currentResidence: 'basic', currentAddress: 'basic', emergencyContactName: 'basic', emergencyContactPhone: 'basic', qq: 'basic', wechat: 'basic', idNumber: 'basic', maritalStatus: 'basic', healthStatus: 'basic', height: 'basic', address: 'basic', postalCode: 'basic', photo: 'basic', mailingProvince: 'basic', mailingCity: 'basic', mailingDistrict: 'basic', mailingDetail: 'basic', jobCompany: 'job', jobPosition: 'job', firstPreference: 'job', secondPreference: 'job', expectedLocation: 'job', expectedCity: 'job', expectedPosition: 'job', salaryExpectation: 'job', monthlySalary: 'job', annualSalary: 'job', applicationSource: 'job', acceptsTransfer: 'job', availableDate: 'job', company: 'experience', position: 'experience', department: 'experience', industry: 'experience', employmentType: 'experience', startDate: 'experience', endDate: 'experience', dateRange: 'experience', workDescription: 'experience', projectName: 'project', projectRole: 'project', projectDescription: 'project', school: 'education', major: 'education', degree: 'education', degreeTitle: 'education', majorRank: 'education', educationLevel: 'education', educationDepartment: 'education', educationAdvisor: 'education', educationSecondMajor: 'education', educationStartDate: 'education', educationEndDate: 'education', educationCountryRegion: 'education', schoolType: 'education', studyMode: 'education', ranking: 'education', gpa: 'education', languageType: 'language', languageLevel: 'language', languageScore: 'language', languageCertificate: 'language', selfIntroduction: 'other', skills: 'skills', certificates: 'certificates', hobbies: 'other' };
  const nameIdSemantics = {
    expectedsalary: 'monthlySalary', monthlysalary: 'monthlySalary', expectedannualsalary: 'annualSalary', annualsalary: 'annualSalary',
    urgencycontactname: 'emergencyContactName', emergencycontactname: 'emergencyContactName', urgencycontactphone: 'emergencyContactPhone', emergencycontactphone: 'emergencyContactPhone',
    politicsstatus: 'politicalStatus', politicalstatus: 'politicalStatus', currentaddr: 'currentAddress', currentaddress: 'currentAddress',
    workwilladdress: 'expectedLocation', expectedworkaddress: 'expectedLocation', expectedlocation: 'expectedLocation',
    certificatetype: 'idType', doctype: 'idType', idtype: 'idType', credentialtype: 'idType', certificatenumber: 'idNumber', idnumber: 'idNumber', docnumber: 'idNumber',
    englishlevel: 'languageLevel', englishlv: 'languageLevel', englistlv: 'languageLevel', englishscore: 'languageScore',
    mailingprovince: 'mailingProvince', mailingcity: 'mailingCity', mailingdistrict: 'mailingDistrict', postaddress: 'mailingDetail', mailingdetailaddress: 'mailingDetail',
    birthday: 'birthDate', birthdate: 'birthDate', infosource: 'applicationSource', applicationsource: 'applicationSource', interests: 'hobbies', hobbies: 'hobbies', nationality: 'nationality', infonation: 'nationality'
  };
  const instructionalPlaceholder = /^(?:请输入(?:内容|相关信息)?|请填写(?:内容)?|请选择(?:内容|要上传的文件)?|点击选择)$/;
  function normalizeFieldPlaceholder(value) {
    return normalize(asText(value).replace(/[＊*]/g, ' ').replace(/[：:]/g, ' ').replace(/[（(]\s*(?:必填|required)\s*[）)]/gi, ' ').replace(/\s+/g, ' ').trim());
  }
  function placeholderSemantic(placeholder) {
    const source = normalizeFieldPlaceholder(placeholder);
    if (!source || instructionalPlaceholder.test(source)) return null;
    const semantics = [...new Set([...Object.keys(values.aliases || {}), ...(web.fields || []).map((field) => field.semantic)])];
    const matches = semantics.filter((semantic) => {
      const aliases = [...new Set([ ...((web.lookupBySemantic(semantic) || {}).aliases || []), ...((values.aliases && values.aliases[semantic]) || []) ])];
      return aliases.some((alias) => normalize(alias) === source);
    });
    return matches.length === 1 ? matches[0] : null;
  }
  function tokenizeNameId(value) { return asText(value).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_\-]+/g, ' ').toLocaleLowerCase().split(/\s+/).filter(Boolean).map((token) => ({ addr: 'address', lv: 'level', num: 'number', tel: 'phone', mob: 'mobile', englist: 'english' }[token] || token)); }
  function nameIdSemantic(evidence) { const raw = Array.isArray(evidence && evidence.nameIdEvidence) ? evidence.nameIdEvidence : [evidence && evidence.attributes]; for (const value of raw) { const compact = tokenizeNameId(value).join(''); if (nameIdSemantics[compact]) return nameIdSemantics[compact]; } return null; }

  function semanticFromKey(key, context) {
    const source = normalize(key);
    const webMatch = web.resolveField && web.resolveField(key); if (webMatch) return webMatch.semantic;
    if (/描述|职责|内容/.test(source)) return context === 'project' ? 'projectDescription' : context === 'experience' ? 'workDescription' : 'selfEvaluation';
    if (/时间|日期/.test(source)) return context === 'project' ? 'dateRange' : context === 'experience' ? 'dateRange' : /入职|开始/.test(source) ? 'startDate' : /离职|结束/.test(source) ? 'endDate' : 'dateRange';
    if (/项目.*(角色|职责|职务)/.test(source)) return 'projectRole';
    for (const [semantic, list] of Object.entries(values.aliases || {})) {
      if (list.some((alias) => normalize(alias) === source)) return semantic;
    }
    return null;
  }
  function flattenResume(resume) {
    if (standard.isStandardResume(resume)) return flattenStandardResume(resume);
    const entries = [];
    Object.entries(resume || {}).forEach(([group, fields]) => {
      const context = contextFromGroup(group);
      Object.entries(fields || {}).forEach(([key, value]) => {
        const semantic = semanticFromKey(key, context);
        if (semantic && asText(value)) entries.push({ group, key, value: asText(value), semantic, context });
      });
    });
    return entries;
  }
  function flattenStandardResume(resume) {
    const entries = [];
    const add = (group, key, value, semantic, context, schemaPath) => { if (asText(value)) entries.push({ group, key, value: asText(value), semantic, context, schemaPath: schemaPath || (web.lookupBySemantic(semantic) || {}).schemaPath || '' }); };
    const basic = resume.basic || {};
    [['name', 'name'], ['phone', 'phone'], ['email', 'email'], ['gender', 'gender'], ['ethnicity', 'ethnicity'], ['birthDate', 'birthDate'], ['politicalStatus', 'politicalStatus'], ['sourceRegion', 'sourceRegion'], ['nativePlace', 'nativePlace'], ['currentResidence', 'currentResidence'], ['currentAddress', 'currentAddress'], ['emergencyContactName', 'emergencyContactName'], ['emergencyContactPhone', 'emergencyContactPhone'], ['qq', 'qq'], ['wechat', 'wechat'], ['idNumber', 'idNumber'], ['maritalStatus', 'maritalStatus'], ['healthStatus', 'healthStatus'], ['height', 'height'], ['address', 'address'], ['postalCode', 'postalCode']].forEach(([key, semantic]) => add('基本信息', key, basic[key], semantic, 'basic', `basic.${key}`));
    const job = resume.job || {};
    [['company', 'jobCompany'], ['position', 'jobPosition'], ['firstPreference', 'firstPreference'], ['secondPreference', 'secondPreference'], ['expectedLocation', 'expectedLocation'], ['monthlySalary', 'monthlySalary'], ['annualSalary', 'annualSalary'], ['applicationSource', 'applicationSource'], ['acceptsTransfer', 'acceptsTransfer'], ['availableDate', 'availableDate']].forEach(([key, semantic]) => add('求职信息', key, job[key], semantic, 'job', `job.${key}`));
    (resume.education || []).forEach((item, index) => [['school', 'school'], ['major', 'major'], ['degree', 'degree'], ['degreeTitle', 'degreeTitle'], ['majorRank', 'majorRank'], ['startDate', 'startDate'], ['endDate', 'endDate']].forEach(([key, semantic]) => add(`教育经历${index + 1}`, key, item[key], semantic, 'education', `education[${index}].${key}`)));
    (resume.work || []).forEach((item, index) => { const group = `工作经历${index + 1}`; [['companyName', 'company'], ['position', 'position'], ['startDate', 'startDate'], ['endDate', 'endDate'], ['workContent', 'workDescription']].forEach(([key, semantic]) => add(group, key, item[key], semantic, 'experience', `work[${index}].${key}`)); if (asText(item.startDate) || asText(item.endDate)) add(group, 'dateRange', `${asText(item.startDate)} 至 ${asText(item.endDate)}`.replace(/^ 至 | 至 $/g, ''), 'dateRange', 'experience', `work[${index}].dateRange`); });
    (resume.projects || []).forEach((item, index) => { const group = `项目经历${index + 1}`; [['name', 'projectName'], ['role', 'projectRole'], ['description', 'projectDescription']].forEach(([key, semantic]) => add(group, key, item[key], semantic, 'project', `projects[${index}].${key}`)); if (asText(item.startDate) || asText(item.endDate)) add(group, 'dateRange', `${asText(item.startDate)} 至 ${asText(item.endDate)}`.replace(/^ 至 | 至 $/g, ''), 'dateRange', 'project', `projects[${index}].dateRange`); });
    (resume.certificatesSkills && resume.certificatesSkills.professionalSkills || []).forEach((value) => add('证书与技能', '专业技能', value, 'skills', 'skills'));
    (resume.certificatesSkills && resume.certificatesSkills.certificates || []).forEach((value) => add('证书与技能', '证书', value, 'certificates', 'certificates'));
    add('其他信息', '自我评价', resume.other && resume.other.selfEvaluation, 'selfEvaluation', 'other');
    return entries;
  }
  function scoreSource(source, aliases, exact, partial) {
    const text = normalize(source); if (!text) return 0;
    let score = 0;
    aliases.forEach((alias) => {
      const wanted = normalize(alias); if (!wanted) return;
      if (text === wanted) score = Math.max(score, exact);
      else if (wanted.length >= 3 && text.includes(wanted)) score = Math.max(score, partial);
    });
    return score;
  }
  function scoreSemantic(control, semantic) {
    const evidence = control.evidence || {};
    const aliases = [...new Set([ ...((web.lookupBySemantic(semantic) || {}).aliases || []), ...((values.aliases && values.aliases[semantic]) || []) ])];
    if (!aliases.length) return 0;
    let score = 0;
    score += scoreSource(evidence.label, aliases, 10, 6);
    score += scoreSource(evidence.aria, aliases, 9, 5);
    const fieldLikePlaceholder = placeholderSemantic(evidence.placeholder);
    score += fieldLikePlaceholder === semantic ? 8 : scoreSource(normalizeFieldPlaceholder(evidence.placeholder), aliases, 3, 1);
    score += scoreSource(evidence.attributes, aliases, 2, 1);
    score += scoreSource((Array.isArray(evidence.nameIdEvidence) ? evidence.nameIdEvidence : [evidence.attributes]).join(' '), aliases, 8, 2);
    if (nameIdSemantic(evidence) === semantic) score += 8;
    score += scoreSource(evidence.nearby, aliases, 4, 2);
    const expected = expectedContext[semantic];
    if (expected && evidence.context === expected) score += 4;
    if (expected && evidence.context !== 'unknown' && evidence.context !== expected) score -= 8;
    if ((semantic === 'company' || semantic === 'position' || semantic === 'workDescription') && evidence.context === 'project') score -= 12;
    if ((semantic.startsWith('project')) && evidence.context === 'experience') score -= 12;
    return score;
  }
  function identifyControl(control, minScore = 8, minGap = 3) {
    const fieldContext = control && control.evidence && control.evidence.fieldContext;
    if (fieldContext && fieldContextTools && typeof fieldContextTools.identify === 'function') {
      const core = fieldContextTools.identify(fieldContext, control.element || null);
      if (core.standardField !== 'UNKNOWN') {
        const semantic = coreSemantic[core.standardField];
        if (semantic) return { semantic, standardField: core.standardField, score: Math.round(core.confidence * 18), confidence: core.confidence, schemaPath: (web.lookupBySemantic(semantic) || {}).schemaPath || '', locator: core.locator, fieldContext: core.context };
      }
      if (core.reason === 'EMERGENCY_CONTACT_CONTEXT' || core.reason === 'CONFLICTING_FIELD_CONTEXT') return { skip: '字段上下文存在冲突', status: 'PAGE_FIELD_UNRECOGNIZED', semantic: 'UNKNOWN', standardField: 'UNKNOWN', confidence: 0 };
    }
    const semantics = [...new Set([...Object.keys(values.aliases || {}), ...(web.fields || []).map((field) => field.semantic)])];
    const candidates = semantics.map((semantic) => ({ semantic, score: scoreSemantic(control, semantic) })).filter((candidate) => candidate.score > 0).sort((a, b) => b.score - a.score);
    if (!candidates.length || candidates[0].score < minScore) return { skip: '字段线索不明确', status: 'PAGE_FIELD_UNRECOGNIZED', semantic: 'UNKNOWN', confidence: 0 };
    if (candidates[1] && candidates[0].score - candidates[1].score < minGap) return { skip: '字段线索存在冲突', status: 'NEEDS_CONFIRMATION' };
    return { ...candidates[0], confidence: Math.min(0.98, candidates[0].score / 16), schemaPath: (web.lookupBySemantic(candidates[0].semantic) || {}).schemaPath || '' };
  }
  function controlPreference(semantic, controlType) {
    if (!TEXT_FIRST_BASIC_FIELDS.has(semantic)) return 0;
    if (controlType === 'text-input') return 3;
    if (controlType === 'textarea' || controlType === 'contenteditable') return 2;
    return 1;
  }
  function createPlan(resume, controls, options = {}) {
    if (controls && Array.isArray(controls.sections) && formMapTools && typeof formMapTools.controls === 'function') controls = formMapTools.controls(controls);
    const entries = flattenResume(resume);
    const plans = [], skipped = [], used = new Set(), position = new Map();
    (controls || []).forEach((control) => {
      const declaredType = control.controlType || control.detectedControlType || controlTypes.classifyControl(control);
      if (control.autoFillSupported === false || declaredType === 'file-upload' || declaredType === 'file-upload-proxy') { skipped.push({ element: control.element, fieldLabel: asText(control.evidence && control.evidence.label) || '上传文件', semantic: 'UNSUPPORTED', controlType: declaredType, fieldCategory: control.fieldCategory || 'FILE_UPLOAD', confidence: 0, evidence: control.evidence || {}, reason: '上传文件需手动处理', status: 'MANUAL_FILE_UPLOAD' }); return; }
      const choice = identifyControl(control, options.minimumScore || 7, options.minimumGap || 3);
      const displayName = (semantic) => (web.lookupBySemantic(semantic) || {}).displayName || semantic;
      const visibleLabel = asText(control.evidence && control.evidence.label);
      if (choice.skip) { skipped.push({ element: control.element, fieldLabel: visibleLabel, semantic: choice.semantic || 'UNKNOWN', controlType: controlTypes.classifyControl(control), fieldCategory: control.fieldCategory || 'UNKNOWN_APPLICATION', confidence: choice.confidence || 0, evidence: control.evidence || {}, reason: choice.skip, status: choice.status || 'PAGE_FIELD_UNRECOGNIZED' }); return; }
      const context = control.evidence && control.evidence.context || 'unknown';
      const key = `${context}:${choice.semantic}`;
      const groupIndex = control.evidence && control.evidence.repeatGroup && control.evidence.repeatGroup.kind === context ? control.evidence.repeatGroup.index : null;
      const scalarField = ['basic', 'job', 'skills', 'certificates', 'other'].includes(expectedContext[choice.semantic]);
      const occurrence = scalarField ? 0 : (groupIndex == null ? (position.get(key) || 0) : groupIndex);
      if (!scalarField) position.set(key, occurrence + 1);
      let candidates = entries.filter((entry) => entry.semantic === choice.semantic);
      const expected = expectedContext[choice.semantic];
      if (expected) candidates = candidates.filter((entry) => entry.context === expected);
      const entry = candidates[occurrence];
      if (!entry) { skipped.push({ element: control.element, fieldLabel: visibleLabel || displayName(choice.semantic), semantic: choice.semantic, schemaPath: choice.schemaPath, controlType: controlTypes.classifyControl(control), fieldCategory: control.fieldCategory || 'UNKNOWN_APPLICATION', confidence: choice.confidence, evidence: control.evidence || {}, reason: '简历中缺少对应值', status: 'RESUME_VALUE_MISSING' }); return; }
      const entryId = `${entry.group}:${entry.key}`;
      const controlType = controlTypes.classifyControl(control);
      const nextPlan = { element: control.element, fieldElement: control.element, elements: control.elements || [control.element], semantic: choice.semantic, standardField: choice.standardField || 'UNKNOWN', locator: choice.locator || control.element, schemaPath: entry.schemaPath || (web.lookupBySemantic(choice.semantic) || {}).schemaPath || '', value: entry.value, score: choice.score, confidence: choice.confidence, fieldCategory: control.fieldCategory || 'UNKNOWN_APPLICATION', evidence: control.evidence || {}, fieldLabel: visibleLabel || displayName(choice.semantic), controlType, detectedControlType: control.detectedControlType || controlType, context: entry.context, group: entry.group, key: entry.key };
      if (used.has(entryId)) {
        const priorIndex = plans.findIndex((plan) => plan.group === entry.group && plan.key === entry.key);
        const prior = plans[priorIndex];
        if (prior && controlPreference(choice.semantic, controlType) > controlPreference(choice.semantic, prior.controlType)) {
          plans[priorIndex] = nextPlan;
          skipped.push({ element: prior.element, semantic: choice.semantic, reason: '同一组合控件采用更明确的文本输入框', status: 'SKIPPED_COMPOSITE_AUXILIARY' });
          return;
        }
        skipped.push({ element: control.element, semantic: choice.semantic, reason: '字段映射冲突，已跳过', status: 'NEEDS_CONFIRMATION' }); return;
      }
      used.add(entryId);
      plans.push(nextPlan);
    });
    const groupedUnused = new Map();
    entries.filter((entry) => !used.has(`${entry.group}:${entry.key}`) && (entry.context === 'experience' || entry.context === 'project')).forEach((entry) => {
      const list = groupedUnused.get(entry.group) || []; list.push(entry); groupedUnused.set(entry.group, list);
    });
    groupedUnused.forEach((items, group) => {
      const total = entries.filter((entry) => entry.group === group).length;
      if (items.length === total) skipped.push({ group, key: group, reason: '网页未提供对应区域', status: 'NOT_RENDERED', diagnosticStatus: 'PAGE_REGION_NOT_RENDERED' });
      else items.forEach((entry) => skipped.push({ semantic: entry.semantic, group: entry.group, key: entry.key, reason: '网页未提供对应区域', status: 'NOT_RENDERED', diagnosticStatus: 'PAGE_REGION_NOT_RENDERED' }));
    });
    const unknown = skipped.filter((item) => item.status === 'PAGE_FIELD_UNRECOGNIZED').length;
    const semanticRecognized = plans.length + skipped.filter((item) => item.status !== 'PAGE_FIELD_UNRECOGNIZED').length;
    return { plans, skipped, diagnostics: { semanticRecognized, resumeMatched: plans.length, unknown } };
  }

  function calculateMetrics(records) {
    const supported = (records || []).filter((item) => Boolean(item && item.schemaPath));
    const native = supported.filter((item) => !['custom-searchable-select', 'province-city-district-cascade', 'unknown'].includes(item.controlType));
    const successful = native.filter((item) => item.result === 'SUCCESS');
    const wrong = supported.filter((item) => item.result === 'WRONG_MATCH');
    return {
      supportedFieldCount: supported.length,
      detectedFieldCount: supported.length,
      nativeMatchedCount: native.length,
      successfulFillCount: successful.length,
      wrongMatchCount: wrong.length,
      fieldDetectionRate: supported.length ? 1 : 0,
      fillSuccessRate: native.length ? successful.length / native.length : 0,
      wrongMatchRate: supported.length ? wrong.length / supported.length : 0,
    };
  }

  return { flattenResume, semanticFromKey, tokenizeNameId, nameIdSemantic, normalizeFieldPlaceholder, placeholderSemantic, scoreSemantic, identifyControl, createPlan, calculateMetrics, coreSemantic };
});
