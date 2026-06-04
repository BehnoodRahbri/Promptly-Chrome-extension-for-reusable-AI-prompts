// Shared storage adapter for the MV3 worker.
(function () {
  const STORAGE_KEY = 'promptSaverData';
  const SETTINGS_SYNC_KEY = 'promptlySettingsSync';
  let writeLock = Promise.resolve();

  function getMigrations() {
    if (typeof globalThis !== 'undefined' && globalThis.PromptlyMigrations) {
      return globalThis.PromptlyMigrations;
    }

    if (typeof require === 'function') {
      return require('./migrations.js');
    }

    throw new Error('Promptly migrations module is not available');
  }

  function clone(value) {
    if (value == null) {
      return value;
    }

    return JSON.parse(JSON.stringify(value));
  }

  async function getChromeArea(areaName) {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage[areaName]) {
      throw new Error(`chrome.storage.${areaName} is not available`);
    }

    return chrome.storage[areaName];
  }

  async function readRawLocalData() {
    const local = await getChromeArea('local');
    const result = await local.get(STORAGE_KEY);
    return result[STORAGE_KEY];
  }

  async function writeRawLocalData(blob) {
    const local = await getChromeArea('local');
    await local.set({ [STORAGE_KEY]: blob });
  }

  async function readData() {
    const migrations = getMigrations();
    const migrated = migrations.migrateData(await readRawLocalData());
    return migrated;
  }

  async function writeSettingsSync(settings) {
    const sync = await getChromeArea('sync');
    await sync.set({ [SETTINGS_SYNC_KEY]: extractSyncSettings(settings) });
  }

  function extractSyncSettings(settings) {
    const migrations = getMigrations();
    const merged = migrations.mergeSettings(settings);
    return {
      locale: merged.locale,
      theme: merged.theme,
      syncEnabled: Boolean(merged.syncEnabled),
      slashTrigger: merged.slashTrigger,
      updatedAt: new Date().toISOString()
    };
  }

  async function readSettingsSync() {
    const sync = await getChromeArea('sync');
    const result = await sync.get(SETTINGS_SYNC_KEY);
    return result[SETTINGS_SYNC_KEY] || null;
  }

  async function writeData(blob) {
    const migrations = getMigrations();
    const nextBlob = migrations.migrateData(blob);

    writeLock = writeLock.catch(() => {}).then(async () => {
      await writeRawLocalData(nextBlob);
      if (nextBlob.settings && nextBlob.settings.syncEnabled) {
        await writeSettingsSync(nextBlob.settings);
      }
      return clone(nextBlob);
    });

    return writeLock;
  }

  async function updateData(mutator) {
    writeLock = writeLock.catch(() => {}).then(async () => {
      const migrations = getMigrations();
      const current = migrations.migrateData(await readRawLocalData());
      const mutated = await mutator(clone(current));
      const next = migrations.migrateData(mutated || current);
      await writeRawLocalData(next);
      if (next.settings && next.settings.syncEnabled) {
        await writeSettingsSync(next.settings);
      }
      return clone(next);
    });

    return writeLock;
  }

  async function mergeSettingsFromSync(syncSettings) {
    if (!syncSettings || typeof syncSettings !== 'object') {
      return readData();
    }

    return updateData((data) => {
      const migrations = getMigrations();
      data.settings = migrations.mergeSettings({
        ...data.settings,
        ...syncSettings,
        syncEnabled: Boolean((data.settings && data.settings.syncEnabled) || syncSettings.syncEnabled)
      });
      return data;
    });
  }

  const api = {
    SETTINGS_SYNC_KEY,
    STORAGE_KEY,
    extractSyncSettings,
    mergeSettingsFromSync,
    readData,
    readSettingsSync,
    updateData,
    writeData,
    writeSettingsSync
  };

  if (typeof globalThis !== 'undefined') {
    globalThis.PromptlyStorage = api;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
