import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';

test('reviewed RPC migration adds only the custom label to the captured live function', async () => {
  const file = (await readdir('supabase/migrations')).find(name => name.endsWith('_web_preview_custom_category_label.sql'));
  const sql = await readFile('supabase/migrations/' + file, 'utf8');
  const checksum = sql.match(/<> '([a-f0-9]{32})'/)[1];
  const start = sql.indexOf('CREATE OR REPLACE FUNCTION');
  const end = sql.indexOf("NOTIFY pgrst");
  const definition = sql.slice(start, end).trim().replace(/;$/, '') + '\n';
  const addition = "    'custom_category_label', v_event.custom_category_label,\n";
  assert.equal(definition.split(addition).length, 2);
  const original = definition.replace(addition, '');
  assert.equal(createHash('md5').update(original).digest('hex'), checksum);
  assert.match(original, /SECURITY DEFINER\s+SET search_path TO ''/);
  assert.match(original, /revoked_at is null/);
  assert.match(original, /max_uses/);
  assert.doesNotMatch(sql, /\b(GRANT|REVOKE|ALTER TABLE|DROP FUNCTION|INSERT INTO|UPDATE public\.events)\b/i);
});
