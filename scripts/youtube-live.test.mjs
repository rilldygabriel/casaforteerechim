import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CHURCH_YOUTUBE_CHANNEL, confirmedLiveVideo, discoveryIntervalMs,
  publicLiveSnapshot, shouldDiscover, youtubeQuotaDay,
} from '../src/lib/youtube-live.ts';

const video = {
  id: 'abcdefghijk',
  snippet: { channelId: CHURCH_YOUTUBE_CHANNEL, title: 'Culto', liveBroadcastContent: 'live' },
  status: { privacyStatus: 'public', embeddable: true },
  liveStreamingDetails: { actualStartTime: '2026-09-27T22:00:00Z' },
};
const cache = { snapshot: { status: 'offline', video: null }, checked_at: null,
  discovery_at: null, search_day: null, search_count: 0 };

test('quarta 19h30 e domingo 19h sao interpretados em Sao Paulo', () => {
  assert.equal(discoveryIntervalMs(new Date('2026-09-30T22:30:00Z')), 300_000);
  assert.equal(discoveryIntervalMs(new Date('2026-09-27T22:00:00Z')), 300_000);
  assert.equal(discoveryIntervalMs(new Date('2026-09-27T21:29:00Z')), 3_600_000);
  assert.equal(discoveryIntervalMs(new Date('2026-09-28T22:00:00Z')), 3_600_000);
});
test('transicao para a janela de culto antecipa a proxima busca', () => {
  assert.equal(shouldDiscover({ ...cache, discovery_at: '2026-09-27T21:20:00Z' }, new Date('2026-09-27T21:30:00Z')), true);
});
test('somente transmissao publica real e do canal correto e exibida', () => {
  assert.equal(confirmedLiveVideo(video)?.id, video.id);
  assert.equal(confirmedLiveVideo({ ...video, snippet: { ...video.snippet, channelId: 'other' } }), null);
  assert.equal(confirmedLiveVideo({ ...video, status: { ...video.status, privacyStatus: 'private' } }), null);
  assert.equal(confirmedLiveVideo({ ...video, snippet: { ...video.snippet, liveBroadcastContent: 'upcoming' } }), null);
  assert.equal(confirmedLiveVideo({ ...video, liveStreamingDetails: {} }), null);
  assert.equal(confirmedLiveVideo({ ...video, id: '../untrusted' }), null);
});
test('encerramento real tira o selo ao vivo; nao depende do horario', () => {
  assert.equal(confirmedLiveVideo({ ...video, liveStreamingDetails: {
    ...video.liveStreamingDetails, actualEndTime: '2026-09-28T04:00:00Z',
  } }), null);
  const late = new Date('2026-09-28T03:30:00Z');
  assert.equal(publicLiveSnapshot({ ...cache, snapshot: { status: 'live', video: confirmedLiveVideo(video) }, checked_at: late.toISOString() }, late).status, 'live');
});
test('embed desativado mantem alternativa de assistir pelo YouTube', () => {
  assert.equal(confirmedLiveVideo({ ...video, status: { ...video.status, embeddable: false } })?.embeddable, false);
});
test('cache vencido ou ausente nao afirma ao vivo nem offline', () => {
  const now = new Date('2026-09-27T22:10:00Z');
  assert.equal(publicLiveSnapshot(null, now).status, 'unknown');
  assert.equal(publicLiveSnapshot({ ...cache, snapshot: { status: 'live', video: confirmedLiveVideo(video) }, checked_at: '2026-09-27T22:06:00Z' }, now).status, 'unknown');
  assert.equal(publicLiveSnapshot({ ...cache, checked_at: '2026-09-27T22:00:00Z' }, now).status, 'unknown');
});
test('quota tem limite independente do trafego e reinicia no fuso do YouTube', () => {
  const now = new Date('2026-09-28T06:59:00Z');
  assert.equal(youtubeQuotaDay(now), '2026-09-27');
  assert.equal(shouldDiscover({ ...cache, search_day: '2026-09-27', search_count: 90 }, now), false);
  assert.equal(shouldDiscover({ ...cache, search_day: '2026-09-27', search_count: 90 }, new Date('2026-09-28T07:00:00Z')), true);
});
test('sem culto, uma semana inteira cabe no limite diario com folga', () => {
  let state = { ...cache };
  const totals = {};
  for (let t = Date.parse('2026-09-21T07:00:00Z'); t < Date.parse('2026-09-28T07:00:00Z'); t += 60_000) {
    const now = new Date(t);
    if (shouldDiscover(state, now)) {
      const day = youtubeQuotaDay(now);
      totals[day] = (totals[day] || 0) + 1;
      state = { ...state, discovery_at: now.toISOString(), search_day: day, search_count: totals[day] };
    }
  }
  assert.ok(Object.values(totals).every(count => count < 90));
});
