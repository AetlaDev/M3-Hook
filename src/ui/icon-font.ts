import iconFontCss from './icon-font.css?inline';

const FONT_FAMILY = 'Material Symbols Outlined';
const MAX_ATTEMPTS = 3;

let m3HookFontStyle: HTMLStyleElement | null = null;
let m3HookFontRepaired = false;

function m3HookWait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function installIconFont(): void {
  const style = document.createElement('style');
  style.textContent = iconFontCss;
  m3HookFontStyle = style;
  const append = () => {
    (document.head || document.documentElement || document).appendChild(style);
  };
  if (document.head || document.documentElement) {
    append();
    return;
  }
  const observer = new MutationObserver(() => {
    if (!document.documentElement) return;
    append();
    observer.disconnect();
  });
  observer.observe(document, { childList: true, subtree: true });
}

function m3HookFontReady(): boolean {
  return Boolean(m3HookFontStyle?.isConnected) && document.fonts.check(`24px "${FONT_FAMILY}"`);
}

async function m3HookWaitForFont(timeout: number): Promise<boolean> {
  const deadline = performance.now() + timeout;
  while (performance.now() < deadline) {
    if (m3HookFontReady()) return true;
    await m3HookWait(300);
  }
  return m3HookFontReady();
}

export async function ensureIconFont(attempt = 0): Promise<void> {
  if (m3HookFontRepaired) return;
  try {
    const connectDeadline = performance.now() + 3000;
    while (!m3HookFontStyle?.isConnected && performance.now() < connectDeadline) {
      await m3HookWait(100);
    }
    if (!m3HookFontStyle?.isConnected) return;
    if (await m3HookWaitForFont(1000)) {
      m3HookFontRepaired = true;
      return;
    }
    m3HookFontStyle.remove();
    (document.head || document.documentElement || document).appendChild(m3HookFontStyle);
    if (await m3HookWaitForFont(1200)) {
      m3HookFontRepaired = true;
      return;
    }
  } catch {}
  if (attempt + 1 < MAX_ATTEMPTS) {
    await ensureIconFont(attempt + 1);
  }
}
