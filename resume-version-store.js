(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./standard-resume.js'));
  else root.ResumeQuickFillVersionStore = factory(root.ResumeQuickFillStandardResume);
})(typeof window !== 'undefined' ? window : globalThis, function (standardResume) {
  'use strict';

  const STORE_KEY = 'resume_version_store_v1';
  const LEGACY_DATA_KEY = 'resume_grouped_data';
  const LEGACY_FILE_KEY = 'resume_file_name';
  const asText = (value) => String(value == null ? '' : value).trim();
  const copy = (value) => JSON.parse(JSON.stringify(value));
  const standard = standardResume || { isStandardResume: () => false, normalizeResume: (value) => value };

  function isGroupedResume(data) {
    return Boolean(data) && typeof data === 'object' && !Array.isArray(data) && Object.keys(data).some((group) => {
      const fields = data[group];
      return fields && typeof fields === 'object' && !Array.isArray(fields) && Object.keys(fields).length;
    });
  }

  function isStoredResume(data) { return isGroupedResume(data) || standard.isStandardResume(data); }
  function normalizeResume(data) { return standard.normalizeResume(data); }

  function parseLegacy(value) {
    if (isGroupedResume(value)) return value;
    if (typeof value !== 'string') return null;
    try { const parsed = JSON.parse(value); return isGroupedResume(parsed) ? parsed : null; } catch { return null; }
  }

  function defaultId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return `resume-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function currentId(resumes, requested) {
    if (resumes.some((item) => item.id === requested)) return requested;
    return resumes.length ? resumes.slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0].id : null;
  }

  function normalizeStore(value) {
    if (!value || typeof value !== 'object' || !Array.isArray(value.resumes)) return null;
    const ids = new Set();
    const resumes = value.resumes.filter((item) => {
      if (!item || !asText(item.id) || ids.has(item.id) || !isStoredResume(item.data)) return false;
      ids.add(item.id);
      return true;
    }).map((item) => ({
      id: asText(item.id), name: asText(item.name) || '未命名简历', data: copy(normalizeResume(item.data)),
      createdAt: asText(item.createdAt) || asText(item.updatedAt) || new Date(0).toISOString(),
      updatedAt: asText(item.updatedAt) || asText(item.createdAt) || new Date(0).toISOString(),
    }));
    return { schemaVersion: 2, currentResumeId: currentId(resumes, value.currentResumeId), resumes };
  }

  function createMemoryBackend(seed = {}) {
    const values = copy(seed);
    return {
      async get(keys) {
        const selected = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(keys || values);
        return selected.reduce((result, key) => { if (Object.prototype.hasOwnProperty.call(values, key)) result[key] = copy(values[key]); return result; }, {});
      },
      async set(next) { Object.entries(next || {}).forEach(([key, value]) => { values[key] = copy(value); }); },
      async remove(keys) { (Array.isArray(keys) ? keys : [keys]).forEach((key) => { delete values[key]; }); },
    };
  }

  function createRepository(backend, options = {}) {
    if (!backend || typeof backend.get !== 'function' || typeof backend.set !== 'function') throw new Error('本地存储不可用');
    const now = options.now || (() => new Date().toISOString());
    const id = options.id || defaultId;
    const stamp = () => asText(now()) || new Date().toISOString();
    async function persist(store) { await backend.set({ [STORE_KEY]: copy(store) }); return copy(store); }
    async function load(legacy = {}) {
      const raw = await backend.get([STORE_KEY, LEGACY_DATA_KEY, LEGACY_FILE_KEY]);
      const existing = normalizeStore(raw[STORE_KEY]);
      if (existing) return persist(existing);
      const data = parseLegacy(legacy.data) || parseLegacy(raw[LEGACY_DATA_KEY]);
      const fileName = asText(legacy.fileName) || asText(raw[LEGACY_FILE_KEY]) || '已迁移简历';
      if (!data) return persist({ schemaVersion: 2, currentResumeId: null, resumes: [] });
      const created = stamp();
      const migrated = { schemaVersion: 2, currentResumeId: asText(id()), resumes: [] };
      migrated.resumes.push({ id: migrated.currentResumeId, name: fileName, data: copy(normalizeResume(data)), createdAt: created, updatedAt: created });
      return persist(migrated);
    }
    async function create(name, data) {
      if (!isStoredResume(data)) throw new Error('分组简历数据无效');
      const store = await load(); const created = stamp(); const resume = { id: asText(id()), name: asText(name) || '未命名简历', data: copy(normalizeResume(data)), createdAt: created, updatedAt: created };
      if (!resume.id || store.resumes.some((item) => item.id === resume.id)) throw new Error('简历版本标识无效');
      store.resumes.push(resume); store.currentResumeId = resume.id;
      return persist(store);
    }
    async function select(resumeId) {
      const store = await load();
      if (!store.resumes.some((item) => item.id === resumeId)) throw new Error('简历版本不存在');
      store.currentResumeId = resumeId; return persist(store);
    }
    async function rename(resumeId, name) {
      const nextName = asText(name); if (!nextName) throw new Error('名称不能为空');
      const store = await load(); const resume = store.resumes.find((item) => item.id === resumeId);
      if (!resume) throw new Error('简历版本不存在');
      resume.name = nextName; resume.updatedAt = stamp(); return persist(store);
    }
    async function saveCurrent(data) {
      if (!isStoredResume(data)) throw new Error('简历数据无效');
      const store = await load(); const resume = store.resumes.find((item) => item.id === store.currentResumeId);
      if (!resume) throw new Error('当前简历不存在');
      resume.data = copy(normalizeResume(data)); resume.updatedAt = stamp();
      return persist(store);
    }
    async function remove(resumeId) {
      const store = await load(); const index = store.resumes.findIndex((item) => item.id === resumeId);
      if (index < 0) throw new Error('简历版本不存在');
      store.resumes.splice(index, 1); store.currentResumeId = currentId(store.resumes, store.currentResumeId === resumeId ? null : store.currentResumeId);
      return persist(store);
    }
    return { load, create, select, rename, saveCurrent, remove };
  }

  return { STORE_KEY, LEGACY_DATA_KEY, LEGACY_FILE_KEY, isGroupedResume, isStoredResume, normalizeStore, createMemoryBackend, createRepository };
});
