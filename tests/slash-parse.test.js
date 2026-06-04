const { parseTrigger } = require('../slash-parse.js');

describe('parseTrigger', () => {
  it('parses a trigger at the start of text', () => {
    expect(parseTrigger('/sum', '/')).toEqual({
      token: '/sum',
      query: 'sum',
      start: 0,
      end: 4
    });
  });

  it('parses a trigger after whitespace with correct offsets', () => {
    expect(parseTrigger('please /sum', '/')).toEqual({
      token: '/sum',
      query: 'sum',
      start: 7,
      end: 11
    });
  });

  it('supports empty query', () => {
    expect(parseTrigger('please /', '/')).toEqual({
      token: '/',
      query: '',
      start: 7,
      end: 8
    });
  });

  it('rejects mid-word triggers and URLs', () => {
    expect(parseTrigger('a/b', '/')).toBeNull();
    expect(parseTrigger('http://example.test/', '/')).toBeNull();
  });

  it('rejects escaped double trigger tokens in v1', () => {
    expect(parseTrigger('//', '/')).toBeNull();
  });
});
