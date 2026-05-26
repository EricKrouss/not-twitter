import { useState, useEffect, useMemo } from 'react';
import { doc, getDoc } from '@lib/atproto/store';
import { usersCollection } from '@lib/atproto/collections';
import type { CollectionReference } from '@lib/atproto/store';
import type { User } from '@lib/types/user';

type UserArrayDocument<T> = {
  data: T[] | null;
  loading: boolean;
};

type DataWithRef<T> = (T & { createdBy: string; user?: User })[];
type DataWithUser<T> = UserArrayDocument<T & { user: User }>;

export function useArrayDocument<T>(
  docsIds: string[],
  collectionRef: CollectionReference<T>,
  options?: { includeUser?: true; disabled?: boolean }
): DataWithUser<T>;

export function useArrayDocument<T>(
  docsIds: string[],
  collectionRef: CollectionReference<T>,
  options?: { includeUser?: false; disabled?: boolean }
): UserArrayDocument<T>;

export function useArrayDocument<T>(
  docsId: string[],
  collection: CollectionReference<T>,
  options?: { includeUser?: boolean; disabled?: boolean }
): UserArrayDocument<T> | DataWithUser<T> {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);

  const cachedDocsId = useMemo(() => docsId, [docsId]);

  const { includeUser, disabled } = options ?? {};

  useEffect(() => {
    if (disabled) return;

    if (includeUser && !data) setLoading(true);

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

    const fetchData = async (): Promise<void> => {
      try {
        const docsSnapshot = await Promise.all(
          cachedDocsId.map((id) => getDoc(doc(collection, id)))
        );

        const docs = docsSnapshot
          .filter((doc) => doc.exists())
          .map((doc) => doc.data({ serverTimestamps: 'estimate' }));

        if (!docs.length) {
          setData(null);
          setLoading(false);
          return;
        }

        if (includeUser) void populateUser(docs as DataWithRef<T>);
        else {
          setData(docs as T[]);
          setLoading(false);
        }
      } catch {
        setData(null);
        setLoading(false);
      }
    };

    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cachedDocsId]);

  return { data, loading };
}
