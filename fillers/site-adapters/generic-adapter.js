(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./base-adapter.js'), require('./custom-select-adapter.js'), require('./searchable-select-adapter.js'), require('./cascader-adapter.js'), require('./date-picker-adapter.js'));
  else root.ResumeQuickFillGenericSiteAdapter = factory(root.ResumeQuickFillBaseSiteAdapter, root.ResumeQuickFillCustomSelectAdapter, root.ResumeQuickFillSearchableSelectAdapter, root.ResumeQuickFillCascaderAdapter, root.ResumeQuickFillDatePickerAdapter);
})(typeof window !== 'undefined' ? window : globalThis, function (base, customSelect, searchableSelect, cascader, datePicker) {
  'use strict';
  const create = base && base.createBaseAdapter ? base.createBaseAdapter : (config) => config;
  return create({
    id: 'generic',
    matches: () => true,
    tryFill(plan, document) {
      const type = plan && plan.controlType;
      if (type === 'province-city-district-cascade' || type === 'cascader') return cascader.tryFill(plan, document);
      if (type === 'custom-searchable-select' || type === 'searchable-select' || type === 'autocomplete') return searchableSelect.tryFill(plan, document);
      if (type === 'custom-select') return customSelect.tryFill(plan, document);
      if (type === 'date-picker') return datePicker.tryFill(plan, document);
      return { status: 'UNSUPPORTED_CONTROL', reason: '该复杂控件暂不支持自动填写' };
    },
    async tryFillAsync(plan, document, settings) {
      const type = plan && plan.controlType;
      const target = type === 'province-city-district-cascade' || type === 'cascader' ? cascader
        : type === 'custom-searchable-select' || type === 'searchable-select' || type === 'autocomplete' ? searchableSelect
          : type === 'custom-select' ? customSelect : type === 'date-picker' ? datePicker : null;
      if (!target) return { status: 'UNSUPPORTED_CONTROL', reason: '该复杂控件暂不支持自动填写' };
      return typeof target.tryFillAsync === 'function' ? target.tryFillAsync(plan, document, settings) : target.tryFill(plan, document);
    }
  });
});
