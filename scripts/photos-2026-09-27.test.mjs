import assert from 'node:assert/strict';
import test from 'node:test';
import { SEPTEMBER_TWENTY_SEVENTH_ALBUM as photos } from '../src/lib/cult-album-2026-09-27.ts';

test('inclui todas as 168 fotos das duas pastas sem IDs repetidos', () => {
  assert.equal(photos.length, 168);
  assert.equal(new Set(photos.map(p => p.id)).size, 168);
  assert.equal(photos.filter(p => p.orientation === 'horizontal').length, 38);
  assert.equal(photos.filter(p => p.orientation === 'vertical').length, 130);
});
