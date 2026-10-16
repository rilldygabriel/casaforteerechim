import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUpload, MAX_MEDIA_BYTES, mediaFilename, matchesMedia } from '../src/lib/media-library.ts';
const base = { id: 'd9edce66-186c-42be-a018-1a143daaa5f4', title: 'Teste', caption: 'Ação 🙏\n\n#CasaForte', kind: 'carousel', files: [{ name: 'a.png', size: 23, mime: 'image/png' }] };
test('preserves caption, order and all nine slides without imposing eight', () => {
  const value = normalizeUpload({ ...base, files: Array.from({length:9}, (_, i) => ({name:`${9-i}.webp`,size:100,mime:'image/webp'})) });
  assert.equal(value.files.length,9); assert.equal(value.files[0].name,'9.webp'); assert.equal(value.caption,base.caption);
});
test('five GB allowed, larger and empty files refused', () => {
  assert.equal(normalizeUpload({...base,files:[{name:'a.png',size:MAX_MEDIA_BYTES}]}).files[0].size,MAX_MEDIA_BYTES);
  for(const size of [0,-1,MAX_MEDIA_BYTES+1,NaN]) assert.throws(()=>normalizeUpload({...base,files:[{name:'a.png',size}]}));
});
test('rejects malformed types, unsafe names, mismatched MIME and missing Reel cover',()=>{
  for(const files of [[{name:'../a.png',size:1}], [{name:'a.svg',size:1}], [{name:'a.png',size:1,mime:'text/html'}], []]) assert.throws(()=>normalizeUpload({...base,files}));
  assert.throws(()=>normalizeUpload({...base,kind:'reel'}));
  const r=normalizeUpload({...base,kind:'reel',files:[{name:'video.MOV',size:5,mime:'video/quicktime'},{name:'cover.jpg',size:5,mime:'image/jpeg'}]});
  assert.deepEqual(r.files.map(f=>f.role),['video','cover']);
});
test('ZIP names retain original file format and sortable order',()=>{
  assert.equal(mediaFilename({name:'original.JPEG',role:'slide'},0),'01-slide.jpeg');
  assert.equal(mediaFilename({name:'original.webp',role:'slide'},8),'09-slide.webp');
  assert.equal(mediaFilename({name:'original.MOV',role:'video'},0),'video-final.mov');
  const names = Array.from({length:200}, (_,i)=>mediaFilename({name:'original.png',role:'slide'},i,200));
  assert.deepEqual([...names].sort(), names);
});
test('search combines accent-insensitive caption/title, type and publication filters',()=>{
  const p={...base,posted:false};
  assert.ok(matchesMedia(p,'acao','carousel','ready'));
  assert.ok(matchesMedia(p,'#casaforte','all','all'));
  assert.equal(matchesMedia(p,'acao','reel','ready'),false);
  assert.equal(matchesMedia(p,'','all','posted'),false);
  assert.ok(matchesMedia({...p,posted:true},'','all','posted'));
});
