import assert from 'node:assert/strict';
import worker from '../src/worker.js';
import { renderClashSubscription } from '../src/core.js';
import { writeFile } from 'node:fs/promises';

const node = { name: 'test node', type: 'vmess', server: '192.0.2.1', port: 443, uuid: '00000000-0000-4000-8000-000000000001', network: 'ws', tls: true, host: 'example.com', sni: 'example.com', path: '/ws' };
const env = { SUB_STORE: { async get(key) { return key === 'sub:test' ? JSON.stringify({ nodes: [node] }) : null; } } };
const response = await worker.fetch(new Request('https://example.com/sub/test?target=clash'), env);
assert.equal(response.status, 200);
const actual = await response.text();
if (process.env.CF_ROUTING_FIXTURE) await writeFile(process.env.CF_ROUTING_FIXTURE, actual);
for (const [label, body] of [['worker', actual], ['core', renderClashSubscription([node])]]) {
  const youtube = body.indexOf('DOMAIN-SUFFIX,youtube.com,');
  const baidu = body.indexOf('DOMAIN-SUFFIX,baidu.com,DIRECT');
  const cn = body.indexOf('GEOSITE,CN,DIRECT');
  const geoip = body.indexOf('GEOIP,CN,DIRECT');
  const fallback = body.indexOf('MATCH,');
  assert.ok(youtube >= 0 && youtube < baidu && baidu < cn && cn < geoip && geoip < fallback, `${label}: routing order`);
  for (const domain of ['youtu.be', 'googlevideo.com', 'ytimg.com', 'google.com', 'googleapis.com', 'gstatic.com', 'openai.com', 'chatgpt.com']) {
    const position = body.indexOf(`DOMAIN-SUFFIX,${domain},`);
    assert.ok(position >= 0 && position < cn, `${label}: ${domain} must use the proxy before the China rules`);
  }
  assert.match(body, /type:\s*vmess/);
}
const raw = await worker.fetch(new Request('https://example.com/sub/test?target=raw'), env);
assert.equal(raw.status, 200);
assert.match(atob(await raw.text()), /^vmess:\/\//);
console.log('worker and core routing checks passed');
