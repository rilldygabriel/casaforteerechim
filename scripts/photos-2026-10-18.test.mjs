import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {OCTOBER_EIGHTEENTH_ALBUM as photos} from '../src/lib/cult-album-2026-10-18.ts';
import {GALLERY_PHOTOS} from '../src/lib/gallery.ts';
test('18/10 inclui todas as 217 fotos, sem repetição',()=>{
 assert.equal(photos.length,217);
 assert.equal(new Set(photos.map(p=>p.id)).size,217);
 assert.equal(new Set(photos.map(p=>p.filename)).size,217);
 assert.equal(photos.filter(p=>p.orientation==='horizontal').length,80);
 assert.equal(photos.filter(p=>p.orientation==='vertical').length,137);
});
test('destaques pertencem ao álbum novo e preservam orientação',()=>{
 assert.equal(GALLERY_PHOTOS.length,20);
 assert.equal(new Set(GALLERY_PHOTOS.map(p=>p.src)).size,20);
 for(const p of GALLERY_PHOTOS){
 const original=photos.find(o=>p.src.includes('/d/'+o.id+'='));
 assert.ok(original);
 assert.equal(p.className,original.orientation==='vertical'?'home-gallery-tall':'home-gallery-wide');
 assert.match(p.slug,/^culto-de-domingo-18-10-foto-/);
 assert.match(p.alt,/18 de outubro/);
 }
});
test('álbum atual, arquivo anterior, Kids e limite de cinco links preservados',()=>{
 const album=readFileSync(new URL('../src/lib/cult-album.ts',import.meta.url),'utf8');
 assert.match(album,/LATEST_CULT_ALBUM[^=]*= OCTOBER_EIGHTEENTH_ALBUM/);
 assert.match(album,/LATEST_CULT_DATE_SHORT = "18\/10"/);
 const home=readFileSync(new URL('../src/app/page.tsx',import.meta.url),'utf8');
 assert.ok(home.indexOf('date: "18/10"')<home.indexOf('date: "11/10"'));
 assert.ok(home.includes('1dGF-HtU5hwSaNnTchNZhYrOqd1_Vpmct'));
 assert.ok(home.includes('/fotos/eventos'));
 assert.match(home,/PHOTO_ARCHIVE_FOLDERS\.slice\(0, 5\)/);
});
