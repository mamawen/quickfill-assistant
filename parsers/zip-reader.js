(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ResumeQuickFillZip = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  function bytesOf(input) { return input instanceof Uint8Array ? input : new Uint8Array(input); }
  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24) >>> 0); }
  function findEnd(b) { for (let i = b.length - 22; i >= Math.max(0, b.length - 0xffff - 22); i -= 1) if (u32(b, i) === 0x06054b50) return i; return -1; }
  function text(b) { return new TextDecoder('utf-8', { fatal: false }).decode(b); }
  async function inflateRaw(data) {
    if (typeof DecompressionStream !== 'undefined') {
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }
    if (typeof require === 'function') { const zlib = require('node:zlib'); return new Uint8Array(zlib.inflateRawSync(Buffer.from(data))); }
    throw new Error('invalid_docx');
  }
  async function readZip(input) {
    const b = bytesOf(input); const end = findEnd(b); if (end < 0) throw new Error('invalid_docx');
    const count = u16(b, end + 10); const centralSize = u32(b, end + 12); const centralOffset = u32(b, end + 16); const entries = new Map(); let p = centralOffset;
    for (let i = 0; i < count; i += 1) {
      if (u32(b, p) !== 0x02014b50) throw new Error('invalid_docx');
      const method = u16(b, p + 10); const compressedSize = u32(b, p + 20); const nameLength = u16(b, p + 28); const extraLength = u16(b, p + 30); const commentLength = u16(b, p + 32); const localOffset = u32(b, p + 42); const name = text(b.subarray(p + 46, p + 46 + nameLength));
      entries.set(name, { method, compressedSize, localOffset }); p += 46 + nameLength + extraLength + commentLength;
    }
    async function read(name) {
      const entry = entries.get(name); if (!entry) throw new Error('invalid_docx'); const o = entry.localOffset;
      if (u32(b, o) !== 0x04034b50) throw new Error('invalid_docx'); const nameLength = u16(b, o + 26); const extraLength = u16(b, o + 28); const start = o + 30 + nameLength + extraLength; const compressed = b.subarray(start, start + entry.compressedSize);
      if (entry.method === 0) return compressed; if (entry.method === 8) return inflateRaw(compressed); throw new Error('invalid_docx');
    }
    return { read, entries: [...entries.keys()], centralSize };
  }
  return { readZip };
});