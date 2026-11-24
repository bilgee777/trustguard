import { isRouteErrorResponse, useRouteError } from 'react-router';
import { TriangleAlert } from 'lucide-react';
import { StatePanel } from '@/components/feedback/StatePanel';
import { ButtonLink } from '@/components/ui/Button';

export function RouteError() {
  const error = useRouteError();
  const detail = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : null;
  if (!isRouteErrorResponse(error)) console.error(error);
  return (
    <StatePanel
      tone="error"
      icon={<TriangleAlert className="size-5" />}
      title="This page failed to load"
      actions={
        <ButtonLink to="/" reloadDocument>
          Back to the analyzer
        </ButtonLink>
      }
    >
      {detail ?? 'An unexpected error stopped this page from rendering. Your text was not sent anywhere.'}
    </StatePanel>
  );
}
