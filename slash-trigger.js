// Inline slash-command trigger for Promptly.
(function () {
  if (window.__promptlySlash) {
    return;
  }

  window.__promptlySlash = true;

  const Injection = window.PromptlyInjection;
  const Fuzzy = window.PromptlyFuzzy;
  const Parser = window.PromptlySlashParse;
  const Template = window.PromptlyTemplate;

  const DEFAULT_SETTINGS = {
    enabled: true,
    trigger: '/',
    maxResults: 8
  };

  let prompts = [];
  let settings = { slashTrigger: { ...DEFAULT_SETTINGS } };
  let hasLoaded = false;
  let activeElement = null;
  let activeParse = null;
  let activeItems = [];
  let activeIndex = 0;
  let composing = false;
  let mode = 'closed';
  let host = null;
  let shadow = null;

  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!response) {
          reject(new Error('No response from Promptly background'));
          return;
        }

        resolve(response);
      });
    });
  }

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value || '');
    return div.innerHTML;
  }

  function getSlashSettings() {
    return {
      ...DEFAULT_SETTINGS,
      ...(settings.slashTrigger || {})
    };
  }

  function sortPrompts(list) {
    return [...list].sort((a, b) => {
      if (Boolean(b.favorite) !== Boolean(a.favorite)) {
        return Boolean(b.favorite) - Boolean(a.favorite);
      }

      const aUsed = new Date(a.lastUsed || a.updatedAt || a.createdAt || 0).getTime();
      const bUsed = new Date(b.lastUsed || b.updatedAt || b.createdAt || 0).getTime();
      return bUsed - aUsed;
    });
  }

  async function loadPrompts() {
    if (hasLoaded) {
      return;
    }

    const response = await sendMessage({ type: 'GET_PROMPTS' });
    if (!response.success) {
      throw new Error(response.error || 'Failed to load prompts');
    }

    prompts = response.data || [];
    settings = response.settings || settings;
    hasLoaded = true;
  }

  function ensureShadow() {
    if (host && shadow) {
      return;
    }

    host = document.createElement('div');
    host.style.cssText = [
      'position:fixed',
      'z-index:2147483647',
      'display:none',
      'left:0',
      'top:0'
    ].join(';');

    shadow = host.attachShadow({ mode: 'open' });
    document.body.appendChild(host);
  }

  function positionHost(element) {
    ensureShadow();
    const rect = Injection.getCaretRect(element) || element.getBoundingClientRect();
    const estimatedHeight = 260;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - 320);
    const top = rect.bottom + estimatedHeight > window.innerHeight
      ? Math.max(8, rect.top - estimatedHeight - 6)
      : rect.bottom + 6;

    host.style.left = `${left}px`;
    host.style.top = `${top}px`;
  }

  function hide() {
    if (host) {
      host.style.display = 'none';
    }
    if (shadow) {
      shadow.innerHTML = '';
    }
    activeElement = null;
    activeParse = null;
    activeItems = [];
    activeIndex = 0;
    mode = 'closed';
  }

  function baseStyles() {
    return `
      <style>
        :host { all: initial; }
        * { box-sizing: border-box; }
        .panel {
          --bg: #ffffff;
          --surface: #f4f4f5;
          --text: #18181b;
          --muted: #71717a;
          --faint: #a1a1aa;
          --border: #e7e7ea;
          --accent: #4f46e5;
          --accent-soft: rgba(79, 70, 229, 0.10);
          --shadow: 0 16px 44px rgba(9, 9, 11, 0.22);
          width: 320px;
          overflow: hidden;
          background: var(--bg);
          color: var(--text);
          border: 1px solid var(--border);
          border-radius: 10px;
          box-shadow: var(--shadow);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 13px;
          line-height: 1.45;
          -webkit-font-smoothing: antialiased;
        }
        @media (prefers-color-scheme: dark) {
          .panel {
            --bg: #161618;
            --surface: #232327;
            --text: #f4f4f5;
            --muted: #a1a1aa;
            --faint: #71717a;
            --border: #2e2e33;
            --accent: #818cf8;
            --accent-soft: rgba(129, 140, 248, 0.16);
            --shadow: 0 16px 44px rgba(0, 0, 0, 0.6);
          }
        }
        .list { max-height: 256px; overflow-y: auto; }
        .item {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          width: 100%;
          padding: 9px 12px;
          border: 0;
          border-left: 2px solid transparent;
          background: transparent;
          color: inherit;
          text-align: left;
          cursor: pointer;
          font: inherit;
        }
        .item + .item { border-top: 1px solid var(--border); }
        .item:hover { background: var(--surface); }
        .item.is-active {
          background: var(--accent-soft);
          border-left-color: var(--accent);
        }
        .star, .spacer { flex: 0 0 auto; width: 14px; height: 14px; margin-top: 2px; }
        .star svg { width: 14px; height: 14px; display: block; fill: #f59e0b; }
        .body { flex: 1 1 auto; min-width: 0; }
        .title {
          display: block;
          font-weight: 650;
          line-height: 1.3;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .summary {
          display: block;
          margin-top: 1px;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.35;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .empty { padding: 18px 12px; color: var(--muted); text-align: center; }
        .hint {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 6px 12px;
          border-top: 1px solid var(--border);
          background: var(--surface);
          color: var(--faint);
          font-size: 11px;
        }
        .hint .k {
          display: inline-block;
          min-width: 15px;
          padding: 1px 4px;
          margin-right: 2px;
          border: 1px solid var(--border);
          border-radius: 4px;
          background: var(--bg);
          color: var(--muted);
          font-size: 10px;
          line-height: 1.4;
          text-align: center;
        }
        form { display: grid; gap: 10px; padding: 12px; }
        label { display: grid; gap: 4px; color: var(--muted); font-weight: 600; font-size: 12px; }
        input {
          width: 100%;
          box-sizing: border-box;
          padding: 8px 10px;
          border: 1px solid var(--border);
          border-radius: 7px;
          background: var(--bg);
          color: var(--text);
          font: inherit;
        }
        input:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-soft);
        }
        .actions { display: flex; justify-content: flex-end; gap: 8px; }
        button.action {
          border: 0;
          border-radius: 7px;
          padding: 7px 12px;
          background: var(--accent);
          color: #ffffff;
          font: inherit;
          font-weight: 600;
          cursor: pointer;
        }
        button.secondary {
          background: var(--surface);
          color: var(--text);
          border: 1px solid var(--border);
        }
      </style>
    `;
  }

  function renderDropdown() {
    ensureShadow();
    const star = '<span class="star"><svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></span>';
    const hint = `
      <div class="hint">
        <span><span class="k">&uarr;</span><span class="k">&darr;</span> navigate</span>
        <span><span class="k">&crarr;</span> insert</span>
        <span><span class="k">esc</span> close</span>
      </div>`;
    const items = activeItems.length
      ? `<div class="list" role="listbox">${activeItems.map((prompt, index) => `
        <button class="item ${index === activeIndex ? 'is-active' : ''}" data-index="${index}" type="button" role="option" aria-selected="${index === activeIndex}">
          ${prompt.favorite ? star : '<span class="spacer"></span>'}
          <span class="body">
            <span class="title">${escapeHtml(prompt.title)}</span>
            <span class="summary">${escapeHtml((prompt.summary || prompt.text || '').replace(/\s+/g, ' ').trim().slice(0, 140))}</span>
          </span>
        </button>
      `).join('')}</div>${hint}`
      : '<div class="empty">No prompts found</div>';

    shadow.innerHTML = `${baseStyles()}<div class="panel">${items}</div>`;
    shadow.querySelectorAll('[data-index]').forEach((button) => {
      button.addEventListener('mousedown', (event) => {
        event.preventDefault();
        activeIndex = Number(button.getAttribute('data-index'));
        acceptActivePrompt().catch((error) => {
          console.error('Promptly slash accept failed:', error);
          hide();
        });
      });
    });
    mode = 'dropdown';
    host.style.display = 'block';
  }

  function renderVariableForm(prompt, specs) {
    ensureShadow();
    const fields = specs.map((spec) => `
      <label>
        <span>${escapeHtml(spec.name)}</span>
        <input name="${escapeHtml(spec.name)}" value="${escapeHtml(spec.defaultValue)}" autocomplete="off">
      </label>
    `).join('');

    shadow.innerHTML = `
      ${baseStyles()}
      <div class="panel">
        <form>
          ${fields}
          <div class="actions">
            <button class="action secondary" type="button" data-cancel>Cancel</button>
            <button class="action" type="submit">Insert</button>
          </div>
        </form>
      </div>
    `;

    const form = shadow.querySelector('form');
    const cancel = shadow.querySelector('[data-cancel]');
    cancel.addEventListener('click', hide);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const values = {};
      specs.forEach((spec) => {
        values[spec.name] = form.elements[spec.name].value;
      });
      insertPromptText(prompt, Template.fillTemplate(prompt.text, values)).catch((error) => {
        console.error('Promptly variable insert failed:', error);
        hide();
      });
    });
    shadow.querySelector('input')?.focus();
    mode = 'variables';
    host.style.display = 'block';
  }

  function currentParseForElement(element) {
    const slash = getSlashSettings();
    const before = Injection.getTextBeforeCaret(element);
    return Parser.parseTrigger(before, slash.trigger);
  }

  async function insertPromptText(prompt, text) {
    const parse = currentParseForElement(activeElement) || activeParse;
    if (!parse) {
      hide();
      return;
    }

    Injection.replaceRange(activeElement, parse.start, parse.end, text);
    hide();

    try {
      await sendMessage({ type: 'TRACK_PROMPT_USAGE', promptId: prompt.id });
      prompt.usageCount = Number(prompt.usageCount || 0) + 1;
      prompt.lastUsed = new Date().toISOString();
    } catch (error) {
      console.warn('Promptly usage tracking failed:', error);
    }
  }

  async function acceptActivePrompt() {
    const prompt = activeItems[activeIndex];
    if (!prompt || !activeElement) {
      hide();
      return;
    }

    const specs = Template.extractVariableSpecs(prompt.text);
    if (specs.length) {
      positionHost(activeElement);
      renderVariableForm(prompt, specs);
      return;
    }

    await insertPromptText(prompt, prompt.text);
  }

  async function updateForTarget(target) {
    if (!Injection || !Fuzzy || !Parser || !Template || !Injection.isElementEditable(target)) {
      hide();
      return;
    }

    await loadPrompts();
    const slash = getSlashSettings();
    if (!slash.enabled) {
      hide();
      return;
    }

    const parse = currentParseForElement(target);
    if (!parse) {
      hide();
      return;
    }

    activeElement = target;
    activeParse = parse;
    activeIndex = 0;
    activeItems = Fuzzy.fuzzyFilter(
      parse.query,
      sortPrompts(prompts),
      { limit: Number(slash.maxResults || 8) }
    );

    positionHost(target);
    renderDropdown();
  }

  document.addEventListener('input', (event) => {
    if (mode === 'variables') {
      return;
    }

    if (composing) {
      return;
    }

    updateForTarget(event.target).catch((error) => {
      console.warn('Promptly slash update failed:', error);
      hide();
    });
  }, true);

  document.addEventListener('compositionstart', () => {
    composing = true;
  }, true);

  document.addEventListener('compositionend', (event) => {
    composing = false;
    updateForTarget(event.target).catch((error) => {
      console.warn('Promptly slash update failed after composition:', error);
      hide();
    });
  }, true);

  document.addEventListener('keydown', (event) => {
    if (!host || host.style.display === 'none') {
      return;
    }

    if (mode === 'variables') {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        hide();
      }
      return;
    }

    if (mode !== 'dropdown') {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      hide();
    } else if (!activeItems.length) {
      return;
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopImmediatePropagation();
      activeIndex = (activeIndex + 1) % activeItems.length;
      renderDropdown();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopImmediatePropagation();
      activeIndex = (activeIndex - 1 + activeItems.length) % activeItems.length;
      renderDropdown();
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault();
      event.stopImmediatePropagation();
      acceptActivePrompt().catch((error) => {
        console.error('Promptly slash accept failed:', error);
        hide();
      });
    }
  }, true);

  window.addEventListener('scroll', () => {
    if (host && host.style.display !== 'none' && activeElement) {
      positionHost(activeElement);
    }
  }, true);

  window.addEventListener('resize', () => {
    if (host && host.style.display !== 'none' && activeElement) {
      positionHost(activeElement);
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.promptSaverData?.newValue) {
      const data = changes.promptSaverData.newValue;
      prompts = data.prompts || prompts;
      settings = data.settings || settings;
      hasLoaded = true;
    }
  });
})();
