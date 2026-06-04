const {
  extractVariableSpecs,
  extractVariables,
  fillTemplate
} = require('../template.js');

describe('template helpers', () => {
  it('extracts variables in order and de-duplicates names', () => {
    expect(extractVariables('Hi {{name}}, write about {{topic|AI}} for {{name}}.')).toEqual(['name', 'topic']);
  });

  it('extracts defaults from pipe syntax', () => {
    expect(extractVariableSpecs('{{topic|AI agents}}')).toEqual([
      { name: 'topic', defaultValue: 'AI agents' }
    ]);
  });

  it('fills provided values and falls back to defaults or empty strings', () => {
    expect(fillTemplate('{{name}}: {{topic|AI}} {{missing}}', { name: 'Sam', extra: 'ignored' }))
      .toBe('Sam: AI ');
  });

  it('leaves literal single braces alone', () => {
    expect(fillTemplate('Use {name} then {{name}}', { name: 'value' })).toBe('Use {name} then value');
  });
});
