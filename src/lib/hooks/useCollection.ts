import { useState, useEffect } from 'react';
import { getDoc, doc, onSnapshot } from '@lib/atproto/store';
import { usersCollection } from '@lib/atproto/collections';
import { useCacheQuery } from './useCacheQuery';
import type { Query } from '@lib/atproto/store';
import type { User } from '@lib/types/user';

type UseCollection<T> = {
  data: T[] | null;
  loading: boolean;
};

type DataWithRef<T> = (T & { createdBy: string; user?: User })[];
type DataWithUser<T> = UseCollection<T & { user: User }>;

export type UseCollectionOptions = {
  includeUser?: boolean;
  allowNull?: boolean;
  disabled?: boolean;
  preserve?: boolean;
};

export function useCollection<T>(
  query: Query<T>,
  options: {
    includeUser: true;
    allowNull?: boolean;
    disabled?: boolean;
    preserve?: boolean;
  }
): DataWithUser<T>;

export function useCollection<T>(
  query: Query<T>,
  options?: UseCollectionOptions
): UseCollection<T>;

export function useCollection<T>(
  query: Query<T>,
  options?: UseCollectionOptions
): UseCollection<T> | DataWithUser<T> {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);

  const cachedQuery = useCacheQuery(query);

  const { includeUser, allowNull, disabled, preserve } = options ?? {};

  useEffect(() => {
    if (disabled) {
      setLoading(false);
      return;
    }

    if (!preserve && data) {
      setData(null);
      setLoading(true);
    }

    const populateUser = async (currentData: DataWithRef<T>): Promise<void> => {
      const usersById = new Map<string, User>();

      currentData.forEach(({ createdBy, user }) => {
        if (user) usersById.set(createdBy, user);
      });

      await Promise.all(
        Array.from(
          new Set(
            currentData
              .map(({ createdBy }) => createdBy)
              .filter((createdBy) => !usersById.has(createdBy))
          )
        ).map(async (createdBy) => {
            const user = (await getDoc(doc(usersCollection, createdBy))).data();
            usersById.set(createdBy, user as User);
          })
      );

      const dataWithUser = currentData.map((currentData) => ({
        ...currentData,
        user: usersById.get(currentData.createdBy) as User
      }));

      setData(dataWithUser);
      setLoading(false);
    };

    const unsubscribe = onSnapshot(cachedQuery, (snapshot) => {
      const data = snapshot.docs.map((doc) =>
        doc.data({ serverTimestamps: 'estimate' })
      );

      if (allowNull && !data.length) {
        setData(null);
        setLoading(false);
        return;
      }

      if (includeUser) void populateUser(data as DataWithRef<T>);
      else {
        setData(data);
        setLoading(false);
      }
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cachedQuery, disabled]);

  return { data, loading };
}
