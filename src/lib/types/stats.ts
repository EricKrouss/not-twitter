import type { Timestamp, DataConverter } from '@lib/atproto/store';

export type Stats = {
  likes: string[];
  tweets: string[];
  updatedAt: Timestamp | null;
};

export const statsConverter: DataConverter<Stats> = {
  toStore(bookmark) {
    return { ...bookmark };
  },
  fromStore(snapshot, options) {
    const data = snapshot.data(options);

    return { ...data } as Stats;
  }
};
