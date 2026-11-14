export interface M3HookSettings {
  autoCleanup: boolean;
}

const SETTINGS_KEY = 'm3-hook:settings';

const DEFAULT_SETTINGS: M3HookSettings = {
  autoCleanup: false,
};

export function loadSettings(): M3HookSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') as Partial<M3HookSettings>;
    return {
      autoCleanup:
        typeof parsed.autoCleanup === 'boolean' ? parsed.autoCleanup : DEFAULT_SETTINGS.autoCleanup,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: M3HookSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}
