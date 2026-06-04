// Shared slash trigger parser.
(function () {
  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function parseTrigger(textBeforeCaret, triggerStr) {
    const text = String(textBeforeCaret || '');
    const trigger = String(triggerStr || '/');

    if (!trigger) {
      return null;
    }

    const escaped = escapeRegExp(trigger);
    const pattern = new RegExp(`(^|\\s)(${escaped})([^\\s]*)$`);
    const match = text.match(pattern);

    if (!match) {
      return null;
    }

    const prefixLength = match[1].length;
    const tokenStart = match.index + prefixLength;
    const token = match[2] + match[3];

    if (match[3] && match[3].includes(trigger)) {
      return null;
    }

    return {
      token,
      query: match[3] || '',
      start: tokenStart,
      end: tokenStart + token.length
    };
  }

  const api = {
    parseTrigger
  };

  if (typeof globalThis !== 'undefined') {
    globalThis.PromptlySlashParse = api;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
