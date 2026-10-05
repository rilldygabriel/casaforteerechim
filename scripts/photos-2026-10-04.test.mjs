import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { OCTOBER_FOURTH_ALBUM as photos } from '../src/lib/cult-album-2026-10-04.ts';
import { GALLERY_PHOTOS } from '../src/lib/gallery.ts';

test('inclui as 188 fotos das duas pastas de 04/10 sem IDs repetidos', () => {
  assert.equal(photos.length, 188);
  assert.equal(new Set(photos.map(p => p.id)).size, 188);
  assert.equal(photos.filter(p => p.orientation === 'horizontal').length, 64);
  assert.equal(photos.filter(p => p.orientation === 'vertical').length, 124);
});

test('os 20 destaques pertencem ao álbum de 04/10 e usam a data correta', () => {
  assert.equal(GALLERY_PHOTOS.length, 20);
  assert.equal(new Set(GALLERY_PHOTOS.map(p => p.src)).size, 20);
  for (const photo of GALLERY_PHOTOS) {
    const id = photo.src.split('/d/')[1].split('=')[0];
    assert.ok(photos.some(p => p.id === id));
    assert.match(photo.slug, /^culto-de-domingo-04-10-foto-/);
    assert.match(photo.alt, /4 de outubro/);
  }
});

test('atualiza o álbum completo e preserva o link do culto anterior', () => {
  const album = readFileSync(new URL('../src/lib/cult-album.ts', import.meta.url), 'utf8');
  assert.match(album, /LATEST_CULT_ALBUM[^=]*= OCTOBER_FOURTH_ALBUM/);
  assert.match(album, /1-adlZ2ejURTu6LSf7rYB54589wE2miqs/);
  assert.match(album, /1966p6yJ5PWM5YOII5IgVI7BZ-Fo8QN04/);
  const home = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
  const current = home.indexOf('date: "04/10"');
  const previous = home.indexOf('date: "27/09"');
  assert.ok(current >= 0 && previous > current);
  assert.match(home, /1XIaJ0tQIDvqZBT-cMeOrS2C3hdR7eEKF/);
  assert.match(home, /PHOTO_ARCHIVE_FOLDERS\.slice\(0, 5\)/);
});
