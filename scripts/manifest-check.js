const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const requiredTopLevelKeys = [
  'manifest_version',
  'name',
  'version',
  'permissions',
  'background',
  'action',
  'content_scripts',
  'icons'
];

for (const key of requiredTopLevelKeys) {
  if (!(key in manifest)) {
    throw new Error(`manifest.json is missing required key: ${key}`);
  }
}

if (manifest.manifest_version !== 3) {
  throw new Error('Promptly must stay on Manifest V3');
}

if (manifest.permissions.includes('tabs')) {
  throw new Error('The broad "tabs" permission must not be reintroduced');
}

const contentScriptFiles = manifest.content_scripts?.[0]?.js || [];
for (const fileName of contentScriptFiles) {
  const fullPath = path.join(root, fileName);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Content script listed in manifest does not exist: ${fileName}`);
  }
}

const injectionIndex = contentScriptFiles.indexOf('content-injection.js');
const slashIndex = contentScriptFiles.indexOf('slash-trigger.js');
if (slashIndex !== -1 && slashIndex <= injectionIndex) {
  throw new Error('slash-trigger.js must load after content-injection.js');
}

console.log('manifest.json sanity check passed');
