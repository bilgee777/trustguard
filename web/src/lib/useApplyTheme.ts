import { useEffect } from 'react';
import { resolveTheme, useThemeStore } from '@/stores/themeStore';

/** Keeps <html data-theme> in sync with the stored preference and the OS setting. */
export function useApplyTheme() {
  const mode = useThemeStore((s) => s.mode);
  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset['theme'] = resolveTheme(mode);
    };
    apply();
    if (mode !== 'system') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    query.addEventListener('change', apply);
    return () => {
      query.removeEventListener('change', apply);
    };
  }, [mode]);
}
