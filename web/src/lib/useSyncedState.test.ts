import { act, renderHook } from '@testing-library/react';
import { useSyncedState } from './useSyncedState';

describe('useSyncedState', () => {
  it('starts with the external value', () => {
    const { result } = renderHook(() => useSyncedState('a'));
    expect(result.current[0]).toBe('a');
  });

  it('changes instantly when set locally, before the external value catches up', () => {
    const { result } = renderHook(({ external }) => useSyncedState(external), { initialProps: { external: 'a' } });
    act(() => {
      result.current[1]('b');
    });
    expect(result.current[0]).toBe('b');
  });

  it('follows the external value when it changes', () => {
    const { result, rerender } = renderHook(({ external }) => useSyncedState(external), {
      initialProps: { external: 'a' },
    });
    act(() => {
      result.current[1]('b');
    });
    rerender({ external: 'c' });
    expect(result.current[0]).toBe('c');
  });

  it('keeps the local value across re-renders when the external value is unchanged', () => {
    const { result, rerender } = renderHook(({ external }) => useSyncedState(external), {
      initialProps: { external: 'a' },
    });
    act(() => {
      result.current[1]('b');
    });
    rerender({ external: 'a' });
    expect(result.current[0]).toBe('b');
  });
});
