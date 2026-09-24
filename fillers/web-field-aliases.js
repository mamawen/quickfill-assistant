(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./value-normalizer.js'));
  else root.ResumeQuickFillWebAliases = factory(root.ResumeQuickFillValue);
})(typeof window !== 'undefined' ? window : globalThis, function (valueTools) {
  'use strict';

  const normalize = valueTools && valueTools.normalizeText || ((value) => String(value || '').trim().toLocaleLowerCase());
  const fields = [
    ['name', 'basic.name', ['姓名', '中文姓名', '真实姓名', '名字', 'name', 'full name']],
    ['firstName', 'basic.firstName', ['名', '名字', 'first name', 'given name']],
    ['lastName', 'basic.lastName', ['姓', 'last name', 'family name']],
    ['namePinyin', 'basic.namePinyin', ['姓名拼音', '姓名全拼', '拼音', 'name pinyin']],
    ['firstNamePinyin', 'basic.firstNamePinyin', ['名拼音', '名字拼音', 'first name pinyin']],
    ['lastNamePinyin', 'basic.lastNamePinyin', ['姓拼音', 'last name pinyin']],
    ['phone', 'basic.phone', ['手机号', '手机号码', '联系电话', '移动电话', '联系手机', '本人手机', '手机', 'phone', 'mobile']],
    ['email', 'basic.email', ['电子邮箱', '邮箱', '电子邮件', 'email', 'e mail']],
    ['gender', 'basic.gender', ['性别', 'gender', 'sex']],
    ['ethnicity', 'basic.ethnicity', ['民族', 'ethnicity']],
    ['birthDate', 'basic.birthDate', ['出生日期', '出生年月', '生日', 'birth date']],
    ['countryCode', 'basic.countryCode', ['国家区号', '电话区号', 'country code']],
    ['idType', 'basic.idType', ['证件类型', '证件类别', 'id type']],
    ['politicalStatus', 'basic.politicalStatus', ['政治面貌', '政治身份', '党派']],
    ['sourceRegion', 'basic.sourceRegion', ['生源地', '生源', '生源地区', '生源所在地', '高考生源地', '生源省份']],
    ['nativePlace', 'basic.nativePlace', ['籍贯', '籍贯所在地', '籍贯地区', '籍贯省份', '祖籍']],
    ['currentResidence', 'basic.currentResidence', ['现居住地', '现住址', '居住地', '现所在地']],
    ['idNumber', 'basic.idNumber', ['身份证号', '身份证号码', '证件号码']],
    ['currentAddress', 'basic.currentAddress', ['现居住地址', '现住地址', '当前地址']],
    ['emergencyContactName', 'basic.emergencyContactName', ['紧急联系人姓名', '紧急联系人']],
    ['emergencyContactPhone', 'basic.emergencyContactPhone', ['紧急联系人电话', '紧急联系人手机号']],
    ['qq', 'basic.qq', ['qq', 'QQ']],
    ['wechat', 'basic.wechat', ['微信号', '微信', 'wechat']],
    ['nationality', 'basic.nationality', ['国籍', 'nationality']],
    ['countryRegion', 'basic.countryRegion', ['国籍/地区', '所属国家/地区', '国家/地区', 'country region']],
    ['maritalStatus', 'basic.maritalStatus', ['婚姻状况', '婚姻']],
    ['healthStatus', 'basic.healthStatus', ['健康状况', '健康']],
    ['height', 'basic.height', ['身高']],
    ['address', 'basic.address', ['通讯地址', '联系地址', '住址', '地址']],
    ['postalCode', 'basic.postalCode', ['邮政编码', '邮编']],
    ['photo', 'basic.photo', ['个人照片', '证件照', '照片', 'photo']],
    ['jobCompany', 'job.company', ['应聘单位', '目标单位']],
    ['jobPosition', 'job.position', ['应聘岗位', '目标岗位', '求职岗位', '岗位名称']],
    ['firstPreference', 'job.firstPreference', ['第一志愿', '第一意向']],
    ['secondPreference', 'job.secondPreference', ['第二志愿', '第二意向']],
    ['expectedLocation', 'job.expectedLocation', ['期望工作地点', '期望地点', '期望城市']],
    ['acceptsTransfer', 'job.acceptsTransfer', ['是否服从调剂', '是否接受调剂', '服从调剂']],
    ['availableDate', 'job.availableDate', ['期望到岗时间', '到岗时间', '可到岗时间']],
    ['expectedCity', 'job.expectedCity', ['期望城市', '意向城市', 'expected city']],
    ['expectedPosition', 'job.expectedPosition', ['期望职位', '意向岗位', 'expected position']],
    ['salaryExpectation', 'job.salaryExpectation', ['期望薪资', '薪资要求', 'salary expectation']],
    ['monthlySalary', 'job.monthlySalary', ['期望月薪', '月薪期望', 'monthly salary']],
    ['annualSalary', 'job.annualSalary', ['期望年薪', '年薪期望', 'annual salary']],
    ['applicationSource', 'job.applicationSource', ['招聘信息来源', '招聘来源', '信息来源', 'application source']],
    ['school', 'education[].school', ['学校名称', '毕业院校', '院校名称', '就读院校', '学校']],
    ['major', 'education[].major', ['所学专业', '专业名称', '专业']],
    ['degree', 'education[].degree', ['学历层次', '最高学历', '学历']],
    ['degreeTitle', 'education[].degreeTitle', ['学位名称', '学位']],
    ['majorRank', 'education[].majorRank', ['专业排名']],
    ['educationLevel', 'education[].educationLevel', ['教育程度', '教育层次', 'education level']],
    ['educationDepartment', 'education[].department', ['院系', '学院', '系别', '所属院系', 'department']],
    ['educationAdvisor', 'education[].advisor', ['导师', '指导教师', '指导老师', 'advisor']],
    ['educationSecondMajor', 'education[].secondMajor', ['第二专业', '第二学位专业', 'second major']],
    ['educationStartDate', 'education[].startDate', ['入学时间', '教育开始时间', 'study start date']],
    ['educationEndDate', 'education[].endDate', ['毕业时间', '教育结束时间', 'graduation date']],
    ['educationCountryRegion', 'education[].countryRegion', ['学校所在国家/地区', '教育国家/地区', '所属国家/地区', 'school country region']],
    ['schoolType', 'education[].schoolType', ['学校类型', '院校类型', 'school type']],
    ['studyMode', 'education[].studyMode', ['学习方式', '学习形式', '培养方式', 'study mode']],
    ['ranking', 'education[].ranking', ['排名', '综合排名', 'ranking']],
    ['gpa', 'education[].gpa', ['绩点', '平均绩点', 'gpa']],
    ['company', 'work[].companyName', ['公司名称', '任职公司', '工作单位', '单位名称']],
    ['position', 'work[].position', ['职位名称', '职务', '职位', '岗位']],
    ['workDescription', 'work[].workContent', ['工作描述', '工作职责', '岗位职责', '工作内容']],
    ['department', 'work[].department', ['部门', '所属部门', 'department']],
    ['industry', 'work[].industry', ['行业', '所属行业', 'industry']],
    ['employmentType', 'work[].employmentType', ['雇佣类型', '工作性质', 'employment type']],
    ['projectName', 'projects[].name', ['项目名称', '项目名']],
    ['projectRole', 'projects[].role', ['项目角色', '项目职责', '项目职务']],
    ['projectDescription', 'projects[].description', ['项目描述', '项目内容', '项目介绍']],
    ['languageType', 'language[].type', ['外语', '外语类型', '语言类型', '语种', 'language type']],
    ['languageLevel', 'language[].level', ['外语等级', '语言等级', '语言能力', 'language level']],
    ['languageScore', 'language[].score', ['外语成绩', '语言成绩', '英语成绩', 'language score']],
    ['mailingProvince', 'basic.mailingAddress.province', ['邮寄地址省份', '通讯地址省份']],
    ['mailingCity', 'basic.mailingAddress.city', ['邮寄地址城市', '通讯地址城市']],
    ['mailingDistrict', 'basic.mailingAddress.district', ['邮寄地址区县', '通讯地址区县']],
    ['mailingDetail', 'basic.mailingAddress.detail', ['邮寄详细地址', '通讯详细地址']],
    ['hobbies', 'other.hobbies', ['兴趣爱好', '爱好', 'hobbies']],
    ['languageCertificate', 'language[].certificate', ['语言证书', '外语证书', 'language certificate']],
    ['selfIntroduction', 'other.selfIntroduction', ['自我介绍', '个人介绍', 'self introduction']],
  ].map(([semantic, schemaPath, aliases]) => ({ semantic, schemaPath, aliases, displayName: aliases[0] || semantic }));

  function resolveField(label) {
    const source = normalize(label); if (!source) return null;
    const exact = fields.filter((field) => field.aliases.some((alias) => normalize(alias) === source));
    if (exact.length === 1) return exact[0];
    const partial = fields.filter((field) => field.aliases.some((alias) => { const wanted = normalize(alias); return wanted.length >= 3 && source.includes(wanted); }));
    return partial.length === 1 ? partial[0] : null;
  }
  function lookupBySemantic(semantic) { return fields.find((field) => field.semantic === semantic) || null; }
  return { fields, resolveField, lookupBySemantic };
});
