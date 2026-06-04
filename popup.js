// Popup script for PromptStow.
const ROOT_FOLDER_ID = 'root';
const SUPPORTED_SITE_HOSTS = [
  'chatgpt.com',
  'chat.openai.com',
  'claude.ai',
  'gemini.google.com',
  'aistudio.google.com',
  'grok.com',
  'chat.deepseek.com'
];

const defaultSettings = {
  locale: 'en',
  theme: 'auto',
  syncEnabled: false,
  slashTrigger: {
    enabled: true,
    trigger: '/',
    maxResults: 8
  }
};

const state = {
  prompts: [],
  folders: [{ id: ROOT_FOLDER_ID, name: 'Root', parentId: null }],
  settings: { ...defaultSettings },
  displayPrompts: [],
  activeIndex: 0,
  selectedTag: '',
  selectedFolderId: '',
  sortMode: 'recent'
};

const dom = {};

// Inline SVG icons (zero-build, no icon font). 24x24 viewBox, stroke = currentColor.
const ICON_PATHS = {
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  insert: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/>',
  copy: '<rect width="13" height="13" x="9" y="9" rx="2" ry="2"/><path d="M5 15a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>'
};

function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;
}

document.addEventListener('DOMContentLoaded', async () => {
  cacheDom();
  setupEventListeners();
  await loadUiPreferences();
  await loadData();
  dom.searchInput.focus();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.promptSaverData?.newValue) {
    const data = changes.promptSaverData.newValue;
    state.prompts = data.prompts || [];
    state.folders = data.folders || state.folders;
    state.settings = mergeSettings(data.settings || {});
    applySettings();
    refreshUi();
  }
});

function cacheDom() {
  [
    'loading',
    'promptsList',
    'searchInput',
    'tagFilter',
    'sortSelect',
    'settingsBtn',
    'statsBtn',
    'settingsPanel',
    'themeSelect',
    'localeSelect',
    'slashEnabled',
    'syncEnabled',
    'slashTriggerInput',
    'slashMaxResults',
    'folderTree',
    'addFolderBtn',
    'renameFolderBtn',
    'deleteFolderBtn',
    'newPromptBtn',
    'importBtn',
    'exportBtn',
    'importFileInput',
    'newPromptForm',
    'promptTitle',
    'promptSummary',
    'promptText',
    'promptTags',
    'promptFolder',
    'saveBtn',
    'cancelBtn',
    'modalRoot'
  ].forEach((id) => {
    dom[id] = document.getElementById(id);
  });
}

function mergeSettings(settings) {
  const incoming = settings && typeof settings === 'object' ? settings : {};
  return {
    ...defaultSettings,
    ...incoming,
    slashTrigger: {
      ...defaultSettings.slashTrigger,
      ...(incoming.slashTrigger || {})
    }
  };
}

function t(key, vars) {
  return window.PromptStowI18n.t(key, vars);
}

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response) {
        reject(new Error('No response from background script'));
        return;
      }

      resolve(response);
    });
  });
}

async function loadUiPreferences() {
  const result = await chrome.storage.local.get(['selectedTag', 'selectedFolderId', 'sortMode']);
  state.selectedTag = result.selectedTag || '';
  state.selectedFolderId = result.selectedFolderId || '';
  state.sortMode = result.sortMode || 'recent';
  dom.sortSelect.value = state.sortMode;
}

