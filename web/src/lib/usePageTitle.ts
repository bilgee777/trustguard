import { useEffect } from 'react';

/** Route-level document titles so screen-reader users hear where they landed. */
export function usePageTitle(title: string | null) {
  useEffect(() => {
    document.title = title ? `${title} | TrustGuard` : 'TrustGuard: Think before you trust';
  }, [title]);
}
