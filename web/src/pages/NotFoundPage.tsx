import { Compass } from 'lucide-react';
import { StatePanel } from '@/components/feedback/StatePanel';
import { ButtonLink } from '@/components/ui/Button';
import { usePageTitle } from '@/lib/usePageTitle';

export function NotFoundPage() {
  usePageTitle('Page not found');
  return (
    <StatePanel
      icon={<Compass className="size-5" />}
      title="This page does not exist"
      actions={<ButtonLink to="/">Go to the analyzer</ButtonLink>}
    >
      The address may be mistyped, or the page may have moved.
    </StatePanel>
  );
}
