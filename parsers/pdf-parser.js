(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ResumeQuickFillPdf = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  let pdfjsLib = null;
  let pdfJsDocumentOptions = {};

  function pdfError(code, message, diagnostics) {
    const error = new Error(message || code);
    error.code = code;
    if (diagnostics) error.diagnostics = diagnostics;
    return error;
  }

  function configurePdfJs(library, workerSrc, documentOptions) {
    if (!library || typeof library.getDocument !== 'function') throw new Error('invalid_pdfjs_library');
    pdfjsLib = library;
    pdfJsDocumentOptions = documentOptions && typeof documentOptions === 'object' ? { ...documentOptions } : {};
    if (pdfjsLib.GlobalWorkerOptions && workerSrc) pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
  }

  function rebuildPageText(items) {
    let text = '';
    let previous = null;
    for (const item of items || []) {
      const value = String(item && item.str || '').trim();
      if (!value) continue;
      const transform = item.transform || [];
      const x = Number(transform[4]) || 0;
      const y = Number(transform[5]) || 0;
      const fontHeight = Math.max(1, Math.abs(Number(transform[3])) || 10);
      const shouldBreakLine = previous && (item.hasEOL || Math.abs(y - previous.y) > Math.max(2, fontHeight * 0.45));
      const shouldAddSpace = previous && !shouldBreakLine && x > previous.x + previous.width + Math.max(1, fontHeight * 0.15);
      if (shouldBreakLine) text += '\n'; else if (shouldAddSpace) text += ' ';
      text += value;
      previous = { x, y, width: Number(item.width) || value.length * fontHeight * 0.5 };
    }
    return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function logPageTextContent(pageNumber, items, pageText) {
    if (typeof globalThis === 'undefined' || globalThis.__RESUME_QUICK_FILL_DEBUG__ !== true) return;
    if (typeof console === 'undefined' || typeof console.info !== 'function') return;
    const previewItems = (items || []).slice(0, 20).map((item) => ({
      str: String(item && item.str || ''),
      fontName: String(item && item.fontName || ''),
      hasEOL: Boolean(item && item.hasEOL),
      transform: Array.isArray(item && item.transform) ? item.transform : [],
    }));
    console.info('[ResumeQuickFill][PDF] page-text-content', JSON.stringify({
      pageNumber,
      itemCount: (items || []).length,
      nonEmptyItemCount: (items || []).filter((item) => String(item && item.str || '').trim()).length,
      decodedCharCount: pageText.length,
      items: previewItems,
    }));
  }

  function countTextOperators(operatorList) {
    const ops = pdfjsLib && pdfjsLib.OPS;
    if (!ops || !operatorList || !Array.isArray(operatorList.fnArray)) return 0;
    const names = ['showText', 'showSpacedText', 'nextLineShowText', 'nextLineSetSpacingShowText'];
    const textOps = new Set(names.map((name) => ops[name]).filter((value) => Number.isInteger(value)));
    return operatorList.fnArray.filter((operation) => textOps.has(operation)).length;
  }

  async function parsePdf(input) {
    if (!pdfjsLib) throw pdfError('pdfjs_unavailable', 'pdfjs_unavailable');
    let loadingTask;
    let documentProxy;
    try {
      // PDF.js rejects Node's Buffer subclass even though it inherits Uint8Array.
      // Copy every typed-array input into a plain Uint8Array so the public parser
      // contract behaves identically in local tests and Chrome file uploads.
      const data = new Uint8Array(input);
      loadingTask = pdfjsLib.getDocument({ data, ...pdfJsDocumentOptions });
      documentProxy = await loadingTask.promise;
    } catch (error) {
      throw pdfError('pdf_open_failed', 'pdf_open_failed');
    }
    const pageCount = documentProxy.numPages || 0;
    let textItemCount = 0;
    let pagesWithText = 0;
    let textOperatorCount = 0;
    let pagesWithTextOperators = 0;
    const pages = [];
    try {
      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        let page;
        let textContent;
        try {
          page = await documentProxy.getPage(pageNumber);
          textContent = await page.getTextContent();
        } catch (error) {
          throw pdfError('pdf_text_extract_failed', 'pdf_text_extract_failed');
        }
        const items = (textContent && textContent.items) || [];
        textItemCount += items.filter((item) => String(item && item.str || '').trim()).length;
        const pageText = rebuildPageText(items);
        logPageTextContent(pageNumber, items, pageText);
        if (pageText) { pagesWithText += 1; pages.push(pageText); }
        else if (page && typeof page.getOperatorList === 'function') {
          try {
            const count = countTextOperators(await page.getOperatorList());
            if (count) { textOperatorCount += count; pagesWithTextOperators += 1; }
          } catch (error) { /* Diagnostics only: text extraction remains authoritative. */ }
        }
      }
      const text = pages.join('\n\n').trim();
      const diagnostics = { pageCount, textItemCount, decodedCharCount: text.length, pagesWithText, textOperatorCount, pagesWithTextOperators };
      if (!text) {
        const code = pagesWithTextOperators > 0 ? 'pdf_text_encoding_unreliable' : 'pdf_no_text';
        throw pdfError(code, code === 'pdf_no_text' ? 'no_extractable_text' : 'pdf_text_encoding_unreliable', diagnostics);
      }
      return { text, ...diagnostics };
    } finally {
      if (documentProxy && typeof documentProxy.destroy === 'function') await documentProxy.destroy();
      else if (loadingTask && typeof loadingTask.destroy === 'function') await loadingTask.destroy();
    }
  }

  return { configurePdfJs, parsePdf, rebuildPageText };
});
