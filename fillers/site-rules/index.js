(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./generic-rules.js'));
  else root.ResumeQuickFillSiteRules = factory(root.ResumeQuickFillGenericSiteRules);
})(typeof window !== 'undefined' ? window : globalThis, function (generic) {
  'use strict';
  const rules = [generic].filter(Boolean);
  function forLocation(location = {}) { return rules.find((rule) => rule.hostPattern === '*' || String(location.hostname || '').endsWith(rule.hostPattern)) || generic; }
  return { rules, forLocation };
});
