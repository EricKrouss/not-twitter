import type { Theme, Accent } from './theme';
import type { Timestamp, DataConverter } from '@lib/atproto/store';

export type User = {
  id: string;
  bio: string | null;
  pronouns: string | null;
  name: string;
  theme: Theme | null;
  accent: Accent | null;
  website: string | null;
  username: string;
  photoURL: string;
  verified: boolean;
  following: string[];
  followers: string[];
  followingCount: number;
  followersCount: number;
  blocking: boolean;
  blockedBy: boolean;
  blockingUri: string | null;
  blockingByListName: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp | null;
  totalTweets: number;
  totalPhotos: number;
  pinnedTweet: string | null;
  coverPhotoURL: string | null;
};

export type EditableData = Extract<
  keyof User,
  'bio' | 'name' | 'pronouns' | 'website' | 'photoURL' | 'coverPhotoURL'
>;

export type EditableUserData = Pick<User, EditableData>;

export const userConverter: DataConverter<User> = {
  toStore(user) {
    return { ...user };
  },
  fromStore(snapshot, options) {
    const data = snapshot.data(options) as Partial<User>;
    return {
      ...data,
      blocking: data.blocking ?? false,
      blockedBy: data.blockedBy ?? false,
      blockingUri: data.blockingUri ?? null,
      blockingByListName: data.blockingByListName ?? null
    } as User;
  }
};