async function saveUiPreference(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

async function loadData() {
  dom.loading.style.display = 'block';

  try {
    const response = await sendMessage({ type: 'GET_DATA' });
    if (!response.success) {
      throw new Error(response.error || 'Failed to load data');
    }

    const data = response.data || {};
    state.prompts = data.prompts || [];
    state.folders = data.folders?.length ? data.folders : state.folders;
    state.settings = mergeSettings(data.settings || {});
    applySettings();
    refreshUi();
  } catch (error) {
    showError(error.message);
  } finally {
    dom.loading.style.display = 'none';
  }
}

function setupEventListeners() {
  dom.searchInput.addEventListener('input', () => {
    state.activeIndex = 0;
    refreshPromptList();
  });

  dom.searchInput.addEventListener('keydown', handlePaletteKeys);
  document.addEventListener('keydown', handleGlobalKeys);

  dom.tagFilter.addEventListener('change', async () => {
    state.selectedTag = dom.tagFilter.value;
    state.activeIndex = 0;
    await saveUiPreference('selectedTag', state.selectedTag);
    refreshPromptList();
  });

  dom.sortSelect.addEventListener('change', async () => {
    state.sortMode = dom.sortSelect.value;
    state.activeIndex = 0;
    await saveUiPreference('sortMode', state.sortMode);
    refreshPromptList();
  });

  dom.settingsBtn.addEventListener('click', () => {
    dom.settingsPanel.hidden = !dom.settingsPanel.hidden;
  });

  dom.statsBtn.addEventListener('click', showStatsModal);
  dom.importBtn.addEventListener('click', () => dom.importFileInput.click());
  dom.exportBtn.addEventListener('click', exportPrompts);
  dom.importFileInput.addEventListener('change', importPrompts);
  dom.newPromptBtn.addEventListener('click', () => showPromptForm());
  dom.cancelBtn.addEventListener('click', hidePromptForm);
  dom.saveBtn.addEventListener('click', savePromptFromForm);

  [dom.themeSelect, dom.localeSelect, dom.slashEnabled, dom.syncEnabled, dom.slashTriggerInput, dom.slashMaxResults]
    .forEach((control) => control.addEventListener('change', saveSettingsFromControls));

  dom.slashTriggerInput.addEventListener('input', saveSettingsFromControls);
  dom.slashMaxResults.addEventListener('input', saveSettingsFromControls);

  dom.folderTree.addEventListener('click', handleFolderClick);
  dom.addFolderBtn.addEventListener('click', createFolder);
  dom.renameFolderBtn.addEventListener('click', renameFolder);
  dom.deleteFolderBtn.addEventListener('click', deleteFolder);
  dom.promptsList.addEventListener('click', handlePromptAction);

  [dom.promptTitle, dom.promptSummary, dom.promptText, dom.promptTags].forEach((input) => {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && event.ctrlKey) {
        savePromptFromForm();
      }
    });
  });
}

function handlePaletteKeys(event) {
  if (!state.displayPrompts.length) {
    return;
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    state.activeIndex = (state.activeIndex + 1) % state.displayPrompts.length;
    renderPrompts();
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    state.activeIndex = (state.activeIndex - 1 + state.displayPrompts.length) % state.displayPrompts.length;
    renderPrompts();
  } else if (event.key === 'Enter') {
    event.preventDefault();
    insertPrompt(state.displayPrompts[state.activeIndex].id);
  }
}

function handleGlobalKeys(event) {
  if (event.key !== 'Escape') {
    return;
  }

  if (dom.modalRoot.firstChild) {
    closeModal();
  } else if (dom.newPromptForm.style.display === 'block') {
    hidePromptForm();
  } else if (dom.searchInput.value) {
    dom.searchInput.value = '';
    refreshPromptList();
  }
}

function applySettings() {
  document.body.dataset.theme = state.settings.theme || 'auto';
  window.PromptStowI18n.setLocale(state.settings.locale || 'en');
  window.PromptStowI18n.applyI18n(document);

  dom.themeSelect.value = state.settings.theme || 'auto';
  dom.localeSelect.value = state.settings.locale || 'en';
  dom.slashEnabled.checked = Boolean(state.settings.slashTrigger?.enabled);
  dom.syncEnabled.checked = Boolean(state.settings.syncEnabled);
  dom.slashTriggerInput.value = state.settings.slashTrigger?.trigger || '/';
  dom.slashMaxResults.value = state.settings.slashTrigger?.maxResults || 8;
  dom.sortSelect.value = state.sortMode;
}

async function saveSettingsFromControls() {
  const trigger = dom.slashTriggerInput.value.trim() || '/';
  const maxResults = Math.min(20, Math.max(1, Number(dom.slashMaxResults.value || 8)));
  const nextSettings = {
    theme: dom.themeSelect.value,
    locale: dom.localeSelect.value,
    syncEnabled: dom.syncEnabled.checked,
    slashTrigger: {
      enabled: dom.slashEnabled.checked,
      trigger,
      maxResults
    }
  };

  try {
    const response = await sendMessage({ type: 'UPDATE_SETTINGS', settings: nextSettings });
    if (!response.success) {
      throw new Error(response.error || 'Failed to save settings');
    }
    state.settings = mergeSettings(response.settings);
    applySettings();
  } catch (error) {
    showToast(error.message, true);
  }
}

