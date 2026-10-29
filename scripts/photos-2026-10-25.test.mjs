import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {OCTOBER_TWENTY_FIFTH_ALBUM as photos} from '../src/lib/cult-album-2026-10-25.ts';
import {GALLERY_PHOTOS} from '../src/lib/gallery.ts';
test('25/10 reúne as duas pastas, omitindo apenas uma cópia de pixels idênticos',()=>{
 assert.equal(photos.length,204);
 assert.equal(new Set(photos.map(p=>p.id)).size,204);
 assert.equal(new Set(photos.map(p=>p.filename)).size,204);
 assert.equal(photos.filter(p=>p.orientation==='horizontal').length,61);
 assert.equal(photos.filter(p=>p.orientation==='vertical').length,143);
 assert.ok(photos.some(p=>p.filename==='7H0A1633.jpg'));
 assert.ok(!photos.some(p=>p.filename==='7H0A1633-2.jpg'));
});
test('20 destaques novos preservam a orientação e pertencem ao álbum',()=>{
 assert.equal(GALLERY_PHOTOS.length,20);
 assert.equal(new Set(GALLERY_PHOTOS.map(p=>p.src)).size,20);
 for(const p of GALLERY_PHOTOS){
  const original=photos.find(o=>p.src.includes('/d/'+o.id+'='));
  assert.ok(original);
  assert.equal(p.className,original.orientation==='vertical'?'home-gallery-tall':'home-gallery-wide');
  assert.match(p.slug,/^culto-de-domingo-25-10-foto-/);
  assert.match(p.alt,/25 de outubro/);
 }
});
test('álbum atual, arquivo de 18/10, Kids e cinco links são preservados',()=>{
 const album=readFileSync(new URL('../src/lib/cult-album.ts',import.meta.url),'utf8');
 assert.match(album,/LATEST_CULT_ALBUM[^=]*= OCTOBER_TWENTY_FIFTH_ALBUM/);
 assert.match(album,/LATEST_CULT_DATE_SHORT = "25\/10"/);
 const home=readFileSync(new URL('../src/app/page.tsx',import.meta.url),'utf8');
 assert.ok(home.indexOf('date: "25/10"')<home.indexOf('date: "18/10"'));
 assert.ok(home.includes('1-zlBmJVQF13igQ6sK9h6cvMx0Y5RcDsS'));
 assert.ok(home.includes('/fotos/eventos'));
 assert.match(home,/PHOTO_ARCHIVE_FOLDERS\.slice\(0, 5\)/);
});
