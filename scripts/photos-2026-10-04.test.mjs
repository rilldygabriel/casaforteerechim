import assert from 'node:assert/strict';
import test from 'node:test';
import { OCTOBER_FOURTH_ALBUM as photos } from '../src/lib/cult-album-2026-10-04.ts';

test('preserva as 188 fotos do álbum histórico de 04/10', () => {
  assert.equal(photos.length, 188);
  assert.equal(new Set(photos.map(p => p.id)).size, 188);
  assert.equal(photos.filter(p => p.orientation === 'horizontal').length, 64);
  assert.equal(photos.filter(p => p.orientation === 'vertical').length, 124);
});