function refreshUi() {
  renderTagFilter();
  renderFolders();
  renderFolderSelect();
  refreshPromptList();
}

function renderTagFilter() {
  const tags = [...new Set(state.prompts.flatMap((prompt) => Array.isArray(prompt.tags) ? prompt.tags : []))]
    .sort((a, b) => a.localeCompare(b));

  dom.tagFilter.innerHTML = `<option value="">${escapeHtml(t('allTags'))}</option>${tags
    .map((tag) => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`)
    .join('')}`;

  if (state.selectedTag && tags.includes(state.selectedTag)) {
    dom.tagFilter.value = state.selectedTag;
  } else {
    state.selectedTag = '';
  }
}

function folderDepth(folderId) {
  let depth = 0;
  let current = state.folders.find((folder) => folder.id === folderId);
  while (current?.parentId) {
    depth += 1;
    current = state.folders.find((folder) => folder.id === current.parentId);
  }
  return depth;
}

function renderFolderSelect() {
  const options = [...state.folders]
    .sort((a, b) => {
      if (a.id === ROOT_FOLDER_ID) return -1;
      if (b.id === ROOT_FOLDER_ID) return 1;
      return a.name.localeCompare(b.name);
    })
    .map((folder) => {
      const label = `${'  '.repeat(folderDepth(folder.id))}${folder.name}`;
      return `<option value="${escapeHtml(folder.id)}">${escapeHtml(label)}</option>`;
    });

  dom.promptFolder.innerHTML = options.join('');
}

function renderFolders() {
  const folderIds = new Set(state.folders.map((folder) => folder.id));
  if (state.selectedFolderId && !folderIds.has(state.selectedFolderId)) {
    state.selectedFolderId = '';
  }

  const chips = [
    `<button class="folder-chip ${state.selectedFolderId ? '' : 'is-active'}" data-folder-id="">${escapeHtml(t('allFolders'))}</button>`,
    ...state.folders.map((folder) => {
      const count = state.prompts.filter((prompt) => prompt.folderId === folder.id).length;
      const active = state.selectedFolderId === folder.id ? 'is-active' : '';
      const indent = folder.id === ROOT_FOLDER_ID ? '' : '&nbsp;'.repeat(folderDepth(folder.id) * 2);
      return `<button class="folder-chip ${active}" data-folder-id="${escapeHtml(folder.id)}">${indent}${escapeHtml(folder.name)}<span class="count">${count}</span></button>`;
    })
  ];

  dom.folderTree.innerHTML = chips.join('');
}

function getFolderDescendants(folderId) {
  if (!folderId) {
    return null;
  }

  const ids = new Set([folderId]);
  let changed = true;
  while (changed) {
    changed = false;
    state.folders.forEach((folder) => {
      if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) {
        ids.add(folder.id);
        changed = true;
      }
    });
  }
  return ids;
}

function refreshPromptList() {
  const query = dom.searchInput.value.trim();
  const folderIds = getFolderDescendants(state.selectedFolderId);
  let list = state.prompts.filter((prompt) => {
    const matchesTag = !state.selectedTag || (prompt.tags || []).includes(state.selectedTag);
    const matchesFolder = !folderIds || folderIds.has(prompt.folderId || ROOT_FOLDER_ID);
    return matchesTag && matchesFolder;
  });

  if (query) {
    list = window.PromptStowFuzzy.fuzzyFilter(query, list, { limit: list.length });
  }

  state.displayPrompts = sortPrompts(list);
  if (state.activeIndex >= state.displayPrompts.length) {
    state.activeIndex = Math.max(0, state.displayPrompts.length - 1);
  }
  renderPrompts();
}

function sortPrompts(list) {
  const sorted = [...list];
  const recentTime = (prompt) => new Date(prompt.lastUsed || prompt.updatedAt || prompt.createdAt || 0).getTime();

  sorted.sort((a, b) => {
    if (state.sortMode === 'most-used') {
      return Number(b.usageCount || 0) - Number(a.usageCount || 0) || recentTime(b) - recentTime(a);
    }

    if (state.sortMode === 'az') {
      return String(a.title || '').localeCompare(String(b.title || ''));
    }

    if (state.sortMode === 'favorites') {
      return Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)) || recentTime(b) - recentTime(a);
    }

    return recentTime(b) - recentTime(a);
  });

  return sorted;
}

function renderPrompts() {
  if (!state.displayPrompts.length) {
    dom.promptsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${icon('inbox')}</div>
        <h3>${escapeHtml(t('noPrompts'))}</h3>
        <p>${escapeHtml(t('noPromptsHint'))}</p>
      </div>
    `;
    return;
  }

  dom.promptsList.innerHTML = state.displayPrompts.map((prompt, index) => {
    const active = index === state.activeIndex ? 'is-active' : '';
    const favorite = Boolean(prompt.favorite);
    const preview = (prompt.summary || prompt.text || '').replace(/\s+/g, ' ').trim();
    const used = Number(prompt.usageCount || 0);
    const folder = state.folders.find((item) => item.id === prompt.folderId)?.name || 'Root';
    const tagList = (prompt.tags || []).filter(Boolean);

    const metaParts = [
      ...tagList.slice(0, 3).map((tag) => `<span class="tag">#${escapeHtml(tag)}</span>`),
      ...(tagList.length > 3 ? [`<span class="tag">+${tagList.length - 3}</span>`] : []),
      `<span>${escapeHtml(folder)}</span>`,
      `<span class="uses">${used} uses</span>`,
      ...(prompt.lastUsed ? [`<span>${escapeHtml(new Date(prompt.lastUsed).toLocaleDateString())}</span>`] : [])
    ];

    return `
      <article class="prompt-card ${active} ${favorite ? 'is-favorite' : ''}" data-card-index="${index}" style="--card-accent: ${escapeHtml(prompt.color || '#4f46e5')}">
        <button class="fav" data-action="toggle-favorite" data-prompt-id="${escapeHtml(prompt.id)}" aria-pressed="${favorite}" title="${escapeHtml(t('favorite'))}">${icon('star')}</button>
        <div class="card-text">
          <div class="prompt-title">${escapeHtml(prompt.title)}</div>
          ${preview ? `<div class="prompt-summary">${escapeHtml(preview)}</div>` : ''}
          <div class="meta">${metaParts.join('<span class="dot">·</span>')}</div>
        </div>
        <div class="card-actions">
          <button class="act act-insert" data-action="insert" data-prompt-id="${escapeHtml(prompt.id)}" title="${escapeHtml(t('insert'))}">${icon('insert')}</button>
          <button class="act" data-action="copy" data-prompt-id="${escapeHtml(prompt.id)}" title="${escapeHtml(t('copy'))}">${icon('copy')}</button>
          <button class="act" data-action="history" data-prompt-id="${escapeHtml(prompt.id)}" title="${escapeHtml(t('history'))}">${icon('history')}</button>
          <button class="act" data-action="edit" data-prompt-id="${escapeHtml(prompt.id)}" title="${escapeHtml(t('edit'))}">${icon('edit')}</button>
          <button class="act act-danger" data-action="delete" data-prompt-id="${escapeHtml(prompt.id)}" title="${escapeHtml(t('deletePrompt'))}">${icon('trash')}</button>
        </div>
      </article>
    `;
  }).join('');

  const activeCard = dom.promptsList.querySelector('.prompt-card.is-active');
  activeCard?.scrollIntoView({ block: 'nearest' });
}

