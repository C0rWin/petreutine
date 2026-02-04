import { useCallback, useState } from 'react';

interface UsePaginationOptions {
  initialLimit?: number;
  initialOffset?: number;
}

export function usePagination(options: UsePaginationOptions = {}) {
  const { initialLimit = 20, initialOffset = 0 } = options;

  const [limit, setLimit] = useState(initialLimit);
  const [offset, setOffset] = useState(initialOffset);

  const currentPage = Math.floor(offset / limit) + 1;

  const goToPage = useCallback(
    (page: number) => {
      setOffset((page - 1) * limit);
    },
    [limit]
  );

  const nextPage = useCallback(() => {
    setOffset(prev => prev + limit);
  }, [limit]);

  const prevPage = useCallback(() => {
    setOffset(prev => Math.max(0, prev - limit));
  }, [limit]);

  const changeLimit = useCallback((newLimit: number) => {
    setLimit(newLimit);
    setOffset(0);
  }, []);

  const reset = useCallback(() => {
    setOffset(0);
  }, []);

  return {
    limit,
    offset,
    currentPage,
    setLimit: changeLimit,
    goToPage,
    nextPage,
    prevPage,
    reset,
  };
}
