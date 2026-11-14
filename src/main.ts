import './hook';
import { createApp, type App as VueApp } from 'vue';
import './ui/m3e';
import './styles.css';
import App from './App.vue';
import { m3HookOnCleanup } from './lifecycle';
import { ensureIconFont, installIconFont } from './ui/icon-font';

const ROOT_ID = 'm3-hook-root';

const m3HookPage: Window & typeof globalThis =
  typeof unsafeWindow === 'object' && unsafeWindow ? unsafeWindow : window;

type M3HookPrepend = (this: Element, ...nodes: (Node | string)[]) => void;

const m3HookNativePrepend = m3HookPage.Element.prototype.prepend as M3HookPrepend;
let m3HookApp: VueApp<Element> | null = null;

function m3HookGuardCspPrepend(this: Element, ...nodes: (Node | string)[]): void {
  if (this === m3HookPage.document.head) {
    for (const node of nodes) {
      if (typeof node !== 'string' && node.tagName === 'META' && node.getAttribute('http-equiv') === 'Content-Security-Policy') return;
    }
  }
  return m3HookNativePrepend.call(this, ...nodes);
}

(m3HookPage.Element.prototype as { prepend: M3HookPrepend }).prepend = m3HookGuardCspPrepend;

installIconFont();
void ensureIconFont();

function mount(): void {
  if (document.getElementById(ROOT_ID)) return;
  const host = document.createElement('div');
  host.id = ROOT_ID;
  (document.body || document.documentElement).appendChild(host);
  m3HookApp = createApp(App);
  m3HookApp.mount(host);
}

m3HookOnCleanup(() => {
  m3HookPage.Element.prototype.prepend = m3HookNativePrepend;
  m3HookApp?.unmount();
  m3HookApp = null;
  document.getElementById(ROOT_ID)?.remove();
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount, { once: true });
} else {
  mount();
}
