import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {NOVEMBER_FIRST_ALBUM as photos} from '../src/lib/cult-album-2026-11-01.ts';
import {GALLERY_PHOTOS} from '../src/lib/gallery.ts';
test('01/11 inclui as 167 fotos únicas das duas pastas',()=>{
 assert.equal(photos.length,167); assert.equal(new Set(photos.map(p=>p.id)).size,167); assert.equal(new Set(photos.map(p=>p.filename)).size,167);
});
test('20 destaques novos preservam a orientação e pertencem ao álbum',()=>{
 assert.equal(GALLERY_PHOTOS.length,20);
 assert.equal(new Set(GALLERY_PHOTOS.map(p=>p.src)).size,20);
 for(const p of GALLERY_PHOTOS){
  const original=photos.find(o=>p.src.includes('/d/'+o.id+'='));
  assert.ok(original);
  assert.equal(p.className,original.orientation==='vertical'?'home-gallery-tall':'home-gallery-wide');
  assert.match(p.slug,/^culto-de-domingo-01-11-foto-/);
  assert.match(p.alt,/1º de novembro/);
 }
});
test('álbum atual, arquivo de 25/10, Kids e cinco links são preservados',()=>{
 const album=readFileSync(new URL('../src/lib/cult-album.ts',import.meta.url),'utf8');
 assert.match(album,/LATEST_CULT_ALBUM[^=]*= NOVEMBER_FIRST_ALBUM/);
 assert.match(album,/LATEST_CULT_DATE_SHORT = "01\/11"/);
 const home=readFileSync(new URL('../src/app/page.tsx',import.meta.url),'utf8');
 assert.ok(home.indexOf('date: "01/11"')<home.indexOf('date: "25/10"'));
 assert.ok(home.includes('1jKWZkI7KpfwjQr2ZrZQtG9qh6EnzWulp'));
 assert.ok(home.includes('/fotos/eventos'));
 assert.match(home,/PHOTO_ARCHIVE_FOLDERS\.slice\(0, 5\)/);
});
