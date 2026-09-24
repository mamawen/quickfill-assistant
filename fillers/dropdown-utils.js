(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ResumeQuickFillDropdown = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const text = (value) => String(value == null ? '' : value).trim();
  const normalize = (value) => text(value).toLocaleLowerCase().replace(/[\s：:（）()【】\[\]{}<>「」“”"'`、，,。；;！!?？\-_]/g, '');
  const attr = (node, name) => text(node && node.getAttribute && node.getAttribute(name));
  const isVisible = (node) => Boolean(node) && !node.hidden && attr(node, 'aria-hidden') !== 'true';

  function dropdownContainers(document) {
    if (!document || typeof document.querySelectorAll !== 'function') return [];
    return [...document.querySelectorAll('[role="listbox"], [data-rqf-dropdown-root], [data-rqf-dropdown], .select-dropdown, .dropdown-menu')].filter(isVisible);
  }

  function snapshotDropdowns(document) { return dropdownContainers(document); }

  function resolveContext(control, document, before = []) {
    if (!control || !document) return { status: 'VALUE_NOT_FOUND', context: null };
    const reference = attr(control, 'aria-controls') || attr(control, 'aria-owns') || attr(control, 'data-rqf-dropdown-id');
    if (reference && typeof document.getElementById === 'function') {
      const byId = document.getElementById(reference.split(/\s+/)[0]);
      if (byId) return { status: 'SUCCESS', context: byId };
    }
    const host = control.closest && control.closest('[data-rqf-dropdown-root], [role="listbox"]');
    if (host) return { status: 'SUCCESS', context: host };
    const previous = new Set(before || []);
    const fresh = dropdownContainers(document).filter((node) => !previous.has(node));
    if (fresh.length === 1) return { status: 'SUCCESS', context: fresh[0] };
    if (fresh.length > 1) return { status: 'NEEDS_CONFIRMATION', context: null };
    return { status: 'VALUE_NOT_FOUND', context: null };
  }

  function contextFor(control, document, before) { return resolveContext(control, document, before).context; }

  function visibleOptions(context) {
    if (!context || typeof context.querySelectorAll !== 'function') return [];
    return [...context.querySelectorAll('[role="option"], [role="radio"], [data-rqf-option="true"], [data-rqf-cascader-option="true"], [data-rqf-date-option="true"], [data-rqf-cascader-level]')].filter(isVisible);
  }

  function uniqueOption(options, candidates) {
    const wanted = new Set((candidates || []).map(normalize).filter(Boolean));
    const matches = (options || []).filter((node) => wanted.has(normalize(node && (node.textContent || node.innerText || node.value))));
    if (!matches.length) return { status: 'VALUE_NOT_FOUND', option: null };
    if (matches.length !== 1) return { status: 'NEEDS_CONFIRMATION', option: null };
    return { status: 'SUCCESS', option: matches[0] };
  }

  function postFillMatches(actual, candidates) {
    const wanted = new Set((candidates || []).map(normalize).filter(Boolean));
    return wanted.has(normalize(actual));
  }

  function waitForOptions(read, options = {}) {
    const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(1, options.timeoutMs) : 650;
    const intervalMs = Number.isFinite(options.intervalMs) ? Math.max(1, options.intervalMs) : 40;
    return new Promise((resolve) => {
      let complete = false; let observer = null; let interval = null; let timeout = null;
      const finish = (result) => { if (complete) return; complete = true; if (observer) observer.disconnect(); if (interval) clearInterval(interval); if (timeout) clearTimeout(timeout); resolve(result); };
      const inspect = () => { const result = read(); if (Array.isArray(result) && result.length) finish(result); };
      inspect();
      if (complete) return;
      const Observer = options.MutationObserver || (typeof MutationObserver === 'function' ? MutationObserver : null);
      const target = options.observeTarget;
      if (Observer && target) { observer = new Observer(inspect); observer.observe(target, { childList: true, subtree: true }); }
      interval = setInterval(inspect, intervalMs);
      timeout = setTimeout(() => finish(null), timeoutMs);
    });
  }

  return { text, normalize, contextFor, resolveContext, snapshotDropdowns, dropdownContainers, visibleOptions, uniqueOption, postFillMatches, waitForOptions };
});
