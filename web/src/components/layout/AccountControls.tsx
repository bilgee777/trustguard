import { NavLink } from 'react-router';
import { Button, ButtonLink } from '@/components/ui/Button';
import { useLogout } from '@/features/auth/hooks';
import { useSession } from '@/features/auth/session';
import { cn } from '@/lib/cn';

/** Sign in for visitors; settings link and sign out for members. */
export function AccountControls({ onNavigate, stacked = false }: { onNavigate?: () => void; stacked?: boolean }) {
  const session = useSession();
  const logout = useLogout();
  const user = session.data?.user ?? null;

  // Reserve the space while the session loads so the header does not jump.
  if (session.isPending) return <div aria-hidden="true" className="h-8 w-20" />;

  if (!user) {
    return (
      <ButtonLink to="/login" variant="secondary" size="sm" onClick={onNavigate}>
        Sign in
      </ButtonLink>
    );
  }

  return (
    <div className={cn('flex items-center gap-1', stacked && 'flex-col items-stretch gap-1')}>
      <NavLink
        to="/settings"
        onClick={onNavigate}
        aria-label={`Settings for ${user.displayName}`}
        className={({ isActive }) =>
          cn(
            'max-w-40 truncate rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            stacked && 'max-w-none py-2.5',
            isActive ? 'bg-surface-2 text-text ring-1 ring-line' : 'text-muted hover:text-text',
          )
        }
      >
        {user.displayName}
      </NavLink>
      <Button
        variant="ghost"
        size="sm"
        disabled={logout.isPending}
        onClick={() => {
          onNavigate?.();
          logout.mutate();
        }}
      >
        Sign out
      </Button>
    </div>
  );
}
