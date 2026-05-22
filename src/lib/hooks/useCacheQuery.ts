import { useState, useEffect } from 'react';
import { queryEqual } from '@lib/atproto/store';
import type { Query } from '@lib/atproto/store';

export function useCacheQuery<T>(query: Query<T>): Query<T> {
  const [cachedQuery, setCachedQuery] = useState(query);

  useEffect(() => {
    if (!queryEqual(query, cachedQuery)) setCachedQuery(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return cachedQuery;
}