async function handleFolderClick(event) {
  const button = event.target.closest('[data-folder-id]');
  if (!button) {
    return;
  }

  state.selectedFolderId = button.getAttribute('data-folder-id');
  state.activeIndex = 0;
  await saveUiPreference('selectedFolderId', state.selectedFolderId);
  renderFolders();
  refreshPromptList();
}

async function createFolder() {
  const name = prompt('Folder name');
  if (!name || !name.trim()) {
    return;
  }

  await mutateData({ type: 'CREATE_FOLDER', name: name.trim(), parentId: state.selectedFolderId || ROOT_FOLDER_ID });
}

async function renameFolder() {
  if (!state.selectedFolderId || state.selectedFolderId === ROOT_FOLDER_ID) {
    showToast('Select a custom folder first', true);
    return;
  }

  const current = state.folders.find((folder) => folder.id === state.selectedFolderId);
  const name = prompt('Folder name', current?.name || '');
  if (!name || !name.trim()) {
    return;
  }

  await mutateData({ type: 'RENAME_FOLDER', folderId: state.selectedFolderId, name: name.trim() });
}

async function deleteFolder() {
  if (!state.selectedFolderId || state.selectedFolderId === ROOT_FOLDER_ID) {
    showToast('Select a custom folder first', true);
    return;
  }

  if (!confirm('Delete this folder? Prompts will move to Root.')) {
    return;
  }

  await mutateData({ type: 'DELETE_FOLDER', folderId: state.selectedFolderId });
  state.selectedFolderId = '';
  await saveUiPreference('selectedFolderId', '');
}

