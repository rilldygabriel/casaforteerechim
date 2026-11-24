const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = ts.transpileModule(fs.readFileSync('src/components/home-section-motion.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function mount({ reduced = false, supported = true } = {}) {
  let cleanup, change;
  const observers = [];
  const preference = {
    matches: reduced,
    addEventListener: (_, listener) => { change = listener; },
    removeEventListener: (_, listener) => { if (listener === change) change = undefined; },
  };
  function card(top) {
    const attrs = new Map();
    const animations = [];
    return {
      animations,
      getBoundingClientRect: () => ({ top }),
      hasAttribute: (name) => attrs.has(name),
      setAttribute: (name, value) => attrs.set(name, value),
      animate: (frames, options) => {
        const animation = { frames, options, cancelled: false, cancel() { this.cancelled = true; } };
        animations.push(animation);
        return animation;
      },
    };
  }
  const visible = card(100), below = card(1200);
  class Observer {
    constructor(callback) { this.callback = callback; this.observed = new Set(); observers.push(this); }
    observe(element) { this.observed.add(element); }
    unobserve(element) { this.observed.delete(element); }
    disconnect() { this.observed.clear(); }
  }
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    require: () => ({ useEffect: (effect) => { cleanup = effect(); } }),
    window: { innerHeight: 800, matchMedia: () => preference, ...(supported ? { IntersectionObserver: Observer } : {}) },
    document: { querySelector: () => ({ querySelectorAll: () => [visible, below] }) },
    Element: { prototype: { animate() {} } },
    IntersectionObserver: Observer,
  });
  exports.default();
  return { visible, below, observers, cleanup: () => cleanup?.(), change: (value) => { preference.matches = value; change?.(); } };
}

test('already visible content is not animated; offscreen sections enter once', () => {
  const view = mount();
  assert.equal(view.visible.animations.length, 0);
  const observer = view.observers[0];
  assert.equal(observer.observed.has(view.below), true);
  observer.callback([{ target: view.below, isIntersecting: true }]);
  observer.callback([{ target: view.below, isIntersecting: true }]);
  assert.equal(view.below.animations.length, 1);
  assert.equal(observer.observed.size, 0);
  assert.equal(view.below.animations[0].options.duration, 650);
  view.cleanup();
  assert.equal(view.below.animations[0].cancelled, true);
});

test('reduced motion skips animation and responds to a live preference change', () => {
  const view = mount({ reduced: true });
  assert.equal(view.observers.length, 0);
  view.change(false);
  assert.equal(view.observers.length, 1);
  view.observers[0].callback([{ target: view.below, isIntersecting: true }]);
  view.change(true);
  assert.equal(view.below.animations[0].cancelled, true);
  assert.equal(view.observers[0].observed.size, 0);
  view.cleanup();
});

test('unsupported browsers retain plain visible content', () => {
  const view = mount({ supported: false });
  assert.equal(view.observers.length, 0);
  assert.equal(view.below.animations.length, 0);
  view.cleanup();
});
