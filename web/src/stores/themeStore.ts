import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

export const THEME_STORAGE_KEY = 'trustguard-theme';

/** localStorage can throw in private windows or with blocked storage; the app must still work. */
const safeStorage = createJSONStorage<Pick<ThemeState, 'mode'>>(() => {
  try {
    const probe = '__tg_probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const memory = new Map<string, string>();
    return {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => void memory.set(key, value),
      removeItem: (key) => void memory.delete(key),
    };
  }
});

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'system',
      setMode: (mode) => {
        set({ mode });
      },
    }),
    { name: THEME_STORAGE_KEY, storage: safeStorage, partialize: (state) => ({ mode: state.mode }) },
  ),
);

export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode !== 'system') return mode;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
