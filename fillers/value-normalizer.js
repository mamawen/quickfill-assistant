(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ResumeQuickFillValue = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const asText = (value) => String(value == null ? '' : value).trim();
  const normalizeText = (value) => asText(value).toLocaleLowerCase().replace(/[：:（）()【】\[\]{}<>「」“”"'`、，,。；;！!?？\-_]/g, ' ').replace(/\s+/g, ' ').trim();
  const aliases = {
    name: ['姓名', '名字', '真实姓名', 'name', 'full name', 'fullname'],
    phone: ['手机号', '手机', '联系电话', '电话', 'mobile', 'phone', 'telephone'],
    email: ['邮箱', '电子邮箱', '电子邮件', 'email', 'e mail'],
    gender: ['性别', 'gender', 'sex'],
    politicalStatus: ['政治面貌', '党员', '团员', 'political status'],
    birthDate: ['出生日期', '生日', 'birth date'],
    idNumber: ['身份证号', '身份证号码', 'id number'],
    address: ['通讯地址', '联系地址', '居住地址', 'address'],
    postalCode: ['邮政编码', '邮编', 'zip code'],
    maritalStatus: ['婚姻状况', 'marital status'],
    healthStatus: ['健康状况', 'health status'],
    height: ['身高', 'height'],
    school: ['学校', '毕业院校', '院校', '院校名称', 'school', 'university', 'college'],
    major: ['专业', '所学专业', '专业名称', 'major'],
    degree: ['学历', '最高学历', '学历层次', 'degree', 'education level'],
    company: ['公司名称', '任职公司', '工作单位', '单位名称', '公司', 'employer', 'company'],
    position: ['职位名称', '职位', '岗位', '职务', 'position', 'job title', 'role'],
    startDate: ['开始时间', '入职时间', '起始时间', 'start date', 'start time'],
    endDate: ['结束时间', '离职时间', '截止时间', 'end date', 'end time'],
    dateRange: ['工作时间', '任职时间', '项目时间', '时间范围', '起止时间', 'date range', 'duration'],
    workDescription: ['工作描述', '工作职责', '岗位职责', '职责描述', '工作内容', 'responsibilities'],
    projectName: ['项目名称', '项目名', 'project name', 'project'],
    projectRole: ['项目角色', '项目职责', '项目职务', 'project role'],
    projectDescription: ['项目描述', '项目内容', '项目介绍', 'project description'],
    skills: ['技能', '专业技能', 'skill', 'skills'],
    certificates: ['证书', '资格证', 'certificate', 'certification'],
    selfEvaluation: ['自我评价', '个人评价', '自我介绍', 'self evaluation', 'summary'],
    city: ['城市', '所在地', '现居地', '期望城市', 'city', 'location'],
    expectedLocation: ['期望工作地点', '期望地点', '工作地点', 'expected location'],
    acceptsTransfer: ['是否服从调剂', '是否接受调剂', '服从调剂', 'accept transfer'],
    availableDate: ['期望到岗时间', '到岗时间', 'available date'],
  };
  const degreeMap = { '本科': ['本科', '大学本科', 'bachelor', 'undergraduate'], '大专': ['大专', '专科', 'associate'], '硕士': ['硕士', 'master'], '博士': ['博士', 'doctor', 'phd'] };
  const genderMap = { '男': ['男', '男性', 'male', 'm'], '女': ['女', '女性', 'female', 'f'] };
  function canonicalFrom(map, value) { const wanted = normalizeText(value); return Object.keys(map).find((key) => map[key].some((item) => normalizeText(item) === wanted)) || asText(value); }
  function canonicalDegree(value) { return canonicalFrom(degreeMap, value); }
  function canonicalGender(value) { return canonicalFrom(genderMap, value); }
  function normalizeDate(value, type) {
    const raw = asText(value); if (!raw) return '';
    if (/^(至今|现在|present)$/i.test(raw)) return raw;
    const match = raw.match(/(19|20)\d{2}\D{0,3}(0?[1-9]|1[0-2])(?:\D{0,3}(0?[1-9]|[12]\d|3[01]))?/);
    if (!match) return raw;
    const year = match[0].match(/(19|20)\d{2}/)[0];
    const parts = raw.match(/(19|20)\d{2}\D{0,3}(0?[1-9]|1[0-2])(?:\D{0,3}(0?[1-9]|[12]\d|3[01]))?/);
    const numbers = parts[0].match(/\d+/g);
    const month = String(numbers[1]).padStart(2, '0');
    if (type === 'month') return `${year}-${month}`;
    const day = String(numbers[2] || '1').padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  function normalizedComparable(value, semantic) {
    if (semantic === 'degree') return normalizeText(canonicalDegree(value));
    if (semantic === 'gender') return normalizeText(canonicalGender(value));
    return normalizeText(value);
  }
  return { aliases, normalizeText, canonicalDegree, canonicalGender, normalizeDate, normalizedComparable };
});
