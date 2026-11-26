export type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'qoc_theme_mode';
let mediaListenerBound = false;

function isDarkPreferredByOs(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function getThemeMode(): ThemeMode {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') {
      return raw;
    }
  } catch {
    // Ignore storage errors in private/restricted environments
  }
  return 'system';
}

export function applyThemeMode(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const useDark = mode === 'dark' || (mode === 'system' && isDarkPreferredByOs());
  document.documentElement.classList.toggle('ion-palette-dark', useDark);
  document.documentElement.style.colorScheme = useDark ? 'dark' : 'light';
}

export function setThemeMode(mode: ThemeMode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Ignore storage errors
  }
  applyThemeMode(mode);
}

/**
 * Initializes saved theme preference at startup and tracks live OS theme changes
 * when the user keeps mode on 'system'.
 */
export function initThemePreference(): void {
  applyThemeMode(getThemeMode());
  if (mediaListenerBound || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return;
  }
  mediaListenerBound = true;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    if (getThemeMode() === 'system') {
      applyThemeMode('system');
    }
  };
  if (typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', onChange);
  }
}