async function handlePromptAction(event) {
  const button = event.target.closest('[data-action]');
  const card = event.target.closest('[data-card-index]');
  if (card) {
    state.activeIndex = Number(card.getAttribute('data-card-index'));
  }
  if (!button) {
    return;
  }

  const promptId = button.getAttribute('data-prompt-id');
  const action = button.getAttribute('data-action');

  if (action === 'insert') {
    await insertPrompt(promptId);
  } else if (action === 'copy') {
    await copyPrompt(promptId);
  } else if (action === 'edit') {
    showPromptForm(promptId);
  } else if (action === 'delete') {
    await deletePrompt(promptId);
  } else if (action === 'toggle-favorite') {
    await mutateData({ type: 'TOGGLE_FAVORITE', promptId });
  } else if (action === 'history') {
    showHistoryModal(promptId);
  }
}

function showPromptForm(promptId) {
  const promptToEdit = promptId ? state.prompts.find((prompt) => prompt.id === promptId) : null;
  dom.newPromptForm.dataset.editingId = promptToEdit?.id || '';
  dom.promptTitle.value = promptToEdit?.title || '';
  dom.promptSummary.value = promptToEdit?.summary || '';
  dom.promptText.value = promptToEdit?.text || '';
  dom.promptTags.value = (promptToEdit?.tags || []).join(', ');
  dom.promptFolder.value = promptToEdit?.folderId || state.selectedFolderId || ROOT_FOLDER_ID;
  dom.newPromptForm.style.display = 'block';
  dom.promptTitle.focus();
}

function hidePromptForm() {
  dom.newPromptForm.style.display = 'none';
  dom.newPromptForm.dataset.editingId = '';
  dom.promptTitle.value = '';
  dom.promptSummary.value = '';
  dom.promptText.value = '';
  dom.promptTags.value = '';
  dom.promptFolder.value = ROOT_FOLDER_ID;
}

