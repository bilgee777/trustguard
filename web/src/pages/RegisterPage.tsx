import { AuthForm } from '@/features/auth/AuthForm';
import { usePageTitle } from '@/lib/usePageTitle';

export function RegisterPage() {
  usePageTitle('Create account');
  return <AuthForm mode="register" />;
}
