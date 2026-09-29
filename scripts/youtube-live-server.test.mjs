import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import * as core from '../src/lib/youtube-live.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = ts.transpileModule(readFileSync(new URL('../src/lib/youtube-live-server.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const active = { id: 'abcdefghijk', snippet: { channelId: core.CHURCH_YOUTUBE_CHANNEL,
  title: 'Culto', liveBroadcastContent: 'live' }, status: { privacyStatus: 'public', embeddable: true },
  liveStreamingDetails: { actualStartTime: '2026-09-27T22:00:00Z' } };

function harness({ row = {}, responses = [], configured = true } = {}) {
  const state = { snapshot: { status: 'offline', video: null }, discovery_at: null,
    checked_at: null, search_day: null, search_count: 0, lease_until: '-infinity', ...row };
  const requests = [];
  const db = { from: () => {
    let changes; let cutoff;
    const apply = () => {
      if (cutoff && state.lease_until !== '-infinity' && Date.parse(state.lease_until) > Date.parse(cutoff)) return { data: null, error: null };
      Object.assign(state, changes);
      return { data: structuredClone(state), error: null };
    };
    return {
      update(values) { changes = values; return this; },
      eq() { return this; }, lte(_column, value) { cutoff = value; return this; },
      select() { return this; }, maybeSingle() { return Promise.resolve(apply()); },
      single() { return Promise.resolve(apply()); },
      then(resolve, reject) { return Promise.resolve(apply()).then(resolve, reject); },
    };
  } };
  const module = { exports: {} };
  vm.runInNewContext(source, { exports: module.exports, module, URL, Date, AbortSignal, console,
    process: { env: configured ? { YOUTUBE_API_KEY: 'test-only' } : {} },
    require(id) {
      if (id === 'server-only') return {};
      if (id === '@/lib/supabase/service') return { getSupabaseServiceClient: () => db };
      if (id === '@/lib/youtube-live') return core;
      throw new Error(`Unexpected dependency ${id}`);
    },
    async fetch(url, options) {
      requests.push({ url: String(url), options });
      const reply = responses.shift();
      if (!reply) throw new Error('Unexpected YouTube request');
      return { ok: reply.status === undefined, status: reply.status || 200, json: async () => reply };
    },
  });
  return { ...module.exports, state, requests };
}

test('cron descobre, confirma detalhes e publica somente live real', async () => {
  const h = harness({ responses: [{ items: [{ id: { videoId: active.id } }] }, { items: [active] }] });
  await h.refreshLiveStatus();
  assert.equal(h.state.snapshot.status, 'live');
  assert.equal(h.requests.length, 2);
  assert.ok(h.requests[0].url.includes(`channelId=${core.CHURCH_YOUTUBE_CHANNEL}`));
  assert.ok(!h.requests[0].url.includes('test-only'));
  await h.refreshLiveStatus();
  assert.equal(h.requests.length, 2, 'entrega concorrente nao repete consulta');
});
test('live em andamento ignora quota de busca e permanece ate actualEndTime', async () => {
  const h = harness({ row: { snapshot: { status: 'live', video: core.confirmedLiveVideo(active) },
    search_day: core.youtubeQuotaDay(new Date()), search_count: 90 }, responses: [{ items: [active] }] });
  await h.refreshLiveStatus();
  assert.equal(h.state.snapshot.status, 'live');
  assert.ok(h.requests[0].url.includes('/videos?'));
});
test('fim real remove live mesmo que a busca seguinte falhe', async () => {
  const h = harness({ row: { snapshot: { status: 'live', video: core.confirmedLiveVideo(active) } },
    responses: [{ items: [{ ...active, liveStreamingDetails: { ...active.liveStreamingDetails,
      actualEndTime: new Date().toISOString() } }] }, { status: 403 }] });
  await assert.rejects(h.refreshLiveStatus, /HTTP 403/);
  assert.equal(h.state.snapshot.status, 'offline');
  assert.equal(h.state.snapshot.video, null);
  assert.equal(h.state.search_count, 1);
});
test('falha de rede nao falsifica encerramento; cache envelhecido torna-se desconhecido', async () => {
  const checked_at = new Date(Date.now() - 240_000).toISOString();
  const h = harness({ row: { snapshot: { status: 'live', video: core.confirmedLiveVideo(active) }, checked_at }, responses: [{ status: 500 }] });
  await assert.rejects(h.refreshLiveStatus, /HTTP 500/);
  assert.equal(h.state.checked_at, checked_at);
  assert.equal((await h.readLiveStatus()).status, 'unknown');
});
test('sem chave nenhuma chamada externa e feita', async () => {
  const h = harness({ configured: false });
  await assert.rejects(h.refreshLiveStatus, /YOUTUBE_API_KEY/);
  assert.equal(h.requests.length, 0);
});
