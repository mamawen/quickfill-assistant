const assert = require('node:assert/strict');

const fieldContext = require('../fillers/field-context.js');
const matcher = require('../fillers/field-matcher.js');
const formMap = require('../fillers/form-map.js');

function identify(input) {
  return fieldContext.identify(fieldContext.create(input));
}

const coreCases = [
  ['PERSON_NAME', { labelText: '姓名', placeholder: '请输入姓名', name: 'fullName' }],
  ['PHONE', { labelText: '联系电话', placeholder: '请输入手机号', name: 'mobile' }],
  ['EMAIL', { labelText: '电子邮箱', placeholder: '请输入邮箱', name: 'email' }],
  ['UNIVERSITY', { labelText: '毕业院校', placeholder: '请输入学校名称', name: 'schoolName', sectionText: '教育经历' }],
  ['MAJOR', { labelText: '所学专业', placeholder: '请输入专业名称', name: 'major' }],
  ['EDUCATION_LEVEL', { labelText: '学历', placeholder: '请选择学历层次', name: 'degree' }],
  ['COMPANY', { labelText: '公司名称', placeholder: '请输入工作单位', name: 'companyName', sectionText: '工作经历' }],
  ['JOB_TITLE', { labelText: '职位名称', placeholder: '请输入岗位', name: 'position' }],
  ['EXPECTED_CITY', { labelText: '期望城市', placeholder: '请选择期望工作地点', name: 'expectedCity', sectionText: '求职意向' }],
  ['EXPECTED_SALARY', { labelText: '期望薪资', placeholder: '请输入期望月薪', name: 'expectedSalary', sectionText: '求职意向' }],
];

for (const [expected, input] of coreCases) {
  const result = identify(input);
  assert.equal(result.standardField, expected, `${expected} should use combined context`);
  assert.ok(result.confidence > 0.5, `${expected} should have multi-source confidence`);
}

assert.equal(identify({ labelText: '学校名称', name: 'schoolName' }).standardField, 'UNIVERSITY');
assert.equal(identify({ labelText: '公司名称', name: 'companyName' }).standardField, 'COMPANY');
assert.equal(identify({ labelText: '紧急联系人电话', placeholder: '请输入联系电话', name: 'emergencyPhone' }).standardField, 'UNKNOWN');
assert.equal(identify({ labelText: '学校名称', placeholder: '请输入公司名称' }).standardField, 'UNKNOWN');

const universityContext = fieldContext.create({ labelText: '毕业院校', placeholder: '请输入学校名称', name: 'schoolName', sectionText: '教育经历', inputType: 'text' });
const integration = matcher.identifyControl({ element: { tagName: 'INPUT', type: 'text' }, evidence: { fieldContext: universityContext } });
assert.equal(integration.semantic, 'school');
assert.equal(integration.standardField, 'UNIVERSITY');

const mapped = formMap.build({ controls: [{ element: { name: 'schoolName', id: '', tagName: 'INPUT' }, evidence: { label: '毕业院校', labelSource: 'label-for', fieldContext: universityContext, optionEvidence: { count: 0, samples: [] } }, elements: [], controlType: 'text-input' }] });
const mappedControl = formMap.controls(mapped)[0];
assert.equal(matcher.identifyControl(mappedControl).standardField, 'UNIVERSITY');

console.log('field context tests passed');
