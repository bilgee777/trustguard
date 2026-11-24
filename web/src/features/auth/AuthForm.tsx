import { useState, type SubmitEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { LogIn, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Spinner } from '@/components/ui/Spinner';
import { TextField } from '@/components/ui/TextField';
import { ApiError } from '@/lib/api/client';
import { useLogin, useRegister } from './hooks';
import { useUser } from './session';
import {
  MIN_PASSWORD_LENGTH,
  safeRedirect,
  validateAuthFields,
  type AuthMode,
  type FieldErrors,
} from './authValidation';

/** Maps a server rejection to the field it is about, or to a form-level message. */
function describeFailure(error: unknown): { field?: keyof FieldErrors; message: string } {
  if (!(error instanceof ApiError)) return { message: 'Something went wrong. Try again.' };
  switch (error.code) {
    case 'invalid_email':
    case 'email_taken':
      return { field: 'email', message: error.message };
    case 'weak_password':
      return { field: 'password', message: error.message };
    default:
      return { message: error.message };
  }
}

export function AuthForm({ mode }: { mode: AuthMode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useUser();
  const login = useLogin();
  const register = useRegister();
  const mutation = mode === 'login' ? login : register;

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const destination = safeRedirect((location.state as { from?: unknown } | null)?.from);
  if (user) return <Navigate to={destination} replace />;

  const isLogin = mode === 'login';

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    const errors = validateAuthFields(mode, { displayName, email, password });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      // Move focus to the first invalid field, as a screen-reader user expects.
      const first = errors.displayName ? 'name' : errors.email ? 'email' : 'password';
      document
        .querySelector<HTMLInputElement>(
          `[autocomplete="${first === 'name' ? 'name' : first === 'email' ? 'email' : isLogin ? 'current-password' : 'new-password'}"]`,
        )
        ?.focus();
      return;
    }

    const onError = (error: unknown) => {
      const failure = describeFailure(error);
      if (failure.field) setFieldErrors({ [failure.field]: failure.message });
      else setFormError(failure.message);
    };
    const onSuccess = () => {
      void navigate(destination, { replace: true });
    };

    if (isLogin) login.mutate({ email: email.trim(), password }, { onSuccess, onError });
    else register.mutate({ displayName: displayName.trim(), email: email.trim(), password }, { onSuccess, onError });
  };

  return (
    <div className="mx-auto max-w-md px-4 pt-10 pb-16 sm:pt-16">
      <h1 className="text-[26px] leading-tight font-semibold tracking-tight">
        {isLogin ? 'Sign in' : 'Create your account'}
      </h1>
      <p className="mt-2 text-[15px] text-muted">
        {isLogin
          ? 'Sign in to keep a history of your analyses. You can use TrustGuard without an account.'
          : 'An account lets you keep a history of analyses. History stays off until you turn it on.'}
      </p>

      <Panel elevated className="mt-6">
        <form onSubmit={submit} noValidate aria-busy={mutation.isPending} className="flex flex-col gap-4">
          {!isLogin && (
            <TextField
              label="Name"
              autoComplete="name"
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
              }}
              error={fieldErrors.displayName}
              maxLength={80}
            />
          )}
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
            error={fieldErrors.email}
            maxLength={254}
          />
          <TextField
            label="Password"
            type="password"
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
            error={fieldErrors.password}
            hint={
              isLogin
                ? undefined
                : `At least ${MIN_PASSWORD_LENGTH} characters. A few unrelated words make a strong password.`
            }
            maxLength={128}
          />

          {formError && (
            <p role="alert" className="rounded-lg bg-critical-soft px-3 py-2 text-sm text-critical">
              {formError}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={mutation.isPending}
            icon={
              mutation.isPending ? (
                <Spinner />
              ) : isLogin ? (
                <LogIn className="size-4" aria-hidden="true" />
              ) : (
                <UserPlus className="size-4" aria-hidden="true" />
              )
            }
          >
            {mutation.isPending
              ? isLogin
                ? 'Signing in…'
                : 'Creating account…'
              : isLogin
                ? 'Sign in'
                : 'Create account'}
          </Button>
        </form>
      </Panel>

      <p className="mt-5 text-sm text-muted">
        {isLogin ? 'New to TrustGuard? ' : 'Already have an account? '}
        <Link
          to={isLogin ? '/register' : '/login'}
          state={location.state as unknown}
          className="font-medium text-accent hover:text-accent-strong"
        >
          {isLogin ? 'Create an account' : 'Sign in'}
        </Link>
      </p>
    </div>
  );
}
