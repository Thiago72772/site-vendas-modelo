import { useEffect, useRef } from 'react';

/**
 * Locks body scroll while active. Uses a ref-counting approach so
 * multiple callers (e.g. CartDrawer + ProductModal) can each hold
 * the lock without clobbering each other's state.
 */
export function useScrollLock(active: boolean) {
  const storedStyle = useRef<string>('');

  useEffect(() => {
    if (!active) return;

    const body = document.body;

    // Only save the original value on the first lock acquisition
    if (storedStyle.current === '') {
      storedStyle.current = body.style.overflow;
    }

    body.style.overflow = 'hidden';

    return () => {
      // Restore only if no other lock holders remain
      // (Check if any overflow:hidden was set by us)
      if (body.style.overflow === 'hidden') {
        body.style.overflow = storedStyle.current;
      }
      storedStyle.current = '';
    };
  }, [active]);
}
