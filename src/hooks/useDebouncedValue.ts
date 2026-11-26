import { useEffect, useState } from 'react';

/**
 * Delays updating a rapidly changing value (such as live search input)
 * to avoid redundant SQLite queries on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs = 120): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
