# Changelog

All notable changes to Promptly will be documented in this file.

## Unreleased

### Added

- Added schema migrations, a storage adapter, serialized writes, and lazy startup migration.
- Added Vitest tests, ESLint, manifest sanity checks, and GitHub Actions CI.
- Added variable templating with `{{name}}` and `{{name|default}}`.
- Added slash-command inline prompt expansion with fuzzy autocomplete.
- Added popup keyboard navigation, fuzzy search, and the `_execute_action` shortcut.
- Added prompt history, restore, and line diff helpers.
- Added favorites, usage counts, usage-based sorting, folders, settings, dark mode, i18n scaffolding, settings sync, and local stats.
- Added a manual integration checklist for supported chat sites.
- Added repository hygiene files: README, MIT license, changelog, and gitignore.
- Added a README screenshot under `docs/screenshots/popup.png`.
- Added `https://chatgpt.com/*` support for ChatGPT in the manifest.

### Changed

- Refactored the background worker to use shared migrations, storage, and history modules.
- Refactored the popup into a single state-driven render path.
- Extended `content-injection.js` with caret geometry and range replacement for inline expansion.
- Consolidated prompt insertion behavior into the shared `content-injection.js` module.
- Updated popup, background, and content-script entry points to call the shared insertion module.
- Moved icon generation helpers into `scripts/`.
- Removed the `tabs` permission from the extension manifest.

### Removed

- Removed the empty `test-popup.html` file.
- Removed the superseded `popup-fixed.js` file.
