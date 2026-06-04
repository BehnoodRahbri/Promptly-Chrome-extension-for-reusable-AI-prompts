// Background Service Worker for Promptly.
importScripts('migrations.js', 'history.js', 'storage.js');

const Migrations = globalThis.PromptlyMigrations;
const PromptHistory = globalThis.PromptlyHistory;
const PromptStorage = globalThis.PromptlyStorage;

const DEFAULT_PROMPT = {
  id: 'default-hello-world',
  title: 'Hello World',
  summary: 'A simple test prompt to get you started',
  text: 'Hello! This is a test prompt from Promptly. You can replace this with your own prompts.',
  color: '#3b82f6',
  tags: ['test', 'demo'],
  folderId: Migrations.ROOT_FOLDER_ID,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  favorite: false,
  usageCount: 0,
  history: []
};

function nowIso() {
  return new Date().toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sendSuccess(sendResponse, payload = {}) {
  sendResponse({ success: true, ...payload });
}

function getDefaultData() {
  return Migrations.migrateData({
    prompts: [clone(DEFAULT_PROMPT)],
    folders: [{ id: Migrations.ROOT_FOLDER_ID, name: 'Root', parentId: null }],
    settings: Migrations.DEFAULT_SETTINGS
  });
}

async function ensureContextMenu() {
  try {
    await chrome.contextMenus.removeAll();
    chrome.contextMenus.create({
      id: 'insert-prompt',
      title: 'Insert first Promptly prompt',
      contexts: ['editable']
    });
  } catch (error) {
    console.error('Promptly context menu setup failed:', error);
  }
}

async function ensureInitialData(details) {
  if (details && details.reason === 'install') {
    const data = await PromptStorage.readData();
    if (!data.prompts.length) {
      await PromptStorage.writeData(getDefaultData());
      return;
    }
  }

  await PromptStorage.writeData(await PromptStorage.readData());
}

async function hydrateSettingsFromSync() {
  try {
    const syncSettings = await PromptStorage.readSettingsSync();
    if (syncSettings && syncSettings.syncEnabled) {
      await PromptStorage.mergeSettingsFromSync(syncSettings);
    }
  } catch (error) {
    console.warn('Promptly settings sync hydration skipped:', error);
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  await ensureInitialData(details);
  await hydrateSettingsFromSync();
  await ensureContextMenu();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureInitialData({ reason: 'startup' });
  await hydrateSettingsFromSync();
  await ensureContextMenu();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync' || !changes[PromptStorage.SETTINGS_SYNC_KEY]?.newValue) {
    return;
  }

  PromptStorage.mergeSettingsFromSync(changes[PromptStorage.SETTINGS_SYNC_KEY].newValue).catch((error) => {
    console.warn('Promptly failed to merge synced settings:', error);
  });
});

chrome.action.onClicked.addListener(() => {
  // Kept for future command-only flows. The popup handles normal action clicks.
});

async function insertPromptIntoTab(tabId, promptText, promptTitle = '') {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content-injection.js']
  });

  const [injectionResult] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (text, title) => {
      if (!window.PromptlyInjection || typeof window.PromptlyInjection.insertPrompt !== 'function') {
        throw new Error('Promptly injection module is not available');
      }

      return window.PromptlyInjection.insertPrompt(text, { title });
    },
    args: [promptText, promptTitle]
  });

  return injectionResult?.result || {
    success: false,
    error: 'No result returned from prompt insertion'
  };
}

async function trackPromptUsage(promptId) {
  const data = await PromptStorage.updateData((draft) => {
    const prompt = draft.prompts.find((item) => item.id === promptId);
    if (prompt) {
      prompt.lastUsed = nowIso();
      prompt.usageCount = Number(prompt.usageCount || 0) + 1;
      prompt.updatedAt = prompt.updatedAt || prompt.lastUsed;
    }
    return draft;
  });

  return data.prompts.find((prompt) => prompt.id === promptId) || null;
}

