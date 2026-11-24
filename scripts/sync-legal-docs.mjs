import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const sourceDirectory = process.argv[2];
if (!sourceDirectory) {
  throw new Error('Usage: node scripts/sync-legal-docs.mjs <legal-source-directory>');
}

const documents = {
  privacy: 'privacy.md',
  terms: 'terms.md',
  'creator-agreement': 'creator-agreement.md',
  'seller-agreement': 'seller-agreement.md'
};

const contents = Object.fromEntries(await Promise.all(
  Object.entries(documents).map(async ([route, filename]) => [
    route,
    await readFile(resolve(sourceDirectory, filename), 'utf8')
  ])
));

await writeFile(
  resolve('legal', 'legal-content.js'),
  `/* Generated from the approved-in-progress mobile-app legal drafts. Do not hand-edit. */\nwindow.STUMBL_LEGAL_DOCUMENTS = ${JSON.stringify(contents, null, 2)};\n`,
  'utf8'
);
