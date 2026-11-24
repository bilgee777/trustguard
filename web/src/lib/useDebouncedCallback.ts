import { useCallback, useEffect, useRef } from 'react';

/** Calls `callback` once the caller has stopped calling it for `delay` ms. Pending calls are dropped on unmount. */
export function useDebouncedCallback<Args extends unknown[]>(callback: (...args: Args) => void, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(callback);

  useEffect(() => {
    latest.current = callback;
  });
  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );

  return useCallback(
    (...args: Args) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        latest.current(...args);
      }, delay);
    },
    [delay],
  );
}
