import {
  clearBookmarks,
  blockUser,
  deletePost,
  followUser,
  likePost,
  muteUser,
  reportPost,
  reportUser,
  repostPost,
  setBookmark,
  setPinnedPost,
  stageImages,
  unblockUser,
  unmuteUser,
  unfollowUser,
  updateProfile,
  type ModerationReportReason,
  type ProfileMediaFiles
} from '@lib/atproto/backend';
import type { Query } from '@lib/atproto/store';
import type { EditableUserData } from '@lib/types/user';
import type { FilesWithId, ImagesPreview } from '@lib/types/file';
import type { Theme, Accent } from '@lib/types/theme';

export function checkUsernameAvailability(
  _username?: string
): Promise<boolean> {
  void _username;
  return Promise.resolve(true);
}

export async function getCollectionCount<T>(
  collection: Query<T>
): Promise<number> {
  const { getDocs } = await import('@lib/atproto/store');
  const snapshot = await getDocs(collection);
  return snapshot.size;
}

export async function updateUserData(
  userId: string,
  userData: EditableUserData,
  mediaFiles?: ProfileMediaFiles
): Promise<void> {
  await updateProfile(userId, userData, mediaFiles);
}

export async function updateUserTheme(
  userId: string,
  themeData: { theme?: Theme; accent?: Accent }
): Promise<void> {
  await updateProfile(userId, themeData);
}

export function updateUsername(
  _userId?: string,
  _username?: string
): Promise<void> {
  void _userId;
  void _username;
  // Bluesky handles are managed by the account PDS, not this UI field.
  return Promise.resolve();
}

export function managePinnedTweet(
  type?: 'pin' | 'unpin',
  _userId?: string,
  tweetId?: string
): Promise<void> {
  void _userId;
  if (!type) return Promise.resolve();
  return setPinnedPost(type === 'pin' ? tweetId ?? null : null);
}

export async function manageFollow(
  type: 'follow' | 'unfollow',
  _userId: string,
  targetUserId: string
): Promise<void> {
  void _userId;
  if (type === 'follow') await followUser(targetUserId);
  else await unfollowUser(targetUserId);
}

export async function manageBlock(
  type: 'block' | 'unblock',
  _userId: string,
  targetUserId: string
): Promise<void> {
  void _userId;
  if (type === 'block') await blockUser(targetUserId);
  else await unblockUser(targetUserId);
}

export async function manageMute(
  type: 'mute' | 'unmute',
  _userId: string,
  targetUserId: string
): Promise<void> {
  void _userId;
  if (type === 'mute') await muteUser(targetUserId);
  else await unmuteUser(targetUserId);
}

export function reportTweet(
  tweetId: string,
  reasonType: ModerationReportReason,
  reason?: string
): Promise<void> {
  return reportPost(tweetId, reasonType, reason);
}

export function reportAccount(
  targetUserId: string,
  reasonType: ModerationReportReason,
  reason?: string
): Promise<void> {
  return reportUser(targetUserId, reasonType, reason);
}

export async function removeTweet(tweetId: string): Promise<void> {
  await deletePost(tweetId);
}

export function uploadImages(
  userId: string,
  files: FilesWithId
): Promise<ImagesPreview | null> {
  return Promise.resolve(files.length ? stageImages(userId, files) : null);
}

export function manageReply(
  _type?: 'increment' | 'decrement',
  _tweetId?: string
): Promise<void> {
  void _type;
  void _tweetId;
  return Promise.resolve();
}
export function manageTotalTweets(
  _type?: 'increment' | 'decrement',
  _userId?: string
): Promise<void> {
  void _type;
  void _userId;
  return Promise.resolve();
}
export function manageTotalPhotos(
  _type?: 'increment' | 'decrement',
  _userId?: string
): Promise<void> {
  void _type;
  void _userId;
  return Promise.resolve();
}

export function manageRetweet(
  type: 'retweet' | 'unretweet',
  _userId: string,
  tweetId: string
): () => Promise<void> {
  void _userId;
  return async (): Promise<void> => repostPost(tweetId, type);
}

export function manageLike(
  type: 'like' | 'unlike',
  _userId: string,
  tweetId: string
): () => Promise<void> {
  void _userId;
  return async (): Promise<void> => likePost(tweetId, type);
}

export function manageBookmark(
  type: 'bookmark' | 'unbookmark',
  userId: string,
  tweetId: string
): Promise<void> {
  return setBookmark(userId, tweetId, type === 'bookmark');
}

export function clearAllBookmarks(userId: string): Promise<void> {
  return clearBookmarks(userId);
}
