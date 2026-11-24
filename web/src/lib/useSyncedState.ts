import { useState } from 'react';

/**
 * State that mirrors an external value (such as a URL parameter) but updates instantly when the user
 * changes it. Navigation is asynchronous, so a control bound straight to the URL would snap back to its old
 * value for a moment after each click. When the external value changes, local state follows it.
 * This is React's documented "adjust state during render" pattern, not an effect.
 */
export function useSyncedState<T>(external: T): [T, (value: T) => void] {
  const [value, setValue] = useState(external);
  const [previous, setPrevious] = useState(external);
  if (!Object.is(previous, external)) {
    setPrevious(external);
    setValue(external);
  }
  return [value, setValue];
}
