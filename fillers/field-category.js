(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ResumeQuickFillFieldCategory = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const categories = Object.freeze({
    CORE_APPLICATION: 'CORE_APPLICATION', OPTIONAL_APPLICATION: 'OPTIONAL_APPLICATION', FILE_UPLOAD: 'FILE_UPLOAD',
    EEO_DEMOGRAPHIC: 'EEO_DEMOGRAPHIC', SURVEY: 'SURVEY', CAPTCHA_CHALLENGE: 'CAPTCHA_CHALLENGE',
    PAGE_NOISE: 'PAGE_NOISE', UNKNOWN_APPLICATION: 'UNKNOWN_APPLICATION'
  });
  const policies = Object.freeze({
    CORE_APPLICATION: { autoFill: 'ALLOW', status: 'ELIGIBLE' }, OPTIONAL_APPLICATION: { autoFill: 'ALLOW', status: 'ELIGIBLE' },
    FILE_UPLOAD: { autoFill: 'MANUAL', status: 'MANUAL_FILE_UPLOAD' }, EEO_DEMOGRAPHIC: { autoFill: 'SKIP', status: 'SKIPPED_EEO_DEMOGRAPHIC' },
    SURVEY: { autoFill: 'CONFIRM', status: 'NEEDS_CONFIRMATION' }, CAPTCHA_CHALLENGE: { autoFill: 'MANUAL', status: 'MANUAL_REQUIRED' },
    PAGE_NOISE: { autoFill: 'IGNORE', status: 'IGNORED' }, UNKNOWN_APPLICATION: { autoFill: 'REVIEW', status: 'NEEDS_REVIEW' }
  });
  const text = (value) => String(value == null ? '' : value).trim();
  const normalize = (value) => text(value).toLocaleLowerCase().replace(/[：:（）()【】\[\]{}<>「」“”"'`、，,。；;！!?？＊*\-_]/g, ' ').replace(/\s+/g, ' ').trim();
  function evidenceText(field) {
    const evidence = field && field.evidence || {};
    const nameId = Array.isArray(evidence.nameIdEvidence) ? evidence.nameIdEvidence.join(' ') : '';
    return normalize([evidence.label, evidence.aria, evidence.placeholder, evidence.attributes, nameId, field && field.semantic, field && field.schemaPath, field && field.controlType, field && field.type].join(' '));
  }
  function classify(field = {}) {
    if (Object.values(categories).includes(field.fieldCategory)) return field.fieldCategory;
    const controlType = text(field.controlType || field.detectedControlType).toLocaleLowerCase();
    const clue = evidenceText(field);
    if (controlType === 'file-upload' || controlType === 'file-upload-proxy' || /\bfile\b|上传.*(?:文件|简历|附件)|(?:resume|cv).*upload/.test(clue)) return categories.FILE_UPLOAD;
    if (/(?:captcha|recaptcha|hcaptcha|turnstile|human verification|人机验证|验证码(?:挑战)?|验证挑战)/.test(clue)) return categories.CAPTCHA_CHALLENGE;
    if (/(?:\beeo\b|gender identity|pronouns?|race|ethnicity|disability|veteran|demographic|性别认同|代词|种族|族裔|民族|残障|残疾|退伍军人|人口统计|自愿披露)/.test(clue)) return categories.EEO_DEMOGRAPHIC;
    if (/(?:how did you hear|application source|source survey|recruit(?:ment)? source|questionnaire|survey(?:s|responses)?|satisfaction|feedback|consent|marketing|privacy policy|招聘来源|问卷|调查|满意度|同意|隐私政策)/.test(clue)) return categories.SURVEY;
    if (field.outsideApplicationRoot === true || field.applicationAssociation === 'outside' || field.utilityHidden === true) return categories.PAGE_NOISE;
    if (/(?:linkedin|github|portfolio|personal website|个人网站|目前公司|当前公司|current company|current location|\blocation\b|其他网址|other url|additional (?:information|notes)|补充说明)/.test(clue)) return categories.OPTIONAL_APPLICATION;
    if (/(?:full name|\bname\b|email|e mail|phone|mobile|姓名|邮箱|电子邮件|手机号|电话|教育|学校|院校|学历|专业|工作经历|公司名称|职位|岗位|项目经历|求职意向|work experience|education|degree|major|school|position|company)/.test(clue)) return categories.CORE_APPLICATION;
    return categories.UNKNOWN_APPLICATION;
  }
  function policyFor(field) { return policies[classify(field)] || policies.UNKNOWN_APPLICATION; }
  return { categories, policies, classify, policyFor, evidenceText };
});
