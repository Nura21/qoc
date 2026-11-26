import { useCallback, useEffect, useRef, useState } from 'react';

import { subscribeDbChanges } from '../db/client';

export interface AsyncQueryResult<T> {
  data: T;
  loading: boolean;
  reload: () => Promise<void>;
}

/**
 * Automatically executes an async SQLite query and re-runs whenever local SQLite data mutates
 * or `queryKey` changes.
 */
export function useAsyncQuery<T>(fetcher: () => Promise<T>, initialValue: T, queryKey = ''): AsyncQueryResult<T> {
  const [data, setData] = useState<T>(initialValue);
  const [loading, setLoading] = useState<boolean>(true);
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const reload = useCallback(async () => {
    const result = await fetcherRef.current();
    setData(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    const run = async () => {
      const result = await fetcherRef.current();
      if (active) {
        setData(result);
        setLoading(false);
      }
    };
    void run();
    const unsubscribe = subscribeDbChanges(() => {
      void run();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [queryKey]);

  return { data, loading, reload };
}
