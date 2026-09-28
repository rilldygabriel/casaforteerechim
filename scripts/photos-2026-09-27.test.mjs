import assert from 'node:assert/strict';
import test from 'node:test';
import { SEPTEMBER_TWENTY_SEVENTH_ALBUM as photos } from '../src/lib/cult-album-2026-09-27.ts';
import { GALLERY_PHOTOS } from '../src/lib/gallery.ts';

test('inclui todas as 168 fotos das duas pastas sem IDs repetidos', () => {
  assert.equal(photos.length, 168);
  assert.equal(new Set(photos.map(p => p.id)).size, 168);
  assert.equal(photos.filter(p => p.orientation === 'horizontal').length, 38);
  assert.equal(photos.filter(p => p.orientation === 'vertical').length, 130);
});

test('os 20 destaques pertencem ao album novo e usam a data correta', () => {
  assert.equal(GALLERY_PHOTOS.length, 20);
  assert.equal(new Set(GALLERY_PHOTOS.map(p => p.src)).size, 20);
  for (const photo of GALLERY_PHOTOS) {
    const id = photo.src.split('/d/')[1].split('=')[0];
    assert.ok(photos.some(p => p.id === id));
    assert.match(photo.slug, /^culto-de-domingo-27-09-foto-/);
    assert.match(photo.alt, /27 de setembro/);
  }
});
