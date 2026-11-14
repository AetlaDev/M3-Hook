/// <reference types="vite/client" />

declare const unsafeWindow: (Window & typeof globalThis) | undefined;

interface Window {
  vm?: unknown;
  __m3hookEditorVM?: unknown;
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>;
  export default component;
}

declare module '*.css?inline' {
  const css: string;
  export default css;
}
