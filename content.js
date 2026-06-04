// Content script bridge for prompt insertion requests.
console.log('PromptStow content script loaded on:', window.location.hostname);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== 'INSERT_PROMPT') {
    return false;
  }

  (async () => {
    try {
      if (!window.PromptStowInjection || typeof window.PromptStowInjection.insertPrompt !== 'function') {
        throw new Error('PromptStow injection module is not available');
      }

      const result = await window.PromptStowInjection.insertPrompt(
        message.payload.text,
        { title: message.payload.title }
      );

      sendResponse(result);
    } catch (error) {
      console.error('Error inserting prompt:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();

  return true;
});
