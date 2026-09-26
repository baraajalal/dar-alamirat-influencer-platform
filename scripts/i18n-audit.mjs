import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const failures = [];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function flattenShape(value, prefix = '') {
  const out = [];
  if (Array.isArray(value)) {
    out.push(`${prefix}[]`);
    value.forEach((item, index) => out.push(...flattenShape(item, `${prefix}[${index}]`)));
    return out;
  }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value).sort()) {
      const next = prefix ? `${prefix}.${key}` : key;
      out.push(next);
      out.push(...flattenShape(value[key], next));
    }
  }
  return out;
}


function collectStringLeaves(value, prefix = '', out = new Map()) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectStringLeaves(item, `${prefix}[${index}]`, out));
    return out;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      const next = prefix ? `${prefix}.${key}` : key;
      collectStringLeaves(item, next, out);
    }
    return out;
  }
  if (typeof value === 'string') out.set(prefix, value);
  return out;
}

function placeholders(value) {
  return [...value.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((match) => match[1]).sort();
}

function comparePlaceholders(label, arPath, enPath) {
  const ar = collectStringLeaves(readJson(arPath));
  const en = collectStringLeaves(readJson(enPath));
  for (const [key, arValue] of ar) {
    const enValue = en.get(key);
    if (typeof enValue !== 'string') continue;
    const arPlaceholders = placeholders(arValue);
    const enPlaceholders = placeholders(enValue);
    if (JSON.stringify(arPlaceholders) !== JSON.stringify(enPlaceholders)) {
      failures.push(`${label}: placeholder mismatch at ${key}`);
    }
  }
}

function compareDictionaryShape(label, arPath, enPath) {
  const arShape = new Set(flattenShape(readJson(arPath)));
  const enShape = new Set(flattenShape(readJson(enPath)));
  const missingInEn = [...arShape].filter((key) => !enShape.has(key));
  const missingInAr = [...enShape].filter((key) => !arShape.has(key));
  if (missingInEn.length || missingInAr.length) {
    failures.push(`${label}: dictionary shape mismatch`);
    if (missingInEn.length) console.error(`  Missing in EN: ${missingInEn.join(', ')}`);
    if (missingInAr.length) console.error(`  Missing in AR: ${missingInAr.join(', ')}`);
  } else {
    console.log(`OK ${label}: Arabic/English keys match`);
  }
}

compareDictionaryShape('app', 'messages/app/ar.json', 'messages/app/en.json');
comparePlaceholders('app', 'messages/app/ar.json', 'messages/app/en.json');
compareDictionaryShape('dashboard', 'messages/dashboard/ar.json', 'messages/dashboard/en.json');
comparePlaceholders('dashboard', 'messages/dashboard/ar.json', 'messages/dashboard/en.json');
compareDictionaryShape('flows', 'messages/flows/ar.json', 'messages/flows/en.json');
comparePlaceholders('flows', 'messages/flows/ar.json', 'messages/flows/en.json');

const migratedFiles = [
  'app/page.tsx',
  'app/login/page.tsx',
  'app/login/login-form.tsx',
  'app/portal-access/request/page.tsx',
  'app/portal/access/edit/page.tsx',
  'components/influencer-onboarding-wizard.tsx',
  'app/terms/page.tsx',
  'app/privacy/page.tsx',
  'app/portal/(account)/layout.tsx',
  'components/influencer-portal/portal-shell.tsx',
  'app/portal/(account)/campaigns/page.tsx',
  'app/portal/(account)/dashboard/page.tsx',
  'app/portal/(account)/portfolio/page.tsx',
  'app/portal/(account)/performance/page.tsx',
  'app/portal/(account)/payments/page.tsx',
  'app/portal/(account)/notifications/page.tsx',
  'app/portal/(account)/profile/page.tsx',
  'app/portal/profile/payment-details/page.tsx',
  'app/portal/profile/payment-details/payment-details-client.tsx',
  'app/dashboard/campaigns/[id]/applications/page.tsx',
  'app/dashboard/campaigns/[id]/applications/review/page.tsx',
  'app/dashboard/campaigns/[id]/participants/draft/page.tsx',
  'app/dashboard/campaigns/[id]/participants/draft/[draftId]/page.tsx',
  'app/dashboard/campaigns/[id]/participants/draft/[draftId]/simplified-assignment-form.tsx',
  'app/portal/access/activate/page.tsx',
  'app/portal/access/activate/activate-client.tsx',
  'app/portal/activate-account/page.tsx',
  'app/portal/activate-account/activation-client.tsx',
  'app/portal/complete-account/page.tsx',
  'app/portal/complete-account/complete-account-client.tsx',
  'app/portal/set-password/page.tsx',
  'app/portal/set-password/set-password-client.tsx',
  'app/set-password/page.tsx',
  'app/portal/assignments/[token]/page.tsx',
  'app/portal/assignments/[token]/guest-assignment-client.tsx',
  'app/dashboard/influencers/archive/page.tsx',
  'app/dashboard/influencers/[id]/work-history-form.tsx',
  'app/dashboard/influencers/[id]/work-history-delete-button.tsx',
];

const allowedArabicFiles = new Set([
  'app/login/login-form.tsx', // language selector label: العربية
  'components/influencer-onboarding-wizard.tsx', // canonical stored shooting-style values
]);

const arabicPattern = /[\u0600-\u06ff]/;
for (const relativePath of migratedFiles) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    failures.push(`Missing migrated file: ${relativePath}`);
    continue;
  }
  const source = fs.readFileSync(fullPath, 'utf8');
  if (arabicPattern.test(source) && !allowedArabicFiles.has(relativePath)) {
    failures.push(`Unexpected hard-coded Arabic in migrated file: ${relativePath}`);
  }
}

// Hydration safety: the legacy compatibility component must never walk or
// rewrite server-rendered DOM text. UI strings belong in dictionaries, while
// creator names, campaign names, brands and other database values stay exact.
{
  const relativePath = 'components/i18n/global-translator.tsx';
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    failures.push(`Missing hydration guard: ${relativePath}`);
  } else {
    const source = fs.readFileSync(fullPath, 'utf8');
    const banned = [
      'MutationObserver',
      'createTreeWalker',
      'SHOW_TEXT',
      'nodeValue =',
      '.split(arabic).join(english)',
    ];
    for (const token of banned) {
      if (source.includes(token)) failures.push(`Unsafe DOM translation token in ${relativePath}: ${token}`);
    }
  }
}

if (failures.length) {
  console.error('\nI18N AUDIT FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`OK migrated surfaces: ${migratedFiles.length} files checked`);
console.log('I18N AUDIT PASSED');
