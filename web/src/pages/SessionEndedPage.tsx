import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { SESSION_KEY, useSetSession } from '@/features/auth/session';

/**
 * Where sign-out and account deletion land before returning home. The detour is deliberate: the session is
 * cleared only here, after the protected page the user was on has been replaced. Clearing it while that page
 * is still mounted lets it see "no user" and redirect to the sign-in screen, racing the navigation home.
 */
export function SessionEndedPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setSession = useSetSession();

  useEffect(() => {
    queryClient.removeQueries({ queryKey: ['history'] });
    setSession(null);
    // The server is the source of truth: confirm with a fresh probe rather than trusting the local clear.
    void queryClient.invalidateQueries({ queryKey: SESSION_KEY });
    void navigate('/', { replace: true });
  }, [navigate, queryClient, setSession]);

  return null;
}
