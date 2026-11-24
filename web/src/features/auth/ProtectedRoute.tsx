import { Navigate, Outlet, useLocation } from 'react-router';
import { CloudOff } from 'lucide-react';
import { StatePanel } from '@/components/feedback/StatePanel';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useSession } from './session';

/** Gates account pages. This is a convenience for navigation: every API call is authorized again on the server. */
export function ProtectedRoute() {
  const session = useSession();
  const location = useLocation();

  if (session.isPending) {
    return (
      <div className="grid place-items-center py-24 text-muted">
        <Spinner label="Checking your session" />
      </div>
    );
  }
  if (session.data && !session.data.apiAvailable) {
    return (
      <StatePanel
        tone="error"
        icon={<CloudOff className="size-5" />}
        title="The server is not reachable"
        actions={
          <Button
            onClick={() => {
              void session.refetch();
            }}
          >
            Try again
          </Button>
        }
      >
        Your account and history live on the server. You can still analyze messages in your browser from the home page.
      </StatePanel>
    );
  }
  if (!session.data?.user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  return <Outlet />;
}
