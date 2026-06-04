// Shared prompt history and diff helpers.
(function () {
  const HISTORY_FIELDS = ['title', 'summary', 'text'];

  function cloneTags(tags) {
    return Array.isArray(tags) ? tags.map(String) : [];
  }

  function buildSnapshot(prompt) {
    const source = prompt || {};

    return {
      title: source.title || '',
      summary: source.summary || '',
      text: source.text || '',
      tags: cloneTags(source.tags),
      savedAt: new Date().toISOString()
    };
  }

  function snapshotsEqual(a, b) {
    if (!a || !b) {
      return false;
    }

    return (
      a.title === b.title &&
      a.summary === b.summary &&
      a.text === b.text &&
      JSON.stringify(cloneTags(a.tags)) === JSON.stringify(cloneTags(b.tags))
    );
  }

  function pushHistory(history, snapshot, maxN = 10) {
    const existing = Array.isArray(history) ? history : [];
    if (!snapshot) {
      return existing.slice(0, maxN);
    }

    if (snapshotsEqual(existing[0], snapshot)) {
      return existing.slice(0, maxN);
    }

    return [snapshot, ...existing].slice(0, maxN);
  }

  function shouldSnapshot(prev, next) {
    if (!prev || !next) {
      return false;
    }

    const textFieldsChanged = HISTORY_FIELDS.some((field) => String(prev[field] || '') !== String(next[field] || ''));
    const tagsChanged = JSON.stringify(cloneTags(prev.tags)) !== JSON.stringify(cloneTags(next.tags));
    return textFieldsChanged || tagsChanged;
  }

  function diffLines(oldText, newText) {
    const oldLines = String(oldText || '').split('\n');
    const newLines = String(newText || '').split('\n');
    const rows = oldLines.length + 1;
    const cols = newLines.length + 1;
    const table = Array.from({ length: rows }, () => Array(cols).fill(0));

    for (let i = oldLines.length - 1; i >= 0; i -= 1) {
      for (let j = newLines.length - 1; j >= 0; j -= 1) {
        if (oldLines[i] === newLines[j]) {
          table[i][j] = table[i + 1][j + 1] + 1;
        } else {
          table[i][j] = Math.max(table[i + 1][j], table[i][j + 1]);
        }
      }
    }

    const diff = [];
    let i = 0;
    let j = 0;

    while (i < oldLines.length && j < newLines.length) {
      if (oldLines[i] === newLines[j]) {
        diff.push({ type: 'same', line: oldLines[i] });
        i += 1;
        j += 1;
      } else if (table[i + 1][j] >= table[i][j + 1]) {
        diff.push({ type: 'del', line: oldLines[i] });
        i += 1;
      } else {
        diff.push({ type: 'add', line: newLines[j] });
        j += 1;
      }
    }

    while (i < oldLines.length) {
      diff.push({ type: 'del', line: oldLines[i] });
      i += 1;
    }

    while (j < newLines.length) {
      diff.push({ type: 'add', line: newLines[j] });
      j += 1;
    }

    return diff;
  }

  const api = {
    buildSnapshot,
    diffLines,
    pushHistory,
    shouldSnapshot
  };

  if (typeof globalThis !== 'undefined') {
    globalThis.PromptlyHistory = api;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
