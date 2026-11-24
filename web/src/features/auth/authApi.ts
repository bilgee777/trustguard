import { del, post, put } from '@/lib/api/client';
import type { Settings, User } from '@/lib/api/types';

export interface Credentials {
  email: string;
  password: string;
}

export interface Registration extends Credentials {
  displayName: string;
}

export const login = (credentials: Credentials) => post<User>('/api/auth/login', credentials);
export const register = (registration: Registration) => post<User>('/api/auth/register', registration);
// keepalive: signing out must reach the server even if the user navigates away at once.
export const logout = () => post<undefined>('/api/auth/logout', undefined, { keepalive: true });
export const updateSettings = (settings: Settings) => put<Settings>('/api/me/settings', settings);
export const deleteAccount = (password: string) => del('/api/me', { password });
