// Shared fuzzy search helpers.
(function () {
  function normalize(value) {
    return String(value || '').toLowerCase();
  }

  function isWordBoundary(target, index) {
    if (index === 0) {
      return true;
    }

    return /[\s._:/()[\]{}-]/.test(target[index - 1]);
  }

  function fuzzyScore(query, target) {
    const q = normalize(query).trim();
    const t = normalize(target);

    if (!q) {
      return 1;
    }

    let score = 0;
    let lastIndex = -1;
    let searchFrom = 0;

    for (const char of q) {
      const index = t.indexOf(char, searchFrom);
      if (index === -1) {
        return 0;
      }

      score += 2;
      if (index === lastIndex + 1) {
        score += 4;
      }
      if (isWordBoundary(t, index)) {
        score += 3;
      }
      if (index === 0) {
        score += 2;
      }

      score -= Math.max(0, index - searchFrom) * 0.04;
      lastIndex = index;
      searchFrom = index + 1;
    }

    if (t.includes(q)) {
      score += 8;
    }

    return Math.max(0, score - t.length * 0.01);
  }

  function promptSearchText(prompt) {
    const source = prompt || {};
    return [
      source.title,
      source.summary,
      source.text,
      Array.isArray(source.tags) ? source.tags.join(' ') : ''
    ].filter(Boolean).join(' ');
  }

  function fuzzyFilter(query, prompts, options = {}) {
    const limit = options.limit || prompts.length;
    const list = Array.isArray(prompts) ? prompts : [];
    const q = String(query || '').trim();

    if (!q) {
      return list.slice(0, limit);
    }

    return list
      .map((prompt, index) => ({
        prompt,
        index,
        score: fuzzyScore(q, promptSearchText(prompt))
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        return a.index - b.index;
      })
      .slice(0, limit)
      .map((item) => item.prompt);
  }

  const api = {
    fuzzyFilter,
    fuzzyScore
  };

  if (typeof globalThis !== 'undefined') {
    globalThis.PromptStowFuzzy = api;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
