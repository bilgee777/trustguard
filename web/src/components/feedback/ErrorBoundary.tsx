import { Component, type ErrorInfo, type ReactNode } from 'react';
import { RotateCcw, TriangleAlert } from 'lucide-react';
import { Button } from '../ui/Button';
import { StatePanel } from './StatePanel';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Last line of defence for render errors outside the router (route errors use RouteError). */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error', error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <StatePanel
        tone="error"
        icon={<TriangleAlert className="size-5" />}
        title="TrustGuard stopped unexpectedly"
        actions={
          <Button
            icon={<RotateCcw className="size-4" aria-hidden="true" />}
            onClick={() => {
              window.location.reload();
            }}
          >
            Reload the app
          </Button>
        }
      >
        Something in the interface failed to render. Your text was not sent anywhere. Reloading clears this state.
      </StatePanel>
    );
  }
}
