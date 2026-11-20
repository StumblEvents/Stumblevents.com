import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildEnvironment } from '../scripts/build-vercel-local.mjs';

test('Windows child builds retain one populated PATH without changing the parent', () => {
  const source = { Path: 'C:\\Windows\\System32;C:\\Program Files\\nodejs', PATH: '', ComSpec: 'cmd.exe' };
  const result = buildEnvironment(source);
  assert.equal(result.PATH, source.Path);
  assert.deepEqual(Object.keys(result).filter(k => k.toLowerCase() === 'path'), ['PATH']);
  assert.equal(result.ComSpec, source.ComSpec);
  assert.equal(source.PATH, '');
  assert.equal(buildEnvironment({ PATH: '/usr/bin' }).PATH, '/usr/bin');
});
