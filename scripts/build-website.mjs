import { cp, lstat, mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, '.website-output');
// This is generated output only. Never remove a caller-supplied path or symlink.
if (path.dirname(output) !== root || path.basename(output) !== '.website-output') throw new Error('Invalid build output path');
const existing = await lstat(output).catch(error => {
  if (error.code !== 'ENOENT') throw error;
});
if (existing?.isSymbolicLink()) throw new Error('Build output must not be a symlink');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

const publicFiles = [
  'index.html', 'about.html', 'about.css', 'script.js', 'styles.css',
  'event-page.js', 'favicon.ico', 'site.webmanifest', 'stumbl-share-preview.jpg', 'stumbl-share-preview.png',
  'assets', 'support', 'delete-account', 'email-verified', 'legal',
  'minor-purchase', 'minor-promotion',
];
for (const file of publicFiles) {
  await cp(path.join(root, file), path.join(output, file), { recursive: true });
}
execFileSync(process.execPath, [path.join(root, 'scripts/generate-well-known.mjs')], {
  cwd: root,
  env: { ...process.env, WELL_KNOWN_OUTPUT_DIR: output },
  stdio: 'inherit',
});
console.log('Prepared public website assets and app-link manifests.');
