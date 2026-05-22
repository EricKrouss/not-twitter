import type { Timestamp, DataConverter } from '@lib/atproto/store';

export type Bookmark = {
  id: string;
  createdAt: Timestamp;
};

export const bookmarkConverter: DataConverter<Bookmark> = {
  toStore(bookmark) {
    return { ...bookmark };
  },
  fromStore(snapshot, options) {
    const data = snapshot.data(options);

    return { ...data } as Bookmark;
  }
};
