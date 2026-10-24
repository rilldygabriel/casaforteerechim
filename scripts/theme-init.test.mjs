import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/theme-init.js', import.meta.url), 'utf8');
function boot(saved, blocked = false) {
  const root = { dataset: {}, style: {} };
  const meta = {};
  const context = { document: { documentElement: root, querySelector: () => ({ setAttribute: (k,v) => {meta[k]=v;} }) }, localStorage: { getItem() { if (blocked) throw new Error('Blocked'); return saved; }, setItem() {} } };
  vm.runInNewContext(source, context);
  return {root, meta};
}
for (const theme of ['dark','navy','heritage','natural','impact']) {
  test(`restaura ${theme} antes da hidratação`, () => {
    const {root,meta} = boot(theme);
    assert.equal(root.dataset.theme, ['dark','impact'].includes(theme) ? 'dark' : 'light');
    assert.equal(root.dataset.palette, theme === 'dark' ? undefined : theme);
    assert.equal(root.style.colorScheme, ['dark','impact'].includes(theme) ? 'dark' : 'light');
    if (theme === 'natural') assert.equal(meta.content, '#f2efe7');
    if (theme === 'impact') assert.equal(meta.content, '#ffd600');
  });
}
test('preserva migração dos antigos temas claros', () => {
  for (const old of ['light','editorial']) assert.equal(boot(old).root.dataset.palette,'navy');
});
test('Impacto Amarelo mantém contraste AA e CSS restrito à nova opção', () => {
  for (const [fg,bg] of [['141414','ffd600'],['303030','ffd600'],['faf9f4','202020'],['c5c5bd','202020'],['ffd600','353535']]) {
    const [a,b]=[luminance(fg),luminance(bg)].sort((x,y)=>y-x);
    assert.ok((a+.05)/(b+.05)>=4.5,`${fg} on ${bg}`);
  }
  const css=fs.readFileSync(new URL('../src/app/theme-impact.css',import.meta.url),'utf8');
  assert.match(css,/prefers-reduced-motion/);
  assert.ok(!css.includes('@import'));
  // Every actual style rule is palette-scoped; at-rules only wrap those rules.
  const selectors=css.replace(/\/\*[\s\S]*?\*\//g,'').split('}').flatMap(part=>part.split('{').slice(0,-1));
  for(const selector of selectors.map(s=>s.trim()).filter(s=>s && !s.startsWith('@'))) {
    assert.ok(selector.startsWith('html[data-palette="impact"]'),selector);
  }
  const toggle=fs.readFileSync(new URL('../src/components/theme-toggle.tsx',import.meta.url),'utf8');
  assert.match(toggle,/impact: "Impacto Amarelo"/);
  assert.match(toggle,/saved === "impact"/);
});
test('armazenamento bloqueado ou opção inválida não impede carregamento', () => {
  for (const result of [boot('unknown'),boot(null),boot('natural',true)]) assert.equal(result.root.dataset.theme,'dark');
});
function luminance(hex) {
  const channels=hex.match(/[a-f0-9]{2}/gi).map(h=>parseInt(h,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
  return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
}
test('paleta tem contraste AA em textos, botões e subtítulos', () => {
  for(const [fg,bg] of [['171916','f5df38'],['171916','fffdf7'],['53564e','f2efe7'],['fffdf7','252525'],['dbdfd3','252525'],['454b30','fffdf7'],['f5df38','252525']]) {
    const [a,b]=[luminance(fg),luminance(bg)].sort((x,y)=>y-x);
    assert.ok((a+.05)/(b+.05)>=4.5,`${fg} on ${bg}`);
  }
});
test('fundos responsivos leves e isolados do tema original', () => {
  for(const file of ['natural-stone.webp','natural-stone-mobile.webp']) assert.ok(fs.statSync(new URL(`../public/images/themes/${file}`,import.meta.url)).size<120000);
  const css=fs.readFileSync(new URL('../src/app/theme-natural.css',import.meta.url),'utf8');
  assert.match(css,/pointer-events: none/);
  assert.match(css,/html\[data-palette="natural"\] body::before/);
  assert.match(css,/natural-stone-mobile.webp/);
});
