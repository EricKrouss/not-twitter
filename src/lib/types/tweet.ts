import type { Timestamp, DataConverter } from '@lib/atproto/store';
import type { ImagesPreview } from './file';
import type { User } from './user';

export type TweetReplySetting =
  | 'everyone'
  | 'following'
  | 'followers'
  | 'mentioned'
  | 'none';

export type TweetUnavailableReason =
  | 'blocked'
  | 'blocked-by'
  | 'not-found'
  | 'unknown';

export type TweetTombstoneKind =
  | 'limited-visibility'
  | 'sensitive'
  | 'sensitive-media'
  | 'age-restricted'
  | 'rules-violation'
  | 'suspended'
  | 'withheld'
  | 'reported'
  | 'muted-account'
  | 'muted-word'
  | 'no-longer-exists'
  | 'unavailable';

export type TweetCard = {
  type: 'external' | 'summary' | 'youtube';
  url: string;
  title: string;
  description: string | null;
  image: string | null;
  domain: string | null;
};

export type TweetMediaWarning = {
  title: string;
  description: string;
  label: string;
  noOverride: boolean;
};

export type EmbeddedTweet = {
  id: string | null;
  authorName: string | null;
  authorUsername: string | null;
  authorAvatar: string | null;
  authorVerified: boolean;
  text: string | null;
  langs: string[];
  createdAt: Timestamp | null;
  images: ImagesPreview | null;
  mediaWarning: TweetMediaWarning | null;
  card: TweetCard | null;
  tombstone?: TweetTombstoneKind | null;
  unavailable?: 'not-found' | 'blocked' | 'detached' | 'unknown';
};

export type Tweet = {
  id: string;
  text: string | null;
  langs: string[];
  images: ImagesPreview | null;
  mediaWarning: TweetMediaWarning | null;
  card: TweetCard | null;
  quotedTweet: EmbeddedTweet | null;
  parent: { id: string; username: string } | null;
  userLikes: string[];
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp | null;
  userReplies: number;
  userRetweets: string[];
  userQuotes: number;
  bookmarkCount: number;
  replySetting?: TweetReplySetting | null;
  viewerCanReply?: boolean | null;
  threadMuted?: boolean | null;
  unavailable?: TweetUnavailableReason;
  tombstone?: TweetTombstoneKind | null;
};

export type TweetWithUser = Tweet & { user: User };

export const tweetConverter: DataConverter<Tweet> = {
  toStore(tweet) {
    return { ...tweet };
  },
  fromStore(snapshot, options) {
    const { id } = snapshot;
    const data = snapshot.data(options);

    return { ...data, id } as Tweet;
  }
};
