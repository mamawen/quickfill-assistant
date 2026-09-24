(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ResumeQuickFillGenericSiteRules = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  return {
    hostPattern: '*',
    fieldRules: [],
    controlHints: {
      customSelect: '[role="combobox"]',
      searchableSelect: '[aria-autocomplete="list"]',
      cascader: '[data-rqf-cascader-level]',
      datePicker: '[data-rqf-date-option="true"]'
    },
    valueMappings: {}
  };
});
