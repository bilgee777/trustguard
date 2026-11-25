import { act, renderHook } from '@testing-library/react';
import { useDebouncedCallback } from './useDebouncedCallback';

describe('useDebouncedCallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('calls once, with the last arguments, after the quiet period', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 300));

    act(() => {
      result.current('a');
      vi.advanceTimersByTime(200);
      result.current('ab');
      vi.advanceTimersByTime(200);
    });
    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(callback).toHaveBeenCalledExactlyOnceWith('ab');
  });

  it('always calls the latest callback', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(({ cb }) => useDebouncedCallback(cb, 100), { initialProps: { cb: first } });

    act(() => {
      result.current();
    });
    rerender({ cb: second });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it('drops a pending call when the component unmounts', () => {
    const callback = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedCallback(callback, 100));

    act(() => {
      result.current();
    });
    unmount();
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(callback).not.toHaveBeenCalled();
  });
});
