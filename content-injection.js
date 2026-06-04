// Shared prompt insertion module for supported AI chat sites.
(function () {
  if (window.PromptlyInjection) {
    return;
  }

  const GENERIC_SELECTORS = [
    'textarea:not([readonly]):not([disabled])',
    'input[type="text"]:not([readonly]):not([disabled])',
    'input[type="search"]:not([readonly]):not([disabled])',
    '[contenteditable="true"]'
  ];

  const SITE_STRATEGIES = [
    {
      host: 'chatgpt.com',
      selectors: [
        '#prompt-textarea',
        'textarea[data-id="prompt-textarea"]',
        '[contenteditable="true"][id="prompt-textarea"]',
        '[contenteditable="true"][data-testid*="prompt" i]',
        'textarea[placeholder*="message" i]'
      ],
      waitForElement: false
    },
    {
      host: 'chat.openai.com',
      selectors: [
        '#prompt-textarea',
        'textarea[data-id="prompt-textarea"]',
        '[contenteditable="true"][id="prompt-textarea"]',
        'textarea[placeholder*="message" i]'
      ],
      waitForElement: false
    },
    {
      host: 'claude.ai',
      selectors: [
        'div[contenteditable="true"][data-testid="prompt-input"]',
        'div[contenteditable="true"][role="textbox"]',
        'div[contenteditable="true"][aria-label*="prompt" i]',
        'textarea[placeholder*="Claude" i]',
        'div[contenteditable="true"]'
      ],
      waitForElement: true,
      maxWaitTime: 5000
    },
    {
      host: 'gemini.google.com',
      selectors: [
        'rich-textarea div[contenteditable="true"]',
        'div[contenteditable="true"][aria-label*="prompt" i]',
        'textarea[aria-label*="prompt" i]',
        'textarea[placeholder*="prompt" i]',
        'textarea[aria-label*="Ask Gemini" i]'
      ],
      waitForElement: false
    },
    {
      host: 'aistudio.google.com',
      selectors: [
        '.textarea.gmat-body-medium',
        'div[contenteditable="true"][role="textbox"]',
        'textarea[aria-label*="prompt" i]',
        'textarea'
      ],
      waitForElement: true,
      maxWaitTime: 3000
    },
    {
      host: 'grok.com',
      selectors: [
        'textarea[aria-label*="Grok" i]',
        'textarea[dir="auto"]',
        'div[contenteditable="true"][role="textbox"]',
        'textarea'
      ],
      waitForElement: false
    },
    {
      host: 'chat.deepseek.com',
      selectors: [
        'textarea#chat-input',
        'textarea[placeholder*="DeepSeek" i]',
        'div[contenteditable="true"][role="textbox"]',
        'textarea'
      ],
      waitForElement: false
    }
  ];

  function getCurrentStrategy() {
    const hostname = window.location.hostname;
    return SITE_STRATEGIES.find((strategy) => hostname.includes(strategy.host)) || {
      host: 'generic',
      selectors: GENERIC_SELECTORS,
      waitForElement: true,
      maxWaitTime: 3000
    };
  }

  function isElementVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);

    return (
      rect.width > 20 &&
      rect.height > 20 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0'
    );
  }

  function isElementEditable(element) {
    if (!element) {
      return false;
    }

    if (element.disabled || element.readOnly) {
      return false;
    }

    if (element.tagName === 'TEXTAREA') {
      return true;
    }

    if (element.tagName === 'INPUT') {
      const textInputTypes = new Set(['', 'email', 'search', 'tel', 'text', 'url']);
      return textInputTypes.has((element.type || '').toLowerCase());
    }

    return Boolean(element.isContentEditable);
  }

  function findElement(selectors) {
    for (const selector of selectors) {
      try {
        const elements = document.querySelectorAll(selector);

        for (const element of elements) {
          if (isElementVisible(element) && isElementEditable(element)) {
            return element;
          }
        }
      } catch (error) {
        console.warn('Promptly skipped invalid selector:', selector, error);
      }
    }

    return null;
  }

  function getFocusedEditableElement() {
    const activeElement = document.activeElement;
    if (isElementEditable(activeElement) && isElementVisible(activeElement)) {
      return activeElement;
    }

    return null;
  }

  function waitForElement(selectors, timeout = 3000) {
    return new Promise((resolve) => {
      const immediateElement = findElement(selectors);
      if (immediateElement) {
        resolve(immediateElement);
        return;
      }

      if (!document.body) {
        resolve(null);
        return;
      }

      let settled = false;
      const observer = new MutationObserver(() => {
        if (settled) {
          return;
        }

        const element = findElement(selectors);
        if (element) {
          settled = true;
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        attributes: true,
        childList: true,
        subtree: true
      });

      window.setTimeout(() => {
        if (!settled) {
          settled = true;
          observer.disconnect();
          resolve(null);
        }
      }, timeout);
    });
  }

  async function resolveTargetElement(strategy) {
    const selectors = [...strategy.selectors, ...GENERIC_SELECTORS];
    const targetElement = strategy.waitForElement
      ? await waitForElement(selectors, strategy.maxWaitTime)
      : findElement(selectors);

    return targetElement || getFocusedEditableElement();
  }

  function setNativeValue(element, value) {
    const prototype = element.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

    if (descriptor && descriptor.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }
  }

  function dispatchEditingEvents(element) {
    try {
      element.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText'
      }));
    } catch {
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }

    element.dispatchEvent(new Event('change', { bubbles: true }));

    try {
      element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    } catch {
      // CompositionEvent is not available in every page context.
    }
  }

  function moveCursorToEnd(element) {
    element.focus();

    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      element.selectionStart = element.selectionEnd = element.value.length;
      return;
    }

    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function getTextBeforeCaret(element) {
    if (!element) {
      return '';
    }

    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      return String(element.value || '').slice(0, element.selectionStart || 0);
    }

    if (!element.isContentEditable) {
      return '';
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return '';
    }

    const range = selection.getRangeAt(0);
    if (!element.contains(range.startContainer)) {
      return '';
    }

    const clone = range.cloneRange();
    clone.selectNodeContents(element);
    clone.setEnd(range.startContainer, range.startOffset);
    return clone.toString();
  }

  function copyInputStyles(source, target) {
    const computed = window.getComputedStyle(source);
    [
      'boxSizing',
      'width',
      'height',
      'borderTopWidth',
      'borderRightWidth',
      'borderBottomWidth',
      'borderLeftWidth',
      'paddingTop',
      'paddingRight',
      'paddingBottom',
      'paddingLeft',
      'fontFamily',
      'fontSize',
      'fontWeight',
      'letterSpacing',
      'lineHeight',
      'textTransform',
      'wordSpacing',
      'tabSize'
    ].forEach((property) => {
      target.style[property] = computed[property];
    });
  }

  function getInputCaretRect(element) {
    const selectionStart = element.selectionStart || 0;
    const value = String(element.value || '');
    const mirror = document.createElement('div');
    const marker = document.createElement('span');

    copyInputStyles(element, mirror);
    mirror.style.position = 'fixed';
    mirror.style.left = `${element.getBoundingClientRect().left}px`;
    mirror.style.top = `${element.getBoundingClientRect().top}px`;
    mirror.style.visibility = 'hidden';
    mirror.style.whiteSpace = element.tagName === 'TEXTAREA' ? 'pre-wrap' : 'pre';
    mirror.style.overflowWrap = 'break-word';
    mirror.textContent = value.slice(0, selectionStart);
    marker.textContent = value.slice(selectionStart, selectionStart + 1) || '\u200b';
    mirror.appendChild(marker);
    document.body.appendChild(mirror);

    const rect = marker.getBoundingClientRect();
    const finalRect = {
      left: rect.left - element.scrollLeft,
      right: rect.right - element.scrollLeft,
      top: rect.top - element.scrollTop,
      bottom: rect.bottom - element.scrollTop,
      width: rect.width,
      height: rect.height || parseFloat(window.getComputedStyle(element).lineHeight) || 18
    };

    mirror.remove();
    return finalRect;
  }

  function getContentEditableCaretRect(element) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return element.getBoundingClientRect();
    }

    const range = selection.getRangeAt(0).cloneRange();
    if (!element.contains(range.startContainer)) {
      return element.getBoundingClientRect();
    }

    range.collapse(true);
    const rect = range.getClientRects()[0];
    if (rect) {
      return rect;
    }

    const marker = document.createElement('span');
    marker.textContent = '\u200b';
    range.insertNode(marker);
    const markerRect = marker.getBoundingClientRect();
    marker.remove();
    return markerRect;
  }

  function getCaretRect(element) {
    if (!element) {
      return null;
    }

    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      return getInputCaretRect(element);
    }

    if (element.isContentEditable) {
      return getContentEditableCaretRect(element);
    }

    return element.getBoundingClientRect();
  }

  function getTextPosition(root, targetOffset) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let remaining = targetOffset;
    let lastTextNode = null;

    while (walker.nextNode()) {
      const node = walker.currentNode;
      lastTextNode = node;
      if (remaining <= node.textContent.length) {
        return { node, offset: remaining };
      }
      remaining -= node.textContent.length;
    }

    if (lastTextNode) {
      return { node: lastTextNode, offset: lastTextNode.textContent.length };
    }

    return { node: root, offset: 0 };
  }

  function textFragment(text) {
    const fragment = document.createDocumentFragment();
    const lines = String(text || '').split('\n');
    let lastNode = null;

    lines.forEach((line, index) => {
      if (index > 0) {
        lastNode = document.createElement('br');
        fragment.appendChild(lastNode);
      }

      if (line) {
        lastNode = document.createTextNode(line);
        fragment.appendChild(lastNode);
      }
    });

    if (!lastNode) {
      lastNode = document.createTextNode('');
      fragment.appendChild(lastNode);
    }

    return { fragment, lastNode };
  }

  function replaceContentEditableRange(element, start, end, text) {
    element.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    const startPosition = getTextPosition(element, start);
    const endPosition = getTextPosition(element, end);
    const { fragment, lastNode } = textFragment(text);

    range.setStart(startPosition.node, startPosition.offset);
    range.setEnd(endPosition.node, endPosition.offset);
    range.deleteContents();
    range.insertNode(fragment);

    const cursor = document.createRange();
    cursor.setStartAfter(lastNode);
    cursor.collapse(true);
    selection.removeAllRanges();
    selection.addRange(cursor);
    dispatchEditingEvents(element);
  }

  function replaceRange(element, start, end, text) {
    if (!element) {
      throw new Error('No target element supplied');
    }

    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      const currentValue = String(element.value || '');
      const nextValue = `${currentValue.slice(0, start)}${text}${currentValue.slice(end)}`;
      setNativeValue(element, nextValue);
      element.focus();
      const nextCursor = start + String(text).length;
      element.selectionStart = element.selectionEnd = nextCursor;
      dispatchEditingEvents(element);
      return;
    }

    if (element.isContentEditable) {
      replaceContentEditableRange(element, start, end, text);
      return;
    }

    throw new Error('Target element is not editable');
  }

  function insertIntoInput(element, text) {
    const currentValue = element.value || '';
    const nextValue = currentValue.trim() ? `${currentValue}\n\n${text}` : text;

    setNativeValue(element, nextValue);
    moveCursorToEnd(element);
    dispatchEditingEvents(element);
  }

  function writeContentEditableFallback(element, text) {
    element.innerHTML = '';

    text.split('\n').forEach((line, index, lines) => {
      if (line) {
        element.appendChild(document.createTextNode(line));
      }

      if (index < lines.length - 1) {
        element.appendChild(document.createElement('br'));
      }
    });
  }

  function insertIntoContentEditable(element, text) {
    const currentText = element.textContent || element.innerText || '';
    const textToInsert = currentText.trim() ? `\n\n${text}` : text;

    moveCursorToEnd(element);

    try {
      const inserted = document.execCommand('insertText', false, textToInsert);
      if (!inserted) {
        throw new Error('execCommand returned false');
      }
    } catch {
      if (currentText.trim()) {
        element.appendChild(document.createTextNode(textToInsert));
      } else {
        writeContentEditableFallback(element, text);
      }
    }

    moveCursorToEnd(element);
    dispatchEditingEvents(element);
  }

  async function insertPrompt(promptText, options = {}) {
    if (!promptText) {
      throw new Error('Prompt text is empty');
    }

    const strategy = getCurrentStrategy();
    const targetElement = await resolveTargetElement(strategy);

    if (!targetElement) {
      throw new Error('No suitable text input found on this page');
    }

    if (targetElement.tagName === 'TEXTAREA' || targetElement.tagName === 'INPUT') {
      insertIntoInput(targetElement, promptText);
    } else if (targetElement.isContentEditable) {
      insertIntoContentEditable(targetElement, promptText);
    } else {
      throw new Error('Target element is not editable');
    }

    console.log('Promptly inserted prompt:', options.title || '(untitled)', strategy.host);
    return { success: true, message: 'Prompt inserted successfully' };
  }

  window.PromptlyInjection = {
    findElement,
    getCaretRect,
    getCurrentStrategy,
    getTextBeforeCaret,
    insertPrompt,
    isElementEditable,
    isElementVisible,
    replaceRange,
    waitForElement
  };

  // Backward-compatible alias for older callers.
  window.injectPromptAdvanced = (promptText, promptTitle) => (
    window.PromptlyInjection.insertPrompt(promptText, { title: promptTitle })
  );
})();
