import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const output = path.resolve(process.argv[2] || '.vercel/output');
const staticRoot = path.join(output, 'static');
async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if ((await stat(file)).isDirectory()) result.push(...await files(file));
    else result.push(file);
  }
  return result;
}
const publicFiles = (await files(staticRoot)).map(file => path.relative(staticRoot, file).replaceAll('\\', '/'));
for (const required of [
  'index.html', 'about.html', 'support/index.html', 'delete-account/index.html',
  'legal/index.html', 'legal/legal.js', 'legal/legal-content.js', 'legal/legal.css',
  'email-verified/index.html', 'email-verified/verification.js',
  'minor-purchase/index.html', 'minor-promotion/index.html',
  'stumbl-share-preview.jpg', 'stumbl-share-preview.png',
  '.well-known/apple-app-site-association', '.well-known/assetlinks.json',
]) assert(publicFiles.includes(required), `Missing public asset: ${required}`);
assert(!publicFiles.some(file => /(^|\/)(api|tests|scripts|\.git|\.vercel|\.recovery)(\/|$)|\.zip$|\.env|INVESTIGATION|RESTORATION|PREDEPLOYMENT/i.test(file)), 'Source, backup, credential, or draft archive reached static output');
for (const file of ['apple-app-site-association', 'assetlinks.json']) {
  JSON.parse(await readFile(path.join(staticRoot, '.well-known', file), 'utf8'));
}
const functionFiles = await files(path.join(output, 'functions'));
const functions = functionFiles.filter(file => path.basename(file) === '.vc-config.json');
assert.equal(functions.length, 12, 'Unexpected serverless endpoint inventory');
for (const endpoint of ['event', 'invite', 'calendar', 'link-preview', 'email-verification-result']) {
  assert(functions.some(file => file.endsWith(path.join(`${endpoint}.func`, '.vc-config.json'))), `Missing ${endpoint} function`);
}
const routes = JSON.stringify(JSON.parse(await readFile(path.join(output, 'config.json'), 'utf8')).routes);
for (const route of ['privacy', 'terms', 'creator-agreement', 'events', 'invite', 'creator/stripe']) assert(routes.includes(route), `Missing route: ${route}`);
console.log(`Verified ${publicFiles.length} public assets, 12 API functions, and required routes; no private build artifacts in static output.`);
