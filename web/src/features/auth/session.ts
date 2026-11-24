import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, get, refreshSession } from '@/lib/api/client';
import type { User } from '@/lib/api/types';

export interface SessionState {
  user: User | null;
  /** False when the API could not be reached. The app then keeps working in the browser-only mode. */
  apiAvailable: boolean;
}

interface SessionResponse {
  user: User | null;
  canRefresh: boolean;
}

export const SESSION_KEY = ['session'] as const;

/**
 * Startup probe. One request for an anonymous visitor. If the access token expired but a refresh token is
 * still around, the session is renewed once and the probe repeated, so returning users stay signed in.
 */
export async function loadSession(): Promise<SessionState> {
  try {
    let response = await get<SessionResponse>('/api/auth/session');
    if (response.user === null && response.canRefresh && (await refreshSession())) {
      response = await get<SessionResponse>('/api/auth/session');
    }
    return { user: response.user, apiAvailable: true };
  } catch (error) {
    if (error instanceof ApiError && error.isUnavailable) return { user: null, apiAvailable: false };
    return { user: null, apiAvailable: true };
  }
}

export function useSession() {
  return useQuery({ queryKey: SESSION_KEY, queryFn: loadSession, staleTime: 5 * 60_000, retry: false });
}

/** The signed-in user, or null while loading or when anonymous. */
export function useUser(): User | null {
  return useSession().data?.user ?? null;
}

export function useSetSession() {
  const queryClient = useQueryClient();
  return (user: User | null) => {
    queryClient.setQueryData<SessionState>(SESSION_KEY, { user, apiAvailable: true });
  };
}
