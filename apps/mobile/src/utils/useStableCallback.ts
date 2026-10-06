import { useCallback, useInsertionEffect, useRef } from 'react';

/**
 * A callback whose identity never changes but always runs the latest `fn`, so event handlers can be
 * passed to memoized children (list rows, cards) without re-rendering them on every parent render.
 */
export function useStableCallback<Args extends unknown[], Result>(
  fn: (...args: Args) => Result,
): (...args: Args) => Result {
  const ref = useRef(fn);
  useInsertionEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args: Args) => ref.current(...args), []);
}
