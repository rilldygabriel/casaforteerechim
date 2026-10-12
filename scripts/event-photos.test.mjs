import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { TARDE_DA_ALEGRIA_ALBUM as photos } from '../src/lib/event-album-2026-10-10.ts';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Tarde da Alegria contém as 168 fotos únicas nas duas orientações', () => {
  assert.equal(photos.length, 168);
  assert.equal(new Set(photos.map(p => p.id)).size, 168);
  assert.equal(photos.filter(p => p.orientation === 'horizontal').length, 87);
  assert.equal(photos.filter(p => p.orientation === 'vertical').length, 81);
  for (const p of photos) assert.match(p.filename, /\.jpg$/i);
});
test('evento tem página interna, abas e download autorizado somente por lista', () => {
  assert.match(read('src/app/fotos/eventos/page.tsx'), /<h1>Tarde da Alegria<\/h1>/);
  assert.match(read('src/app/fotos/eventos/page.tsx'), /photos=\{TARDE_DA_ALEGRIA_ALBUM\}/);
  assert.match(read('src/app/fotos/page.tsx'), /<PhotoTabs active="cultos"/);
  assert.match(read('src/app/fotos/photo-tabs.tsx'), /href="\/fotos\/eventos"/);
  const api = read('src/app/api/fotos/download/route.ts');
  assert.match(api, /TARDE_DA_ALEGRIA_ALBUM.find/);
  assert.match(api, /if \(!photo\).*status: 404/);
  assert.match(read('src/app/page.tsx'), /title: "Tarde da Alegria",\s+url: "\/fotos\/eventos"/);
});
