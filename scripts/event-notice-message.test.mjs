import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {splitNotice} from '../src/lib/event-notice-message.ts';
test('preserves complete message without truncation and numbers parts',()=>{
 const message=('Orientações ✅ Bíblia e coberta.\n\n').repeat(90);
 const parts=splitNotice(message);
 assert(parts.length>1);
 assert(parts.every(p=>p.length<=900));
 assert.equal(parts.map(p=>p.replace(/^\(\d+\/\d+\) /,'')).join(' '),message.trim().replace(/\s+/g,' '));
});
test('small messages and empty messages',()=>{
 assert.deepEqual(splitNotice('Bom dia\n amiga'),['Bom dia amiga']);
 assert.deepEqual(splitNotice('   '),[]);
});
