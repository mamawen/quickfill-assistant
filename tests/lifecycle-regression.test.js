const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const fieldAdapter = require('../field-adapter.js');
const dynamicFormMap = require('../fillers/dynamic-form-map.js');

function testNativeInputEvents() {
  const events = [];
  const inputPrototype = {};
  Object.defineProperty(inputPrototype, 'value', {
    set(value) { this._value = value; },
    get() { return this._value || ''; },
  });
  const input = Object.assign(Object.create(inputPrototype), {
    tagName: 'INPUT', type: 'text', _value: '',
    ownerDocument: { defaultView: { HTMLInputElement: function HTMLInputElement() {}, Event: class Event { constructor(type, options) { this.type = type; this.bubbles = options.bubbles; } } } },
    dispatchEvent(event) { events.push(event.type); return true; },
  });
  input.ownerDocument.defaultView.HTMLInputElement.prototype = inputPrototype;
  assert.equal(fieldAdapter.writeTextValue(input, 'Alice').ok, true);
  assert.equal(input.value, 'Alice');
  assert.deepEqual(events, ['input', 'change', 'blur']);
}

function testMutationInvalidatesCurrentPage() {
  let observer;
  class FakeObserver {
    constructor(callback) { observer = callback; }
    observe() {}
    disconnect() {}
  }
  let dirtyCalls = 0;
  let onDirtyCalls = 0;
  const document = { body: {}, documentElement: {} };
  dynamicFormMap.observe(document, { markDirty() { dirtyCalls += 1; return true; } }, { MutationObserver: FakeObserver, debounceMs: 0, onDirty() { onDirtyCalls += 1; } });
  observer([{ target: {} }]);
  return new Promise((resolve) => setTimeout(() => {
    assert.equal(dirtyCalls, 1);
    assert.equal(onDirtyCalls, 1);
    resolve();
  }, 100));
}

function testContentLifecycleContract() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8');
  assert.equal(source.includes('formMapCache'), false, 'DOM-backed form cache must not survive between executions');
  assert.equal(source.includes('lastScan'), false, 'scan results must not be stored as persistent DOM mappings');
  assert.match(source, /function resetTransientState\(/);
  assert.match(source, /function rescanCurrentPage\(/);
  assert.match(source, /function rebuildFieldMappings\(/);
  assert.match(source, /function installPageLifecycle\(/);
  assert.match(source, /finally \{ state\.autofillBusy = false;/);
  assert.ok((source.match(/startTransientExecution\(/g) || []).length >= 4, 'scan, preview, and fill must each start a fresh execution');
  assert.ok(source.includes('[QuickFill]'));
  ['start', 'reset state', 'scan DOM', 'mapping completed', 'fill completed', 'cleanup completed'].forEach((stage) => assert.ok(source.includes(`'${stage}'`)));
}

async function main() {
  testNativeInputEvents();
  await testMutationInvalidatesCurrentPage();
  testContentLifecycleContract();
  console.log('lifecycle regression tests passed');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
