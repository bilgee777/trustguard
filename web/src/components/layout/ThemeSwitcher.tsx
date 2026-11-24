import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useThemeStore, type ThemeMode } from '@/stores/themeStore';

const OPTIONS: { mode: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { mode: 'system', label: 'Use system theme', Icon: Monitor },
  { mode: 'light', label: 'Light theme', Icon: Sun },
  { mode: 'dark', label: 'Dark theme', Icon: Moon },
];

export function ThemeSwitcher() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  return (
    <fieldset className="flex items-center rounded-lg bg-surface-2 p-0.5 ring-1 ring-line">
      <legend className="sr-only">Color theme</legend>
      {OPTIONS.map(({ mode: option, label, Icon }) => (
        <button
          key={option}
          type="button"
          aria-pressed={mode === option}
          aria-label={label}
          title={label}
          onClick={() => {
            setMode(option);
          }}
          className={cn(
            'grid size-7 place-items-center rounded-md transition-colors',
            mode === option ? 'bg-surface text-text shadow-sm ring-1 ring-line' : 'text-faint hover:text-text',
          )}
        >
          <Icon className="size-3.5" aria-hidden="true" />
        </button>
      ))}
    </fieldset>
  );
}
