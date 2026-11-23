import type { Season } from '../types/league';

const THEME_KEY = 'zashilaa_league_theme_v1';

export function loadTheme(): 'dark' | 'light' {
  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // ignore
  }
  return 'dark';
}

export function saveTheme(theme: 'dark' | 'light'): void {
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore
  }
}

export function validateImportedSeasons(data: unknown): Season[] | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  for (const item of data) {
    if (
      typeof item !== 'object' ||
      item === null ||
      typeof (item as Season).id !== 'string' ||
      typeof (item as Season).name !== 'string' ||
      !Array.isArray((item as Season).teams) ||
      (item as Season).teams.length !== 6 ||
      !Array.isArray((item as Season).matches)
    ) {
      return null;
    }
  }
  return data as Season[];
}
