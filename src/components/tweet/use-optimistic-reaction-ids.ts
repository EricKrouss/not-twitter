import { useCallback, useEffect, useRef, useState } from 'react';

const emptyReactionIds: string[] = [];

export function useOptimisticReactionIds(
  sourceIds: string[] | undefined,
  viewerId: string | undefined
): {
  optimisticIds: string[];
  active: boolean;
  applyOptimisticActive: (active: boolean) => void;
  rollbackOptimisticIds: (previousIds: string[]) => void;
} {
  const incomingIds = sourceIds ?? emptyReactionIds;
  const pendingActive = useRef<boolean | null>(null);
  const [optimisticIds, setOptimisticIds] = useState(incomingIds);

  useEffect(() => {
    if (!viewerId) {
      pendingActive.current = null;
      setOptimisticIds(incomingIds);
      return;
    }

    const incomingActive = incomingIds.includes(viewerId);
    const requestedActive = pendingActive.current;

    if (requestedActive !== null) {
      if (incomingActive === requestedActive) {
        pendingActive.current = null;
        setOptimisticIds(incomingIds);
      }

      return;
    }

    setOptimisticIds(incomingIds);
  }, [incomingIds, viewerId]);

  const applyOptimisticActive = useCallback(
    (active: boolean): void => {
      if (!viewerId) return;

      pendingActive.current = active;
      setOptimisticIds((currentIds) =>
        active
          ? [viewerId, ...currentIds.filter((id) => id !== viewerId)]
          : currentIds.filter((id) => id !== viewerId)
      );
    },
    [viewerId]
  );

  const rollbackOptimisticIds = useCallback((previousIds: string[]): void => {
    pendingActive.current = null;
    setOptimisticIds(previousIds);
  }, []);

  return {
    optimisticIds,
    active: !!viewerId && optimisticIds.includes(viewerId),
    applyOptimisticActive,
    rollbackOptimisticIds
  };
}