function mergePromptForSave(incoming, previous) {
  const now = nowIso();
  const protectedFields = previous
    ? {
      id: previous.id,
      color: previous.color || '#3b82f6',
      createdAt: previous.createdAt || now,
      favorite: Boolean(previous.favorite),
      usageCount: Number(previous.usageCount || 0),
      lastUsed: previous.lastUsed,
      history: Array.isArray(previous.history) ? previous.history : []
    }
    : {
      color: incoming.color || '#3b82f6',
      createdAt: incoming.createdAt || now,
      favorite: Boolean(incoming.favorite),
      usageCount: Number(incoming.usageCount || 0),
      history: Array.isArray(incoming.history) ? incoming.history : []
    };

  return {
    ...previous,
    ...incoming,
    ...protectedFields,
    id: incoming.id || protectedFields.id,
    title: String(incoming.title || 'Untitled prompt'),
    summary: String(incoming.summary || ''),
    text: String(incoming.text || ''),
    tags: Array.isArray(incoming.tags) ? incoming.tags.filter(Boolean).map(String) : [],
    folderId: incoming.folderId || previous?.folderId || Migrations.ROOT_FOLDER_ID,
    updatedAt: incoming.updatedAt || now
  };
}

function folderDescendants(folders, folderId) {
  const ids = new Set([folderId]);
  let changed = true;

  while (changed) {
    changed = false;
    folders.forEach((folder) => {
      if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) {
        ids.add(folder.id);
        changed = true;
      }
    });
  }

  return ids;
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'insert-prompt' || !tab?.id) {
    return;
  }

  try {
    const data = await PromptStorage.readData();
    const prompt = data.prompts[0];
    if (!prompt) {
      return;
    }

    const result = await insertPromptIntoTab(tab.id, prompt.text, prompt.title);
    if (!result.success) {
      throw new Error(result.error || result.message || 'Prompt insertion failed');
    }

    await trackPromptUsage(prompt.id);
  } catch (error) {
    console.error('Error inserting prompt from context menu:', error);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        case 'GET_DATA': {
          const data = await PromptStorage.readData();
          sendSuccess(sendResponse, { data });
          break;
        }

        case 'GET_PROMPTS': {
          const data = await PromptStorage.readData();
          sendSuccess(sendResponse, { data: data.prompts, settings: data.settings });
          break;
        }

        case 'GET_SETTINGS': {
          const data = await PromptStorage.readData();
          sendSuccess(sendResponse, { settings: data.settings });
          break;
        }

        case 'UPDATE_SETTINGS': {
          const data = await PromptStorage.updateData((draft) => {
            draft.settings = Migrations.mergeSettings({
              ...draft.settings,
              ...(message.settings || {})
            });
            return draft;
          });
          sendSuccess(sendResponse, { settings: data.settings });
          break;
        }

        case 'SAVE_PROMPT': {
          const incoming = message.prompt || {};
          const data = await PromptStorage.updateData((draft) => {
            const existingIndex = draft.prompts.findIndex((prompt) => prompt.id === incoming.id);
            const previous = existingIndex >= 0 ? draft.prompts[existingIndex] : null;
            const nextPrompt = mergePromptForSave(incoming, previous);

            if (existingIndex >= 0) {
              draft.prompts[existingIndex] = nextPrompt;
            } else {
              draft.prompts.push(nextPrompt);
            }

            return draft;
          });

          sendSuccess(sendResponse, { data });
          break;
        }

        case 'UPDATE_PROMPT': {
          const incoming = message.prompt || {};
          const data = await PromptStorage.updateData((draft) => {
            const index = draft.prompts.findIndex((prompt) => prompt.id === incoming.id);
            if (index < 0) {
              throw new Error('Prompt not found');
            }

            const previous = draft.prompts[index];
            const nextPrompt = mergePromptForSave(incoming, previous);
            if (PromptHistory.shouldSnapshot(previous, nextPrompt)) {
              nextPrompt.history = PromptHistory.pushHistory(previous.history, PromptHistory.buildSnapshot(previous));
            }

            draft.prompts[index] = nextPrompt;
            return draft;
          });

          sendSuccess(sendResponse, { data });
          break;
        }

        case 'DELETE_PROMPT': {
          const promptId = message.promptId;
          const data = await PromptStorage.updateData((draft) => {
            const originalLength = draft.prompts.length;
            draft.prompts = draft.prompts.filter((prompt) => prompt.id !== promptId);
            if (draft.prompts.length === originalLength) {
              throw new Error('Prompt not found');
            }
            return draft;
          });

          sendSuccess(sendResponse, { data });
          break;
        }

        case 'TOGGLE_FAVORITE': {
          const data = await PromptStorage.updateData((draft) => {
            const prompt = draft.prompts.find((item) => item.id === message.promptId);
            if (!prompt) {
              throw new Error('Prompt not found');
            }
            prompt.favorite = !prompt.favorite;
            return draft;
          });

          sendSuccess(sendResponse, { data });
          break;
        }

        case 'TRACK_PROMPT_USAGE': {
          const prompt = await trackPromptUsage(message.promptId);
          if (!prompt) {
            throw new Error('Prompt not found');
          }
          sendSuccess(sendResponse, { prompt });
          break;
        }

        case 'RESTORE_VERSION': {
          const data = await PromptStorage.updateData((draft) => {
            const prompt = draft.prompts.find((item) => item.id === message.promptId);
            if (!prompt) {
              throw new Error('Prompt not found');
            }

            const snapshot = prompt.history?.[message.index];
            if (!snapshot) {
              throw new Error('Version not found');
            }

            const currentSnapshot = PromptHistory.buildSnapshot(prompt);
            prompt.history = PromptHistory.pushHistory(
              prompt.history.filter((_, index) => index !== message.index),
              currentSnapshot
            );
            prompt.title = snapshot.title;
            prompt.summary = snapshot.summary;
            prompt.text = snapshot.text;
            prompt.tags = Array.isArray(snapshot.tags) ? snapshot.tags : [];
            prompt.updatedAt = nowIso();
            return draft;
          });

          sendSuccess(sendResponse, { data });
          break;
        }

        case 'CREATE_FOLDER': {
          const data = await PromptStorage.updateData((draft) => {
            const name = String(message.name || '').trim();
            if (!name) {
              throw new Error('Folder name is required');
            }

            draft.folders.push({
              id: `folder_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
              name,
              parentId: message.parentId || Migrations.ROOT_FOLDER_ID
            });
            return draft;
          });

          sendSuccess(sendResponse, { data });
          break;
        }

        case 'RENAME_FOLDER': {
          const data = await PromptStorage.updateData((draft) => {
            const folder = draft.folders.find((item) => item.id === message.folderId);
            if (!folder || folder.id === Migrations.ROOT_FOLDER_ID) {
              throw new Error('Folder cannot be renamed');
            }

            folder.name = String(message.name || '').trim() || folder.name;
            return draft;
          });

          sendSuccess(sendResponse, { data });
          break;
        }

        case 'DELETE_FOLDER': {
          const data = await PromptStorage.updateData((draft) => {
            if (message.folderId === Migrations.ROOT_FOLDER_ID) {
              throw new Error('Root folder cannot be deleted');
            }

            const ids = folderDescendants(draft.folders, message.folderId);
            draft.prompts.forEach((prompt) => {
              if (ids.has(prompt.folderId)) {
                prompt.folderId = Migrations.ROOT_FOLDER_ID;
              }
            });
            draft.folders = draft.folders
              .filter((folder) => !ids.has(folder.id))
              .map((folder) => (
                ids.has(folder.parentId)
                  ? { ...folder, parentId: Migrations.ROOT_FOLDER_ID }
                  : folder
              ));
            return draft;
          });

          sendSuccess(sendResponse, { data });
          break;
        }

        case 'INSERT_PROMPT': {
          if (!sender.tab?.id) {
            throw new Error('No sender tab found');
          }

          const result = await insertPromptIntoTab(
            sender.tab.id,
            message.payload.text,
            message.payload.title
          );
          sendResponse(result);
          break;
        }

        case 'COPY_PROMPT': {
          sendSuccess(sendResponse);
          break;
        }

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Error handling Promptly message:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();

  return true;
});