async function savePromptFromForm() {
  const title = dom.promptTitle.value.trim();
  const summary = dom.promptSummary.value.trim();
  const text = dom.promptText.value.trim();
  const tags = dom.promptTags.value.split(',').map((tag) => tag.trim()).filter(Boolean);

  if (!title || !text) {
    showToast('Title and prompt text are required', true);
    return;
  }

  const editingId = dom.newPromptForm.dataset.editingId;
  const now = new Date().toISOString();
  const promptData = {
    id: editingId || `prompt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    title,
    summary,
    text,
    tags,
    folderId: dom.promptFolder.value || ROOT_FOLDER_ID,
    updatedAt: now
  };

  if (!editingId) {
    promptData.createdAt = now;
    promptData.color = '#3b82f6';
  }

  await mutateData({
    type: editingId ? 'UPDATE_PROMPT' : 'SAVE_PROMPT',
    prompt: promptData
  });
  hidePromptForm();
  showToast(editingId ? 'Prompt updated' : 'Prompt saved');
}

async function insertPrompt(promptId) {
  const promptToUse = state.prompts.find((prompt) => prompt.id === promptId);
  if (!promptToUse) {
    showToast('Prompt not found', true);
    return;
  }

  const promptText = await resolvePromptText(promptToUse);
  if (promptText == null) {
    return;
  }

  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.id) {
      throw new Error('No active tab found');
    }

    const activeTabUrl = activeTab.url || '';
    const isSupported = SUPPORTED_SITE_HOSTS.some((host) => activeTabUrl.includes(host));
    if (!isSupported && !activeTabUrl.startsWith('file:')) {
      console.warn('PromptStow is inserting into an unlisted host:', activeTabUrl);
    }

    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      files: ['content-injection.js']
    });

    const results = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: (text, title) => {
        if (!window.PromptStowInjection || typeof window.PromptStowInjection.insertPrompt !== 'function') {
          throw new Error('PromptStow injection module is not available');
        }

        return window.PromptStowInjection.insertPrompt(text, { title });
      },
      args: [promptText, promptToUse.title]
    });

    const result = results?.[0]?.result;
    if (!result?.success) {
      throw new Error(result?.error || result?.message || 'Failed to insert prompt');
    }

    await trackUsage(promptId);
    showToast('Prompt inserted');
    window.setTimeout(() => window.close(), 700);
  } catch (error) {
    console.error('Prompt insertion failed:', error);
    try {
      await fallbackCopy(promptText);
      showToast('Insert failed. Prompt copied instead.', true, 3600);
    } catch {
      showToast(`Insert failed: ${error.message}`, true, 3600);
    }
  }
}

async function copyPrompt(promptId) {
  const promptToCopy = state.prompts.find((prompt) => prompt.id === promptId);
  if (!promptToCopy) {
    showToast('Prompt not found', true);
    return;
  }

  const promptText = await resolvePromptText(promptToCopy);
  if (promptText == null) {
    return;
  }

  try {
    await fallbackCopy(promptText);
  } catch (error) {
    showToast(`Copy failed: ${error.message}`, true);
    return;
  }
  await trackUsage(promptId);
  showToast('Prompt copied');
}

async function resolvePromptText(promptToResolve) {
  const specs = window.PromptStowTemplate.extractVariableSpecs(promptToResolve.text);
  if (!specs.length) {
    return promptToResolve.text;
  }

  const values = await promptForVariables(specs);
  if (values == null) {
    return null;
  }

  return window.PromptStowTemplate.fillTemplate(promptToResolve.text, values);
}

async function fallbackCopy(text, showManualOnFailure = true) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
      if (!document.execCommand('copy')) {
        throw new Error('Copy fallback failed');
      }
    } catch (error) {
      if (showManualOnFailure) {
        showTextModal(text);
      }
      throw error;
    } finally {
      textarea.remove();
    }
  }
}

async function trackUsage(promptId) {
  try {
    await mutateData({ type: 'TRACK_PROMPT_USAGE', promptId }, false);
  } catch (error) {
    console.warn('PromptStow usage tracking failed:', error);
  }
}

async function deletePrompt(promptId) {
  const promptToDelete = state.prompts.find((prompt) => prompt.id === promptId);
  if (!promptToDelete) {
    showToast('Prompt not found', true);
    return;
  }

  if (!confirm(`Delete "${promptToDelete.title}"?`)) {
    return;
  }

  await mutateData({ type: 'DELETE_PROMPT', promptId });
  showToast('Prompt deleted');
}

async function mutateData(message, toastOnError = true) {
  try {
    const response = await sendMessage(message);
    if (!response.success) {
      throw new Error(response.error || 'Action failed');
    }

    if (response.data) {
      state.prompts = response.data.prompts || state.prompts;
      state.folders = response.data.folders || state.folders;
      state.settings = mergeSettings(response.data.settings || state.settings);
      applySettings();
      refreshUi();
    } else {
      await loadData();
    }
  } catch (error) {
    if (toastOnError) {
      showToast(error.message, true);
    }
    throw error;
  }
}

function promptForVariables(specs) {
  return new Promise((resolve) => {
    const fields = specs.map((spec) => `
      <div class="field">
        <label for="var-${escapeHtml(spec.name)}">${escapeHtml(spec.name)}</label>
        <input class="input" id="var-${escapeHtml(spec.name)}" name="${escapeHtml(spec.name)}" value="${escapeHtml(spec.defaultValue)}">
      </div>
    `).join('');

    showModal({
      title: t('fillVariables'),
      body: `<form id="variablesForm" class="form-grid">${fields}</form>`,
      footer: `
        <button class="btn" data-modal-cancel>${escapeHtml(t('cancel'))}</button>
        <button class="btn btn-primary" data-modal-submit>${escapeHtml(t('insert'))}</button>
      `,
      onMount(root) {
        const form = root.querySelector('#variablesForm');
        root.querySelector('[data-modal-cancel]').addEventListener('click', () => {
          dom.modalRoot._onClose = null;
          closeModal();
          resolve(null);
        });
        root.querySelector('[data-modal-submit]').addEventListener('click', () => {
          const values = {};
          specs.forEach((spec) => {
            values[spec.name] = form.elements[spec.name].value;
          });
          dom.modalRoot._onClose = null;
          closeModal();
          resolve(values);
        });
        form.addEventListener('submit', (event) => {
          event.preventDefault();
          root.querySelector('[data-modal-submit]').click();
        });
        form.querySelector('input')?.focus();
      },
      onClose() {
        resolve(null);
      }
    });
  });
}

function showHistoryModal(promptId) {
  const promptWithHistory = state.prompts.find((prompt) => prompt.id === promptId);
  if (!promptWithHistory) {
    showToast('Prompt not found', true);
    return;
  }

  const history = Array.isArray(promptWithHistory.history) ? promptWithHistory.history : [];
  const body = history.length
    ? history.map((snapshot, index) => `
      <div class="history-item">
        <strong>${escapeHtml(snapshot.title || 'Untitled')}</strong>
        <div class="meta">${escapeHtml(new Date(snapshot.savedAt || 0).toLocaleString())}</div>
        <div class="btn-row">
          <button class="btn btn-primary" data-restore-index="${index}">${escapeHtml(t('restore'))}</button>
          <button class="btn" data-diff-index="${index}">${escapeHtml(t('diff'))}</button>
        </div>
        <div class="diff" id="diff-${index}" hidden></div>
      </div>
    `).join('')
    : `<div class="empty-state"><h3>${escapeHtml(t('history'))}</h3><p>No saved versions yet.</p></div>`;

  showModal({
    title: `${t('history')}: ${promptWithHistory.title}`,
    body,
    footer: `<button class="btn" data-modal-close>${escapeHtml(t('close'))}</button>`,
    onMount(root) {
      root.querySelector('[data-modal-close]').addEventListener('click', closeModal);
      root.querySelectorAll('[data-restore-index]').forEach((button) => {
        button.addEventListener('click', async () => {
          await mutateData({
            type: 'RESTORE_VERSION',
            promptId,
            index: Number(button.getAttribute('data-restore-index'))
          });
          closeModal();
          showToast('Version restored');
        });
      });
      root.querySelectorAll('[data-diff-index]').forEach((button) => {
        button.addEventListener('click', () => {
          const index = Number(button.getAttribute('data-diff-index'));
          const diffBox = root.querySelector(`#diff-${index}`);
          const snapshot = history[index];
          diffBox.hidden = !diffBox.hidden;
          if (!diffBox.hidden && !diffBox.innerHTML) {
            diffBox.innerHTML = window.PromptStowHistory
              .diffLines(snapshot.text, promptWithHistory.text)
              .map((line) => `<div class="diff-line ${line.type}">${escapeHtml(prefixDiff(line.type, line.line))}</div>`)
              .join('');
          }
        });
      });
    }
  });
}

