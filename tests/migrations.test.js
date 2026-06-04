const {
  CURRENT_SCHEMA_VERSION,
  ROOT_FOLDER_ID,
  migrateData
} = require('../migrations.js');

describe('migrateData', () => {
  it('creates the full default shape from an empty object', () => {
    const migrated = migrateData({});

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.prompts).toEqual([]);
    expect(migrated.folders).toEqual([{ id: ROOT_FOLDER_ID, name: 'Root', parentId: null }]);
    expect(migrated.settings).toMatchObject({
      locale: 'en',
      theme: 'auto',
      syncEnabled: false,
      slashTrigger: {
        enabled: true,
        trigger: '/',
        maxResults: 8
      }
    });
  });

  it('is idempotent', () => {
    const legacy = {
      prompts: [{ title: 'Legacy', text: 'Body' }],
      settings: { locale: 'fa' }
    };
    const once = migrateData(legacy);
    const twice = migrateData(once);

    expect(twice).toEqual(once);
  });

  it('preserves existing prompt fields', () => {
    const migrated = migrateData({
      schemaVersion: 1,
      prompts: [{
        id: 'p1',
        title: 'Saved',
        summary: 'Keep',
        text: 'Text',
        color: '#111111',
        tags: ['a'],
        folderId: ROOT_FOLDER_ID,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
        favorite: true,
        usageCount: 4,
        history: [{ text: 'Old' }],
        customField: 'preserved'
      }]
    });

    expect(migrated.prompts[0]).toMatchObject({
      id: 'p1',
      color: '#111111',
      createdAt: '2024-01-01T00:00:00.000Z',
      favorite: true,
      usageCount: 4,
      customField: 'preserved'
    });
  });

  it('passes higher schema versions through without down-migrating', () => {
    const future = {
      schemaVersion: CURRENT_SCHEMA_VERSION + 10,
      prompts: [{ title: 'Future shape' }],
      custom: true
    };

    expect(migrateData(future)).toEqual(future);
  });
});
