const { extractSyncSettings, SETTINGS_SYNC_KEY, STORAGE_KEY } = require('../storage.js');

describe('storage helpers', () => {
  it('exports stable storage keys', () => {
    expect(STORAGE_KEY).toBe('promptSaverData');
    expect(SETTINGS_SYNC_KEY).toBe('promptlySettingsSync');
  });

  it('extracts only small settings-sync payload fields', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    expect(extractSyncSettings({
      locale: 'fa',
      theme: 'dark',
      syncEnabled: true,
      slashTrigger: { enabled: false, trigger: ';', maxResults: 3 },
      ignored: 'large'
    })).toEqual({
      locale: 'fa',
      theme: 'dark',
      syncEnabled: true,
      slashTrigger: { enabled: false, trigger: ';', maxResults: 3 },
      updatedAt: '2026-01-01T00:00:00.000Z'
    });

    vi.useRealTimers();
  });
});
