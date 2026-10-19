import assert from 'node:assert/strict';
import test from 'node:test';
import { OCTOBER_ELEVENTH_ALBUM as photos } from '../src/lib/cult-album-2026-10-11.ts';
test('arquivo de 11/10 preserva as 204 fotos únicas', () => {
 assert.equal(photos.length,204);
 assert.equal(new Set(photos.map(p=>p.id)).size,204);
 assert.equal(photos.filter(p=>p.orientation==='horizontal').length,91);
 assert.equal(photos.filter(p=>p.orientation==='vertical').length,113);
});
