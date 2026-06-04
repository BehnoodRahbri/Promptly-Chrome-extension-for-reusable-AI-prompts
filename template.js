// Shared variable templating helpers.
(function () {
  const TOKEN_PATTERN = /\{\{\s*([A-Za-z0-9_.-]+)(?:\|([^}]*))?\s*\}\}/g;

  function extractVariableSpecs(text) {
    const specs = [];
    const seen = new Set();
    const source = String(text || '');
    let match;

    while ((match = TOKEN_PATTERN.exec(source)) !== null) {
      const name = match[1].trim();
      if (!name || seen.has(name)) {
        continue;
      }

      seen.add(name);
      specs.push({
        name,
        defaultValue: match[2] == null ? '' : match[2].trim()
      });
    }

    return specs;
  }

  function extractVariables(text) {
    return extractVariableSpecs(text).map((spec) => spec.name);
  }

  function fillTemplate(text, values) {
    const source = String(text || '');
    const incoming = values && typeof values === 'object' ? values : {};

    return source.replace(TOKEN_PATTERN, (_match, rawName, rawDefault) => {
      const name = rawName.trim();
      if (Object.prototype.hasOwnProperty.call(incoming, name) && incoming[name] != null) {
        return String(incoming[name]);
      }

      return rawDefault == null ? '' : String(rawDefault).trim();
    });
  }

  const api = {
    extractVariableSpecs,
    extractVariables,
    fillTemplate
  };

  if (typeof globalThis !== 'undefined') {
    globalThis.PromptlyTemplate = api;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
