import { useState } from 'react';
import { Link, NavLink, Outlet, ScrollRestoration } from 'react-router';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { LogoMark } from './Logo';
import { useApplyTheme } from '@/lib/useApplyTheme';
import { ThemeSwitcher } from './ThemeSwitcher';

const NAV = [
  { to: '/', label: 'Analyze', end: true },
  { to: '/url-inspector', label: 'URL Inspector', end: false },
  { to: '/demo', label: 'Demo', end: false },
  { to: '/privacy', label: 'Privacy & Security', end: false },
];

function NavItems({ onNavigate, vertical = false }: { onNavigate?: () => void; vertical?: boolean }) {
  return (
    <ul className={cn('flex', vertical ? 'flex-col gap-1' : 'items-center gap-1')}>
      {NAV.map((item) => (
        <li key={item.to}>
          <NavLink
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'block rounded-lg px-3 text-sm font-medium transition-colors',
                vertical ? 'py-2.5' : 'py-1.5',
                isActive ? 'bg-surface-2 text-text ring-1 ring-line' : 'text-muted hover:text-text',
              )
            }
          >
            {item.label}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

export function AppShell() {
  useApplyTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:ring-2 focus:ring-accent"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/75 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-lg font-semibold tracking-tight"
            aria-label="TrustGuard home"
            onClick={() => {
              setMenuOpen(false);
            }}
          >
            <LogoMark />
            <span className="text-[15px]">TrustGuard</span>
          </Link>
          <nav aria-label="Main" className="ml-4 hidden md:block">
            <NavItems />
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeSwitcher />
            <button
              type="button"
              className="grid size-9 place-items-center rounded-lg text-muted ring-1 ring-line hover:text-text md:hidden"
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => {
                setMenuOpen((open) => !open);
              }}
            >
              {menuOpen ? <X className="size-4" aria-hidden="true" /> : <Menu className="size-4" aria-hidden="true" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav id="mobile-nav" aria-label="Main" className="border-t border-line px-4 py-3 md:hidden">
            <NavItems
              vertical
              onNavigate={() => {
                setMenuOpen(false);
              }}
            />
          </nav>
        )}
      </header>

      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        <Outlet />
      </main>

      <footer className="border-t border-line/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-[13px] text-faint sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            TrustGuard gives a second opinion, not a guarantee. When in doubt, contact the sender through a channel you
            trust.
          </p>
          <Link to="/privacy" className="rounded hover:text-text">
            How your data is handled
          </Link>
        </div>
      </footer>
      <ScrollRestoration />
    </div>
  );
}
