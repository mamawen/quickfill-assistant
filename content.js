(() => {
  'use strict';

  if (window.top !== window) return;
  if (document.getElementById('resume-quick-fill-host')) return;

  const ui = window.ResumeQuickFillUI;
  const standardResume = window.ResumeQuickFillStandardResume;
  const editorState = window.ResumeQuickFillEditorState;
  const field = window.ResumeQuickFillField;
  const pdfParser = window.ResumeQuickFillPdf;
  const docxParser = window.ResumeQuickFillDocx;
  const resumeParser = window.ResumeQuickFillParser;
  const versionStore = window.ResumeQuickFillVersionStore;
  const panelControllerApi = window.ResumeQuickFillPanelController;
  const scanner = window.ResumeQuickFillScanner;
  const matcher = window.ResumeQuickFillMatcher;
  const autofill = window.ResumeQuickFillAutofill;
  const controlAdapter = window.ResumeQuickFillControlAdapter;
  const siteAdapters = window.ResumeQuickFillSiteAdapters;
  const formMapTools = window.ResumeQuickFillFormMap;
  const dynamicFormMap = window.ResumeQuickFillDynamicFormMap;
  const compatibilityMetrics = window.ResumeQuickFillCompatibilityMetrics;
  const fieldCategories = window.ResumeQuickFillFieldCategory;
  const REAL_SITE_MODE = '仅扫描 / 仅预览 / 仅填写';
  const PDF_DIAGNOSTIC_BUILD = 'PDF.js diagnostic build 2026-08-27-cid-diagnose';
  let pdfJsReady = null;
  const STORAGE_KEY = 'resume_grouped_data';
  const FILE_KEY = 'resume_file_name';
  const PANEL_KEY = 'resume_panel_state';
  const COMPATIBILITY_HISTORY_KEY = 'resume_compatibility_history';
  const state = {
    view: 'home', search: '', resume: null, fileName: '', currentResumeId: null, versionStore: null, versionReady: false, currentTarget: null,
    panelOpen: false, clearConfirm: false, deleteConfirmId: null, openVersionMenuId: null, lastFill: null, lastAutofill: null, lastCompatibilityReport: null, autofillBusy: false, expanded: new Set(), resumeDirty: false, savedResumeSnapshot: '',
    panel: { right: 20, top: 48, width: 390, height: Math.min(window.innerHeight - 32, 720) }, pageRevision: 0, lastUrl: location.href, pendingPageReset: false,
  };

  const host = document.createElement('div');
  host.id = 'resume-quick-fill-host';
  host.setAttribute('translate', 'no');
  host.translate = false;
  host.dataset.build = PDF_DIAGNOSTIC_BUILD;
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483646;pointer-events:none;';
  const shadow = host.attachShadow({ mode: 'open' });
  const wrap = document.createElement('div');
  wrap.className = 'rqf-root';
  shadow.appendChild(wrap);
  document.documentElement.appendChild(host);
  const storage = {
    read(key) { try { return localStorage.getItem(key); } catch { return null; } },
    write(key, value) { try { localStorage.setItem(key, value); } catch {} },
    remove(key) { try { localStorage.removeItem(key); } catch {} },
  };
  const panelController = panelControllerApi && panelControllerApi.createPanelController ? panelControllerApi.createPanelController(false) : null;

  function quickFillLog(stage, detail = '') { console.info(`[QuickFill] ${stage}${detail ? ` ${detail}` : ''}`); }
  function resetTransientState(reason = 'new execution') {
    quickFillLog('reset state', reason);
    if (state.currentTarget && state.currentTarget.classList) state.currentTarget.classList.remove('rqf-focus');
    state.currentTarget = null;
    state.lastFill = null;
    state.lastAutofill = null;
  }
  function rescanCurrentPage() {
    quickFillLog('scan DOM', `revision=${state.pageRevision}`);
    if (!scanner) return { controls: [], skipped: [], manualControls: [], formMap: null };
    const scan = scanner.scanDocument(document);
    quickFillLog('fields found:', String((scan.controls || []).length + (scan.manualControls || []).length));
    return scan;
  }
  function rebuildFieldMappings(scan) {
    const mappings = scan && scan.formMap || [...(scan && scan.controls || []), ...(scan && scan.manualControls || [])];
    quickFillLog('mapping completed', String(mappings.length));
    return mappings;
  }
  function startTransientExecution(kind) {
    quickFillLog('start', kind);
    resetTransientState(kind);
    return rescanCurrentPage();
  }
  function markPageChanged(reason) {
    state.pageRevision += 1;
    state.lastUrl = location.href;
    if (state.autofillBusy) { state.pendingPageReset = true; quickFillLog('page changed while filling', reason); return; }
    resetTransientState(`page changed: ${reason}`);
  }
  function installPageLifecycle() {
    const cache = { markDirty(mutation) { const target = mutation && mutation.target; if (target && target.closest && target.closest('#resume-quick-fill-host')) return false; return true; } };
    if (dynamicFormMap && dynamicFormMap.observe) dynamicFormMap.observe(document, cache, { onDirty() { markPageChanged('DOM mutation'); } });
    window.addEventListener('popstate', () => markPageChanged('popstate'));
    window.addEventListener('hashchange', () => markPageChanged('hashchange'));
    ['pushState', 'replaceState'].forEach((method) => {
      const original = history[method];
      if (typeof original !== 'function' || original.__quickFillWrapped) return;
      const wrapped = function (...args) { const result = original.apply(this, args); queueMicrotask(() => { if (location.href !== state.lastUrl) markPageChanged(`history.${method}`); }); return result; };
      wrapped.__quickFillWrapped = true;
      history[method] = wrapped;
    });
  }
  function fieldCategoryFor(item) { return text(item && item.fieldCategory) || (fieldCategories && fieldCategories.classify ? fieldCategories.classify(item || {}) : 'UNKNOWN_APPLICATION'); }
  function policyFor(item) { return fieldCategories && fieldCategories.policyFor ? fieldCategories.policyFor({ ...(item || {}), fieldCategory: fieldCategoryFor(item) }) : { autoFill: 'REVIEW', status: 'NEEDS_REVIEW' }; }
  function categorizeItems(items) { return (items || []).map((item) => ({ ...item, fieldCategory: fieldCategoryFor(item) })); }
  function categoryStatistics(scan) {
    const source = scan && scan.formMap && formMapTools && formMapTools.controls ? formMapTools.controls(scan.formMap) : [...(scan && scan.controls || []), ...(scan && scan.manualControls || [])];
    const counts = { CORE_APPLICATION: 0, OPTIONAL_APPLICATION: 0, FILE_UPLOAD: 0, EEO_DEMOGRAPHIC: 0, SURVEY: 0, CAPTCHA_CHALLENGE: 0, PAGE_NOISE: 0, UNKNOWN_APPLICATION: 0 };
    source.forEach((item) => { const category = fieldCategoryFor(item); if (Object.hasOwn(counts, category)) counts[category] += 1; });
    return counts;
  }

  function chromeStorageBackend() {
    const local = globalThis.chrome && chrome.storage && chrome.storage.local;
    if (!local) return null;
    const call = (method, value) => new Promise((resolve, reject) => {
      try {
        local[method](value, (result) => {
          const error = chrome.runtime && chrome.runtime.lastError;
          if (error) reject(new Error(error.message)); else resolve(result || {});
        });
      } catch (error) { reject(error); }
    });
    return { get(keys) { return call('get', keys); }, set(values) { return call('set', values); }, remove(keys) { return call('remove', keys); } };
  }
  const versionBackend = chromeStorageBackend();
  const versionRepository = versionStore && versionBackend ? versionStore.createRepository(versionBackend) : null;
  const CSS = `
    :host{all:initial}.rqf-root{font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",Arial,sans-serif;color:#111827;font-size:13px;pointer-events:none}.rqf-root *{box-sizing:border-box}.rqf-svg{width:18px;height:18px;display:block}.rqf-panel,.rqf-toast,.rqf-modal{pointer-events:auto}.rqf-panel{position:fixed;display:flex;flex-direction:column;min-width:360px;max-width:420px;min-height:320px;max-height:calc(100vh - 32px);background:#f8fafc;border:1px solid #e5e7eb;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.14);overflow:hidden;resize:both;transition:opacity .18s,transform .18s}.rqf-header{flex:none;padding:15px 16px 13px;background:#fff;border-bottom:1px solid #e5e7eb;cursor:move}.rqf-header-row{display:flex;align-items:center;gap:10px}.rqf-logo{width:30px;height:30px;border-radius:10px;background:#635bff;color:#fff;display:grid;place-items:center;font-weight:800}.rqf-brand{font-weight:750;font-size:15px;line-height:1.2}.rqf-sub{font-size:11px;color:#6b7280;margin-top:3px}.rqf-header-actions{margin-left:auto;display:flex;gap:4px}.rqf-icon{width:28px;height:28px;border:0;background:transparent;color:#6b7280;border-radius:7px;cursor:pointer;font-size:17px}.rqf-icon:hover{background:#f3f4f6;color:#111827}.rqf-status{display:flex;align-items:center;gap:6px;min-width:0;margin-top:10px;color:#6b7280;font-size:11px}.rqf-status span:last-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rqf-status-dot{width:7px;height:7px;border-radius:50%;background:#16a34a}.rqf-main{flex:1;min-height:0;overflow:auto;padding:14px}.rqf-main::-webkit-scrollbar{width:8px}.rqf-main::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:8px}.rqf-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:12px;margin-bottom:10px}.rqf-card-title{font-size:13px;font-weight:700;margin:0 0 6px;color:#111827}.rqf-muted{color:#6b7280;font-size:11px}.rqf-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px}.rqf-stat{padding:9px 7px;border:1px solid #eef0f3;border-radius:9px;background:#fafafa}.rqf-stat strong{display:block;font-size:17px;color:#111827}.rqf-stat span{font-size:10px;color:#6b7280}.rqf-section-title{display:flex;align-items:center;justify-content:space-between;margin:15px 0 8px;font-size:12px;font-weight:750}.rqf-section-title button{border:0;background:transparent;color:#635bff;font-size:11px;cursor:pointer}.rqf-field-row{display:flex;align-items:center;gap:8px;min-width:0;padding:8px 0;border-bottom:1px solid #f0f1f3}.rqf-field-row:last-child{border-bottom:0}.rqf-field-label{width:68px;flex:none;color:#6b7280;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rqf-field-value{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#111827}.rqf-field-action{flex:none;border:1px solid #d9d6ff;border-radius:8px;background:#f8f7ff;color:#554ee8;padding:4px 8px;cursor:pointer;font-size:11px}.rqf-field-action:hover{background:#eceaff}.rqf-field-action:disabled{opacity:.45;cursor:not-allowed}.rqf-resume-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:12px;margin-bottom:10px}.rqf-resume-card h4{margin:0;color:#111827;font-size:13px;overflow-wrap:anywhere}.rqf-resume-card p{margin:5px 0;color:#6b7280;font-size:11px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;white-space:pre-line}.rqf-resume-card p.expanded{display:block;-webkit-line-clamp:unset}.rqf-card-fields{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.rqf-chip{border:1px solid #e5e7eb;background:#fff;border-radius:8px;padding:5px 7px;color:#554ee8;font-size:11px;cursor:pointer;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rqf-chip:hover{border-color:#c9c5ff;background:#f8f7ff}.rqf-empty{text-align:center;padding:42px 16px 30px}.rqf-empty-logo{width:46px;height:46px;border-radius:14px;background:#eeecff;color:#635bff;display:grid;place-items:center;font-size:22px;font-weight:800;margin:0 auto 12px}.rqf-empty h2{font-size:17px;margin:0 0 7px}.rqf-empty p{color:#6b7280;line-height:1.6;margin:0 auto 14px;max-width:240px}.rqf-primary{border:0;border-radius:9px;background:#635bff;color:#fff;padding:8px 13px;cursor:pointer;font-size:12px}.rqf-primary:hover{background:#554ee8}.rqf-search-wrap{flex:none;display:flex;gap:7px;padding:10px 14px;background:#fff;border-top:1px solid #e5e7eb}.rqf-search{flex:1;min-width:0;border:1px solid #e5e7eb;border-radius:10px;background:#f9fafb;padding:9px 10px;outline:none;font:inherit;font-size:12px}.rqf-search:focus{border-color:#a7a1ff;box-shadow:0 0 0 3px #635bff18}.rqf-search-send{width:34px;border:0;border-radius:9px;background:#635bff;color:#fff;cursor:pointer}.rqf-nav{flex:none;display:grid;grid-template-columns:repeat(3,1fr);height:48px;background:#fff;border-top:1px solid #eef0f3}.rqf-nav button{border:0;background:transparent;color:#9ca3af;cursor:pointer;font:inherit;font-size:11px}.rqf-nav button.active{color:#635bff;font-weight:700}.rqf-back{border:0;background:transparent;color:#635bff;padding:0;margin:0 0 10px;cursor:pointer;font-size:12px}.rqf-settings-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #f0f1f3}.rqf-settings-row:last-child{border-bottom:0}.rqf-danger{color:#dc2626;border-color:#fecaca;background:#fff}.rqf-version-list{display:flex;flex-direction:column;gap:8px;max-height:270px;overflow:auto;padding-right:3px}.rqf-version-card{position:relative;display:flex;align-items:center;gap:8px;padding:10px;border:1px solid #e5e7eb;border-radius:10px;background:#fff}.rqf-version-current{border-color:#a7a1ff;background:#f8f7ff;box-shadow:inset 3px 0 0 #635bff}.rqf-version-info{flex:1;min-width:0}.rqf-version-name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:650;color:#111827}.rqf-version-current .rqf-version-name{color:#4f46e5}.rqf-version-meta{display:block;margin-top:3px;color:#6b7280;font-size:10px}.rqf-version-badge{display:inline-flex;align-items:center;margin-top:5px;padding:2px 6px;border-radius:999px;background:#e8e7ff;color:#554ee8;font-size:10px;font-weight:700}.rqf-version-actions{display:flex;align-items:center;gap:5px;flex:none}.rqf-version-more{width:28px;height:28px;border:1px solid #d1d5db;border-radius:8px;background:#fff;color:#4b5563;cursor:pointer;font-size:17px;line-height:1}.rqf-version-menu{position:absolute;z-index:2;right:9px;top:43px;display:flex;flex-direction:column;gap:4px;min-width:150px;padding:7px;border:1px solid #e5e7eb;border-radius:9px;background:#fff;box-shadow:0 10px 24px rgba(17,24,39,.14)}.rqf-version-menu button{text-align:left}.rqf-version-delete-warning{margin:2px 0 0;color:#92400e;font-size:10px;line-height:1.4}.rqf-modal{position:fixed;right:28px;bottom:88px;width:min(370px,calc(100vw - 40px));max-height:calc(100vh - 120px);overflow:auto;background:#fff;border:1px solid #e5e7eb;border-radius:14px;box-shadow:0 16px 40px rgba(0,0,0,.16);padding:16px}.rqf-modal h3{margin:0 0 8px;font-size:15px}.rqf-modal p{color:#6b7280;line-height:1.5;font-size:11px}.rqf-file{width:100%;margin:10px 0;padding:7px;border:1px solid #e5e7eb;border-radius:8px}.rqf-preview{background:#f8fafc;border-radius:9px;padding:9px;font-size:11px;line-height:1.6}.rqf-modal-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:12px}.rqf-secondary{border:1px solid #d1d5db;border-radius:9px;background:#fff;color:#374151;padding:7px 11px;cursor:pointer;font-size:11px}.rqf-toast{position:fixed;right:26px;bottom:84px;max-width:300px;padding:9px 12px;border-radius:9px;background:#166534;color:#fff;box-shadow:0 8px 24px #14532d44;font-size:12px}.rqf-toast.error{background:#b91c1c}.rqf-no-results{padding:28px 8px;text-align:center;color:#6b7280;font-size:12px}.rqf-focus{outline:2px solid #635bff!important;outline-offset:2px!important}.rqf-root button:focus-visible,.rqf-root input:focus-visible{outline:2px solid #635bff;outline-offset:2px}@media(max-width:500px){.rqf-panel{right:8px!important;left:8px!important;top:16px!important;width:auto!important;min-width:0!important;max-width:none;height:calc(100vh - 32px)!important}}
  `;
  const EDITOR_CSS = `.rqf-editor{padding-bottom:64px}.rqf-editor-section{margin:0 0 10px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;overflow:hidden}.rqf-editor-section>summary{cursor:pointer;list-style:none;padding:12px;font-weight:750;color:#111827}.rqf-editor-section>summary::-webkit-details-marker{display:none}.rqf-editor-section>summary:after{content:'⌄';float:right;color:#6b7280}.rqf-editor-section:not([open])>summary:after{content:'›'}.rqf-editor-content{padding:0 12px 12px}.rqf-editor-grid{display:grid;grid-template-columns:1fr;gap:9px}.rqf-editor-field{display:grid;gap:4px}.rqf-editor-field label{font-size:11px;color:#4b5563;font-weight:600}.rqf-editor-input{width:100%;border:1px solid #dfe3ea;border-radius:8px;background:#fff;padding:8px 9px;color:#111827;font:inherit;font-size:12px;outline:none}.rqf-editor-input:focus{border-color:#8b84ff;box-shadow:0 0 0 3px #635bff18}.rqf-editor-textarea{min-height:66px;resize:vertical;line-height:1.45}.rqf-editor-record{margin-top:9px;padding:10px;border:1px solid #edf0f3;border-radius:10px;background:#fafbfc}.rqf-editor-record-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;font-size:12px;font-weight:700}.rqf-editor-add{width:100%;margin-top:10px}.rqf-editor-actions{position:sticky;bottom:-14px;display:flex;gap:8px;padding:10px 0 2px;background:linear-gradient(to top,#f8fafc 78%,#f8fafcdd,transparent);z-index:2}.rqf-editor-actions button{flex:1}.rqf-editor-dirty{margin:0 0 9px;color:#a16207;font-size:11px}.rqf-editor-saved{color:#15803d}.rqf-editor-unmapped{font-size:11px;color:#6b7280;white-space:pre-wrap}.rqf-editor-empty{color:#6b7280;font-size:11px;padding:6px 0}`;
  const style = document.createElement('style'); style.textContent = CSS + EDITOR_CSS; shadow.appendChild(style);

  function text(value) { return String(value == null ? '' : value); }
  function icon(name) {
    const paths = { check: '<path d="m4 12 5 5L20 6"/>', menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', send: '<path d="m4 12 16-8-5 16-3-6-8-2Z"/>' };
    return `<svg class="rqf-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.check}</svg>`;
  }
  function safeJSON(value, fallback) { try { return JSON.parse(value) || fallback; } catch { return fallback; } }
  function loadResume() { return safeJSON(storage.read(STORAGE_KEY), null); }
  function savePanel() { storage.write(PANEL_KEY, JSON.stringify({ ...state.panel, expanded: [...state.expanded] })); }
  function loadPanel() { const saved = safeJSON(storage.read(PANEL_KEY), null); if (saved) { Object.assign(state.panel, saved); state.expanded = new Set(saved.expanded || []); } }
  function normalizeResume(data) { return standardResume && standardResume.normalizeResume ? standardResume.normalizeResume(data) : data; }
  function applyVersionStore(store) {
    state.versionStore = store || null; state.currentResumeId = store && store.currentResumeId || null;
    const current = store && store.resumes && store.resumes.find((item) => item.id === state.currentResumeId);
    state.resume = current ? normalizeResume(current.data) : null; state.fileName = current ? current.name : '';
    state.expanded = new Set(Object.keys(state.resume || {})); state.deleteConfirmId = null; state.openVersionMenuId = null; state.resumeDirty = false; state.savedResumeSnapshot = editorState && state.resume ? editorState.snapshot(state.resume) : '';
  }
  async function hydrateVersions() {
    if (!versionRepository) { state.versionReady = true; toast('本地版本存储不可用。', true); render(); return; }
    try { applyVersionStore(await versionRepository.load({ data: loadResume(), fileName: storage.read(FILE_KEY) })); }
    catch (error) { toast(`简历版本加载失败：${text(error && error.message)}`, true); }
    finally { state.versionReady = true; render(); }
  }
  async function createVersion(name, data) { if (!versionRepository) throw new Error('本地版本存储不可用'); applyVersionStore(await versionRepository.create(name, data)); return state.fileName; }
  async function saveCurrentResume() {
    if (!versionRepository || !state.resume) throw new Error('当前简历不可保存');
    state.resume = normalizeResume(state.resume); applyVersionStore(await versionRepository.saveCurrent(state.resume)); render(); toast('✓ 已保存');
  }
  function cancelResumeEdits() {
    const current = state.versionStore && state.versionStore.resumes.find((item) => item.id === state.currentResumeId);
    state.resume = current ? normalizeResume(current.data) : null; state.resumeDirty = false; state.savedResumeSnapshot = editorState && state.resume ? editorState.snapshot(state.resume) : ''; renderMain(); toast('已取消未保存修改。');
  }
  function showUnsavedVersionDialog(nextId) {
    const modal = document.createElement('section'); modal.className = 'rqf-modal'; modal.innerHTML = '<h3>有未保存修改</h3><p>切换简历版本前，请选择保存当前修改、放弃当前修改，或继续编辑。</p><div class="rqf-modal-actions"><button class="rqf-secondary rqf-cancel">继续编辑</button><button class="rqf-secondary rqf-discard">放弃并切换</button><button class="rqf-primary rqf-save">保存并切换</button></div>'; wrap.appendChild(modal);
    const switchNow = async () => { applyVersionStore(await versionRepository.select(nextId)); render(); toast(`✓ 已切换至：${state.fileName}`); };
    modal.querySelector('.rqf-cancel').onclick = () => modal.remove();
    modal.querySelector('.rqf-discard').onclick = async () => { modal.remove(); try { await switchNow(); } catch (error) { toast(`切换失败：${text(error && error.message)}`, true); } };
    modal.querySelector('.rqf-save').onclick = async () => { modal.remove(); try { await saveCurrentResume(); await switchNow(); } catch (error) { toast(`保存或切换失败：${text(error && error.message)}`, true); } };
  }
  async function selectVersion(id) { if (id === state.currentResumeId) return; if (state.resumeDirty) { showUnsavedVersionDialog(id); return; } applyVersionStore(await versionRepository.select(id)); render(); toast(`✓ 已切换至：${state.fileName}`); }
  async function renameVersion(id, name) { applyVersionStore(await versionRepository.rename(id, name)); render(); toast('简历名称已更新。'); }
  async function deleteVersion(id) { applyVersionStore(await versionRepository.remove(id)); state.view = state.resume ? 'settings' : 'home'; render(); toast(state.resume ? '简历版本已删除。' : '最后一份简历已删除。'); }
  function fieldEntries(fields) { return ui ? ui.fieldEntries(fields) : Object.entries(fields || {}).map(([key, value]) => ({ key, value: text(value) })); }
  function sections() { return ui ? ui.buildResumeSections(state.resume) : { basic: [], job: [], education: [], experience: [], projects: [], campus: [], skills: [], awards: [], family: [], other: [] }; }
  function currentLabel(target) { return field ? field.targetLabel(target) : (target ? (target.getAttribute('aria-label') || target.placeholder || target.name || target.id || '当前字段') : '请先点击网页输入框'); }
  function supported(target) { return field ? field.isSupportedTarget(target) : false; }
  function setTarget(target) { if (state.currentTarget) state.currentTarget.classList.remove('rqf-focus'); state.currentTarget = supported(target) ? target : null; if (state.currentTarget) state.currentTarget.classList.add('rqf-focus'); updateTargetStatus(); }
  function updateTargetStatus() { const node = shadow.querySelector('.rqf-target-status'); if (node) node.textContent = state.currentTarget ? `当前目标：${currentLabel(state.currentTarget)}` : '请先点击网页中的输入框'; }
  function findOption(select, value) { return field ? field.findSelectOption(select.options, value) : null; }
  function nativeSetValue(target, value) { if (field) { const result = field.writeTextValue(target, value); if (!result.ok) throw new Error(result.reason); return; } target.value = text(value); target.dispatchEvent(new Event('input', { bubbles: true })); target.dispatchEvent(new Event('change', { bubbles: true })); }
  async function copyText(value) { try { await navigator.clipboard.writeText(text(value)); } catch { const area = document.createElement('textarea'); area.value = text(value); area.style.position = 'fixed'; area.style.opacity = '0'; document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove(); } }
  function toast(message, error = false) { const old = shadow.querySelector('.rqf-toast'); if (old) old.remove(); const node = document.createElement('div'); node.className = `rqf-toast${error ? ' error' : ''}`; node.textContent = message; wrap.appendChild(node); setTimeout(() => node.remove(), 2600); }
  function temporaryHighlight(element, status) {
    if (!element || !element.style) return;
    const oldOutline = element.style.outline; const oldOffset = element.style.outlineOffset;
    const color = status === 'SUCCESS' ? '#16a34a' : '#d97706';
    element.setAttribute('data-fastfill-status', status); element.style.outline = `2px solid ${color}`; element.style.outlineOffset = '2px';
    setTimeout(() => { element.removeAttribute('data-fastfill-status'); element.style.outline = oldOutline; element.style.outlineOffset = oldOffset; }, 1800);
  }
  function pageTypeFor(documentRef) {
    if (documentRef && documentRef.querySelector && documentRef.querySelector('form, [role="form"], fieldset')) return 'application-form';
    return 'profile-or-unknown';
  }
  function compatibilityResult(value, fallback) {
    const allowed = compatibilityMetrics && compatibilityMetrics.RESULTS;
    const status = text(value || fallback || 'MISS');
    if (allowed && allowed.has(status)) return status;
    if (/SKIPPED|LOW_CONFIDENCE/.test(status)) return status === 'SKIPPED_EXISTING' ? 'MATCH_ONLY' : 'MISS';
    if (status === 'FAILED') return 'NEEDS_CONFIRMATION';
    return 'MISS';
  }
  function createCompatibilityRecords(scan, match, result, mode) {
    if (!compatibilityMetrics) return [];
    const record = (item, fallback) => compatibilityMetrics.createRecord({
      hostname: location.hostname, pageType: pageTypeFor(document), fieldLabel: text(item && item.evidence && item.evidence.label) || text(item && item.key) || text(item && item.semantic),
      schemaPath: text(item && item.schemaPath), controlType: controlAdapter && controlAdapter.controlFamily ? controlAdapter.controlFamily(item && item.controlType) : text(item && item.controlType || 'UNKNOWN').toUpperCase(),
      confidence: Number(item && item.confidence || 0), resumeValue: text(item && item.value), result: compatibilityResult(item && (item.status || item.result), fallback), failureReason: text(item && item.reason)
    });
    const rows = [];
    if (mode === 'preview' || mode === 'scan') match.plans.forEach((item) => rows.push(record({ ...item, status: 'MATCH_ONLY', reason: mode === 'scan' ? '仅扫描，未写入网页' : '仅预览，未写入网页' }, 'MATCH_ONLY')));
    else {
      [...(result.filled || []), ...(result.skipped || []), ...(result.manual || [])].forEach((item) => rows.push(record(item, 'MISS')));
    }
    (match.skipped || []).forEach((item) => rows.push(record(item, 'MISS')));
    (scan.skipped || []).filter((item) => !(scan.manualControls || []).includes(item)).forEach((item) => rows.push(record(item, 'UNSUPPORTED_CONTROL')));
    return rows;
  }
  function publishCompatibility(records) {
    if (!compatibilityMetrics) return null;
    const report = compatibilityMetrics.summarize(records); state.lastCompatibilityReport = report;
    if (versionBackend && records.length) versionBackend.get([COMPATIBILITY_HISTORY_KEY]).then((saved) => {
      const history = compatibilityMetrics.appendHistory(saved[COMPATIBILITY_HISTORY_KEY] || [], records);
      return versionBackend.set({ [COMPATIBILITY_HISTORY_KEY]: history });
    }).catch(() => {});
    const debugEnabled = window.__RESUME_QUICK_FILL_DEBUG__ === true;
    if (debugEnabled) { console.table(records); console.info('[ResumeQuickFill][Compatibility]', report); }
    return report;
  }
  function previewStatistics(scan, match) {
    const formItems = (scan && scan.formMap && scan.formMap.sections || []).reduce((total, section) => total + (section.items || []).length, 0);
    const controlsScanned = (scan && scan.controls || []).length + (scan && scan.manualControls || []).length;
    const diagnostics = match && match.diagnostics || {};
    const categories = categoryStatistics(scan);
    return { controlsScanned, formItems, semanticRecognized: diagnostics.semanticRecognized || 0, resumeMatched: diagnostics.resumeMatched || 0, unknown: categories.UNKNOWN_APPLICATION, categories };
  }
  function showAutofillReport(result) {
    const old = shadow.querySelector('.rqf-autofill-report'); if (old) old.remove();
    const modal = document.createElement('section'); modal.className = 'rqf-modal rqf-autofill-report';
    const title = document.createElement('h3'); title.textContent = result.preview ? '预览识别结果' : '一键填写完成'; modal.appendChild(title);
    const summary = document.createElement('p'); const stats = result.statistics; const category = stats && stats.categories || {}; summary.textContent = result.preview ? `核心字段：${category.CORE_APPLICATION || 0}；补充字段：${category.OPTIONAL_APPLICATION || 0}；文件上传：${category.FILE_UPLOAD || 0}；需确认：${stats ? stats.unknown : 0}。其他字段：EEO/自愿披露 ${category.EEO_DEMOGRAPHIC || 0}；调查项 ${category.SURVEY || 0}；页面辅助项 ${category.PAGE_NOISE || 0}；验证码 ${category.CAPTCHA_CHALLENGE || 0}。原生扫描控件：${stats ? stats.controlsScanned : 0}；逻辑字段：${stats ? stats.formItems : 0}。不会写入网页。` : `${result.filled.length} / ${result.filled.length + result.skipped.length + result.manual.length} 已处理；成功填写：${result.filled.length} 项；已跳过：${result.skipped.length} 项；需要手动确认：${result.manual.length} 项。`; modal.appendChild(summary);
    const lines = document.createElement('div'); lines.className = 'rqf-preview';
    const diagnostics = window.__RESUME_QUICK_FILL_DEBUG__ === true;
    const add = (prefix, item, target = lines) => { const line = document.createElement('div'); const control = item.detectedControlType || item.controlType || 'unknown'; const mapping = item.schemaPath ? ` · ${item.schemaPath}` : ''; const confidence = Number.isFinite(item.confidence) ? ` · ${Math.round(item.confidence * 100)}%` : ''; const status = item.status && item.status !== 'MATCH_ONLY' ? ` · ${item.diagnosticStatus || item.status}` : ''; const evidence = diagnostics && item.evidence ? ` · labelSource: ${item.evidence.labelSource || 'none'} · evidence: ${(item.evidence.sources || []).join(',') || item.evidence.label || 'none'}` : ''; line.textContent = `${prefix} ${item.fieldLabel || item.key || item.semantic || '字段'}${item.reason ? `：${item.reason}` : ''}${mapping} · ${control}${confidence}${status}${evidence}`; target.appendChild(line); };
    const mainCategory = (item) => ['CORE_APPLICATION', 'OPTIONAL_APPLICATION', 'FILE_UPLOAD', 'UNKNOWN_APPLICATION'].includes(fieldCategoryFor(item));
    const visible = result.preview ? result.preview.filter(mainCategory) : [...result.filled, ...result.skipped, ...result.manual].filter(mainCategory);
    const other = result.preview ? result.preview.filter((item) => !mainCategory(item)) : [...result.filled, ...result.skipped, ...result.manual].filter((item) => !mainCategory(item));
    if (result.preview) visible.forEach((item) => add('→', item));
    else { visible.filter((item) => result.filled.includes(item)).forEach((item) => add('✓', item)); visible.filter((item) => result.skipped.includes(item)).forEach((item) => add('—', item)); visible.filter((item) => result.manual.includes(item)).forEach((item) => add('⚠', item)); }
    if (other.length) { const folded = document.createElement('details'); const caption = document.createElement('summary'); caption.textContent = `其他字段（${other.length}）`; folded.appendChild(caption); other.forEach((item) => add('·', item, folded)); lines.appendChild(folded); }
    if (!lines.childNodes.length) lines.textContent = '当前页面没有可安全填写的字段。'; modal.appendChild(lines);
    const actions = document.createElement('div'); actions.className = 'rqf-modal-actions'; const close = document.createElement('button'); close.className = 'rqf-primary'; close.textContent = '知道了'; close.onclick = () => modal.remove(); actions.appendChild(close); modal.appendChild(actions); wrap.appendChild(modal);
  }
  async function runAutofill() {
    if (!state.resume) { toast('请先导入本地简历。', true); return; }
    if (state.autofillBusy) return;
    if (!scanner || !matcher || !autofill) { toast('一键填写模块未加载。', true); return; }
    state.autofillBusy = true; renderMain();
    try {
      const scan = startTransientExecution('autofill'); const candidates = rebuildFieldMappings(scan); const match = matcher.createPlan(state.resume, candidates); match.plans = categorizeItems(match.plans); match.skipped = categorizeItems(match.skipped);
      const siteAdapter = siteAdapters && siteAdapters.detect ? siteAdapters.detect({ hostname: location.hostname, pathname: location.pathname, document, location }) : null;
      const executor = autofill.executePlansAsync || autofill.executePlans;
      const allowedPlans = match.plans.filter((item) => policyFor(item).autoFill === 'ALLOW');
      const policySkipped = match.plans.filter((item) => policyFor(item).autoFill === 'SKIP' || policyFor(item).autoFill === 'IGNORE').map((item) => ({ ...item, reason: policyFor(item).autoFill === 'IGNORE' ? '页面辅助项，已忽略' : '自愿披露字段默认跳过', status: policyFor(item).status }));
      const policyManual = match.plans.filter((item) => ['CONFIRM', 'MANUAL', 'REVIEW'].includes(policyFor(item).autoFill)).map((item) => ({ ...item, reason: policyFor(item).autoFill === 'REVIEW' ? '未知招聘字段，需要人工确认' : '该字段需要人工处理', status: policyFor(item).status }));
      const result = await executor(allowedPlans, { adapter: field, siteAdapter, document, allowOverwrite: false, timeoutMs: 650, intervalMs: 40 });
      const scanOnly = (scan.skipped || []).filter((item) => !(scan.manualControls || []).includes(item));
      const report = { filled: categorizeItems(result.filled), skipped: [...categorizeItems(scanOnly), ...match.skipped, ...categorizeItems(result.skipped), ...policySkipped], manual: [...categorizeItems(result.manual), ...policyManual], statistics: previewStatistics(scan, match) };
      publishCompatibility(createCompatibilityRecords(scan, match, result, 'fill'));
      result.filled.forEach((item) => temporaryHighlight(item.element, 'SUCCESS')); result.manual.forEach((item) => temporaryHighlight(item.element, item.status || 'NEEDS_CONFIRMATION'));
      const debugEnabled = window.__RESUME_QUICK_FILL_DEBUG__ === true;
      if (debugEnabled) console.table([...result.filled.map((item) => ({ field: item.key || item.semantic, schemaPath: item.schemaPath, controlType: item.controlType, confidence: item.confidence, hasResumeValue: Boolean(text(item.value)), result: 'SUCCESS' })), ...result.manual.map((item) => ({ field: item.key || item.semantic, schemaPath: item.schemaPath, controlType: item.controlType, confidence: item.confidence, hasResumeValue: Boolean(text(item.value)), result: 'MATCH_ONLY' })), ...match.skipped.map((item) => ({ field: item.key || item.semantic || 'UNKNOWN', schemaPath: item.schemaPath || '', controlType: item.controlType || 'unknown', confidence: item.confidence || 0, hasResumeValue: Boolean(text(item.value)), result: 'SKIP' }))]);
      state.lastAutofill = result.undoBatch.length ? result.undoBatch : null; state.lastFill = null; showAutofillReport(report);
      quickFillLog('fill completed', String(result.filled.length));
      toast(`一键填写完成：${result.filled.length} 项。`, result.filled.length === 0);
    } catch (error) { toast(`一键填写失败：${text(error && error.message) || '请手动填写。'}`, true); }
    finally { state.autofillBusy = false; if (state.pendingPageReset) { state.pendingPageReset = false; resetTransientState('page changed during fill'); } quickFillLog('cleanup completed'); renderMain(); }
  }
  function fillTarget(value, fieldName = '') {
    const target = state.currentTarget;
    if (!target || !supported(target) || !document.contains(target)) { toast('请先点击网页中的输入框。', true); return; }
    const old = target.isContentEditable ? target.textContent : target.type === 'checkbox' || target.type === 'radio' ? target.checked : target.value;
    try {
      const type = (target.type || '').toLowerCase(); const alias = controlAdapter && controlAdapter.classifyControl ? window.ResumeQuickFillWebAliases && window.ResumeQuickFillWebAliases.resolveField(fieldName) : null;
      if (alias && controlAdapter && controlAdapter.writePlan) { const elements = type === 'radio' && target.name ? [...document.querySelectorAll(`input[type="radio"][name="${CSS.escape(target.name)}"]`)] : [target]; controlAdapter.writePlan({ element: target, elements, semantic: alias.semantic, value }, field); }
      else if (target.tagName === 'SELECT') { const option = findOption(target, value); if (!option) throw new Error('下拉框中没有匹配选项'); nativeSetValue(target, option.value); }
      else if (target.isContentEditable) { target.textContent = text(value); target.dispatchEvent(new Event('input', { bubbles: true })); target.dispatchEvent(new Event('change', { bubbles: true })); }
      else if (type === 'checkbox') { target.checked = /^(true|1|是|同意|yes|y|选中)$/i.test(text(value).trim()); target.dispatchEvent(new Event('input', { bubbles: true })); target.dispatchEvent(new Event('change', { bubbles: true })); }
      else if (type === 'radio') { const group = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(target.name)}"]`); const choice = [...group].find((item) => item.value === text(value) || item.getAttribute('aria-label') === text(value)); if (!choice) throw new Error('单选项中没有匹配选项'); choice.checked = true; choice.dispatchEvent(new Event('input', { bubbles: true })); choice.dispatchEvent(new Event('change', { bubbles: true })); }
      else nativeSetValue(target, value);
      const actual = target.isContentEditable ? target.textContent : type === 'checkbox' || type === 'radio' ? target.checked : target.value;
      if (target.tagName !== 'SELECT' && type !== 'checkbox' && type !== 'radio' && text(actual) !== text(value)) throw new Error('网页未接受该值，已复制到剪贴板');
      state.lastFill = { target, old, type, editable: target.isContentEditable }; toast(`✓ 已填写：${text(value).slice(0, 36)}`);
    } catch (error) { copyText(value); toast(`${error.message}，已复制到剪贴板。`, true); }
  }
  function undo() { if (state.lastAutofill && autofill) { autofill.undoBatch(state.lastAutofill, { adapter: field }); state.lastAutofill = null; toast('已撤销本次一键填写。'); return; } const item = state.lastFill; if (!item || !document.contains(item.target)) { toast('没有可撤销的填写记录。', true); return; } if (item.editable) item.target.textContent = item.old; else if (item.type === 'checkbox' || item.type === 'radio') item.target.checked = item.old; else nativeSetValue(item.target, item.old); state.lastFill = null; toast('已撤销上次填写。'); }
  function parseRows(rows) {
    const normalized = rows.filter((row) => Array.isArray(row) && row.some((value) => text(value).trim()));
    if (!normalized.length || normalized[0].slice(0, 3).map((v) => text(v).trim()).join('|') !== '信息分类|字段名|值') throw new Error('表头必须是：信息分类、字段名、值');
    const grouped = {};
    normalized.slice(1).forEach((row) => { const group = text(row[0]).trim(); const key = text(row[1]).trim(); const value = row[2] == null ? '' : text(row[2]); if (!group || !key) return; if (!grouped[group]) grouped[group] = {}; if (Object.prototype.hasOwnProperty.call(grouped[group], key)) throw new Error(`重复字段：${group} / ${key}`); grouped[group][key] = value; });
    if (!Object.keys(grouped).length) throw new Error('没有可导入的字段');
    return normalizeResume(grouped);
  }
  async function parseSpreadsheet(bytes, extension) { const isCsv = extension === 'csv'; const input = isCsv ? new TextDecoder('utf-8').decode(bytes) : bytes; const workbook = window.XLSX.read(input, { type: isCsv ? 'string' : 'array', raw: false }); const sheetName = workbook.SheetNames.find((name) => { const sheet = workbook.Sheets[name]; return window.XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }).some((r) => r.some((v) => text(v).trim())); }); if (!sheetName) throw new Error('没有非空工作表'); const rows = window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false }); return { data: parseRows(rows), sheetName, source: 'XLSX/CSV' }; }
  function diagnostic(scope, details) { if (window.__RESUME_QUICK_FILL_DEBUG__ === true) console.info(`[ResumeQuickFill][${scope}] ${details.stage}`, JSON.stringify(details)); }
  function importError(code, message) { const error = new Error(message); error.code = code; return error; }
  async function loadLocalPdfJs() {
    if (pdfJsReady) return pdfJsReady;
    pdfJsReady = (async () => {
      const runtime = globalThis.chrome && chrome.runtime;
      if (!runtime || !runtime.getURL || !pdfParser || !pdfParser.configurePdfJs) throw importError('pdfjs_unavailable', 'pdfjs_unavailable');
      const libraryUrl = runtime.getURL('vendor/pdfjs/pdf.mjs');
      const workerUrl = runtime.getURL('vendor/pdfjs/pdf.worker.mjs');
      const cMapUrl = runtime.getURL('vendor/pdfjs/cmaps/');
      const library = await import(libraryUrl);
      pdfParser.configurePdfJs(library, workerUrl, { cMapUrl, cMapPacked: true });
      diagnostic('PDF', { stage: 'pdfjs-ready', version: library.version || 'unknown', workerUrl, cMapUrl, cMapPacked: true });
    })();
    return pdfJsReady;
  }
  function previewAutofill() {
    if (!state.resume) { toast('请先导入本地简历。', true); return; }
    if (!scanner || !matcher) { toast('预览模块未加载。', true); return; }
    const scan = startTransientExecution('preview'); const match = matcher.createPlan(state.resume, rebuildFieldMappings(scan)); match.plans = categorizeItems(match.plans); match.skipped = categorizeItems(match.skipped);
    const preview = [...match.plans.map((item) => ({ ...item, reason: `表单映射；值：${text(item.value)}；${REAL_SITE_MODE}`, status: 'MATCH_ONLY' })), ...match.skipped.map((item) => ({ ...item, status: item.diagnosticStatus || item.status }))];
    publishCompatibility(createCompatibilityRecords(scan, match, { filled: [], skipped: [], manual: [] }, 'preview'));
    showAutofillReport({ preview, filled: [], skipped: match.skipped, manual: [], statistics: previewStatistics(scan, match) });
  }
  function scanCurrentPage() {
    if (!scanner || !matcher) { toast('扫描模块未加载。', true); return; }
    const scan = startTransientExecution('scan');
    const candidates = rebuildFieldMappings(scan);
    const match = state.resume ? matcher.createPlan(state.resume, candidates) : { plans: [], skipped: [] }; match.plans = categorizeItems(match.plans); match.skipped = categorizeItems(match.skipped);
    const scanOnly = (scan.skipped || []).filter((item) => !(scan.manualControls || []).includes(item));
    const preview = [...match.plans.map((item) => ({ ...item, reason: '仅扫描，未写入网页', status: 'MATCH_ONLY' })), ...match.skipped.map((item) => ({ ...item, status: item.diagnosticStatus || item.status }))];
    publishCompatibility(createCompatibilityRecords(scan, match, { filled: [], skipped: scanOnly, manual: [] }, 'scan'));
    showAutofillReport({ preview, filled: [], skipped: [...scanOnly, ...match.skipped], manual: [], statistics: previewStatistics(scan, match) });
    toast(`页面扫描完成：${candidates.length} 个候选控件，未写入网页。`);
  }
  async function parseDocument(file, bytes, extension) {
    if (!pdfParser || !docxParser || !resumeParser) throw importError('parser_unavailable', '解析器未加载');
    let result;
    try { if (extension === 'pdf') { await loadLocalPdfJs(); diagnostic('PDF', { stage: 'parser-start' }); } result = extension === 'pdf' ? await pdfParser.parsePdf(bytes) : await docxParser.parseDocx(bytes); }
    catch (error) { diagnostic(extension === 'pdf' ? 'PDF' : 'DOCX', { stage: 'parser', errorName: error && error.name, errorMessage: error && error.message, code: error && error.code, diagnostics: error && error.diagnostics }); throw error; }
    if (extension === 'pdf') diagnostic('PDF', { stage: 'parser-result', pageCount: result.pageCount, textItemCount: result.textItemCount, decodedCharCount: result.decodedCharCount, pagesWithText: result.pagesWithText, textPreview: text(result.text).slice(0, 200) });
    if (!result.text || result.text.trim().length < 12) throw importError('resume_content_too_short', '内容太少，无法可靠识别');
    let rawData; let data;
    try { diagnostic('ResumeParser', { stage: 'start' }); rawData = resumeParser.parseResumeText(result.text); if (!Object.keys(rawData || {}).length) throw new Error('empty_resume'); data = normalizeResume(rawData); }
    catch (error) { diagnostic('ResumeParser', { stage: 'error', errorName: error && error.name, errorMessage: error && error.message }); throw importError('resume_parser_failed', 'resume_parser_failed'); }
    const groups = Object.keys(data || {}); const educationCount = (data.education || []).length; const experienceCount = (data.work || []).length; const projectCount = (data.projects || []).length;
    diagnostic('ResumeParser', { basicInfo: data && data.basic ? Object.values(data.basic).filter(Boolean).length : 0, educationCount, experienceCount, projectCount });
    if (!groups.length) throw importError('resume_parser_failed', 'resume_parser_failed');
    diagnostic('Import', { stage: 'confirmation-ready' }); return { data, source: extension.toUpperCase(), text: result.text };
  }
  async function parseFile(file) { const extension = text(file.name).toLowerCase().split('.').pop(); if (extension === 'pdf') diagnostic('PDF', { stage: 'import-start', fileName: file.name, fileSize: file.size }); const bytes = new Uint8Array(await file.arrayBuffer()); if (extension === 'xlsx' || extension === 'csv') return parseSpreadsheet(bytes, extension); if (extension === 'pdf' || extension === 'docx') return parseDocument(file, bytes, extension); throw new Error('暂不支持该文件格式'); }  function showUpload() {
    const modal = document.createElement('section'); modal.className = 'rqf-modal'; modal.innerHTML = '<h3>导入简历信息</h3><p>仅在本地读取 XLSX、CSV、PDF、DOCX。XLSX/CSV 需包含：信息分类、字段名、值。</p><input class="rqf-file" type="file" accept=".xlsx,.csv,.pdf,.docx"><div class="rqf-preview rqf-upload-message">选择文件后显示预览。</div><div class="rqf-modal-actions"><button class="rqf-secondary rqf-cancel">取消</button></div>'; wrap.appendChild(modal);
    modal.querySelector('.rqf-cancel').onclick = () => modal.remove();
    modal.querySelector('.rqf-file').onchange = async (event) => {
      const file = event.target.files[0]; if (!file) return; const msg = modal.querySelector('.rqf-upload-message');
      try {
        const result = await parseFile(file); const count = ui.counts(result.data); const label = result.sheetName || result.source || file.name;
        const preview = result.text ? `\n文本预览：${result.text.slice(0, 120)}${result.text.length > 120 ? '…' : ''}` : '';
        msg.textContent = `${label}：${count.fields} 个字段，${Object.keys(result.data).length} 个分类。${preview}\n确认后保存为新的简历版本。`;
        const actions = modal.querySelector('.rqf-modal-actions'); actions.innerHTML = '<button class="rqf-secondary rqf-cancel">取消</button><button class="rqf-primary rqf-confirm">确认导入</button>';
        actions.querySelector('.rqf-cancel').onclick = () => modal.remove();
        actions.querySelector('.rqf-confirm').onclick = async () => { try { await createVersion(file.name, result.data); modal.remove(); render(); toast(`✓ 已导入并切换至：${state.fileName}`); } catch (error) { msg.textContent = `保存失败：${text(error && error.message)}`; msg.style.color = '#dc2626'; } };
      } catch (error) {
        const raw = text(error && error.message); const code = error && error.code; diagnostic('Import', { stage: 'error', errorName: error && error.name, errorMessage: raw, code, diagnostics: error && error.diagnostics }); const message = code === 'pdf_no_text' ? '当前 PDF 为扫描版或图片型 PDF，暂不支持 OCR。' : code === 'pdf_text_encoding_unreliable' ? 'PDF包含文字，但当前字体编码无法可靠解析。' : code === 'pdf_open_failed' ? 'PDF 文件读取失败或文件已损坏。' : code === 'pdf_text_extract_failed' ? 'PDF 包含文字，但文本提取失败。' : code === 'pdfjs_unavailable' ? 'PDF 解析组件未能加载，请重新加载扩展后重试。' : code === 'resume_content_too_short' ? 'PDF文字已读取，但简历内容解析失败。' : code === 'resume_parser_failed' ? '简历文字已读取，但结构识别失败。' : raw.includes('invalid_docx') ? 'Word 简历读取失败，请检查文件是否损坏。' : raw || 'PDF导入过程中发生异常，请查看诊断信息。'; msg.textContent = `导入失败：${message}`; msg.style.color = '#dc2626';
      }
    };
  }  function fieldButton(field) { const button = document.createElement('button'); button.className = 'rqf-chip'; button.textContent = field.key; button.title = text(field.value); button.disabled = !state.currentTarget || Boolean(field.empty) || !text(field.value).trim(); button.onclick = () => fillTarget(field.value, field.key); return button; }
  function renderFieldRows(fields, limit = 8) { const wrapNode = document.createElement('div'); fields.slice(0, limit).forEach((field) => { const row = document.createElement('div'); row.className = 'rqf-field-row'; const label = document.createElement('span'); label.className = 'rqf-field-label'; label.textContent = field.key; const value = document.createElement('span'); value.className = 'rqf-field-value'; value.textContent = field.empty || !text(field.value).trim() ? '未填写' : field.value; const action = fieldButton(field); action.className = 'rqf-field-action'; action.textContent = '填写'; row.append(label, value, action); wrapNode.appendChild(row); }); return wrapNode; }
  function renderCard(card) {
    const node = document.createElement('article'); node.className = 'rqf-resume-card';
    const heading = card.fields.find((f) => /公司|项目|学校|名称/.test(f.key));
    const role = card.fields.find((f) => /职位|职务|专业|学历/.test(f.key));
    const desc = card.fields.find((f) => /描述|职责|内容/.test(f.key));
    const h = document.createElement('h4'); h.textContent = heading ? heading.value : card.group; node.appendChild(h);
    if (role) { const p = document.createElement('p'); p.textContent = role.value; node.appendChild(p); }
    if (desc) { const p = document.createElement('p'); p.className = 'rqf-description'; p.textContent = desc.value; node.appendChild(p); if (desc.value.length > 120) { const toggle = document.createElement('button'); toggle.className = 'rqf-back'; toggle.textContent = '展开'; toggle.onclick = () => { const expanded = p.classList.toggle('expanded'); toggle.textContent = expanded ? '收起' : '展开'; }; node.appendChild(toggle); } }
    const chips = document.createElement('div'); chips.className = 'rqf-card-fields'; card.fields.forEach((field) => chips.appendChild(fieldButton(field))); node.appendChild(chips); return node;
  }
  function sectionBlock(title, cards, main) { if (!cards.length) return; const heading = document.createElement('div'); heading.className = 'rqf-section-title'; heading.textContent = title; main.appendChild(heading); cards.forEach((card) => main.appendChild(renderCard(card))); }
  function renderSearchResults(main) { const matches = ui.searchResume(state.resume, state.search); if (!matches.length) { const empty = document.createElement('div'); empty.className = 'rqf-no-results'; empty.textContent = state.search ? '没有找到匹配的简历内容。' : '输入关键词搜索简历内容。'; main.appendChild(empty); return; } const card = document.createElement('article'); card.className = 'rqf-card'; const title = document.createElement('h3'); title.className = 'rqf-card-title'; title.textContent = `找到 ${matches.length} 条相关内容`; card.appendChild(title); matches.forEach((match) => { const row = document.createElement('div'); row.className = 'rqf-field-row'; const label = document.createElement('span'); label.className = 'rqf-field-label'; label.textContent = match.key; const value = document.createElement('span'); value.className = 'rqf-field-value'; value.textContent = match.value; const action = fieldButton(match); action.className = 'rqf-field-action'; action.textContent = '填写'; row.append(label, value, action); card.appendChild(row); }); main.appendChild(card); }
  function renderHome(main) { if (!state.resume) { const empty = document.createElement('div'); empty.className = 'rqf-empty'; empty.innerHTML = '<div class="rqf-empty-logo">✓</div><h2>快填助手</h2><p>导入一份本地简历信息，即可快速填写招聘网站中的字段。</p><button class="rqf-primary">导入简历</button><div class="rqf-muted">支持 XLSX、CSV、PDF、DOCX；简历信息仅在本机处理</div>'; empty.querySelector('.rqf-empty-logo').innerHTML = icon('check'); empty.querySelector('button').onclick = showUpload; main.appendChild(empty); return; } if (state.search.trim()) { renderSearchResults(main); return; } const parts = sections(); const count = ui.counts(state.resume); const status = document.createElement('div'); status.className = 'rqf-card'; status.innerHTML = `<div class="rqf-card-title">已成功读取你的简历</div><div class="rqf-muted">${state.fileName || '本地简历信息'} · 解析成功</div><div class="rqf-summary"><div class="rqf-stat"><strong>${count.basic}</strong><span>基本信息</span></div><div class="rqf-stat"><strong>${count.education}</strong><span>教育经历</span></div><div class="rqf-stat"><strong>${count.experience}</strong><span>工作经历</span></div><div class="rqf-stat"><strong>${count.projects}</strong><span>项目经历</span></div></div>`; main.appendChild(status); const scan = document.createElement('button'); scan.className = 'rqf-secondary'; scan.style.width = '100%'; scan.style.marginTop = '10px'; scan.textContent = '扫描当前页面（不填写）'; scan.onclick = scanCurrentPage; main.appendChild(scan); const auto = document.createElement('button'); auto.className = 'rqf-primary'; auto.style.width = '100%'; auto.style.marginTop = '7px'; auto.textContent = state.autofillBusy ? '正在填写…' : '一键填写当前页面'; auto.disabled = state.autofillBusy; auto.onclick = runAutofill; main.appendChild(auto); const preview = document.createElement('button'); preview.className = 'rqf-secondary'; preview.style.width = '100%'; preview.style.marginTop = '7px'; preview.textContent = '预览识别结果'; preview.onclick = previewAutofill; main.appendChild(preview); const undoButton = document.createElement('button'); undoButton.className = 'rqf-secondary'; undoButton.style.width = '100%'; undoButton.style.marginTop = '7px'; undoButton.textContent = state.lastAutofill ? '撤销本次填写' : '撤销上次填写'; undoButton.disabled = !state.lastAutofill && !state.lastFill; undoButton.onclick = undo; main.appendChild(undoButton); const basic = parts.basic.flatMap((card) => card.fields); if (basic.length) { const title = document.createElement('div'); title.className = 'rqf-section-title'; title.textContent = '快捷填写'; main.appendChild(title); const card = document.createElement('div'); card.className = 'rqf-card'; card.appendChild(renderFieldRows(basic)); main.appendChild(card); } sectionBlock('工作经历', parts.experience, main); sectionBlock('项目经历', parts.projects, main); sectionBlock('教育经历', parts.education, main); const more = document.createElement('button'); more.className = 'rqf-secondary'; more.textContent = '查看完整简历'; more.onclick = () => { state.view = 'resume'; renderMain(); }; main.appendChild(more); }
  function editorLabel(section, key) { return standardResume && standardResume.labels && standardResume.labels[section] && standardResume.labels[section][key] || key; }
  function editorTextarea(key) { return /address|courses|workContent|achievements|leaveReason|description|responsibilities|outcomes|specialties|hobbies|selfEvaluation|strengths|notes|detail/i.test(key); }
  function editorChoices(key) {
    if (/^(gender)$/.test(key)) return ['', '男', '女', '其他'];
    if (/^(acceptsTransfer|highestDegree|relativeAtCompany|overseasExperience)$/.test(key)) return ['', '是', '否'];
    if (/^(maritalStatus)$/.test(key)) return ['', '未婚', '已婚', '其他'];
    if (/^(healthStatus)$/.test(key)) return ['', '健康', '良好', '其他'];
    return null;
  }
  function editorDate(key, value) { return /Date$/.test(key) && /^\d{4}-\d{2}-\d{2}$/.test(text(value)); }
  function markResumeDirty() { state.resumeDirty = editorState ? editorState.isDirty(state.resume, state.savedResumeSnapshot) : true; const notice = shadow.querySelector('.rqf-editor-dirty'); if (notice) { notice.textContent = state.resumeDirty ? '有未保存修改' : '已保存'; notice.classList.toggle('rqf-editor-saved', !state.resumeDirty); } const cancel = shadow.querySelector('.rqf-editor-actions .rqf-secondary'); if (cancel) cancel.disabled = !state.resumeDirty; }
  function bindEditorValue(control, path, list) {
    const eventName = control.tagName === 'SELECT' ? 'change' : 'input';
    control.addEventListener(eventName, (event) => { if (list) editorState.setListValue(state.resume, path, event.target.value); else editorState.setValue(state.resume, path, event.target.value); markResumeDirty(); });
  }
  function renderEditorField(section, key, path, value) {
    const field = document.createElement('div'); field.className = 'rqf-editor-field';
    const label = document.createElement('label'); label.textContent = editorLabel(section, key); label.htmlFor = `rqf-editor-${path.replace(/[^a-zA-Z0-9]/g, '-')}`;
    const choices = editorChoices(key); let control;
    if (choices) { control = document.createElement('select'); choices.forEach((choice) => { const option = document.createElement('option'); option.value = choice; option.textContent = choice || '未填写'; control.appendChild(option); }); if (!choices.includes(text(value))) { const option = document.createElement('option'); option.value = text(value); option.textContent = text(value); control.appendChild(option); } control.value = text(value); }
    else if (editorTextarea(key)) { control = document.createElement('textarea'); control.className = 'rqf-editor-input rqf-editor-textarea'; control.value = text(value); }
    else { control = document.createElement('input'); control.type = editorDate(key, value) ? 'date' : 'text'; control.value = text(value); }
    control.id = label.htmlFor; control.classList.add('rqf-editor-input'); control.placeholder = '未填写'; control.autocomplete = 'off'; bindEditorValue(control, path, false); field.append(label, control); return field;
  }
  function renderEditorObject(section, object, pathPrefix, container, labels) {
    const grid = document.createElement('div'); grid.className = 'rqf-editor-grid'; Object.keys(labels || object || {}).forEach((key) => grid.appendChild(renderEditorField(section, key, `${pathPrefix}.${key}`, object && object[key]))); container.appendChild(grid);
  }
  function renderEditorArray(section, title, main) {
    const details = document.createElement('details'); details.className = 'rqf-editor-section'; details.open = true; const summary = document.createElement('summary'); summary.textContent = title; details.appendChild(summary);
    const body = document.createElement('div'); body.className = 'rqf-editor-content'; const items = state.resume[section] || [];
    if (!items.length) { const empty = document.createElement('div'); empty.className = 'rqf-editor-empty'; empty.textContent = '暂无记录，可手动添加。'; body.appendChild(empty); }
    items.forEach((record, index) => { const card = document.createElement('article'); card.className = 'rqf-editor-record'; const head = document.createElement('div'); head.className = 'rqf-editor-record-head'; const recordTitle = document.createElement('span'); recordTitle.textContent = `${title}${index + 1}`; const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'rqf-secondary rqf-danger'; remove.textContent = '删除'; remove.onclick = () => { editorState.removeRecord(state.resume, section, index); markResumeDirty(); renderMain(); }; head.append(recordTitle, remove); card.appendChild(head);
      const labels = standardResume && standardResume.labels && standardResume.labels[section] || null;
      if (labels) renderEditorObject(section, record, `${section}[${index}]`, card, labels);
      else { const grid = document.createElement('div'); grid.className = 'rqf-editor-grid'; Object.keys(record || {}).forEach((key) => { const field = document.createElement('div'); field.className = 'rqf-editor-field'; const label = document.createElement('label'); label.textContent = key; const input = document.createElement('input'); input.className = 'rqf-editor-input'; input.value = text(record[key]); bindEditorValue(input, `${section}[${index}].${key}`, false); field.append(label, input); grid.appendChild(field); }); card.appendChild(grid); }
      body.appendChild(card); });
    const add = document.createElement('button'); add.type = 'button'; add.className = 'rqf-secondary rqf-editor-add'; add.textContent = `＋ 添加${title}`; add.onclick = () => { editorState.addRecord(state.resume, section); markResumeDirty(); renderMain(); }; body.appendChild(add); details.appendChild(body); main.appendChild(details);
  }
  function renderEditorLists(main) {
    const details = document.createElement('details'); details.className = 'rqf-editor-section'; details.open = true; const summary = document.createElement('summary'); summary.textContent = '资格证书 / 技能'; details.appendChild(summary); const body = document.createElement('div'); body.className = 'rqf-editor-content'; const labels = { certificates: '资格证书', languages: '语言能力', softwareSkills: '软件技能', professionalSkills: '专业技能' }; Object.entries(labels).forEach(([key, labelText]) => { const field = document.createElement('div'); field.className = 'rqf-editor-field'; const label = document.createElement('label'); label.textContent = labelText; const area = document.createElement('textarea'); area.className = 'rqf-editor-input rqf-editor-textarea'; area.placeholder = '每行一项'; area.value = editorState.listValue(state.resume, `certificatesSkills.${key}`); bindEditorValue(area, `certificatesSkills.${key}`, true); field.append(label, area); body.appendChild(field); }); details.appendChild(body); main.appendChild(details);
  }
  function renderOtherUnmapped(main) { const items = state.resume.other && state.resume.other.unmapped || []; if (!items.length) return; const box = document.createElement('div'); box.className = 'rqf-editor-unmapped'; box.textContent = `已保留的原始字段：\n${items.map((item) => `${item.group}｜${item.key}：${item.value}`).join('\n')}`; main.appendChild(box); }
  function renderResumeEditor(main) {
    const editor = document.createElement('div'); editor.className = 'rqf-editor'; const back = document.createElement('button'); back.type = 'button'; back.className = 'rqf-back'; back.textContent = '← 返回首页'; back.onclick = () => { state.view = 'home'; renderMain(); }; editor.appendChild(back);
    const dirty = document.createElement('div'); dirty.className = `rqf-editor-dirty${state.resumeDirty ? '' : ' rqf-editor-saved'}`; dirty.textContent = state.resumeDirty ? '有未保存修改' : '已保存'; editor.appendChild(dirty);
    const basic = document.createElement('details'); basic.className = 'rqf-editor-section'; basic.open = true; const basicSummary = document.createElement('summary'); basicSummary.textContent = '基本信息'; basic.appendChild(basicSummary); const basicBody = document.createElement('div'); basicBody.className = 'rqf-editor-content'; renderEditorObject('basic', state.resume.basic, 'basic', basicBody, standardResume.labels.basic); basic.appendChild(basicBody); editor.appendChild(basic);
    const job = document.createElement('details'); job.className = 'rqf-editor-section'; job.open = true; const jobSummary = document.createElement('summary'); jobSummary.textContent = '求职信息'; job.appendChild(jobSummary); const jobBody = document.createElement('div'); jobBody.className = 'rqf-editor-content'; renderEditorObject('job', state.resume.job, 'job', jobBody, standardResume.labels.job); job.appendChild(jobBody); editor.appendChild(job);
    renderEditorArray('education', '教育经历', editor); renderEditorArray('work', '工作 / 实习经历', editor); renderEditorArray('projects', '项目经历', editor); renderEditorArray('campus', '校园经历', editor); renderEditorLists(editor); renderEditorArray('awards', '奖励与荣誉', editor); renderEditorArray('family', '家庭成员', editor);
    const other = document.createElement('details'); other.className = 'rqf-editor-section'; other.open = true; const otherSummary = document.createElement('summary'); otherSummary.textContent = '其他信息'; other.appendChild(otherSummary); const otherBody = document.createElement('div'); otherBody.className = 'rqf-editor-content'; renderEditorObject('other', state.resume.other, 'other', otherBody, standardResume.labels.other); renderOtherUnmapped(otherBody); other.appendChild(otherBody); editor.appendChild(other);
    const actions = document.createElement('div'); actions.className = 'rqf-editor-actions'; const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'rqf-secondary'; cancel.textContent = '取消修改'; cancel.disabled = !state.resumeDirty; cancel.onclick = cancelResumeEdits; const save = document.createElement('button'); save.type = 'button'; save.className = 'rqf-primary'; save.textContent = '保存简历'; save.onclick = () => saveCurrentResume().catch((error) => toast(`保存失败：${text(error && error.message)}`, true)); actions.append(cancel, save); editor.appendChild(actions); main.appendChild(editor);
  }
  function renderResume(main) { renderResumeEditor(main); }
  function showRenameVersion(version) {
    const modal = document.createElement('section'); modal.className = 'rqf-modal'; modal.innerHTML = '<h3>重命名简历</h3><input class="rqf-file rqf-version-name" maxlength="100"><div class="rqf-modal-actions"><button class="rqf-secondary rqf-cancel">取消</button><button class="rqf-primary rqf-confirm">保存</button></div>'; wrap.appendChild(modal);
    const input = modal.querySelector('.rqf-version-name'); input.value = version.name; input.focus(); modal.querySelector('.rqf-cancel').onclick = () => modal.remove();
    modal.querySelector('.rqf-confirm').onclick = async () => { try { await renameVersion(version.id, input.value); modal.remove(); } catch (error) { toast(`重命名失败：${text(error && error.message)}`, true); } };
  }
  function formatVersionUpdated(value) {
    const parsed = value ? new Date(value) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) return '更新时间未记录';
    return `更新时间：${parsed.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}`;
  }
  function renderSettings(main) {
    const card = document.createElement('div'); card.className = 'rqf-card'; const title = document.createElement('h3'); title.className = 'rqf-card-title'; title.textContent = '设置'; card.appendChild(title);
    [['打开方式', '点击浏览器工具栏图标'], ['面板位置', '右侧浮动'], ['填写反馈', '显示成功提示']].forEach(([label, value]) => { const row = document.createElement('div'); row.className = 'rqf-settings-row'; row.innerHTML = `<span>${label}</span><span class="rqf-muted">${value}</span>`; card.appendChild(row); });
    const status = document.createElement('div'); status.className = 'rqf-settings-row'; const statusLabel = document.createElement('span'); statusLabel.textContent = '当前简历'; const statusValue = document.createElement('span'); statusValue.className = 'rqf-muted'; statusValue.textContent = state.fileName || '未导入'; statusValue.title = state.fileName || ''; status.append(statusLabel, statusValue); card.appendChild(status); main.appendChild(card);
    const versionsCard = document.createElement('div'); versionsCard.className = 'rqf-card'; const versionsTitle = document.createElement('h3'); versionsTitle.className = 'rqf-card-title'; versionsTitle.textContent = '简历版本'; versionsCard.appendChild(versionsTitle);
    if (!state.versionReady) { const loading = document.createElement('div'); loading.className = 'rqf-muted'; loading.textContent = '正在读取本地简历…'; versionsCard.appendChild(loading); }
    else if (!state.versionStore || !state.versionStore.resumes.length) { const empty = document.createElement('div'); empty.className = 'rqf-muted'; empty.textContent = '尚未保存简历版本。'; versionsCard.appendChild(empty); }
    else {
      const list = document.createElement('div'); list.className = 'rqf-version-list';
      state.versionStore.resumes.forEach((version) => {
        const current = version.id === state.currentResumeId;
        const row = document.createElement('article'); row.className = `rqf-version-card${current ? ' rqf-version-current' : ''}`;
        const info = document.createElement('div'); info.className = 'rqf-version-info'; const name = document.createElement('span'); name.className = 'rqf-version-name'; name.textContent = version.name; name.title = version.name; const updated = document.createElement('span'); updated.className = 'rqf-version-meta'; updated.textContent = formatVersionUpdated(version.updatedAt); info.append(name, updated);
        if (current) { const badge = document.createElement('span'); badge.className = 'rqf-version-badge'; badge.textContent = '当前使用'; info.appendChild(badge); }
        const actions = document.createElement('div'); actions.className = 'rqf-version-actions';
        if (!current) { const use = document.createElement('button'); use.className = 'rqf-secondary'; use.textContent = '使用此版本'; use.onclick = () => selectVersion(version.id).catch((error) => toast(`切换失败：${text(error && error.message)}`, true)); actions.appendChild(use); }
        const more = document.createElement('button'); more.className = 'rqf-version-more'; more.textContent = '⋯'; more.title = '更多操作'; more.setAttribute('aria-label', `${version.name} 的更多操作`); more.onclick = () => { state.openVersionMenuId = state.openVersionMenuId === version.id ? null : version.id; state.deleteConfirmId = null; renderMain(); }; actions.appendChild(more); row.append(info, actions);
        if (state.openVersionMenuId === version.id) { const menu = document.createElement('div'); menu.className = 'rqf-version-menu'; const rename = document.createElement('button'); rename.className = 'rqf-secondary'; rename.textContent = '重命名'; rename.onclick = () => showRenameVersion(version); const remove = document.createElement('button'); remove.className = 'rqf-secondary rqf-danger'; remove.textContent = state.deleteConfirmId === version.id ? '确认删除' : '删除版本'; remove.onclick = () => { if (state.deleteConfirmId !== version.id) { state.deleteConfirmId = version.id; renderMain(); return; } deleteVersion(version.id).catch((error) => toast(`删除失败：${text(error && error.message)}`, true)); }; menu.append(rename); if (current) { const warning = document.createElement('p'); warning.className = 'rqf-version-delete-warning'; warning.textContent = '删除后将自动切换到其他可用版本。'; menu.appendChild(warning); } menu.appendChild(remove); row.appendChild(menu); }
        list.appendChild(row);
      });
      versionsCard.appendChild(list);
    }
    main.appendChild(versionsCard);
    const upload = document.createElement('button'); upload.className = 'rqf-primary'; upload.textContent = '＋ 导入新简历'; upload.onclick = showUpload; main.appendChild(upload);
  }  function renderMain(existing) { const main = existing || shadow.querySelector('.rqf-main'); if (!main) return; main.innerHTML = ''; if (!state.resume && state.view !== 'settings') renderHome(main); else if (state.view === 'resume') renderResume(main); else if (state.view === 'settings') renderSettings(main); else renderHome(main); updateTargetStatus(); }
  function renderHeader() {
    const header = document.createElement('header'); header.className = 'rqf-header';
    header.innerHTML = `<div class="rqf-header-row"><div class="rqf-logo">${icon('check')}</div><div><div class="rqf-brand">快填助手</div><div class="rqf-sub">简历信息一键填写工具</div></div><div class="rqf-header-actions"><button class="rqf-icon rqf-min" aria-label="最小化">−</button><button class="rqf-icon rqf-close" aria-label="关闭">×</button></div></div><div class="rqf-status"><span class="rqf-status-dot"></span><span>${state.resume ? `当前简历：${state.fileName || '本地简历'} · 已就绪` : '尚未导入简历'}</span></div><div class="rqf-target-status rqf-muted">${state.currentTarget ? `当前目标：${currentLabel(state.currentTarget)}` : '请先点击网页中的输入框'}</div>`;
    const currentStatus = header.querySelector('.rqf-status span:last-child'); if (currentStatus && state.fileName) currentStatus.title = state.fileName;
    return header;
  }
  function renderSearch(main) {
    const searchWrap = document.createElement('div'); searchWrap.className = 'rqf-search-wrap';
    const search = document.createElement('input'); search.className = 'rqf-search'; search.placeholder = '搜索简历内容或输入关键词…'; search.setAttribute('aria-label', '搜索简历内容'); search.value = state.search;
    search.oninput = (event) => { state.search = event.target.value; renderMain(main); };
    const send = document.createElement('button'); send.className = 'rqf-search-send'; send.innerHTML = icon('send'); send.setAttribute('aria-label', '执行本地搜索'); send.onclick = () => renderMain(main);
    searchWrap.append(search, send); return searchWrap;
  }
  function renderBottomNav(main) {
    const nav = document.createElement('nav'); nav.className = 'rqf-nav';
    [['home', '首页'], ['resume', '简历'], ['settings', '设置']].forEach(([view, label]) => { const button = document.createElement('button'); button.textContent = label; button.className = state.view === view ? 'active' : ''; button.onclick = () => { state.view = view; renderMain(main); nav.querySelectorAll('button').forEach((item, index) => item.className = ['home', 'resume', 'settings'][index] === state.view ? 'active' : ''); }; nav.appendChild(button); });
    return nav;
  }
  function closePanel() { state.panelOpen = panelController ? panelController.close() : false; render(); }
  function togglePanel() { state.panelOpen = panelController ? panelController.toggle() : !state.panelOpen; render(); }
  function render() {
    wrap.innerHTML = '';
    if (!state.panelOpen) return;
    const panel = document.createElement('aside'); panel.className = 'rqf-panel'; const panelPosition = state.panel.left != null ? 'left:' + state.panel.left + 'px;right:auto;' : 'right:' + state.panel.right + 'px;'; panel.style.cssText = panelPosition + 'top:' + state.panel.top + 'px;width:' + state.panel.width + 'px;height:' + state.panel.height + 'px;';
    const header = renderHeader(); const main = document.createElement('main'); main.className = 'rqf-main'; panel.append(header, main, renderSearch(main), renderBottomNav(main)); wrap.appendChild(panel); renderMain(main);
    header.querySelector('.rqf-close').onclick = closePanel; header.querySelector('.rqf-min').onclick = closePanel;
    let drag = false, dx = 0, dy = 0; header.onpointerdown = (event) => { if (event.target.closest('button')) return; drag = true; const rect = panel.getBoundingClientRect(); dx = event.clientX - rect.left; dy = event.clientY - rect.top; header.setPointerCapture(event.pointerId); }; header.onpointermove = (event) => { if (!drag) return; state.panel.left = Math.max(0, event.clientX - dx); state.panel.top = Math.max(8, event.clientY - dy); state.panel.right = null; panel.style.left = `${state.panel.left}px`; panel.style.right = 'auto'; panel.style.top = `${state.panel.top}px`; }; header.onpointerup = () => { if (drag) { drag = false; savePanel(); } };
    if (window.ResizeObserver) { new ResizeObserver(() => { const rect = panel.getBoundingClientRect(); state.panel.width = Math.round(rect.width); state.panel.height = Math.round(rect.height); savePanel(); }).observe(panel); }
  }
  document.addEventListener('focusin', (event) => { if (!host.contains(event.target)) setTarget(event.target); }, true);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && state.panelOpen) closePanel(); });
  if (chrome.runtime && chrome.runtime.onMessage) chrome.runtime.onMessage.addListener((message, sender, sendResponse) => { if (message && message.type === 'QUICK_FILL_TOGGLE_PANEL') { togglePanel(); if (sendResponse) sendResponse({ open: state.panelOpen }); } });
  installPageLifecycle();
  loadPanel(); render(); hydrateVersions();
})();
