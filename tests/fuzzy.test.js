const { fuzzyFilter, fuzzyScore } = require('../fuzzy.js');

describe('fuzzy helpers', () => {
  it('returns zero for non-matches', () => {
    expect(fuzzyScore('xyz', 'prompt')).toBe(0);
  });

  it('rewards contiguous matches', () => {
    expect(fuzzyScore('pro', 'prompt writer')).toBeGreaterThan(fuzzyScore('pro', 'p random output'));
  });

  it('rewards word-boundary matches', () => {
    expect(fuzzyScore('ai', 'AI summary')).toBeGreaterThan(fuzzyScore('ai', 'chair'));
  });

  it('filters prompts by score order', () => {
    const prompts = [
      { id: '1', title: 'Meeting notes' },
      { id: '2', title: 'Code review' },
      { id: '3', title: 'Review email' }
    ];

    expect(fuzzyFilter('rev', prompts, { limit: 2 }).map((prompt) => prompt.id)).toEqual(['3', '2']);
  });
});
