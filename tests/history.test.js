const {
  buildSnapshot,
  diffLines,
  pushHistory,
  shouldSnapshot
} = require('../history.js');

describe('history helpers', () => {
  it('pushes newest snapshots first and caps length', () => {
    const history = [];
    for (let index = 0; index < 12; index += 1) {
      history.splice(0, history.length, ...pushHistory(history, {
        title: `v${index}`,
        summary: '',
        text: String(index),
        tags: [],
        savedAt: String(index)
      }));
    }

    expect(history).toHaveLength(10);
    expect(history[0].title).toBe('v11');
  });

  it('snapshots content changes but ignores lastUsed-only updates', () => {
    const prev = { title: 'A', summary: '', text: 'one', tags: ['x'], lastUsed: '1' };

    expect(shouldSnapshot(prev, { ...prev, lastUsed: '2' })).toBe(false);
    expect(shouldSnapshot(prev, { ...prev, text: 'two' })).toBe(true);
    expect(shouldSnapshot(prev, { ...prev, tags: ['y'] })).toBe(true);
  });

  it('builds snapshots from prompt fields', () => {
    expect(buildSnapshot({ title: 'A', summary: 'S', text: 'T', tags: ['x'] })).toMatchObject({
      title: 'A',
      summary: 'S',
      text: 'T',
      tags: ['x']
    });
  });

  it('diffs same, added, and deleted lines', () => {
    expect(diffLines('a\nb', 'a\nc')).toEqual([
      { type: 'same', line: 'a' },
      { type: 'del', line: 'b' },
      { type: 'add', line: 'c' }
    ]);
  });
});