function prefixDiff(type, line) {
  if (type === 'add') {
    return `+ ${line}`;
  }
  if (type === 'del') {
    return `- ${line}`;
  }
  return `  ${line}`;
}

function showStatsModal() {
  const totalUses = state.prompts.reduce((sum, prompt) => sum + Number(prompt.usageCount || 0), 0);
  const top = [...state.prompts]
    .sort((a, b) => Number(b.usageCount || 0) - Number(a.usageCount || 0))
    .slice(0, 5);
  const maxUses = Math.max(1, ...top.map((prompt) => Number(prompt.usageCount || 0)));
  const bars = top.length
    ? top.map((prompt) => {
      const count = Number(prompt.usageCount || 0);
      const width = Math.round((count / maxUses) * 100);
      return `
        <div class="stat-row is-block">
          <strong>${escapeHtml(prompt.title)}</strong>
          <div class="meta">${count} uses</div>
          <div class="bar"><span style="width:${width}%"></span></div>
        </div>
      `;
    }).join('')
    : '<div class="empty-state"><p>No usage yet.</p></div>';

  showModal({
    title: t('stats'),
    body: `
      <div class="stat-row"><strong>${escapeHtml(t('totalPrompts'))}</strong><div>${state.prompts.length}</div></div>
      <div class="stat-row"><strong>${escapeHtml(t('totalUses'))}</strong><div>${totalUses}</div></div>
      <div class="stat-row"><strong>${escapeHtml(t('topPrompts'))}</strong></div>
      ${bars}
    `,
    footer: `<button class="btn" data-modal-close>${escapeHtml(t('close'))}</button>`,
    onMount(root) {
      root.querySelector('[data-modal-close]').addEventListener('click', closeModal);
    }
  });
}

