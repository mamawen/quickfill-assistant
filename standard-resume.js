(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ResumeQuickFillStandardResume = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const text = (value) => String(value == null ? '' : value).trim();
  const copy = (value) => JSON.parse(JSON.stringify(value));
  const keyText = (value) => text(value).toLocaleLowerCase().replace(/[\s：:（）()【】\[\]、，,。；;\-_]/g, '');
  const labels = {
    basic: { name: '姓名', gender: '性别', birthDate: '出生日期', ethnicity: '民族', politicalStatus: '政治面貌', nativePlace: '籍贯', sourceRegion: '生源地', householdLocation: '户籍所在地', currentResidence: '现居住地', currentAddress: '现居住地址', idNumber: '身份证号', maritalStatus: '婚姻状况', healthStatus: '健康状况', height: '身高', phone: '联系电话', email: '电子邮箱', emergencyContactName: '紧急联系人姓名', emergencyContactPhone: '紧急联系人电话', qq: 'QQ', wechat: '微信号', address: '通讯地址', postalCode: '邮政编码' },
    job: { company: '应聘单位', position: '应聘岗位', firstPreference: '第一志愿', secondPreference: '第二志愿', expectedLocation: '期望工作地点', monthlySalary: '期望月薪', annualSalary: '期望年薪', applicationSource: '招聘信息来源', acceptsTransfer: '是否服从调剂', availableDate: '期望到岗时间' },
    education: { school: '学校名称', degree: '学历', degreeTitle: '学位', department: '院系', major: '专业', startDate: '入学时间', endDate: '毕业时间', studyMode: '学习形式', majorRank: '专业排名', classRank: '班级排名', gpa: 'GPA / 平均成绩', highestDegree: '是否最高学历', courses: '主修课程' },
    work: { companyName: '单位名称', department: '部门', position: '职位', location: '工作地点', startDate: '开始时间', endDate: '结束时间', employmentType: '工作性质', workContent: '工作内容', achievements: '工作业绩', leaveReason: '离职原因' },
    projects: { name: '项目名称', role: '项目角色', startDate: '开始时间', endDate: '结束时间', description: '项目描述', responsibilities: '主要职责', outcomes: '项目成果' },
    campus: { organization: '组织名称', position: '职务', startDate: '开始时间', endDate: '结束时间', description: '经历描述', achievements: '主要成果' },
    other: { specialties: '特长', hobbies: '兴趣爱好', selfEvaluation: '自我评价', strengths: '个人优势', relativeAtCompany: '是否有亲属在本单位工作', overseasExperience: '是否有海外学习 / 工作经历', acceptsTransfer: '是否接受岗位调剂', notes: '其他说明' },
  };
  const aliases = {
    basic: { name: ['姓名', '名字', '真实姓名', 'name', 'fullname'], gender: ['性别', 'gender', 'sex'], birthDate: ['出生日期', '生日', 'birthdate'], ethnicity: ['民族'], politicalStatus: ['政治面貌', '政治身份'], nativePlace: ['籍贯'], sourceRegion: ['生源地'], householdLocation: ['户籍所在地', '户籍地'], currentResidence: ['现居住地', '现住址', '居住地', '所在地'], currentAddress: ['现居住地址', '现住地址', '当前地址'], idNumber: ['身份证号', '身份证号码'], maritalStatus: ['婚姻状况'], healthStatus: ['健康状况'], height: ['身高'], phone: ['手机号', '手机号码', '手机', '联系电话', '移动电话', '电话', 'phone', 'mobile'], email: ['邮箱', '电子邮箱', '电子邮件', 'email'], emergencyContactName: ['紧急联系人姓名', '紧急联系人'], emergencyContactPhone: ['紧急联系人电话', '紧急联系人手机号'], qq: ['qq'], wechat: ['微信号', '微信'], address: ['通讯地址', '联系地址', '地址'], postalCode: ['邮政编码', '邮编'] },
    job: { company: ['应聘单位', '目标单位'], position: ['应聘岗位', '目标岗位', '求职岗位'], firstPreference: ['第一志愿', '第一意向'], secondPreference: ['第二志愿', '第二意向'], expectedLocation: ['期望工作地点', '期望地点', '期望城市'], monthlySalary: ['期望月薪'], annualSalary: ['期望年薪'], applicationSource: ['招聘信息来源', '招聘来源'], acceptsTransfer: ['是否服从调剂', '服从调剂'], availableDate: ['期望到岗时间', '到岗时间', '可到岗时间'] },
    education: { school: ['学校', '学校名称', '毕业院校', '院校', '院校名称', '就读院校'], degree: ['学历', '最高学历', '学历层次'], degreeTitle: ['学位', '学位名称'], department: ['院系', '学院', '系别'], major: ['专业', '所学专业', '专业名称'], startDate: ['入学时间', '开始时间'], endDate: ['毕业时间', '结束时间'], studyMode: ['学习形式'], majorRank: ['专业排名'], classRank: ['班级排名'], gpa: ['gpa', '平均成绩', '绩点'], highestDegree: ['是否最高学历'], courses: ['主修课程', '核心课程'] },
    work: { companyName: ['公司名称', '单位名称', '工作单位', '任职公司', '公司', 'employer', 'company'], department: ['部门'], position: ['职位名称', '职位', '岗位', '职务', 'position', 'jobtitle'], location: ['工作地点', '地点'], startDate: ['开始时间', '入职时间', '起始时间'], endDate: ['结束时间', '离职时间', '截止时间'], employmentType: ['工作性质', '工作类型'], workContent: ['工作内容', '工作描述', '工作职责', '岗位职责', '职责描述'], achievements: ['工作业绩', '工作成果', '业绩'], leaveReason: ['离职原因'] },
    projects: { name: ['项目名称', '项目名', 'projectname', 'project'], role: ['项目角色', '项目职务', '项目角色职责'], startDate: ['开始时间', '项目开始时间'], endDate: ['结束时间', '项目结束时间'], description: ['项目描述', '项目内容', '项目介绍'], responsibilities: ['主要职责', '项目职责', '职责描述'], outcomes: ['项目成果', '项目业绩', '成果'] },
    campus: { organization: ['组织名称', '社团名称', '学生组织'], position: ['职务', '职位', '岗位'], startDate: ['开始时间'], endDate: ['结束时间'], description: ['经历描述', '工作内容', '职责'], achievements: ['主要成果', '成果', '荣誉'] },
    other: { specialties: ['特长'], hobbies: ['兴趣爱好', '爱好'], selfEvaluation: ['自我评价', '个人评价'], strengths: ['个人优势'], relativeAtCompany: ['是否有亲属在本单位工作', '亲属在本单位'], overseasExperience: ['是否有海外学习工作经历', '海外学习工作经历', '海外经历'], acceptsTransfer: ['是否接受岗位调剂', '接受岗位调剂'], notes: ['其他说明', '备注'] },
  };
  const record = (fields) => Object.fromEntries(fields.map((field) => [field, '']));
  const createEmptyEducation = () => record(Object.keys(labels.education));
  const createEmptyWork = () => record(Object.keys(labels.work));
  const createEmptyProject = () => record(Object.keys(labels.projects));
  const createEmptyCampus = () => record(Object.keys(labels.campus));
  const createEmptyResume = () => ({ schemaVersion: 2, basic: record(Object.keys(labels.basic)), job: record(Object.keys(labels.job)), education: [], work: [], projects: [], campus: [], certificatesSkills: { certificates: [], languages: [], softwareSkills: [], professionalSkills: [] }, awards: [], family: [], other: { ...record(Object.keys(labels.other)), unmapped: [] } });
  const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  const isStandardResume = (value) => isObject(value) && Number(value.schemaVersion) === 2 && isObject(value.basic) && isObject(value.job) && Array.isArray(value.education) && Array.isArray(value.work) && Array.isArray(value.projects);
  function propertyFor(map, sourceKey) { const wanted = keyText(sourceKey); return Object.keys(map).find((property) => map[property].some((alias) => keyText(alias) === wanted)) || null; }
  function assignEmptyFirst(target, property, value) { if (property && !text(target[property]) && text(value)) target[property] = text(value); }
  function splitRange(value) { const parts = text(value).split(/\s*(?:至|—|–|~|-|\u2013|\u2014)\s*/).filter(Boolean); return { startDate: parts[0] || '', endDate: parts.slice(1).join(' 至 ') || '' }; }
  function preserve(output, group, key, value) { if (text(value)) output.other.unmapped.push({ group: text(group), key: text(key), value: text(value) }); }
  function hasValues(item) { return Object.values(item).some((value) => text(value)); }
  function normalizeStandard(source) {
    const output = createEmptyResume();
    Object.keys(labels.basic).forEach((key) => assignEmptyFirst(output.basic, key, source.basic && source.basic[key]));
    Object.keys(labels.job).forEach((key) => assignEmptyFirst(output.job, key, source.job && source.job[key]));
    // A Schema V2 value can already be a user-edited resume.  Preserve its
    // explicit empty cards so "add education/work/project" does not vanish
    // merely because the user saves before completing every field.  Legacy
    // parser input continues through normalizeResume below, which still drops
    // records that were never parsed.
    const normalizeRecords = (items, create) => (Array.isArray(items) ? items : []).map((item) => {
      const next = create(); Object.keys(next).forEach((key) => assignEmptyFirst(next, key, item && item[key])); return next;
    });
    output.education = normalizeRecords(source.education, createEmptyEducation, 'education');
    output.work = normalizeRecords(source.work, createEmptyWork, 'work');
    output.projects = normalizeRecords(source.projects, createEmptyProject, 'projects');
    output.campus = normalizeRecords(source.campus, createEmptyCampus, 'campus');
    ['certificates', 'languages', 'softwareSkills', 'professionalSkills'].forEach((key) => { output.certificatesSkills[key] = Array.isArray(source.certificatesSkills && source.certificatesSkills[key]) ? source.certificatesSkills[key].map(text).filter(Boolean) : []; });
    output.awards = Array.isArray(source.awards) ? copy(source.awards) : [];
    output.family = Array.isArray(source.family) ? copy(source.family) : [];
    Object.keys(labels.other).forEach((key) => assignEmptyFirst(output.other, key, source.other && source.other[key]));
    output.other.unmapped = Array.isArray(source.other && source.other.unmapped) ? copy(source.other.unmapped).filter((item) => isObject(item) && text(item.value)) : [];
    return output;
  }
  function normalizeResume(source) {
    if (isStandardResume(source)) return normalizeStandard(source);
    if (!isObject(source)) return createEmptyResume();
    const output = createEmptyResume();
    Object.entries(source).forEach(([group, fields]) => {
      if (!isObject(fields)) return;
      const groupName = text(group); const kind = /项目/.test(groupName) ? 'projects' : /工作|实习|任职/.test(groupName) ? 'work' : /教育|学历|学校|院校/.test(groupName) ? 'education' : /校园|社团|学生会/.test(groupName) ? 'campus' : /证书|技能|语言|软件/.test(groupName) ? 'skills' : /获奖|荣誉|奖励/.test(groupName) ? 'awards' : /家庭|亲属/.test(groupName) ? 'family' : /求职|应聘|意向/.test(groupName) ? 'job' : /基本|个人|联系/.test(groupName) ? 'basic' : 'other';
      if (kind === 'skills') { Object.entries(fields).forEach(([key, value]) => { const valueText = text(value); if (!valueText) return; const bucket = /证书|资格/.test(key) ? 'certificates' : /语言|外语/.test(key) ? 'languages' : /软件|工具/.test(key) ? 'softwareSkills' : 'professionalSkills'; output.certificatesSkills[bucket].push(valueText); }); return; }
      if (kind === 'awards') { Object.entries(fields).forEach(([key, value]) => { if (text(value)) output.awards.push({ name: text(key), detail: text(value) }); }); return; }
      if (kind === 'family') { const family = {}; Object.entries(fields).forEach(([key, value]) => { if (text(value)) family[text(key)] = text(value); }); if (Object.keys(family).length) output.family.push(family); return; }
      const map = aliases[kind] || aliases.other;
      const target = kind === 'basic' ? output.basic : kind === 'job' ? output.job : kind === 'other' ? output.other : null;
      const item = kind === 'education' ? createEmptyEducation() : kind === 'work' ? createEmptyWork() : kind === 'projects' ? createEmptyProject() : kind === 'campus' ? createEmptyCampus() : null;
      Object.entries(fields).forEach(([key, value]) => {
        const valueText = text(value);
        if (item && /工作时间|项目时间|任职时间|起止时间/.test(key)) { const range = splitRange(valueText); assignEmptyFirst(item, 'startDate', range.startDate); assignEmptyFirst(item, 'endDate', range.endDate); return; }
        const property = propertyFor(map, key);
        if (!property) { preserve(output, groupName, key, valueText); return; }
        assignEmptyFirst(item || target, property, valueText);
      });
      if (item && hasValues(item)) output[kind].push(item);
    });
    return output;
  }
  return { labels, aliases, createEmptyResume, createEmptyEducation, createEmptyWork, createEmptyProject, createEmptyCampus, isStandardResume, normalizeResume };
});
