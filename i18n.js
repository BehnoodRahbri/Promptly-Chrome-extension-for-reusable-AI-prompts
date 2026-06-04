// Lightweight user-selectable i18n helpers.
(function () {
  const dictionaries = {
    en: {
      appName: 'Promptly',
      import: 'Import',
      export: 'Export',
      newPrompt: 'New',
      searchPlaceholder: 'Search prompts...',
      allTags: 'All Tags',
      allFolders: 'All folders',
      settings: 'Settings',
      stats: 'Stats',
      title: 'Title',
      summary: 'Summary',
      promptText: 'Prompt text',
      tags: 'Tags',
      folder: 'Folder',
      save: 'Save',
      cancel: 'Cancel',
      theme: 'Theme',
      locale: 'Language',
      slashTrigger: 'Slash trigger',
      syncSettings: 'Sync settings',
      maxResults: 'Max results',
      trigger: 'Trigger',
      sort: 'Sort',
      recent: 'Recent',
      mostUsed: 'Most used',
      az: 'A-Z',
      favoritesFirst: 'Favorites first',
      folders: 'Folders',
      addFolder: 'Add folder',
      renameFolder: 'Rename',
      deleteFolder: 'Delete',
      noPrompts: 'No prompts found',
      noPromptsHint: 'Create a prompt or adjust your filters.',
      insert: 'Insert',
      copy: 'Copy',
      edit: 'Edit',
      history: 'History',
      deletePrompt: 'Delete',
      favorite: 'Favorite',
      restore: 'Restore',
      diff: 'Diff',
      close: 'Close',
      fillVariables: 'Fill variables',
      totalPrompts: 'Total prompts',
      totalUses: 'Total uses',
      topPrompts: 'Top prompts'
    },
    fa: {
      appName: 'Promptly',
      import: 'ورود',
      export: 'خروجی',
      newPrompt: 'جدید',
      searchPlaceholder: 'جستجوی پرامپت...',
      allTags: 'همه برچسب‌ها',
      allFolders: 'همه پوشه‌ها',
      settings: 'تنظیمات',
      stats: 'آمار',
      title: 'عنوان',
      summary: 'خلاصه',
      promptText: 'متن پرامپت',
      tags: 'برچسب‌ها',
      folder: 'پوشه',
      save: 'ذخیره',
      cancel: 'انصراف',
      theme: 'پوسته',
      locale: 'زبان',
      slashTrigger: 'تریگر اسلش',
      syncSettings: 'همگام‌سازی تنظیمات',
      maxResults: 'تعداد نتایج',
      trigger: 'تریگر',
      sort: 'مرتب‌سازی',
      recent: 'جدیدترین',
      mostUsed: 'پرکاربردترین',
      az: 'الفبا',
      favoritesFirst: 'علاقه‌مندی‌ها',
      folders: 'پوشه‌ها',
      addFolder: 'افزودن پوشه',
      renameFolder: 'تغییر نام',
      deleteFolder: 'حذف',
      noPrompts: 'پرامپتی پیدا نشد',
      noPromptsHint: 'یک پرامپت بسازید یا فیلترها را تغییر دهید.',
      insert: 'درج',
      copy: 'کپی',
      edit: 'ویرایش',
      history: 'تاریخچه',
      deletePrompt: 'حذف',
      favorite: 'علاقه‌مندی',
      restore: 'بازیابی',
      diff: 'تفاوت',
      close: 'بستن',
      fillVariables: 'تکمیل متغیرها',
      totalPrompts: 'تعداد پرامپت‌ها',
      totalUses: 'تعداد استفاده',
      topPrompts: 'پرامپت‌های برتر'
    }
  };

  let currentLocale = 'en';

  function setLocale(locale) {
    currentLocale = dictionaries[locale] ? locale : 'en';
    return currentLocale;
  }

  function t(key, vars) {
    const dict = dictionaries[currentLocale] || dictionaries.en;
    let value = dict[key] || dictionaries.en[key] || key;
    const values = vars && typeof vars === 'object' ? vars : {};

    Object.keys(values).forEach((name) => {
      value = value.replace(new RegExp(`\\{${name}\\}`, 'g'), String(values[name]));
    });

    return value;
  }

  function applyI18n(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach((element) => {
      element.textContent = t(element.getAttribute('data-i18n'));
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
      element.setAttribute('placeholder', t(element.getAttribute('data-i18n-placeholder')));
    });
    // Tooltips on icon-only buttons: set title + aria-label without touching textContent
    // (so inline SVG icons are preserved).
    scope.querySelectorAll('[data-i18n-title]').forEach((element) => {
      const label = t(element.getAttribute('data-i18n-title'));
      element.setAttribute('title', label);
      element.setAttribute('aria-label', label);
    });
    scope.documentElement?.setAttribute('lang', currentLocale);
  }

  const api = {
    applyI18n,
    dictionaries,
    setLocale,
    t
  };

  if (typeof globalThis !== 'undefined') {
    globalThis.PromptlyI18n = api;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
