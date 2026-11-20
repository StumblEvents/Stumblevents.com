import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import http from 'node:http';
import { createLocalPreviewServer } from '../scripts/local-preview.mjs';
import handler from '../api/event.js';
import imageHandler from '../api/link-preview.js';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { renderEventPreview } = require('../api/_event-preview.js');
const id = '11111111-1111-4111-8111-111111111111';
const preview = { id, title: 'Escaped <event>', description: '<script>unsafe</script> & details', visibility: 'public', start_time: '2026-12-19T19:00:00Z', timezone: 'America/Denver', occurrences: [], creator: {} };
async function render(query, payload, t) {
  t.mock.method(globalThis, 'fetch', async () => Response.json(payload));
  const res = { headers: {}, setHeader(k,v) { this.headers[k.toLowerCase()]=v; }, end(body) { this.body=body; } };
  await handler({ query, headers: { host:'www.stumblevents.com' } }, res); return res;
}
function env(t) {
  const saved = { ...process.env };
  process.env.SUPABASE_URL='https://example.supabase.co'; process.env.SUPABASE_ANON_KEY='test-anon';
  delete process.env.SUPABASE_SERVICE_ROLE_KEY; delete process.env.SUPABASE_SERVICE_KEY;
  t.after(()=>{ for(const key of Object.keys(process.env)) if(!(key in saved)) delete process.env[key]; Object.assign(process.env,saved); });
}
test('public details are escaped and app handoff retains the shared event', async t=>{
  env(t); const res=await render({id},preview,t);
  assert.equal(res.statusCode,200); assert.match(res.body,/&lt;script&gt;unsafe&lt;\/script&gt;/);
  assert.doesNotMatch(res.body,/<script>unsafe/); assert.match(res.body,/About this event/);
  assert(res.body.includes('href="https://stumblevents.com/events/'+id+'"'));
  assert.equal(res.headers['cache-control'],'private, no-store');
});
test('legacy token aliases preserve private calendar authorization', async t=>{
  env(t); for(const key of ['invite','token','invite_token']) {
    const res=await render({[key]:'valid-invite'},{...preview,visibility:'private'},t);
    assert.equal(res.statusCode,200); assert.match(res.body,/name="invite" value="valid-invite"/);
    assert.match(res.body,/noindex,nofollow/); assert.match(res.body,/\/invite\/valid-invite/);
  }
});
test('missing, unauthorized, and mismatched events disclose no event details',async t=>{
  env(t);for(const payload of [null,{...preview,visibility:'private'},{...preview,id:'22222222-2222-4222-8222-222222222222'},{...preview,visibility:'hidden'}]) {
    const res=await render({id},payload,t);assert.equal(res.statusCode,404);assert.doesNotMatch(res.body,/Escaped|unsafe/);
  }
});
test('existing image-preview API remains a fetch handler',()=>assert.equal(typeof imageHandler.fetch,'function'));
test('events without coordinates use their address instead of a zero-coordinate map',()=>{
  const html=renderEventPreview({preview:{...preview,latitude:null,longitude:null,address:'123 Main Street'},canonicalUrl:'https://www.stumblevents.com/events/'+id});
  assert.match(html,/google.com\/maps\/search/);assert.doesNotMatch(html,/openstreetmap.org\/export\/embed/);
});
test('serverless entrypoints remain within the existing twelve-function limit',async()=>{
  async function endpoints(dir) {
    const found=[];for(const entry of await readdir(dir,{withFileTypes:true})) {
      if(entry.name.startsWith('_'))continue;
      if(entry.isDirectory())found.push(...await endpoints(dir+'/'+entry.name));
      else if(entry.name.endsWith('.js'))found.push(dir+'/'+entry.name);
    }return found;
  }
  const files=await endpoints('api');assert.equal(files.length,12);assert(files.includes('api/calendar.js'));
});
test('local HTTP routes execute the restored handlers and hide recovery snapshots',async t=>{
  env(t);
  t.mock.method(globalThis,'fetch',async()=>Response.json(preview));
  const server=createLocalPreviewServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const get=path=>new Promise((resolve,reject)=>http.get({hostname:'127.0.0.1',port:server.address().port,path},res=>{
    let body='';res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode,body,headers:res.headers}));
  }).on('error',reject));
  const page=await get('/events/'+id);assert.equal(page.status,200);assert.match(page.body,/About this event/);
  const ics=await get('/api/calendar?event='+id+'&provider=ics');assert.equal(ics.status,200);assert.match(ics.body,/BEGIN:VCALENDAR/);
  for(const path of ['/.recovery/manifest.json','/.git/config','/api/_event-preview.js']) assert.equal((await get(path)).status,404);
});
test('legal and legacy shared routes are retained and recovery files excluded',async()=>{
  const config=JSON.parse(await readFile('vercel.json','utf8'));
  for(const route of ['/events/:id','/invite/:token','/privacy','/terms','/creator-agreement','/support','/delete-account']) assert(config.rewrites.some(r=>r.source===route));
  assert.match(await readFile('.vercelignore','utf8'),/\.recovery/);
});
