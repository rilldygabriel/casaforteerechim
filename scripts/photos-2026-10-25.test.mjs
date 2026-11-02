import assert from 'node:assert/strict';
import test from 'node:test';
import {OCTOBER_TWENTY_FIFTH_ALBUM as photos} from '../src/lib/cult-album-2026-10-25.ts';
test('25/10 reúne as duas pastas, omitindo apenas uma cópia de pixels idênticos',()=>{
 assert.equal(photos.length,204);
 assert.equal(new Set(photos.map(p=>p.id)).size,204);
 assert.equal(new Set(photos.map(p=>p.filename)).size,204);
 assert.equal(photos.filter(p=>p.orientation==='horizontal').length,61);
 assert.equal(photos.filter(p=>p.orientation==='vertical').length,143);
 assert.ok(photos.some(p=>p.filename==='7H0A1633.jpg'));
 assert.ok(!photos.some(p=>p.filename==='7H0A1633-2.jpg'));
});
