(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ResumeQuickFillCompatibilityMetrics = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const RESULTS = new Set(['SUCCESS', 'MISS', 'MATCH_ONLY', 'WRONG_MATCH', 'NEEDS_CONFIRMATION', 'VALUE_NOT_FOUND', 'NOT_RENDERED', 'UNSUPPORTED_CONTROL']);
  const text = (value) => String(value == null ? '' : value).trim();
  const number = (value) => Math.max(0, Math.min(1, Number(value) || 0));
  function createRecord(input = {}) {
    const result = text(input.result || 'MISS');
    if (!RESULTS.has(result)) throw new Error(`不支持的兼容性结果：${result}`);
    return {
      hostname: text(input.hostname), pageType: text(input.pageType), fieldLabel: text(input.fieldLabel), schemaPath: text(input.schemaPath),
      controlType: text(input.controlType || 'UNKNOWN'), confidence: number(input.confidence), resumeValue: text(input.resumeValue),
      result, failureReason: text(input.failureReason)
    };
  }
  function category(path) {
    const top = text(path).match(/^([a-zA-Z]+)/); return top ? top[1] : 'unknown';
  }
  function bucket(records) {
    const list = records || []; const total = list.length;
    const success = list.filter((item) => item.result === 'SUCCESS').length;
    const miss = list.filter((item) => item.result === 'MISS').length;
    const wrongMatch = list.filter((item) => item.result === 'WRONG_MATCH').length;
    const needsConfirmation = list.filter((item) => item.result === 'NEEDS_CONFIRMATION').length;
    const unsupported = list.filter((item) => item.result === 'UNSUPPORTED_CONTROL').length;
    const detected = total - miss;
    const safelyFillable = list.filter((item) => ['SUCCESS', 'FAILED', 'VALUE_NOT_FOUND'].includes(item.result));
    return {
      total, success, miss, wrongMatch, needsConfirmation, unsupported,
      fieldDetectionRate: total ? detected / total : 0,
      fillSuccessRate: safelyFillable.length ? success / safelyFillable.length : 0,
      wrongMatchRate: total ? wrongMatch / total : 0,
      needsConfirmationRate: total ? needsConfirmation / total : 0,
      unsupportedControlRate: total ? unsupported / total : 0
    };
  }
  function grouped(records, selector) {
    const groups = {};
    (records || []).forEach((record) => { const key = selector(record) || 'unknown'; (groups[key] ||= []).push(record); });
    return Object.fromEntries(Object.entries(groups).map(([key, values]) => [key, bucket(values)]));
  }
  function summarize(records = []) {
    const normalized = records.map(createRecord);
    return { total: normalized.length, overall: bucket(normalized), byHostname: grouped(normalized, (record) => record.hostname), byControlType: grouped(normalized, (record) => record.controlType), bySchemaCategory: grouped(normalized, (record) => category(record.schemaPath)) };
  }
  function appendHistory(history = [], records = [], limit = 400) {
    const max = Math.max(1, Number(limit) || 400);
    return [...history, ...records].map(createRecord).slice(-max);
  }
  return { RESULTS, createRecord, summarize, appendHistory, category };
});
