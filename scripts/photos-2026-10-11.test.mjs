import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { OCTOBER_ELEVENTH_ALBUM as photos } from '../src/lib/cult-album-2026-10-11.ts';
import { GALLERY_PHOTOS } from '../src/lib/gallery.ts';

test('álbum de 11/10 inclui 204 fotos únicas das duas pastas', () => {
  assert.equal(photos.length, 204);
  assert.equal(new Set(photos.map(p => p.id)).size, 204);
  assert.equal(new Set(photos.map(p => p.filename)).size, 204);
  assert.equal(photos.filter(p => p.orientation === 'horizontal').length, 91);
  assert.equal(photos.filter(p => p.orientation === 'vertical').length, 113);
});

test('20 destaques novos pertencem ao álbum e mantêm a orientação correta', () => {
  assert.equal(GALLERY_PHOTOS.length, 20);
  assert.equal(new Set(GALLERY_PHOTOS.map(p => p.src)).size, 20);
  for (const photo of GALLERY_PHOTOS) {
    const original = photos.find(p => photo.src.includes('/d/' + p.id + '='));
    assert.ok(original);
    assert.equal(photo.className, original.orientation === 'vertical' ? 'home-gallery-tall' : 'home-gallery-wide');
    assert.match(photo.slug, /^culto-de-domingo-11-10-foto-/);
    assert.match(photo.alt, /11 de outubro/);
  }
});

test('datas, pastas e arquivo anterior permanecem consistentes', () => {
  const album = readFileSync(new URL('../src/lib/cult-album.ts', import.meta.url), 'utf8');
  assert.match(album, /LATEST_CULT_ALBUM[^=]*= OCTOBER_ELEVENTH_ALBUM/);
  assert.match(album, /LATEST_CULT_DATE_SHORT = "11\/10"/);
  assert.match(album, /1VrU_TgosiQaf6vEIvJ48RJeAyUwyoZys/);
  assert.match(album, /1IRrx0wVxy4xoCxnap27XuYVfVCJBmqSM/);
  const home = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
  const dates = ['11/10','10/10','07/10','04/10','27/09'];
  for(let i=0;i<dates.length;i++){
    const position=home.indexOf('date: "'+dates[i]+'"');
    assert.ok(position>=0);
    if(i)assert.ok(position>home.indexOf('date: "'+dates[i-1]+'"'));
  }
  for(const id of ['1HalGO7dtimrRMF8Wh3ceoGBl7VVdI2Cd','1vUL12fNtUNUppi7GWHcfl_2JZpdvJkNW','1q2Zo4082yHWynwZSTRrJtSzTIIoKSBOc','1XIaJ0tQIDvqZBT-cMeOrS2C3hdR7eEKF'])assert.ok(home.includes(id));
  assert.match(home, /PHOTO_ARCHIVE_FOLDERS\.slice\(0, 5\)/);
});
