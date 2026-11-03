'use client';

import { useEffect, useRef, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { applyTheme, isTheme, readSavedTheme, saveTheme, systemTheme, THEME_STORAGE_KEY, type Theme } from '../lib/theme';
import './ThemeToggle.css';

/** The root's before-paint script uses the same storage key and data-theme attribute. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);
  const explicitChoice = useRef<Theme | null>(null);

  useEffect(() => {
    const saved = readSavedTheme();
    explicitChoice.current = saved;
    const rootTheme = document.documentElement.dataset.theme;
    const initial = saved ?? (isTheme(rootTheme) ? rootTheme : systemTheme());
    applyTheme(initial); setTheme(initial);

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const followSystem = () => {
      if (explicitChoice.current) return;
      const next = media.matches ? 'dark' : 'light';
      applyTheme(next); setTheme(next);
    };
    const syncPreference = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
      const savedValue = isTheme(event.newValue) ? event.newValue : null;
      explicitChoice.current = savedValue;
      const next = savedValue ?? systemTheme();
      applyTheme(next); setTheme(next);
    };
    media.addEventListener('change', followSystem);
    window.addEventListener('storage', syncPreference);
    return () => { media.removeEventListener('change', followSystem); window.removeEventListener('storage', syncPreference); };
  }, []);

  function toggle() {
    if (!theme) return;
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    explicitChoice.current = next;
    applyTheme(next); saveTheme(next); setTheme(next);
  }

  return <button
    type="button"
    className="theme-toggle"
    role="switch"
    aria-label="Dark mode"
    aria-checked={theme === 'dark'}
    title={theme ? `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode` : 'Light and dark appearance'}
    onClick={toggle}
    disabled={theme === null}
  >
    <span className="theme-toggle__thumb" aria-hidden="true"/>
    <span className="theme-toggle__icon theme-toggle__icon--light" aria-hidden="true"><Sun size={16}/></span>
    <span className="theme-toggle__icon theme-toggle__icon--dark" aria-hidden="true"><Moon size={16}/></span>
  </button>;
}
