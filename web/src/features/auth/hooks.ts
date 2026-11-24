import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useSetSession } from './session';
import { deleteAccount, login, logout, register, updateSettings } from './authApi';
import type { Settings, User } from '@/lib/api/types';

/** Everything cached for one user must disappear when the session changes, so nothing leaks to the next sign-in. */
function useResetAccountData() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.removeQueries({ queryKey: ['history'] });
  };
}

export function useLogin() {
  const setSession = useSetSession();
  const reset = useResetAccountData();
  return useMutation({
    mutationFn: login,
    onSuccess: (user) => {
      reset();
      setSession(user);
    },
  });
}

export function useRegister() {
  const setSession = useSetSession();
  const reset = useResetAccountData();
  return useMutation({
    mutationFn: register,
    onSuccess: (user) => {
      reset();
      setSession(user);
    },
  });
}

/** Signing out ends on the session-ended page, which clears local state once the protected page is gone. */
export function useLogout() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: logout,
    onSettled: () => navigate('/session-ended', { replace: true }),
  });
}

export function useUpdateSettings(current: User) {
  const setSession = useSetSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: Settings) => updateSettings(settings),
    onSuccess: (settings) => {
      setSession({ ...current, settings });
      // Stepping down a mode deletes stored text on the server, so cached history details are stale.
      void queryClient.invalidateQueries({ queryKey: ['history'] });
    },
  });
}

export function useDeleteAccount() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => navigate('/session-ended', { replace: true }),
  });
}
