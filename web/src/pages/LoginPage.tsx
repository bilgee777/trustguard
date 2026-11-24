import { AuthForm } from '@/features/auth/AuthForm';
import { usePageTitle } from '@/lib/usePageTitle';

export function LoginPage() {
  usePageTitle('Sign in');
  return <AuthForm mode="login" />;
}