function showTextModal(text) {
  showModal({
    title: t('copy'),
    body: `<textarea class="textarea" readonly>${escapeHtml(text)}</textarea>`,
    footer: `<button class="btn" data-modal-close>${escapeHtml(t('close'))}</button>`,
    onMount(root) {
      root.querySelector('[data-modal-close]').addEventListener('click', closeModal);
      const textarea = root.querySelector('textarea');
      textarea.focus();
      textarea.select();
    }
  });
}

function showModal({ title, body, footer, onMount, onClose }) {
  closeModal();
  dom.modalRoot.innerHTML = `
    <div class="modal-backdrop">
      <section class="modal" role="dialog" aria-modal="true">
        <div class="modal-header">${escapeHtml(title)}</div>
        <div class="modal-body">${body}</div>
        <div class="modal-footer">${footer || ''}</div>
      </section>
    </div>
  `;
  dom.modalRoot.dataset.hasCloseHandler = onClose ? 'true' : '';
  dom.modalRoot._onClose = onClose || null;
  const backdrop = dom.modalRoot.querySelector('.modal-backdrop');
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) {
      closeModal();
    }
  });
  onMount?.(dom.modalRoot);
}

function closeModal() {
  if (dom.modalRoot?._onClose) {
    const onClose = dom.modalRoot._onClose;
    dom.modalRoot._onClose = null;
    onClose();
  }
  if (dom.modalRoot) {
    dom.modalRoot.innerHTML = '';
  }
}

async function exportPrompts() {
  if (!state.prompts.length) {
    showToast('No prompts to export', true);
    return;
  }

  const exportData = {
    version: '1.1.0',
    exportDate: new Date().toISOString(),
    prompts: state.prompts,
    folders: state.folders,
    settings: state.settings
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `prompts_export_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast('Prompts exported');
}

async function importPrompts(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  try {
    const importData = JSON.parse(await file.text());
    const validPrompts = (importData.prompts || []).filter((prompt) => prompt.title && prompt.text);
    if (!validPrompts.length) {
      throw new Error('No valid prompts found');
    }

    if (!confirm(`Import ${validPrompts.length} prompts? Duplicate titles will be skipped.`)) {
      return;
    }

    const existingTitles = new Set(state.prompts.map((prompt) => prompt.title.toLowerCase()));
    let imported = 0;
    for (const promptData of validPrompts) {
      if (existingTitles.has(String(promptData.title).toLowerCase())) {
        continue;
      }

      const now = new Date().toISOString();
      await sendMessage({
        type: 'SAVE_PROMPT',
        prompt: {
          ...promptData,
          id: `prompt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          folderId: promptData.folderId || ROOT_FOLDER_ID,
          createdAt: now,
          updatedAt: now
        }
      });
      existingTitles.add(String(promptData.title).toLowerCase());
      imported += 1;
    }

    await loadData();
    showToast(`Imported ${imported} prompts`);
  } catch (error) {
    showToast(error.message, true);
  } finally {
    event.target.value = '';
  }
}

function showError(message) {
  dom.promptsList.innerHTML = `
    <div class="empty-state">
      <h3>Error</h3>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function showToast(message, isError = false, duration = 2200) {
  document.querySelectorAll('.toast').forEach((toast) => toast.remove());
  const toast = document.createElement('div');
  toast.className = `toast ${isError ? 'is-error' : ''}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), duration);
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = String(value ?? '');
  return div.innerHTML;
}
