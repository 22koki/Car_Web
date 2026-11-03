export type Theme = 'light' | 'dark';
export const THEME_STORAGE_KEY = 'velocity.theme.v1';

export function isTheme(value: unknown): value is Theme { return value === 'light' || value === 'dark'; }

export function readSavedTheme(): Theme | null {
  if (typeof window === 'undefined') return null;
  try { const value = window.localStorage.getItem(THEME_STORAGE_KEY); return isTheme(value) ? value : null; }
  catch { return null; }
}

export function systemTheme(): Theme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function saveTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(THEME_STORAGE_KEY, theme); }
  catch { /* The appearance still changes for this visit when browser storage is unavailable. */ }
}
