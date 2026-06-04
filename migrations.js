// Shared schema migration helpers for Promptly.
(function () {
  const CURRENT_SCHEMA_VERSION = 5;
  const ROOT_FOLDER_ID = 'root';

  const DEFAULT_SETTINGS = {
    locale: 'en',
    theme: 'auto',
    syncEnabled: false,
    slashTrigger: {
      enabled: true,
      trigger: '/',
      maxResults: 8
    }
  };

  function deepClone(value) {
    if (value == null) {
      return value;
    }

    return JSON.parse(JSON.stringify(value));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function mergeSettings(settings) {
    const incoming = settings && typeof settings === 'object' ? settings : {};
    const incomingSlash = incoming.slashTrigger && typeof incoming.slashTrigger === 'object'
      ? incoming.slashTrigger
      : {};

    return {
      ...DEFAULT_SETTINGS,
      ...incoming,
      slashTrigger: {
        ...DEFAULT_SETTINGS.slashTrigger,
        ...incomingSlash
      }
    };
  }

  function normalizePrompt(prompt, index = 0) {
    const source = prompt && typeof prompt === 'object' ? prompt : {};
    const createdAt = source.createdAt || source.updatedAt || nowIso();

    return {
      ...source,
      id: String(source.id || `legacy_prompt_${index}`),
      title: String(source.title || 'Untitled prompt'),
      summary: String(source.summary || ''),
      text: String(source.text || ''),
      color: source.color || '#3b82f6',
      tags: Array.isArray(source.tags) ? source.tags.filter(Boolean).map(String) : [],
      folderId: source.folderId || ROOT_FOLDER_ID,
      createdAt,
      updatedAt: source.updatedAt || createdAt,
      favorite: Boolean(source.favorite),
      usageCount: Number.isFinite(Number(source.usageCount)) ? Number(source.usageCount) : 0,
      history: Array.isArray(source.history) ? source.history : []
    };
  }

  function normalizeFolder(folder) {
    const source = folder && typeof folder === 'object' ? folder : {};
    const id = String(source.id || ROOT_FOLDER_ID);

    return {
      ...source,
      id,
      name: String(source.name || (id === ROOT_FOLDER_ID ? 'Root' : 'Folder')),
      parentId: id === ROOT_FOLDER_ID ? null : (source.parentId || ROOT_FOLDER_ID)
    };
  }

  function ensureBaseShape(data) {
    const source = data && typeof data === 'object' ? deepClone(data) : {};
    const prompts = Array.isArray(source.prompts) ? source.prompts.map((prompt, index) => normalizePrompt(prompt, index)) : [];
    let folders = Array.isArray(source.folders) ? source.folders.map(normalizeFolder) : [];

    if (!folders.some((folder) => folder.id === ROOT_FOLDER_ID)) {
      folders = [{ id: ROOT_FOLDER_ID, name: 'Root', parentId: null }, ...folders];
    }

    const folderIds = new Set(folders.map((folder) => folder.id));
    prompts.forEach((prompt) => {
      if (!folderIds.has(prompt.folderId)) {
        prompt.folderId = ROOT_FOLDER_ID;
      }
    });

    return {
      ...source,
      prompts,
      folders,
      settings: mergeSettings(source.settings),
      schemaVersion: Number.isFinite(Number(source.schemaVersion)) ? Number(source.schemaVersion) : 0
    };
  }

  const steps = [
    {
      version: 1,
      migrate(data) {
        return ensureBaseShape(data);
      }
    },
    {
      version: 2,
      migrate(data) {
        const next = ensureBaseShape(data);
        next.prompts = next.prompts.map((prompt) => ({
          ...prompt,
          favorite: Boolean(prompt.favorite),
          usageCount: Number.isFinite(Number(prompt.usageCount)) ? Number(prompt.usageCount) : 0
        }));
        return next;
      }
    },
    {
      version: 3,
      migrate(data) {
        const next = ensureBaseShape(data);
        next.prompts = next.prompts.map((prompt) => ({
          ...prompt,
          history: Array.isArray(prompt.history) ? prompt.history : []
        }));
        return next;
      }
    },
    {
      version: 4,
      migrate(data) {
        const next = ensureBaseShape(data);
        next.settings = mergeSettings({
          ...next.settings,
          syncEnabled: Boolean(next.settings && next.settings.syncEnabled)
        });
        return next;
      }
    },
    {
      version: 5,
      migrate(data) {
        const next = ensureBaseShape(data);
        next.settings = mergeSettings(next.settings);
        return next;
      }
    }
  ];

  function migrateData(data) {
    const sourceVersion = Number(data && data.schemaVersion) || 0;

    if (sourceVersion > CURRENT_SCHEMA_VERSION) {
      return deepClone(data);
    }

    let next = ensureBaseShape(data);
    let currentVersion = sourceVersion;

    for (const step of steps) {
      if (step.version > currentVersion) {
        next = step.migrate(next);
        next.schemaVersion = step.version;
        currentVersion = step.version;
      }
    }

    next = ensureBaseShape(next);
    next.schemaVersion = CURRENT_SCHEMA_VERSION;
    return next;
  }

  const api = {
    CURRENT_SCHEMA_VERSION,
    DEFAULT_SETTINGS,
    ROOT_FOLDER_ID,
    ensureBaseShape,
    mergeSettings,
    migrateData
  };

  if (typeof globalThis !== 'undefined') {
    globalThis.PromptlyMigrations = api;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
