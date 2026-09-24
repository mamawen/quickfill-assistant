(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./zip-reader.js'));
  else root.ResumeQuickFillDocx = factory(root.ResumeQuickFillZip);
})(typeof window !== 'undefined' ? window : globalThis, function (zip) {
  'use strict';
  function xmlUnescape(value) { return value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&'); }
  function texts(fragment) { return [...fragment.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => xmlUnescape(m[1])).join(''); }
  function tableText(fragment) { return [...fragment.matchAll(/<w:tr\b[\s\S]*?<\/w:tr>/g)].map((row) => [...row[0].matchAll(/<w:tc\b[\s\S]*?<\/w:tc>/g)].map((cell) => texts(cell[0])).filter(Boolean).join(' | ')).filter(Boolean).join('\n'); }
  function extractDocument(xml) { const blocks = []; const re = /<w:tbl\b[\s\S]*?<\/w:tbl>|<w:p\b[\s\S]*?<\/w:p>/g; let match; while ((match = re.exec(xml))) { const value = match[0].startsWith('<w:tbl') ? tableText(match[0]) : texts(match[0]); if (value.trim()) blocks.push(value.trim()); } return blocks.join('\n'); }
  async function parseDocx(input) { try { const archive = await zip.readZip(input); const xml = new TextDecoder('utf-8').decode(await archive.read('word/document.xml')); const text = extractDocument(xml).trim(); if (!text) throw new Error('no_extractable_text'); return { text, blockCount: text.split(/\n+/).length }; } catch (error) { if (/no_extractable_text/.test(error.message)) throw error; throw new Error('invalid_docx'); } }
  return { parseDocx };
});