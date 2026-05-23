import {
  AppBskyEmbedExternal,
  AppBskyEmbedImages,
  AppBskyEmbedRecord,
  AppBskyEmbedRecordWithMedia,
  AppBskyEmbedVideo,
  AppBskyFeedDefs,
  AppBskyGraphDefs,
  AppBskyLabelerDefs,
  Agent,
  AtpAgent,
  BlobRef,
  jsonToLex,
  RichText,
  type AppBskyActorProfile,
  type AppBskyActorDefs,
  type AppBskyFeedPost,
  type AppBskyFeedThreadgate,
  type AppBskyNotificationListNotifications,
  type AtpSessionData,
  type BskyFeedViewPreference,
  type BskyThreadViewPreference,
  type ChatBskyActorDeclaration,
  type ChatBskyConvoDefs
} from '@atproto/api';
import { BrowserOAuthClient } from '@atproto/oauth-client-browser';
import { buildAtprotoLoopbackClientMetadata } from '@atproto/oauth-types';
import { ensureValidDid, isValidHandle } from '@atproto/syntax';

import { Timestamp } from './timestamp';
import type { OAuthSession } from '@atproto/oauth-client';
import type { Bookmark } from '@lib/types/bookmark';
import type { ImagesPreview, FilesWithId } from '@lib/types/file';
import type { Stats } from '@lib/types/stats';
import type {
  EmbeddedTweet,
  Tweet,
  TweetCard,
  TweetReplySetting,
  TweetWithUser
} from '@lib/types/tweet';
import type { User } from '@lib/types/user';

const OAUTH_SUB_KEY = 'twitter-clone:bsky-oauth-sub';
const OAUTH_ACCOUNTS_KEY = 'twitter-clone:bsky-oauth-accounts';
const CREDENTIAL_SESSION_KEY = 'twitter-clone:bsky-credential-session';
const BSKY_APPVIEW_DID = 'did:web:api.bsky.app';
const BSKY_APPVIEW_SERVICE = 'bsky_appview';
const BSKY_APPVIEW_PROXY = `${BSKY_APPVIEW_DID}#${BSKY_APPVIEW_SERVICE}`;
const BSKY_CHAT_DID = 'did:web:api.bsky.chat';
const BSKY_CHAT_SERVICE = 'bsky_chat';
const BSKY_CHAT_PROXY = `${BSKY_CHAT_DID}#${BSKY_CHAT_SERVICE}`;
const OAUTH_SCOPES = [
  'atproto',
  `rpc:*?aud=${BSKY_APPVIEW_DID}%23${BSKY_APPVIEW_SERVICE}`,
  `rpc:*?aud=${BSKY_CHAT_DID}%23${BSKY_CHAT_SERVICE}`,
  'repo:app.bsky.actor.profile',
  'repo:app.bsky.feed.like',
  'repo:app.bsky.feed.post',
  'repo:app.bsky.feed.postgate',
  'repo:app.bsky.feed.repost',
  'repo:app.bsky.feed.threadgate',
  'repo:app.bsky.graph.block',
  'repo:app.bsky.graph.follow',
  'repo:chat.bsky.actor.declaration',
  'blob:image/*',
  'account:email?action=manage',
  'identity:handle'
];
const OAUTH_SCOPE = OAUTH_SCOPES.join(' ');
const CHAT_SCOPE = 'transition:chat.bsky';
const GENERIC_SCOPE = 'transition:generic';
const BSKY_IMAGE_MAX_BYTES = 1_000_000;
const BSKY_IMAGE_TARGET_BYTES = 950_000;
const BSKY_IMAGE_MAX_DIMENSION = 2000;
const BSKY_PROFILE_IMAGE_MIME_TYPE = 'image/jpeg';
const BSKY_PROFILE_IMAGE_ACCEPTED_TYPES = /^image\/(?:jpe?g|png)$/i;
const BSKY_MEDIA_POST_VISIBILITY_RETRIES = 8;
const BSKY_THREAD_REPLY_DEPTH = 25;
const THEME_KEY = 'twitter-clone:bsky-theme';
const DEFAULT_PROFILE_PHOTO_URL = '/assets/twitter-default-egg.png';
const DEFAULT_PROFILE_COVER_URL = '/assets/twitter-default-cover.png';
const CHAT_DECLARATION_COLLECTION = 'chat.bsky.actor.declaration';

type AuthUser = {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
};

export type SavedBlueskyAccount = {
  id: string;
  name: string;
  username: string;
  photoURL: string;
  verified: boolean;
  updatedAt: string;
};

type CollectionName = 'users' | 'tweets' | 'bookmarks' | 'stats';

type QueryFilter = {
  type: 'where';
  field: string;
  op: string;
  value: unknown;
};

type QueryLimit = {
  type: 'limit';
  count: number;
};

type QueryOrder = {
  type: 'orderBy';
  field: string;
  direction?: 'asc' | 'desc';
};

export type BackendConstraint = QueryFilter | QueryLimit | QueryOrder;

export type BackendCollection = {
  collectionName: CollectionName;
  path: string;
  ownerId?: string;
};

type PostRef = {
  uri: string;
  cid: string;
};

type PostReplyRef = {
  root: PostRef;
  parent: PostRef;
};

export type TweetThreadPage = {
  tweet: TweetWithUser;
  parents: TweetWithUser[];
  threadReplies: TweetWithUser[];
  replies: TweetWithUser[];
};

type BookmarkView = {
  subject?: PostRef;
  createdAt?: string;
  item?: unknown;
};

type BookmarksResponse = {
  cursor?: string;
  bookmarks: BookmarkView[];
};

type UploadedImage = {
  file: File;
  preview: ImagesPreview[number];
};

type StrictBlobRef = BlobRef & {
  ref: BlobRef['ref'];
  mimeType: string;
  size: number;
};

export type ProfileMediaFiles = Partial<
  Record<'photoURL' | 'coverPhotoURL', FilesWithId>
>;

type PreparedImageUpload = {
  file: Blob;
  encoding: string;
  aspectRatio: AppBskyEmbedImages.Image['aspectRatio'];
};

type ActorFeedPost = AppBskyFeedDefs.FeedViewPost;
type ActorProfileView =
  | AppBskyActorDefs.ProfileViewBasic
  | AppBskyActorDefs.ProfileView
  | AppBskyActorDefs.ProfileViewDetailed;

export type FeedGeneratorPage = {
  uri: string;
  displayName: string;
  description: string | null;
  avatar: string | null;
  likeCount: number;
  cursor: string | null;
  feed: TweetWithUser[];
};

export type HomeFeedPage = {
  tweets: TweetWithUser[];
  cursor: string | null;
};

export type SubscribedHomeFeed = {
  id: string;
  uri: string;
  displayName: string;
  description: string | null;
  avatar: string | null;
  creatorName: string;
  creatorUsername: string;
  pinned: boolean;
};

export type TweetStatsType = 'retweets' | 'likes' | 'quotes';

export type TweetStatsPage = {
  users: User[];
  tweets: TweetWithUser[];
  cursor: string | null;
};

export type SearchPostFilter = 'top' | 'latest' | 'photos' | 'videos';
export type SearchPeopleFilter = 'anyone' | 'followed';

export type SearchTweetsPage = {
  tweets: TweetWithUser[];
  cursor: string | null;
  hitsTotal: number | null;
};

export type SearchUsersPage = {
  users: User[];
  cursor: string | null;
};

export type UserListTab = 'follow' | 'moderation';

export type UserList = {
  uri: string;
  url: string;
  name: string;
  description: string | null;
  avatar: string | null;
  purpose: UserListTab;
  listItemCount: number;
  creatorName: string;
  creatorUsername: string;
  creatorAvatar: string;
  viewerMuted: boolean;
  viewerBlocked: boolean;
  indexedAt: string | null;
};

export type UserListsPage = {
  lists: UserList[];
};

export type NotificationReason =
  | 'like'
  | 'repost'
  | 'follow'
  | 'mention'
  | 'reply'
  | 'quote'
  | 'starterpack-joined'
  | string;

export type NotificationItem = {
  id: string;
  user: User;
  reason: NotificationReason;
  text: string | null;
  tweet: Tweet | null;
  targetPostId: string | null;
  isRead: boolean;
  createdAt: Timestamp;
};

export type NotificationsPage = {
  notifications: NotificationItem[];
  cursor: string | null;
  seenAt: string | null;
};

export type ChatParticipant = Pick<
  User,
  | 'id'
  | 'name'
  | 'username'
  | 'photoURL'
  | 'verified'
  | 'followingCount'
  | 'followersCount'
  | 'createdAt'
>;

export type ChatReaction = {
  value: string;
  senderId: string;
  createdAt: Timestamp;
};

export type ChatMessage = {
  id: string;
  text: string | null;
  senderId: string;
  sentAt: Timestamp;
  deleted: boolean;
  reactions: ChatReaction[];
  readBy: string[];
};

export type ChatConvo = {
  id: string;
  muted: boolean;
  opened: boolean;
  unreadCount: number;
  status: 'accepted' | 'request' | string;
  members: ChatParticipant[];
  lastMessage: ChatMessage | null;
};

export type ChatConvoPage = {
  convos: ChatConvo[];
  cursor: string | null;
};

export type ChatConvoRequestsPage = {
  requests: ChatConvo[];
  cursor: string | null;
};

export type ChatMessagesPage = {
  messages: ChatMessage[];
  cursor: string | null;
};

export type ChatAllowIncoming = 'all' | 'following' | 'none';

export type ChatSettings = {
  allowIncoming: ChatAllowIncoming;
};

export type SettingsLabelPreference = 'ignore' | 'warn' | 'hide';

export type SettingsContentLabel =
  | 'porn'
  | 'sexual'
  | 'nudity'
  | 'graphic-media';

export type SettingsThreadSort = 'oldest' | 'newest' | 'most-likes' | 'hotness';

export type SettingsDefaultReply =
  | 'everyone'
  | 'following'
  | 'followers'
  | 'mentioned'
  | 'nobody'
  | 'custom';

export type SettingsDefaultQuote = 'enabled' | 'disabled' | 'custom';

export type SettingsMutedWordTarget = 'content' | 'tag';
export type SettingsMutedWordActorTarget = 'all' | 'exclude-following';

export type SettingsMutedWord = {
  id?: string;
  value: string;
  targets: SettingsMutedWordTarget[];
  actorTarget: SettingsMutedWordActorTarget;
  expiresAt?: string;
};

export type SettingsNotificationInclude = 'all' | 'follows' | 'accepted';

export type SettingsNotificationPreference = {
  include?: SettingsNotificationInclude;
  list: boolean;
  push: boolean;
};

export type SettingsNotificationKey =
  | 'chat'
  | 'follow'
  | 'like'
  | 'likeViaRepost'
  | 'mention'
  | 'quote'
  | 'reply'
  | 'repost'
  | 'repostViaRepost'
  | 'starterpackJoined'
  | 'subscribedPost'
  | 'unverified'
  | 'verified';

export type SettingsNotificationPreferences = Record<
  SettingsNotificationKey,
  SettingsNotificationPreference
>;

export type BlueskySettings = {
  account: {
    did: string;
    handle: string;
    email: string | null;
    emailConfirmed: boolean | null;
    emailAuthFactor: boolean | null;
    active: boolean | null;
    status: string | null;
  };
  feedView: BskyFeedViewPreference;
  threadView: BskyThreadViewPreference;
  contentLabels: Record<SettingsContentLabel, SettingsLabelPreference>;
  adultContentEnabled: boolean;
  mutedWords: SettingsMutedWord[];
  postInteractions: {
    defaultReply: SettingsDefaultReply;
    defaultQuote: SettingsDefaultQuote;
  };
  interests: string[];
  chat: {
    available: boolean;
    settings: ChatSettings | null;
    error: string | null;
  };
  notifications: {
    available: boolean;
    preferences: SettingsNotificationPreferences | null;
    error: string | null;
  };
};

export class ChatAccessError extends Error {
  constructor(message = 'Authorize messages to continue.') {
    super(message);
    this.name = 'ChatAccessError';
  }
}

const userCache = new Map<string, User>();
const userHandleCache = new Map<string, User>();
const tweetCache = new Map<string, Tweet>();
const postRefCache = new Map<string, PostRef>();
const postReplyRefCache = new Map<string, PostReplyRef>();
const followUriCache = new Map<string, string>();
const detailedUserCache = new Set<string>();
const stagedImages = new Map<string, UploadedImage[]>();
const listeners = new Set<() => void>();

let agent: Agent | null = null;
let credentialAgent: AtpAgent | null = null;
let oauthClientPromise: Promise<BrowserOAuthClient> | null = null;
let oauthSession: OAuthSession | null = null;
let oauthInitPromise: Promise<AuthUser | null> | null = null;
let sessionDid: string | null = null;
let currentUser: User | null = null;
let currentFollowing = new Set<string>();
let malformedMediaRepairPromise: Promise<void> | null = null;

function hasStorage(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

function readCredentialSession(): AtpSessionData | null {
  if (!hasStorage()) return null;

  try {
    const storedSession = window.localStorage.getItem(CREDENTIAL_SESSION_KEY);
    if (!storedSession) return null;

    const parsedSession = JSON.parse(storedSession) as Partial<AtpSessionData>;

    return parsedSession.did &&
      parsedSession.handle &&
      parsedSession.accessJwt &&
      parsedSession.refreshJwt
      ? (parsedSession as AtpSessionData)
      : null;
  } catch {
    return null;
  }
}

function writeCredentialSession(session?: AtpSessionData): void {
  if (!hasStorage()) return;

  if (session) {
    window.localStorage.setItem(
      CREDENTIAL_SESSION_KEY,
      JSON.stringify(session)
    );
    return;
  }

  window.localStorage.removeItem(CREDENTIAL_SESSION_KEY);
}

function normalizeSavedAccount(value: unknown): SavedBlueskyAccount | null {
  if (!value || typeof value !== 'object') return null;

  const account = value as Partial<SavedBlueskyAccount>;

  if (
    typeof account.id !== 'string' ||
    typeof account.name !== 'string' ||
    typeof account.username !== 'string' ||
    typeof account.updatedAt !== 'string'
  ) {
    return null;
  }

  return {
    id: account.id,
    name: account.name,
    username: account.username,
    photoURL:
      typeof account.photoURL === 'string'
        ? account.photoURL
        : DEFAULT_PROFILE_PHOTO_URL,
    verified: !!account.verified,
    updatedAt: account.updatedAt
  };
}

function readSavedAccounts(): SavedBlueskyAccount[] {
  if (!hasStorage()) return [];

  try {
    const storedAccounts = window.localStorage.getItem(OAUTH_ACCOUNTS_KEY);
    if (!storedAccounts) return [];

    const parsedAccounts = JSON.parse(storedAccounts) as unknown;
    if (!Array.isArray(parsedAccounts)) return [];

    const seen = new Set<string>();
    return parsedAccounts
      .map(normalizeSavedAccount)
      .filter((account): account is SavedBlueskyAccount => {
        if (!account || seen.has(account.id)) return false;
        seen.add(account.id);
        return true;
      });
  } catch {
    return [];
  }
}

function writeSavedAccounts(accounts: SavedBlueskyAccount[]): void {
  if (!hasStorage()) return;

  if (accounts.length) {
    window.localStorage.setItem(OAUTH_ACCOUNTS_KEY, JSON.stringify(accounts));
    return;
  }

  window.localStorage.removeItem(OAUTH_ACCOUNTS_KEY);
}

function saveAccount(user: User): void {
  const savedAccount: SavedBlueskyAccount = {
    id: user.id,
    name: user.name,
    username: user.username,
    photoURL: user.photoURL,
    verified: user.verified,
    updatedAt: new Date().toISOString()
  };

  const accounts = readSavedAccounts();
  const nextAccounts = [
    savedAccount,
    ...accounts.filter((account) => account.id !== savedAccount.id)
  ];

  writeSavedAccounts(nextAccounts);
}

function removeSavedAccount(
  id: string | null | undefined
): SavedBlueskyAccount[] {
  if (!id) return readSavedAccounts();

  const nextAccounts = readSavedAccounts().filter(
    (account) => account.id !== id
  );
  writeSavedAccounts(nextAccounts);
  return nextAccounts;
}

function clearActiveAuthState(): void {
  agent = null;
  credentialAgent = null;
  oauthSession = null;
  oauthInitPromise = null;
  sessionDid = null;
  currentUser = null;
  currentFollowing = new Set();
  malformedMediaRepairPromise = null;

  if (hasStorage()) window.localStorage.removeItem(OAUTH_SUB_KEY);
  writeCredentialSession();
}

function createCredentialAgent(): AtpAgent {
  return new AtpAgent({
    service: 'https://bsky.social',
    persistSession: (_event, session) => writeCredentialSession(session)
  });
}

function getLoopbackRedirectUri(): string {
  const { protocol, hostname, port, pathname } = window.location;
  const redirectHost = hostname === 'localhost' ? '127.0.0.1' : hostname;
  const redirectPort = port ? `:${port}` : '';

  return `${protocol}//${redirectHost}${redirectPort}${pathname}`;
}

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1'
  );
}

function getHostedOAuthClientId(): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

  return `${window.location.origin}${basePath}/oauth/client-metadata.json`;
}

async function getOAuthClient(): Promise<BrowserOAuthClient> {
  if (typeof window === 'undefined') {
    throw new Error('Bluesky OAuth is only available in the browser.');
  }

  if (!oauthClientPromise) {
    oauthClientPromise = (async (): Promise<BrowserOAuthClient> => {
      const configuredClientId = process.env.NEXT_PUBLIC_ATPROTO_CLIENT_ID;

      if (configuredClientId) {
        return BrowserOAuthClient.load({
          clientId: configuredClientId,
          handleResolver: 'https://bsky.social'
        });
      }

      if (!isLoopbackHost(window.location.hostname)) {
        return BrowserOAuthClient.load({
          clientId: getHostedOAuthClientId(),
          handleResolver: 'https://bsky.social'
        });
      }

      return new BrowserOAuthClient({
        handleResolver: 'https://bsky.social',
        clientMetadata: buildAtprotoLoopbackClientMetadata({
          scope: OAUTH_SCOPE,
          redirect_uris: [getLoopbackRedirectUri() as never]
        })
      });
    })();
  }

  return oauthClientPromise;
}

function getAgent(): Agent {
  if (!agent) throw new Error('Sign in with Bluesky before loading this view.');
  return agent;
}

function getAppViewAgent(): Agent {
  return getAgent().withProxy(BSKY_APPVIEW_SERVICE, BSKY_APPVIEW_DID);
}

function getChatAgent(): Agent {
  return getAgent().withProxy(BSKY_CHAT_SERVICE, BSKY_CHAT_DID);
}

function getErrorStatus(error: unknown): number | null {
  const status = (error as { status?: unknown })?.status;
  return typeof status === 'number' ? status : null;
}

function getUnknownErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecordNotFoundError(error: unknown): boolean {
  const status = getErrorStatus(error);
  const message = getUnknownErrorMessage(error);

  return (
    status === 404 ||
    /RecordNotFound|record not found|could not locate|not found/i.test(message)
  );
}

function throwChatError(error: unknown): never {
  const status = getErrorStatus(error);
  const message = getUnknownErrorMessage(error);

  if (
    error instanceof ChatAccessError ||
    status === 401 ||
    status === 403 ||
    /auth|scope|permission|access/i.test(message)
  ) {
    throw new ChatAccessError(
      'Messages need Bluesky DM access. Authorize messages with Bluesky to continue.'
    );
  }

  throw new Error(`Bluesky messages failed: ${message}`);
}

export function isChatAccessError(error: unknown): boolean {
  return (
    error instanceof ChatAccessError ||
    (error instanceof Error && error.name === 'ChatAccessError')
  );
}

async function hasChatAccessScope(): Promise<boolean> {
  if (!oauthSession) return false;

  const tokenInfo = await oauthSession.getTokenInfo('auto');
  const scopes = new Set(tokenInfo.scope.split(/\s+/).filter(Boolean));
  const hasChatRpcScope = Array.from(scopes).some(
    (scope) =>
      scope.startsWith('rpc:') &&
      (scope.includes(`aud=${BSKY_CHAT_PROXY}`) ||
        scope.includes(`aud=${BSKY_CHAT_DID}%23${BSKY_CHAT_SERVICE}`) ||
        scope.includes('aud=*'))
  );

  return (
    (scopes.has(GENERIC_SCOPE) && scopes.has(CHAT_SCOPE)) || hasChatRpcScope
  );
}

async function ensureChatAccessScope(): Promise<void> {
  try {
    if (await hasChatAccessScope()) return;
  } catch (error) {
    throwChatError(error);
  }

  throw new ChatAccessError(
    'Messages need Bluesky DM access. Authorize messages with Bluesky to continue.'
  );
}

async function callChat<T>(request: () => Promise<T>): Promise<T> {
  await ensureChatAccessScope();

  try {
    return await request();
  } catch (error) {
    throwChatError(error);
  }
}

function normalizeChatAllowIncoming(value: unknown): ChatAllowIncoming {
  if (value === 'none' || value === 'following' || value === 'all')
    return value;

  return 'all';
}

async function callChatXrpc<T>(
  method: string,
  data: Record<string, unknown>
): Promise<T> {
  await ensureChatAccessScope();

  if (!oauthSession) throw new ChatAccessError();

  try {
    const response = await oauthSession.fetchHandler(`/xrpc/${method}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'atproto-proxy': BSKY_CHAT_PROXY
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const fallbackMessage = response.statusText || `HTTP ${response.status}`;
      const errorMessage = await response
        .json()
        .then((body: { error?: unknown; message?: unknown }) =>
          [body.error, body.message]
            .filter((value): value is string => typeof value === 'string')
            .join(': ')
        )
        .catch(() => fallbackMessage);
      const error = new Error(errorMessage || fallbackMessage) as Error & {
        status?: number;
      };

      error.status = response.status;
      throw error;
    }

    return (await response.json()) as T;
  } catch (error) {
    throwChatError(error);
  }
}

async function callChatQueryXrpc<T>(
  method: string,
  params: Record<string, unknown>
): Promise<T> {
  await ensureChatAccessScope();

  if (!oauthSession) throw new ChatAccessError();

  try {
    const query = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) query.set(key, String(value));
    });

    const queryString = query.toString();
    const response = await oauthSession.fetchHandler(
      `/xrpc/${method}${queryString ? `?${queryString}` : ''}`,
      {
        method: 'GET',
        headers: {
          'atproto-proxy': BSKY_CHAT_PROXY
        }
      }
    );

    if (!response.ok) {
      const fallbackMessage = response.statusText || `HTTP ${response.status}`;
      const errorMessage = await response
        .json()
        .then((body: { error?: unknown; message?: unknown }) =>
          [body.error, body.message]
            .filter((value): value is string => typeof value === 'string')
            .join(': ')
        )
        .catch(() => fallbackMessage);
      const error = new Error(errorMessage || fallbackMessage) as Error & {
        status?: number;
      };

      error.status = response.status;
      throw error;
    }

    return (await response.json()) as T;
  } catch (error) {
    throwChatError(error);
  }
}

async function readXrpcError(response: Response): Promise<string> {
  const fallbackMessage = response.statusText || `HTTP ${response.status}`;

  return response
    .json()
    .then((body: { error?: unknown; message?: unknown }) =>
      [body.error, body.message]
        .filter((value): value is string => typeof value === 'string')
        .join(': ')
    )
    .catch(() => fallbackMessage);
}

async function callAppXrpc<T>(
  method: string,
  data: Record<string, unknown>
): Promise<T> {
  if (!oauthSession)
    throw new Error('Sign in with Bluesky before changing settings.');

  const response = await oauthSession.fetchHandler(`/xrpc/${method}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'atproto-proxy': BSKY_APPVIEW_PROXY
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const fallbackMessage = response.statusText || `HTTP ${response.status}`;
    throw new Error((await readXrpcError(response)) || fallbackMessage);
  }

  if (response.status === 204) return undefined as unknown as T;

  return response.json().catch(() => undefined) as Promise<T>;
}

async function callAppQueryXrpc<T>(
  method: string,
  params: Record<string, unknown>
): Promise<T> {
  if (!oauthSession)
    throw new Error('Sign in with Bluesky before loading this view.');

  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) query.set(key, String(value));
  });

  const queryString = query.toString();
  const response = await oauthSession.fetchHandler(
    `/xrpc/${method}${queryString ? `?${queryString}` : ''}`,
    {
      method: 'GET',
      headers: {
        'atproto-proxy': BSKY_APPVIEW_PROXY
      }
    }
  );

  if (!response.ok) {
    const fallbackMessage = response.statusText || `HTTP ${response.status}`;
    throw new Error((await readXrpcError(response)) || fallbackMessage);
  }

  return (await response.json()) as T;
}

const SETTINGS_CONTENT_LABELS: SettingsContentLabel[] = [
  'porn',
  'sexual',
  'nudity',
  'graphic-media'
];

const NOTIFICATION_KEYS: SettingsNotificationKey[] = [
  'chat',
  'follow',
  'like',
  'likeViaRepost',
  'mention',
  'quote',
  'reply',
  'repost',
  'repostViaRepost',
  'starterpackJoined',
  'subscribedPost',
  'unverified',
  'verified'
];

const FILTERABLE_NOTIFICATION_KEYS = new Set<SettingsNotificationKey>([
  'follow',
  'like',
  'likeViaRepost',
  'mention',
  'quote',
  'reply',
  'repost',
  'repostViaRepost'
]);

const DEFAULT_NOTIFICATION_PREFERENCES: SettingsNotificationPreferences = {
  chat: { include: 'all', list: true, push: true },
  follow: { include: 'all', list: true, push: true },
  like: { include: 'all', list: true, push: true },
  likeViaRepost: { include: 'all', list: true, push: true },
  mention: { include: 'all', list: true, push: true },
  quote: { include: 'all', list: true, push: true },
  reply: { include: 'all', list: true, push: true },
  repost: { include: 'all', list: true, push: true },
  repostViaRepost: { include: 'all', list: true, push: true },
  starterpackJoined: { list: true, push: true },
  subscribedPost: { list: true, push: true },
  unverified: { list: true, push: true },
  verified: { list: true, push: true }
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasJsonRepresentation(
  value: unknown
): value is { toJSON: () => unknown } {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as { toJSON?: unknown }).toJSON === 'function'
  );
}

function asStrictBlobRef(blob: BlobRef): StrictBlobRef {
  return blob as StrictBlobRef;
}

function parseBlobRef(blob: unknown): StrictBlobRef {
  if (blob instanceof BlobRef) return asStrictBlobRef(blob);

  const parsedBlob = jsonToLex(
    (hasJsonRepresentation(blob) ? blob.toJSON() : blob) as Parameters<
      typeof jsonToLex
    >[0]
  );

  if (parsedBlob instanceof BlobRef) return asStrictBlobRef(parsedBlob);

  throw new Error('Bluesky did not return a valid media blob.');
}

function getBlobRefSize(blob: StrictBlobRef): number | null {
  return Number.isFinite(blob.size) && blob.size > 0 ? blob.size : null;
}

function toPdsCompatibleBlobRef(blob: unknown, sizeOverride?: number): BlobRef {
  const parsedBlob = parseBlobRef(blob);
  const size =
    typeof sizeOverride === 'number' && sizeOverride > 0
      ? sizeOverride
      : getBlobRefSize(parsedBlob);

  if (!size)
    throw new Error('Bluesky returned a media blob without a valid size.');

  return new BlobRef(parsedBlob.ref, parsedBlob.mimeType, size);
}

function isSerializedCidObject(value: unknown): boolean {
  if (!isPlainObject(value)) return false;

  return (
    typeof value.$link !== 'string' &&
    typeof value.code === 'number' &&
    typeof value.version === 'number' &&
    (isPlainObject(value.hash) || value.hash instanceof Uint8Array)
  );
}

function isMalformedImageBlob(value: unknown): boolean {
  if (!isPlainObject(value)) return false;

  return value.$type === 'blob' && isSerializedCidObject(value.ref);
}

function embedHasMalformedImageBlob(embed: unknown): boolean {
  if (!isPlainObject(embed)) return false;

  if (
    embed.$type === 'app.bsky.embed.recordWithMedia' &&
    embedHasMalformedImageBlob(embed.media)
  )
    return true;

  if (embed.$type !== 'app.bsky.embed.images' || !Array.isArray(embed.images))
    return false;

  return embed.images.some(
    (image) => isPlainObject(image) && isMalformedImageBlob(image.image)
  );
}

function recordHasMalformedImageBlob(record: unknown): boolean {
  return isPlainObject(record) && embedHasMalformedImageBlob(record.embed);
}

async function repairMalformedOwnImagePosts(api: Agent): Promise<void> {
  if (!sessionDid || malformedMediaRepairPromise) {
    await malformedMediaRepairPromise;
    return;
  }

  malformedMediaRepairPromise = (async (): Promise<void> => {
    let cursor: string | undefined;
    let checkedRecords = 0;
    let deletedRecords = 0;

    do {
      const response = await api.com.atproto.repo.listRecords({
        repo: sessionDid as string,
        collection: 'app.bsky.feed.post',
        limit: 100,
        cursor
      });

      for (const record of response.data.records) {
        checkedRecords += 1;
        if (!recordHasMalformedImageBlob(record.value)) continue;

        const rkey = getRkeyFromAtUri(record.uri);
        if (!rkey) continue;

        await api.com.atproto.repo.deleteRecord({
          repo: sessionDid as string,
          collection: 'app.bsky.feed.post',
          rkey
        });
        deletedRecords += 1;
      }

      cursor = response.data.cursor;
    } while (cursor && checkedRecords < 500);

    if (deletedRecords > 0) notify();
  })().finally(() => {
    malformedMediaRepairPromise = null;
  });

  await malformedMediaRepairPromise;
}

function getPostRefFromValue(value: unknown): PostRef | null {
  if (!isPlainObject(value)) return null;

  const { uri, cid } = value;
  return typeof uri === 'string' && typeof cid === 'string'
    ? { uri, cid }
    : null;
}

function getReplyRefFromRecord(record: unknown): PostReplyRef | null {
  if (!isPlainObject(record) || !isPlainObject(record.reply)) return null;

  const root = getPostRefFromValue(record.reply.root);
  const parent = getPostRefFromValue(record.reply.parent);

  return root && parent ? { root, parent } : null;
}

function cachePostReplyRef(id: string, record: unknown): void {
  const replyRef = getReplyRefFromRecord(record);
  if (replyRef) postReplyRefCache.set(id, replyRef);
}

function getLocalProfileOverride(data: Partial<User>): Partial<User> {
  const override: Partial<User> = {};

  if ('theme' in data) override.theme = data.theme ?? null;
  if ('accent' in data) override.accent = data.accent ?? null;

  return override;
}

function applyLocalProfileUpdate(userId: string, data: Partial<User>): void {
  const cachedUser = userCache.get(userId);
  const targetUser = currentUser?.id === userId ? currentUser : cachedUser;

  if (!targetUser) return;

  if ('name' in data) targetUser.name = data.name ?? '';
  if ('bio' in data) targetUser.bio = data.bio ? data.bio : null;
  if ('pronouns' in data)
    targetUser.pronouns = data.pronouns ? data.pronouns : null;
  if ('website' in data) targetUser.website = data.website ?? null;
  if ('coverPhotoURL' in data && data.coverPhotoURL === null)
    targetUser.coverPhotoURL = DEFAULT_PROFILE_COVER_URL;

  targetUser.updatedAt = Timestamp.now();
  userCache.set(targetUser.id, targetUser);
  userHandleCache.set(targetUser.username, targetUser);
  detailedUserCache.add(targetUser.id);

  if (currentUser?.id === userId) currentUser = targetUser;
}

function getImageAspectRatio(
  width: number,
  height: number
): PreparedImageUpload['aspectRatio'] {
  return width > 0 && height > 0
    ? {
        width: Math.round(width),
        height: Math.round(height)
      }
    : undefined;
}

function loadImageElement(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const src = URL.createObjectURL(file);
    const image = new Image();

    image.onload = (): void => {
      URL.revokeObjectURL(src);
      resolve(image);
    };

    image.onerror = (): void => {
      URL.revokeObjectURL(src);
      reject(new Error('Unable to load image.'));
    };

    image.src = src;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function encodeCanvasImage(
  canvas: HTMLCanvasElement,
  targetBytes = BSKY_IMAGE_TARGET_BYTES,
  mimeTypes: readonly string[] = ['image/webp', 'image/jpeg']
): Promise<Blob> {
  let fallbackBlob: Blob | null = null;
  const qualities = [0.92, 0.84, 0.76, 0.68, 0.6];

  for (const quality of qualities) {
    for (const mimeType of mimeTypes) {
      const blob = await canvasToBlob(canvas, mimeType, quality);

      if (!blob) continue;

      fallbackBlob = blob;
      if (blob.size <= targetBytes) return blob;
    }
  }

  if (fallbackBlob) return fallbackBlob;

  throw new Error('Unable to prepare image for Bluesky.');
}

function drawImageToCanvas(
  image: HTMLImageElement,
  outputMimeTypes: readonly string[]
): HTMLCanvasElement {
  const scale = Math.min(
    1,
    BSKY_IMAGE_MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight)
  );
  const canvas = document.createElement('canvas');
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');

  if (!context) throw new Error('Unable to prepare image for Bluesky.');

  if (outputMimeTypes.includes(BSKY_PROFILE_IMAGE_MIME_TYPE)) {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
  }

  context.drawImage(image, 0, 0, width, height);

  return canvas;
}

async function prepareImageForBluesky(
  file: File,
  options?: {
    acceptedTypes?: RegExp;
    outputMimeTypes?: readonly string[];
  }
): Promise<PreparedImageUpload> {
  const {
    acceptedTypes = /^image\/(?:jpe?g|png|webp|gif)$/i,
    outputMimeTypes = ['image/webp', 'image/jpeg']
  } = options ?? {};
  const image = await loadImageElement(file);
  const originalAspectRatio = getImageAspectRatio(
    image.naturalWidth,
    image.naturalHeight
  );

  if (file.size <= BSKY_IMAGE_MAX_BYTES && acceptedTypes.test(file.type)) {
    return {
      file,
      encoding: file.type || 'image/jpeg',
      aspectRatio: originalAspectRatio
    };
  }

  const canvas = drawImageToCanvas(image, outputMimeTypes);
  let blob = await encodeCanvasImage(
    canvas,
    BSKY_IMAGE_TARGET_BYTES,
    outputMimeTypes
  );

  while (
    blob.size > BSKY_IMAGE_MAX_BYTES &&
    canvas.width > 640 &&
    canvas.height > 640
  ) {
    const nextWidth = Math.max(1, Math.round(canvas.width * 0.82));
    const nextHeight = Math.max(1, Math.round(canvas.height * 0.82));
    const nextCanvas = document.createElement('canvas');

    nextCanvas.width = nextWidth;
    nextCanvas.height = nextHeight;

    const nextContext = nextCanvas.getContext('2d');

    if (!nextContext) break;

    nextContext.drawImage(canvas, 0, 0, nextWidth, nextHeight);
    canvas.width = nextWidth;
    canvas.height = nextHeight;
    const resizedContext = canvas.getContext('2d');

    if (!resizedContext) break;

    if (outputMimeTypes.includes(BSKY_PROFILE_IMAGE_MIME_TYPE)) {
      resizedContext.fillStyle = '#ffffff';
      resizedContext.fillRect(0, 0, nextWidth, nextHeight);
    }

    resizedContext.drawImage(nextCanvas, 0, 0);

    blob = await encodeCanvasImage(
      canvas,
      BSKY_IMAGE_TARGET_BYTES,
      outputMimeTypes
    );
  }

  if (blob.size > BSKY_IMAGE_MAX_BYTES) {
    throw new Error('Image is too large for Bluesky.');
  }

  return {
    file: blob,
    encoding: blob.type || 'image/jpeg',
    aspectRatio: getImageAspectRatio(canvas.width, canvas.height)
  };
}

function prepareProfileImageForBluesky(
  file: File
): Promise<PreparedImageUpload> {
  return prepareImageForBluesky(file, {
    acceptedTypes: BSKY_PROFILE_IMAGE_ACCEPTED_TYPES,
    outputMimeTypes: [BSKY_PROFILE_IMAGE_MIME_TYPE]
  });
}

function normalizeSettingsLabelPreference(
  value: unknown
): SettingsLabelPreference {
  if (value === 'hide' || value === 'warn' || value === 'ignore') return value;
  if (value === 'show') return 'ignore';

  return 'warn';
}

function normalizeMutedWordTarget(
  value: unknown
): SettingsMutedWordTarget | null {
  if (value === 'content' || value === 'tag') return value;

  return null;
}

function normalizeMutedWordActorTarget(
  value: unknown
): SettingsMutedWordActorTarget {
  if (value === 'exclude-following') return value;

  return 'all';
}

function normalizeMutedWord(
  word: AppBskyActorDefs.MutedWord
): SettingsMutedWord {
  const targets = word.targets
    .map(normalizeMutedWordTarget)
    .filter((target): target is SettingsMutedWordTarget => !!target);

  return {
    id: word.id,
    value: word.value,
    targets,
    actorTarget: normalizeMutedWordActorTarget(word.actorTarget),
    expiresAt: word.expiresAt
  };
}

function normalizeNotificationInclude(
  value: unknown,
  fallback: SettingsNotificationInclude
): SettingsNotificationInclude {
  if (value === 'all' || value === 'follows' || value === 'accepted')
    return value;

  return fallback;
}

function normalizeNotificationPreference(
  key: SettingsNotificationKey,
  value: unknown
): SettingsNotificationPreference {
  const fallback = DEFAULT_NOTIFICATION_PREFERENCES[key];
  if (!isPlainObject(value)) return fallback;

  const next: SettingsNotificationPreference = {
    list: typeof value.list === 'boolean' ? value.list : fallback.list,
    push: typeof value.push === 'boolean' ? value.push : fallback.push
  };

  if (key === 'chat') {
    next.include = normalizeNotificationInclude(
      value.include,
      fallback.include ?? 'all'
    ) as 'all' | 'accepted';
  } else if (FILTERABLE_NOTIFICATION_KEYS.has(key)) {
    const include = normalizeNotificationInclude(
      value.include,
      fallback.include ?? 'all'
    );
    next.include = include === 'accepted' ? 'all' : include;
  }

  return next;
}

function normalizeNotificationPreferences(
  value: unknown
): SettingsNotificationPreferences {
  const source = isPlainObject(value) ? value : {};

  return NOTIFICATION_KEYS.reduce<SettingsNotificationPreferences>(
    (prefs, key) => ({
      ...prefs,
      [key]: normalizeNotificationPreference(key, source[key])
    }),
    { ...DEFAULT_NOTIFICATION_PREFERENCES }
  );
}

function getRuleType(rule: unknown): string | null {
  if (!isPlainObject(rule)) return null;

  return typeof rule.$type === 'string' ? rule.$type : null;
}

function getDefaultReplyFromRules(
  rules: AppBskyActorDefs.PostInteractionSettingsPref['threadgateAllowRules']
): SettingsDefaultReply {
  if (rules === undefined) return 'everyone';
  if (rules.length === 0) return 'nobody';
  if (rules.length !== 1) return 'custom';

  const ruleType = getRuleType(rules[0]);
  if (ruleType === 'app.bsky.feed.threadgate#followingRule') return 'following';
  if (ruleType === 'app.bsky.feed.threadgate#followerRule') return 'followers';
  if (ruleType === 'app.bsky.feed.threadgate#mentionRule') return 'mentioned';

  return 'custom';
}

function getReplyRulesFromDefault(
  setting: Exclude<SettingsDefaultReply, 'custom'>
): AppBskyActorDefs.PostInteractionSettingsPref['threadgateAllowRules'] {
  if (setting === 'everyone') return undefined;
  if (setting === 'nobody') return [];
  if (setting === 'following')
    return [{ $type: 'app.bsky.feed.threadgate#followingRule' }];
  if (setting === 'followers')
    return [{ $type: 'app.bsky.feed.threadgate#followerRule' }];

  return [{ $type: 'app.bsky.feed.threadgate#mentionRule' }];
}

function getDefaultQuoteFromRules(
  rules: AppBskyActorDefs.PostInteractionSettingsPref['postgateEmbeddingRules']
): SettingsDefaultQuote {
  if (!rules || rules.length === 0) return 'enabled';
  if (
    rules.length === 1 &&
    getRuleType(rules[0]) === 'app.bsky.feed.postgate#disableRule'
  )
    return 'disabled';

  return 'custom';
}

function getQuoteRulesFromDefault(
  setting: Exclude<SettingsDefaultQuote, 'custom'>
): AppBskyActorDefs.PostInteractionSettingsPref['postgateEmbeddingRules'] {
  if (setting === 'enabled') return undefined;

  return [{ $type: 'app.bsky.feed.postgate#disableRule' }];
}

async function getNotificationPreferences(): Promise<SettingsNotificationPreferences> {
  const response = await callAppQueryXrpc<{ preferences?: unknown }>(
    'app.bsky.notification.getPreferences',
    {}
  );

  return normalizeNotificationPreferences(response.preferences);
}

async function readBlueskyAccountSession(): Promise<
  BlueskySettings['account']
> {
  const response = await getAgent().com.atproto.server.getSession();

  return {
    did: response.data.did,
    handle: response.data.handle,
    email: response.data.email ?? null,
    emailConfirmed:
      typeof response.data.emailConfirmed === 'boolean'
        ? response.data.emailConfirmed
        : null,
    emailAuthFactor:
      typeof response.data.emailAuthFactor === 'boolean'
        ? response.data.emailAuthFactor
        : null,
    active:
      typeof response.data.active === 'boolean' ? response.data.active : null,
    status: response.data.status ?? null
  };
}

export async function getBlueskySettings(): Promise<BlueskySettings> {
  const api = getAppViewAgent();

  const [account, prefs, chatResult, notificationResult] = await Promise.all([
    readBlueskyAccountSession(),
    api.getPreferences(),
    getChatSettings()
      .then((settings) => ({
        available: true,
        settings,
        error: null
      }))
      .catch((error) => ({
        available: false,
        settings: null,
        error: getUnknownErrorMessage(error)
      })),
    getNotificationPreferences()
      .then((preferences) => ({
        available: true,
        preferences,
        error: null
      }))
      .catch((error) => ({
        available: false,
        preferences: null,
        error: getUnknownErrorMessage(error)
      }))
  ]);

  const labels = SETTINGS_CONTENT_LABELS.reduce<
    Record<SettingsContentLabel, SettingsLabelPreference>
  >(
    (contentLabels, label) => ({
      ...contentLabels,
      [label]: normalizeSettingsLabelPreference(
        prefs.moderationPrefs.labels[label]
      )
    }),
    {
      porn: 'warn',
      sexual: 'warn',
      nudity: 'ignore',
      'graphic-media': 'warn'
    }
  );

  const postInteractionSettings = prefs.postInteractionSettings;

  return {
    account,
    feedView: prefs.feedViewPrefs.home,
    threadView: prefs.threadViewPrefs,
    contentLabels: labels,
    adultContentEnabled: prefs.moderationPrefs.adultContentEnabled,
    mutedWords: prefs.moderationPrefs.mutedWords.map(normalizeMutedWord),
    postInteractions: {
      defaultReply: getDefaultReplyFromRules(
        postInteractionSettings.threadgateAllowRules
      ),
      defaultQuote: getDefaultQuoteFromRules(
        postInteractionSettings.postgateEmbeddingRules
      )
    },
    interests: prefs.interests.tags,
    chat: chatResult,
    notifications: notificationResult
  };
}

export async function setAdultContentSetting(
  enabled: boolean
): Promise<BlueskySettings> {
  await getAppViewAgent().setAdultContentEnabled(enabled);
  notify();

  return getBlueskySettings();
}

export async function requestSettingsEmailUpdateToken(): Promise<boolean> {
  const response = await getAgent().com.atproto.server.requestEmailUpdate();

  return response.data.tokenRequired;
}

export async function updateSettingsHandle(
  handle: string
): Promise<BlueskySettings> {
  const safeHandle = handle.trim().replace(/^@/, '').toLowerCase();

  if (!isValidHandle(safeHandle)) throw new Error('Enter a valid handle.');

  await getAgent().com.atproto.identity.updateHandle({ handle: safeHandle });
  await refreshCurrentUser();
  notify();

  return getBlueskySettings();
}

export async function updateSettingsEmail(
  email: string,
  token: string | undefined,
  emailAuthFactor: boolean
): Promise<BlueskySettings> {
  const safeEmail = email.trim();
  const safeToken = token?.trim();

  if (!safeEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail))
    throw new Error('Enter a valid email address.');

  await getAgent().com.atproto.server.updateEmail({
    email: safeEmail,
    emailAuthFactor,
    token: safeToken ? safeToken : undefined
  });
  notify();

  return getBlueskySettings();
}

export async function requestSettingsEmailConfirmation(): Promise<void> {
  await getAgent().com.atproto.server.requestEmailConfirmation();
}

export async function confirmSettingsEmail(
  email: string,
  token: string
): Promise<BlueskySettings> {
  const safeEmail = email.trim();
  const safeToken = token.trim();

  if (!safeEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail))
    throw new Error('Enter the email address on your account.');
  if (!safeToken)
    throw new Error('Enter the confirmation token from your email.');

  await getAgent().com.atproto.server.confirmEmail({
    email: safeEmail,
    token: safeToken
  });
  notify();

  return getBlueskySettings();
}

export async function requestSettingsPasswordReset(
  email: string
): Promise<void> {
  const safeEmail = email.trim();

  if (!safeEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail))
    throw new Error('Enter the email address on your account.');

  await getAgent().com.atproto.server.requestPasswordReset({
    email: safeEmail
  });
}

export async function resetSettingsPassword(
  token: string,
  password: string
): Promise<void> {
  const safeToken = token.trim();

  if (!safeToken) throw new Error('Enter the reset token from your email.');
  if (password.length < 8)
    throw new Error('Choose a password with at least 8 characters.');

  await getAgent().com.atproto.server.resetPassword({
    token: safeToken,
    password
  });
}

export async function setContentLabelSetting(
  label: SettingsContentLabel,
  preference: SettingsLabelPreference
): Promise<BlueskySettings> {
  if (!SETTINGS_CONTENT_LABELS.includes(label))
    throw new Error('Unsupported content label.');

  await getAppViewAgent().setContentLabelPref(label, preference);
  notify();

  return getBlueskySettings();
}

export async function setFeedViewSetting(
  pref: Partial<BskyFeedViewPreference>
): Promise<BlueskySettings> {
  const safePref: Partial<BskyFeedViewPreference> = {};

  if (typeof pref.hideReplies === 'boolean')
    safePref.hideReplies = pref.hideReplies;
  if (typeof pref.hideRepliesByUnfollowed === 'boolean')
    safePref.hideRepliesByUnfollowed = pref.hideRepliesByUnfollowed;
  if (typeof pref.hideReposts === 'boolean')
    safePref.hideReposts = pref.hideReposts;
  if (typeof pref.hideQuotePosts === 'boolean')
    safePref.hideQuotePosts = pref.hideQuotePosts;
  if (typeof pref.hideRepliesByLikeCount === 'number') {
    safePref.hideRepliesByLikeCount = Math.max(
      0,
      Math.min(1000, Math.round(pref.hideRepliesByLikeCount))
    );
  }

  await getAppViewAgent().setFeedViewPrefs('home', safePref);
  notify();

  return getBlueskySettings();
}

export async function setThreadViewSetting(
  pref: Partial<BskyThreadViewPreference>
): Promise<BlueskySettings> {
  const safePref: Partial<BskyThreadViewPreference> = {};

  if (
    pref.sort === 'oldest' ||
    pref.sort === 'newest' ||
    pref.sort === 'most-likes' ||
    pref.sort === 'hotness'
  ) {
    safePref.sort = pref.sort;
  }

  if (typeof pref.prioritizeFollowedUsers === 'boolean')
    safePref.prioritizeFollowedUsers = pref.prioritizeFollowedUsers;

  await getAppViewAgent().setThreadViewPrefs(safePref);
  notify();

  return getBlueskySettings();
}

export async function setDefaultReplySetting(
  setting: Exclude<SettingsDefaultReply, 'custom'>
): Promise<BlueskySettings> {
  const prefs = await getAppViewAgent().getPreferences();

  await getAppViewAgent().setPostInteractionSettings({
    threadgateAllowRules: getReplyRulesFromDefault(setting),
    postgateEmbeddingRules: prefs.postInteractionSettings.postgateEmbeddingRules
  });
  notify();

  return getBlueskySettings();
}

export async function setDefaultQuoteSetting(
  setting: Exclude<SettingsDefaultQuote, 'custom'>
): Promise<BlueskySettings> {
  const prefs = await getAppViewAgent().getPreferences();

  await getAppViewAgent().setPostInteractionSettings({
    threadgateAllowRules: prefs.postInteractionSettings.threadgateAllowRules,
    postgateEmbeddingRules: getQuoteRulesFromDefault(setting)
  });
  notify();

  return getBlueskySettings();
}

export async function setInterestsSetting(
  tags: string[]
): Promise<BlueskySettings> {
  const safeTags = Array.from(
    new Set(
      tags
        .map((tag) => tag.trim().replace(/^#/, '').toLowerCase())
        .filter((tag) => /^[a-z0-9][a-z0-9-]{0,63}$/.test(tag))
    )
  ).slice(0, 20);

  await getAppViewAgent().setInterestsPref({ tags: safeTags });
  notify();

  return getBlueskySettings();
}

export async function addSettingsMutedWord(
  value: string,
  targets: SettingsMutedWordTarget[],
  actorTarget: SettingsMutedWordActorTarget,
  expiresAt?: string
): Promise<BlueskySettings> {
  const safeValue = value.trim();
  const safeTargets = targets.filter(
    (target): target is SettingsMutedWordTarget =>
      target === 'content' || target === 'tag'
  );

  if (!safeValue) throw new Error('Enter a word or phrase to mute.');
  if (safeValue.length > 1000)
    throw new Error('Muted words must be 1000 characters or fewer.');
  if (!safeTargets.length)
    throw new Error('Choose where this muted word should apply.');

  const safeActorTarget =
    actorTarget === 'exclude-following' ? actorTarget : 'all';
  const safeExpiresAt = expiresAt ? new Date(expiresAt) : null;

  if (safeExpiresAt && Number.isNaN(safeExpiresAt.getTime()))
    throw new Error('Choose a valid expiration date.');

  await getAppViewAgent().addMutedWord({
    value: safeValue,
    targets: safeTargets,
    actorTarget: safeActorTarget,
    expiresAt: safeExpiresAt?.toISOString()
  });
  notify();

  return getBlueskySettings();
}

export async function removeSettingsMutedWord(
  mutedWord: SettingsMutedWord
): Promise<BlueskySettings> {
  await getAppViewAgent().removeMutedWord(mutedWord);
  notify();

  return getBlueskySettings();
}

export async function setSettingsChatAllowIncoming(
  allowIncoming: ChatAllowIncoming
): Promise<BlueskySettings> {
  await setChatSettings(allowIncoming);

  return getBlueskySettings();
}

export async function setSettingsNotificationPreference(
  key: SettingsNotificationKey,
  preference: Partial<SettingsNotificationPreference>
): Promise<BlueskySettings> {
  if (!NOTIFICATION_KEYS.includes(key))
    throw new Error('Unsupported notification preference.');

  const current = await getNotificationPreferences();
  const fallback = current[key];
  const nextPreference = normalizeNotificationPreference(key, {
    ...fallback,
    ...preference
  });

  await callAppXrpc<{ preferences?: unknown }>(
    'app.bsky.notification.putPreferencesV2',
    {
      [key]: nextPreference
    }
  );
  notify();

  return getBlueskySettings();
}

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeBackend(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function safeAtob(value: string): string {
  if (typeof window !== 'undefined' && window.atob) return window.atob(value);
  return Buffer.from(value, 'base64').toString('utf8');
}

function safeBtoa(value: string): string {
  if (typeof window !== 'undefined' && window.btoa) return window.btoa(value);
  return Buffer.from(value, 'utf8').toString('base64');
}

export function postIdFromUri(uri: string): string {
  return safeBtoa(uri)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function uriFromPostId(id: string): string {
  const cachedRef = postRefCache.get(id);
  if (cachedRef) return cachedRef.uri;

  const padded = id.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (padded.length % 4)) % 4);
  return safeAtob(`${padded}${padding}`);
}

function compactArray(count: number, ownerId?: string): string[] {
  const safeCount = Math.max(0, count);
  const placeholders = Array.from({ length: safeCount }, (_, index) =>
    ownerId && index === 0 ? ownerId : `__count_${index}`
  );

  return ownerId && safeCount === 0 ? [ownerId] : placeholders;
}

function getThemeOverride(did: string): Partial<User> {
  if (!hasStorage()) return {};

  try {
    const themes = JSON.parse(
      window.localStorage.getItem(THEME_KEY) ?? '{}'
    ) as Record<string, Partial<User>>;
    const { theme, accent } = themes[did] ?? {};

    return {
      ...(theme !== undefined && { theme }),
      ...(accent !== undefined && { accent })
    };
  } catch {
    return {};
  }
}

function writeThemeOverride(did: string, data: Partial<User>): void {
  if (!hasStorage()) return;

  const override = getLocalProfileOverride(data);
  if (!Object.keys(override).length) return;

  const themes = JSON.parse(
    window.localStorage.getItem(THEME_KEY) ?? '{}'
  ) as Record<string, Partial<User>>;

  themes[did] = { ...(themes[did] ?? {}), ...override };
  window.localStorage.setItem(THEME_KEY, JSON.stringify(themes));
}

function hasDetailedProfileData(
  profile: ActorProfileView
): profile is AppBskyActorDefs.ProfileViewDetailed {
  return (
    'banner' in profile ||
    'followersCount' in profile ||
    'followsCount' in profile ||
    'postsCount' in profile ||
    'pinnedPost' in profile
  );
}

type ProfileVerificationState = {
  verifiedStatus?: unknown;
  trustedVerifierStatus?: unknown;
  verifications?: unknown;
};

type ProfileVerificationRecord = {
  isValid?: unknown;
  status?: unknown;
  verifiedStatus?: unknown;
  trustedVerifierStatus?: unknown;
};

function isValidVerificationStatus(status: unknown): boolean {
  return (
    typeof status === 'string' &&
    (status.toLowerCase() === 'valid' || status.toLowerCase() === 'verified')
  );
}

function isAbsentVerificationStatus(status: unknown): boolean {
  return (
    typeof status === 'string' &&
    ['invalid', 'none', 'unverified', 'not_verified'].includes(
      status.toLowerCase()
    )
  );
}

function isPositiveVerificationFlag(status: unknown): boolean {
  return status === true || isValidVerificationStatus(status);
}

function hasVerificationRecordCheckmark(record: unknown): boolean {
  if (!record || typeof record !== 'object') return false;

  const { isValid, status, verifiedStatus, trustedVerifierStatus } =
    record as ProfileVerificationRecord;
  const statuses = [status, verifiedStatus, trustedVerifierStatus];

  if (isValid === false) return false;
  if (isPositiveVerificationFlag(isValid)) return true;
  if (statuses.some(isPositiveVerificationFlag)) return true;
  if (statuses.some(isAbsentVerificationStatus)) return false;

  return true;
}

function hasProfileVerification(profile: ActorProfileView): boolean {
  const { verification } = profile as { verification?: unknown };
  if (!verification || typeof verification !== 'object') return false;

  const { verifiedStatus, trustedVerifierStatus, verifications } =
    verification as ProfileVerificationState;

  return (
    isPositiveVerificationFlag(verifiedStatus) ||
    isPositiveVerificationFlag(trustedVerifierStatus) ||
    (Array.isArray(verifications) &&
      verifications.some(hasVerificationRecordCheckmark))
  );
}

function getCachedUser(actor: string): User | null {
  return userCache.get(actor) ?? userHandleCache.get(actor) ?? null;
}

function isDefaultProfilePhotoURL(photoURL?: string | null): boolean {
  return (
    !photoURL ||
    photoURL === '/assets/twitter-avatar.jpg' ||
    photoURL === DEFAULT_PROFILE_PHOTO_URL
  );
}

function getProfilePhotoURL(
  profile: ActorProfileView,
  existing: User | undefined,
  isDetailed: boolean
): string {
  if (profile.avatar) return profile.avatar;
  if (!isDetailed && existing && !isDefaultProfilePhotoURL(existing.photoURL))
    return existing.photoURL;

  return DEFAULT_PROFILE_PHOTO_URL;
}

function getProfileCoverURL(
  profile: AppBskyActorDefs.ProfileViewDetailed,
  existing: User | undefined,
  isDetailed: boolean
): string {
  if (profile.banner) return profile.banner;
  if (!isDetailed && existing?.coverPhotoURL) return existing.coverPhotoURL;

  return DEFAULT_PROFILE_COVER_URL;
}

function mapProfile(profile: AppBskyActorDefs.ProfileViewDetailed): User;
function mapProfile(profile: AppBskyActorDefs.ProfileView): User;
function mapProfile(profile: AppBskyActorDefs.ProfileViewBasic): User;
function mapProfile(profile: ActorProfileView): User;
function mapProfile(profile: ActorProfileView): User {
  const existing = userCache.get(profile.did);
  const detailedProfile = profile as AppBskyActorDefs.ProfileViewDetailed;
  const isDetailed = hasDetailedProfileData(profile);
  const did = profile.did;
  const currentDid = sessionDid ?? '';
  const targetFollowsViewer = !!detailedProfile.viewer?.followedBy;
  const viewerFollowsTarget = !!detailedProfile.viewer?.following;
  const isCurrentUser = currentUser?.id === did;
  const following = isCurrentUser
    ? Array.from(currentFollowing)
    : targetFollowsViewer && currentDid
    ? [currentDid]
    : existing?.following ?? [];
  const followers =
    viewerFollowsTarget && currentDid
      ? [currentDid]
      : existing?.followers ?? [];

  if (detailedProfile.viewer?.following) {
    followUriCache.set(did, detailedProfile.viewer.following);
  }

  const profileCreatedAt = Timestamp.fromDate(
    new Date(
      detailedProfile.createdAt ??
        detailedProfile.indexedAt ??
        existing?.createdAt.toDate() ??
        Date.now()
    )
  );
  const pinnedTweet = detailedProfile.pinnedPost
    ? postIdFromUri(detailedProfile.pinnedPost.uri)
    : existing?.pinnedTweet ?? null;

  if (detailedProfile.pinnedPost) {
    postRefCache.set(pinnedTweet as string, detailedProfile.pinnedPost);
  }

  const user: User = {
    id: did,
    bio: detailedProfile.description ?? existing?.bio ?? null,
    pronouns: profile.pronouns ?? existing?.pronouns ?? null,
    name: profile.displayName || existing?.name || profile.handle,
    theme: existing?.theme ?? null,
    accent: existing?.accent ?? null,
    website: detailedProfile.website ?? existing?.website ?? null,
    username: profile.handle,
    photoURL: getProfilePhotoURL(profile, existing, isDetailed),
    verified: (existing?.verified ?? false) || hasProfileVerification(profile),
    following,
    followers,
    followingCount:
      detailedProfile.followsCount ??
      existing?.followingCount ??
      following.length,
    followersCount:
      detailedProfile.followersCount ??
      existing?.followersCount ??
      followers.length,
    createdAt: profileCreatedAt,
    updatedAt: existing?.updatedAt ?? profileCreatedAt,
    totalTweets: detailedProfile.postsCount ?? existing?.totalTweets ?? 0,
    totalPhotos: existing?.totalPhotos ?? 0,
    pinnedTweet,
    coverPhotoURL: getProfileCoverURL(detailedProfile, existing, isDetailed),
    ...getThemeOverride(did)
  };

  userCache.set(did, user);
  userHandleCache.set(user.username, user);
  if (isDetailed) detailedUserCache.add(did);

  return user;
}

async function hydrateProfiles(profiles: ActorProfileView[]): Promise<User[]> {
  const missingDetailedDids = Array.from(
    new Set(
      profiles
        .filter(
          (profile) =>
            !detailedUserCache.has(profile.did) &&
            !hasDetailedProfileData(profile)
        )
        .map(({ did }) => did)
    )
  );

  if (missingDetailedDids.length) {
    try {
      for (let index = 0; index < missingDetailedDids.length; index += 25) {
        const response = await getAppViewAgent().getProfiles({
          actors: missingDetailedDids.slice(index, index + 25)
        });

        response.data.profiles.forEach(mapProfile);
      }
    } catch {
      // Lightweight profile views are still usable if public detail hydration fails.
    }
  }

  return profiles.map(
    (profile) => getCachedUser(profile.did) ?? mapProfile(profile)
  );
}

function getPostText(record: unknown): string | null {
  if (!record || typeof record !== 'object' || !('text' in record)) return null;
  const text = (record as { text?: unknown }).text;
  return typeof text === 'string' && text ? text : null;
}

function getPostCreatedAt(record: unknown, fallback: string): Timestamp {
  const createdAt =
    record && typeof record === 'object' && 'createdAt' in record
      ? (record as { createdAt?: unknown }).createdAt
      : null;

  return Timestamp.fromDate(
    new Date(typeof createdAt === 'string' ? createdAt : fallback)
  );
}

function getHostname(url: string): string | null {
  try {
    const { hostname } = new URL(url);
    return hostname.replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

function getBskyWebUrl(uri: string): string {
  const atUriMatch = uri.match(/^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (!atUriMatch) return uri;

  const [, actor, collection, rkey] = atUriMatch;

  if (collection === 'app.bsky.feed.post')
    return `https://bsky.app/profile/${actor}/post/${rkey}`;
  if (collection === 'app.bsky.feed.generator')
    return `https://bsky.app/profile/${actor}/feed/${rkey}`;
  if (collection === 'app.bsky.graph.list')
    return `https://bsky.app/profile/${actor}/lists/${rkey}`;
  if (collection === 'app.bsky.graph.starterpack')
    return `https://bsky.app/starter-pack/${actor}/${rkey}`;

  return `https://bsky.app/profile/${actor}`;
}

function mapExternalCard(embed: AppBskyEmbedExternal.View): TweetCard {
  const { external } = embed;

  return {
    type: 'external',
    url: external.uri,
    title: external.title || external.uri,
    description: external.description || null,
    image: external.thumb ?? null,
    domain: getHostname(external.uri)
  };
}

function getStarterPackName(record: unknown): string | null {
  if (!record || typeof record !== 'object' || !('name' in record)) return null;
  const name = (record as { name?: unknown }).name;
  return typeof name === 'string' && name ? name : null;
}

function getStarterPackDescription(record: unknown): string | null {
  if (!record || typeof record !== 'object' || !('description' in record))
    return null;
  const description = (record as { description?: unknown }).description;
  return typeof description === 'string' && description ? description : null;
}

function mapRecordSummaryCard(
  record: AppBskyEmbedRecord.View['record']
): TweetCard | null {
  if (AppBskyFeedDefs.isGeneratorView(record))
    return {
      type: 'summary',
      url: getBskyWebUrl(record.uri),
      title: record.displayName,
      description: record.description ?? `Feed by @${record.creator.handle}`,
      image: record.avatar ?? null,
      domain: 'bsky.app'
    };

  if (AppBskyGraphDefs.isListView(record))
    return {
      type: 'summary',
      url: getBskyWebUrl(record.uri),
      title: record.name,
      description: record.description ?? `List by @${record.creator.handle}`,
      image: record.avatar ?? null,
      domain: 'bsky.app'
    };

  if (AppBskyGraphDefs.isStarterPackViewBasic(record)) {
    const name = getStarterPackName(record.record);
    const description = getStarterPackDescription(record.record);

    return {
      type: 'summary',
      url: getBskyWebUrl(record.uri),
      title: name ?? 'Starter Pack',
      description: description ?? `Starter Pack by @${record.creator.handle}`,
      image: null,
      domain: 'bsky.app'
    };
  }

  if (AppBskyLabelerDefs.isLabelerView(record))
    return {
      type: 'summary',
      url: getBskyWebUrl(record.uri),
      title: record.creator.displayName
        ? record.creator.displayName
        : record.creator.handle,
      description: `Labeler by @${record.creator.handle}`,
      image: record.creator.avatar ?? null,
      domain: 'bsky.app'
    };

  return null;
}

function mapMedia(embed: unknown): ImagesPreview | null {
  if (!embed) return null;

  if (AppBskyEmbedImages.isView(embed))
    return (embed as AppBskyEmbedImages.View).images.map((image, index) => ({
      id: `${image.fullsize}-${index}`,
      src: image.fullsize,
      alt: image.alt ? image.alt : 'Image',
      type: /\.gif($|\?)/i.test(image.fullsize) ? 'gif' : 'image',
      aspectRatio: image.aspectRatio ?? null
    }));

  if (AppBskyEmbedVideo.isView(embed)) {
    const { viewCount } = embed as AppBskyEmbedVideo.View & {
      viewCount?: number;
    };
    const videoEmbed = embed as AppBskyEmbedVideo.View;

    return [
      {
        id: `${videoEmbed.cid}-video`,
        src: videoEmbed.playlist,
        alt: videoEmbed.alt ? videoEmbed.alt : 'Video',
        type: 'video',
        poster: videoEmbed.thumbnail ?? null,
        viewCount: viewCount ?? null,
        aspectRatio: videoEmbed.aspectRatio ?? null
      }
    ];
  }

  if (AppBskyEmbedRecordWithMedia.isView(embed))
    return mapMedia((embed as AppBskyEmbedRecordWithMedia.View).media);

  return null;
}

function mapCard(embed: unknown): TweetCard | null {
  if (!embed) return null;

  if (AppBskyEmbedExternal.isView(embed))
    return mapExternalCard(embed as AppBskyEmbedExternal.View);

  if (AppBskyEmbedRecordWithMedia.isView(embed)) {
    const recordWithMedia = embed as AppBskyEmbedRecordWithMedia.View;
    const mediaCard = mapCard(recordWithMedia.media);
    if (mediaCard) return mediaCard;
    return mapRecordSummaryCard(recordWithMedia.record.record);
  }

  if (AppBskyEmbedRecord.isView(embed))
    return mapRecordSummaryCard((embed as AppBskyEmbedRecord.View).record);

  return null;
}

function mapFirstEmbeddedMedia(
  embeds?: AppBskyEmbedRecord.ViewRecord['embeds']
): ImagesPreview | null {
  if (!embeds) return null;

  for (const embed of embeds) {
    const media = mapMedia(embed);
    if (media) return media;
  }

  return null;
}

function mapFirstEmbeddedCard(
  embeds?: AppBskyEmbedRecord.ViewRecord['embeds']
): TweetCard | null {
  if (!embeds) return null;

  for (const embed of embeds) {
    const card = mapCard(embed);
    if (card) return card;
  }

  return null;
}

function mapUnavailableEmbeddedTweet(
  unavailable: EmbeddedTweet['unavailable'],
  uri?: string
): EmbeddedTweet {
  return {
    id: uri ? postIdFromUri(uri) : null,
    authorName: null,
    authorUsername: null,
    authorAvatar: null,
    authorVerified: false,
    text: null,
    createdAt: null,
    images: null,
    card: null,
    unavailable
  };
}

function mapEmbeddedRecord(
  record: AppBskyEmbedRecord.View['record']
): EmbeddedTweet | null {
  if (AppBskyEmbedRecord.isViewRecord(record)) {
    const id = postIdFromUri(record.uri);
    const author = mapProfile(record.author);

    postRefCache.set(id, { uri: record.uri, cid: record.cid });
    cachePostReplyRef(id, record.value);

    return {
      id,
      authorName: author.name,
      authorUsername: author.username,
      authorAvatar: author.photoURL,
      authorVerified: author.verified,
      text: getPostText(record.value),
      createdAt: getPostCreatedAt(record.value, record.indexedAt),
      images: mapFirstEmbeddedMedia(record.embeds),
      card: mapFirstEmbeddedCard(record.embeds)
    };
  }

  if (AppBskyEmbedRecord.isViewNotFound(record))
    return mapUnavailableEmbeddedTweet('not-found', record.uri);

  if (AppBskyEmbedRecord.isViewBlocked(record))
    return mapUnavailableEmbeddedTweet('blocked', record.uri);

  if (AppBskyEmbedRecord.isViewDetached(record))
    return mapUnavailableEmbeddedTweet('detached', record.uri);

  return null;
}

function mapQuotedTweet(embed: unknown): EmbeddedTweet | null {
  if (!embed) return null;

  if (AppBskyEmbedRecordWithMedia.isView(embed))
    return mapEmbeddedRecord(
      (embed as AppBskyEmbedRecordWithMedia.View).record.record
    );

  if (AppBskyEmbedRecord.isView(embed))
    return mapEmbeddedRecord((embed as AppBskyEmbedRecord.View).record);

  return null;
}

function getPostBookmarkCount(post: AppBskyFeedDefs.PostView): number {
  const bookmarkCount = post.bookmarkCount;

  return typeof bookmarkCount === 'number' && Number.isFinite(bookmarkCount)
    ? bookmarkCount
    : 0;
}

function mapPost(
  post: AppBskyFeedDefs.PostView,
  parent?: { id: string; username: string } | null
): Tweet {
  const id = postIdFromUri(post.uri);
  const currentDid = sessionDid;
  const tweet: Tweet = {
    id,
    text: getPostText(post.record),
    images: mapMedia(post.embed),
    card: mapCard(post.embed),
    quotedTweet: mapQuotedTweet(post.embed),
    parent: parent ?? null,
    userLikes: compactArray(
      post.likeCount ?? 0,
      post.viewer?.like && currentDid ? currentDid : undefined
    ),
    createdBy: post.author.did,
    createdAt: getPostCreatedAt(post.record, post.indexedAt),
    updatedAt: null,
    userReplies: post.replyCount ?? 0,
    userRetweets: compactArray(
      post.repostCount ?? 0,
      post.viewer?.repost && currentDid ? currentDid : undefined
    ),
    userQuotes: post.quoteCount ?? 0,
    bookmarkCount: getPostBookmarkCount(post)
  };

  postRefCache.set(id, { uri: post.uri, cid: post.cid });
  cachePostReplyRef(id, post.record);
  tweetCache.set(id, tweet);
  mapProfile(post.author);

  return tweet;
}

function getThreadParent(
  thread: AppBskyFeedDefs.ThreadViewPost
): { id: string; username: string } | null {
  const { parent } = thread;

  return AppBskyFeedDefs.isThreadViewPost(parent)
    ? {
        id: postIdFromUri(parent.post.uri),
        username: parent.post.author.handle
      }
    : null;
}

function mapThreadPost(thread: AppBskyFeedDefs.ThreadViewPost): TweetWithUser {
  return {
    ...mapPost(thread.post, getThreadParent(thread)),
    user: mapProfile(thread.post.author)
  };
}

function mapThreadParents(
  thread: AppBskyFeedDefs.ThreadViewPost
): TweetWithUser[] {
  const parents: TweetWithUser[] = [];
  let currentParent = thread.parent;

  while (AppBskyFeedDefs.isThreadViewPost(currentParent)) {
    parents.unshift(mapThreadPost(currentParent));
    currentParent = currentParent.parent;
  }

  return parents;
}

function getVisibleThreadReplies(
  thread: AppBskyFeedDefs.ThreadViewPost
): AppBskyFeedDefs.ThreadViewPost[] {
  return (thread.replies ?? []).filter(AppBskyFeedDefs.isThreadViewPost);
}

function compareThreadPostsByCreatedAt(
  a: AppBskyFeedDefs.ThreadViewPost,
  b: AppBskyFeedDefs.ThreadViewPost
): number {
  const createdAtDifference =
    getPostCreatedAt(a.post.record, a.post.indexedAt).toDate().getTime() -
    getPostCreatedAt(b.post.record, b.post.indexedAt).toDate().getTime();

  return createdAtDifference || a.post.uri.localeCompare(b.post.uri);
}

function collectAuthorThreadReplies(
  thread: AppBskyFeedDefs.ThreadViewPost,
  authorDid: string,
  seenUris: Set<string>
): AppBskyFeedDefs.ThreadViewPost[] {
  const authorReplies = getVisibleThreadReplies(thread)
    .filter((reply) => reply.post.author.did === authorDid)
    .sort(compareThreadPostsByCreatedAt);
  const threadReplies: AppBskyFeedDefs.ThreadViewPost[] = [];

  authorReplies.forEach((reply) => {
    if (seenUris.has(reply.post.uri)) return;

    seenUris.add(reply.post.uri);
    threadReplies.push(
      reply,
      ...collectAuthorThreadReplies(reply, authorDid, seenUris)
    );
  });

  return threadReplies;
}

function mapThreadReplies(thread: AppBskyFeedDefs.ThreadViewPost): {
  threadReplies: TweetWithUser[];
  replies: TweetWithUser[];
} {
  const threadReplyUris = new Set<string>();
  const authorThreadReplies = collectAuthorThreadReplies(
    thread,
    thread.post.author.did,
    threadReplyUris
  );
  const replies = getVisibleThreadReplies(thread).filter(
    (reply) => !threadReplyUris.has(reply.post.uri)
  );

  return {
    threadReplies: authorThreadReplies.map(mapThreadPost),
    replies: replies.map(mapThreadPost)
  };
}

function postHasVisibleMedia(post: AppBskyFeedDefs.PostView): boolean {
  return !!mapMedia(post.embed)?.length;
}

async function waitForPublishedPost(
  uri: string,
  requireMedia: boolean
): Promise<Tweet> {
  let lastError: unknown = null;

  for (
    let attempt = 0;
    attempt < BSKY_MEDIA_POST_VISIBILITY_RETRIES;
    attempt += 1
  ) {
    try {
      const post = (await getAppViewAgent().getPosts({ uris: [uri] })).data
        .posts[0];

      if (post && (!requireMedia || postHasVisibleMedia(post)))
        return mapPost(post);
    } catch (error) {
      lastError = error;
    }

    await wait(700 + attempt * 200);
  }

  if (requireMedia) {
    throw new Error(
      'Bluesky accepted the Tweet, but did not publish its attached image. Try a smaller image.'
    );
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Bluesky did not publish the Tweet.');
}

function mapFeedItem(item: ActorFeedPost): Tweet {
  const parent =
    item.reply?.parent && AppBskyFeedDefs.isPostView(item.reply.parent)
      ? {
          id: postIdFromUri(item.reply.parent.uri),
          username: item.reply.parent.author.handle
        }
      : null;

  const tweet = mapPost(item.post, parent);

  if (item.reason && AppBskyFeedDefs.isReasonRepost(item.reason)) {
    const repostedBy = item.reason.by.did;

    if (!tweet.userRetweets.includes(repostedBy))
      tweet.userRetweets = [repostedBy, ...tweet.userRetweets];
  }

  return tweet;
}

async function mapFeedItemsWithUsers(
  items: ActorFeedPost[]
): Promise<TweetWithUser[]> {
  const feed = items.map((item) => {
    const tweet = mapFeedItem(item);
    return { item, tweet };
  });
  const users = await hydrateProfiles(feed.map(({ item }) => item.post.author));
  const usersByDid = new Map(users.map((user) => [user.id, user]));

  return feed.map(({ item, tweet }) => ({
    ...tweet,
    user: usersByDid.get(tweet.createdBy) ?? mapProfile(item.post.author)
  }));
}

function isFollowedAuthor(tweet: Tweet): boolean {
  return (
    tweet.createdBy === sessionDid || currentFollowing.has(tweet.createdBy)
  );
}

function hasPhoto(tweet: Tweet): boolean {
  return !!tweet.images?.some((media) => !media.type?.includes('video'));
}

function hasVideo(tweet: Tweet): boolean {
  return !!tweet.images?.some((media) => media.type?.includes('video'));
}

export async function searchTweets(
  searchQuery: string,
  options?: {
    filter?: SearchPostFilter;
    people?: SearchPeopleFilter;
    cursor?: string;
    limit?: number;
  }
): Promise<SearchTweetsPage> {
  const trimmedQuery = searchQuery.trim();

  if (!trimmedQuery) return { tweets: [], cursor: null, hitsTotal: 0 };

  const filter = options?.filter ?? 'top';
  const apiLimit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
  const response = await getAppViewAgent().app.bsky.feed.searchPosts({
    q: trimmedQuery,
    sort: filter === 'latest' ? 'latest' : 'top',
    cursor: options?.cursor,
    limit: filter === 'photos' || filter === 'videos' ? 100 : apiLimit
  });

  const posts = response.data.posts.map((post) => ({
    post,
    tweet: mapPost(post)
  }));
  const users = await hydrateProfiles(posts.map(({ post }) => post.author));
  const usersByDid = new Map(users.map((user) => [user.id, user]));

  const tweets = posts
    .map(({ post, tweet }) => ({
      ...tweet,
      user: usersByDid.get(tweet.createdBy) ?? mapProfile(post.author)
    }))
    .filter((tweet) =>
      options?.people === 'followed' ? isFollowedAuthor(tweet) : true
    )
    .filter((tweet) => {
      if (filter === 'photos') return hasPhoto(tweet);
      if (filter === 'videos') return hasVideo(tweet);
      return true;
    })
    .slice(0, apiLimit);

  return {
    tweets,
    cursor: response.data.cursor ?? null,
    hitsTotal: response.data.hitsTotal ?? null
  };
}

export async function searchUsers(
  searchQuery: string,
  options?: {
    people?: SearchPeopleFilter;
    cursor?: string;
    limit?: number;
  }
): Promise<SearchUsersPage> {
  const trimmedQuery = searchQuery.trim();

  if (!trimmedQuery) return { users: [], cursor: null };

  const response = await getAppViewAgent().searchActors({
    q: trimmedQuery,
    cursor: options?.cursor,
    limit: Math.min(Math.max(options?.limit ?? 30, 1), 100)
  });
  const users = await hydrateProfiles(response.data.actors);

  return {
    users:
      options?.people === 'followed'
        ? users.filter(
            (user) => user.id === sessionDid || currentFollowing.has(user.id)
          )
        : users,
    cursor: response.data.cursor ?? null
  };
}

function mapGraphList(
  list: AppBskyGraphDefs.ListView,
  viewerState?: Partial<Pick<UserList, 'viewerMuted' | 'viewerBlocked'>>
): UserList {
  const creatorName = list.creator.displayName ?? list.creator.handle;

  return {
    uri: list.uri,
    url: getBskyWebUrl(list.uri),
    name: list.name,
    description: list.description ?? null,
    avatar: list.avatar ?? null,
    purpose:
      list.purpose === AppBskyGraphDefs.MODLIST ? 'moderation' : 'follow',
    listItemCount: list.listItemCount ?? 0,
    creatorName,
    creatorUsername: list.creator.handle,
    creatorAvatar: list.creator.avatar ?? DEFAULT_PROFILE_PHOTO_URL,
    viewerMuted: viewerState?.viewerMuted ?? !!list.viewer?.muted,
    viewerBlocked: viewerState?.viewerBlocked ?? !!list.viewer?.blocked,
    indexedAt: list.indexedAt ?? null
  };
}

function mergeUserLists(lists: UserList[]): UserList[] {
  const mergedLists = new Map<string, UserList>();

  for (const list of lists) {
    const existingList = mergedLists.get(list.uri);

    mergedLists.set(
      list.uri,
      existingList
        ? {
            ...existingList,
            viewerMuted: existingList.viewerMuted || list.viewerMuted,
            viewerBlocked: existingList.viewerBlocked || list.viewerBlocked
          }
        : list
    );
  }

  return Array.from(mergedLists.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

export async function getUserLists(tab: UserListTab): Promise<UserListsPage> {
  if (!sessionDid) throw new Error('Sign in with Bluesky first.');

  const api = getAppViewAgent();
  const ownedListsResponse = await api.app.bsky.graph.getLists({
    actor: sessionDid,
    limit: 100
  });
  const ownedLists = ownedListsResponse.data.lists.map((list) =>
    mapGraphList(list)
  );

  if (tab === 'follow')
    return {
      lists: ownedLists.filter(({ purpose }) => purpose === 'follow')
    };

  const [mutedListsResponse, blockedListsResponse] = await Promise.all([
    api.app.bsky.graph.getListMutes({ limit: 100 }).catch(() => null),
    api.app.bsky.graph.getListBlocks({ limit: 100 }).catch(() => null)
  ]);
  const mutedLists =
    mutedListsResponse?.data.lists.map((list) =>
      mapGraphList(list, { viewerMuted: true })
    ) ?? [];
  const blockedLists =
    blockedListsResponse?.data.lists.map((list) =>
      mapGraphList(list, { viewerBlocked: true })
    ) ?? [];
  const moderationLists = ownedLists.filter(
    ({ purpose }) => purpose === 'moderation'
  );

  return {
    lists: mergeUserLists([...moderationLists, ...mutedLists, ...blockedLists])
  };
}

export async function getFeedGeneratorPage(
  actor: string,
  rkey: string,
  cursor?: string,
  limit = 25
): Promise<FeedGeneratorPage> {
  const api = getAppViewAgent();
  const profileResponse = await api.getProfile({ actor });
  const feedUri = `at://${profileResponse.data.did}/app.bsky.feed.generator/${rkey}`;

  const [metadataResponse, feedResponse] = await Promise.all([
    api.app.bsky.feed.getFeedGenerator({ feed: feedUri }),
    api.app.bsky.feed.getFeed({
      feed: feedUri,
      cursor,
      limit: Math.min(Math.max(limit, 1), 100)
    })
  ]);

  return {
    uri: feedUri,
    displayName: metadataResponse.data.view.displayName,
    description: metadataResponse.data.view.description ?? null,
    avatar: metadataResponse.data.view.avatar ?? null,
    likeCount: metadataResponse.data.view.likeCount ?? 0,
    cursor: feedResponse.data.cursor ?? null,
    feed: await mapFeedItemsWithUsers(feedResponse.data.feed)
  };
}

export async function getDiscoverHomeFeedPage(
  cursor?: string,
  limit = 30
): Promise<HomeFeedPage> {
  const page = await getFeedGeneratorPage(
    'bsky.app',
    'whats-hot',
    cursor,
    limit
  );

  return {
    tweets: page.feed,
    cursor: page.cursor
  };
}

function isFeedGeneratorUri(uri: string): boolean {
  return /^at:\/\/[^/]+\/app\.bsky\.feed\.generator\/[^/]+$/.test(uri);
}

function getFeedGeneratorFallbackName(uri: string): string {
  const rkey = getRkeyFromAtUri(uri);
  if (!rkey) return 'Feed';

  return rkey.replace(/[-_]+/g, ' ');
}

function mapSubscribedHomeFeed(
  savedFeed: AppBskyActorDefs.SavedFeed,
  generator?: AppBskyFeedDefs.GeneratorView
): SubscribedHomeFeed {
  return {
    id: savedFeed.id,
    uri: savedFeed.value,
    displayName:
      generator?.displayName ?? getFeedGeneratorFallbackName(savedFeed.value),
    description: generator?.description ?? null,
    avatar: generator?.avatar ?? null,
    creatorName: generator?.creator.displayName ?? 'Bluesky',
    creatorUsername: generator?.creator.handle ?? 'bsky.app',
    pinned: savedFeed.pinned
  };
}

function isDefaultDiscoverFeed(feed: SubscribedHomeFeed): boolean {
  return (
    feed.creatorUsername === 'bsky.app' &&
    getRkeyFromAtUri(feed.uri) === 'whats-hot'
  );
}

async function getFeedGeneratorsByUri(
  feedUris: string[]
): Promise<Map<string, AppBskyFeedDefs.GeneratorView>> {
  const api = getAppViewAgent();
  const generators = new Map<string, AppBskyFeedDefs.GeneratorView>();

  for (let index = 0; index < feedUris.length; index += 25) {
    const feeds = feedUris.slice(index, index + 25);

    try {
      const response = await api.app.bsky.feed.getFeedGenerators({ feeds });

      for (const generator of response.data.feeds)
        generators.set(generator.uri, generator);
    } catch {
      // Saved feeds can include stale or unavailable generators; keep the rest.
    }
  }

  return generators;
}

export async function getSubscribedHomeFeeds(): Promise<SubscribedHomeFeed[]> {
  const prefs = await getAppViewAgent().getPreferences();
  const savedFeeds = prefs.savedFeeds.filter(
    (feed) => feed.type === 'feed' && isFeedGeneratorUri(feed.value)
  );
  const feedUris = Array.from(new Set(savedFeeds.map(({ value }) => value)));
  const generators = await getFeedGeneratorsByUri(feedUris);

  return savedFeeds
    .map((savedFeed) =>
      mapSubscribedHomeFeed(savedFeed, generators.get(savedFeed.value))
    )
    .filter((feed) => !isDefaultDiscoverFeed(feed));
}

export async function getSubscribedHomeFeedPage(
  feedUri: string,
  cursor?: string,
  limit = 30
): Promise<HomeFeedPage> {
  const response = await getAppViewAgent().app.bsky.feed.getFeed({
    feed: feedUri,
    cursor,
    limit: Math.min(Math.max(limit, 1), 100)
  });

  return {
    tweets: await mapFeedItemsWithUsers(response.data.feed),
    cursor: response.data.cursor ?? null
  };
}

export async function getFollowingHomeFeedPage(
  cursor?: string,
  limit = 30
): Promise<HomeFeedPage> {
  const response = await getAppViewAgent().getTimeline({
    cursor,
    limit: Math.min(Math.max(limit, 1), 100)
  });

  return {
    tweets: await mapFeedItemsWithUsers(response.data.feed),
    cursor: response.data.cursor ?? null
  };
}

function getNotificationTargetPostId(
  notification: AppBskyNotificationListNotifications.Notification
): string | null {
  if (notification.reason === 'follow') return null;

  const targetUri =
    notification.reason === 'like' || notification.reason === 'repost'
      ? notification.reasonSubject
      : notification.uri;

  return targetUri ? postIdFromUri(targetUri) : null;
}

function getNotificationPreviewPostUri(
  notification: AppBskyNotificationListNotifications.Notification
): string | null {
  if (notification.reason !== 'like' && notification.reason !== 'repost')
    return null;

  return notification.reasonSubject ?? null;
}

function getNotificationTweetUri(
  notification: AppBskyNotificationListNotifications.Notification
): string | null {
  if (notification.reason === 'follow') return null;

  return notification.reason === 'like' || notification.reason === 'repost'
    ? notification.reasonSubject ?? null
    : notification.uri;
}

async function getNotificationTweetByUri(
  notifications: AppBskyNotificationListNotifications.Notification[]
): Promise<Map<string, Tweet>> {
  const uris = Array.from(
    new Set(
      notifications
        .map(getNotificationTweetUri)
        .filter((uri): uri is string => !!uri)
    )
  );
  const tweetByUri = new Map<string, Tweet>();

  if (!uris.length) return tweetByUri;

  for (let index = 0; index < uris.length; index += 25) {
    try {
      const response = await getAppViewAgent().getPosts({
        uris: uris.slice(index, index + 25)
      });

      response.data.posts.forEach((post) => {
        tweetByUri.set(post.uri, mapPost(post));
      });
    } catch {
      // Activity rows can still render without a target Tweet preview.
    }
  }

  return tweetByUri;
}

function mapNotification(
  notification: AppBskyNotificationListNotifications.Notification,
  tweetByUri?: Map<string, Tweet>
): NotificationItem {
  const targetPostId = getNotificationTargetPostId(notification);
  const previewPostUri = getNotificationPreviewPostUri(notification);
  const tweetUri = getNotificationTweetUri(notification);
  const tweet = tweetUri ? tweetByUri?.get(tweetUri) ?? null : null;

  if (
    targetPostId &&
    ['mention', 'reply', 'quote'].includes(notification.reason)
  ) {
    postRefCache.set(targetPostId, {
      uri: notification.uri,
      cid: notification.cid
    });
  }

  return {
    id: postIdFromUri(notification.uri),
    user: mapProfile(notification.author),
    reason: notification.reason,
    text: previewPostUri
      ? tweetByUri?.get(previewPostUri)?.text ?? null
      : getPostText(notification.record),
    tweet,
    targetPostId,
    isRead: notification.isRead,
    createdAt: Timestamp.fromDate(new Date(notification.indexedAt))
  };
}

export async function listNotificationsPage(
  cursor?: string,
  options?: { mentionsOnly?: boolean; limit?: number }
): Promise<NotificationsPage> {
  const response = await getAppViewAgent().listNotifications({
    cursor,
    limit: Math.min(Math.max(options?.limit ?? 30, 1), 100),
    reasons: options?.mentionsOnly ? ['mention', 'reply', 'quote'] : undefined
  });
  const tweetByUri = await getNotificationTweetByUri(
    response.data.notifications
  );

  return {
    notifications: response.data.notifications.map((notification) =>
      mapNotification(notification, tweetByUri)
    ),
    cursor: response.data.cursor ?? null,
    seenAt: response.data.seenAt ?? null
  };
}

export async function markNotificationsSeen(): Promise<void> {
  await getAppViewAgent().updateSeenNotifications(
    new Date().toISOString() as Parameters<Agent['updateSeenNotifications']>[0]
  );
  notify();
}

type RawChatMessage =
  | ChatBskyConvoDefs.MessageView
  | ChatBskyConvoDefs.DeletedMessageView
  | { $type: string; [k: string]: unknown };

function getActorDid(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return null;

  const { did } = value as { did?: unknown };
  return typeof did === 'string' ? did : null;
}

function mapChatReactions(reactions: unknown): ChatReaction[] {
  if (!Array.isArray(reactions)) return [];

  return reactions
    .map((reaction) => {
      if (!reaction || typeof reaction !== 'object') return null;

      const reactionRecord = reaction as {
        value?: unknown;
        sender?: unknown;
        createdAt?: unknown;
      };
      const senderId = getActorDid(reactionRecord.sender);

      if (
        typeof reactionRecord.value !== 'string' ||
        !senderId ||
        typeof reactionRecord.createdAt !== 'string'
      ) {
        return null;
      }

      return {
        value: reactionRecord.value,
        senderId,
        createdAt: Timestamp.fromDate(new Date(reactionRecord.createdAt))
      };
    })
    .filter((reaction): reaction is ChatReaction => !!reaction);
}

function mapActorDids(values: unknown): string[] {
  if (!Array.isArray(values)) return [];

  return values
    .map(getActorDid)
    .filter((did): did is string => typeof did === 'string');
}

function mapChatMessage(message?: RawChatMessage): ChatMessage | null {
  if (!message || typeof message !== 'object') return null;

  const messageRecord = message as {
    id?: unknown;
    text?: unknown;
    sender?: { did?: unknown };
    sentAt?: unknown;
    reactions?: unknown;
    readBy?: unknown;
    seenBy?: unknown;
  };

  if (
    typeof messageRecord.id !== 'string' ||
    typeof messageRecord.sender?.did !== 'string' ||
    typeof messageRecord.sentAt !== 'string'
  ) {
    return null;
  }

  const text =
    typeof messageRecord.text === 'string' ? messageRecord.text : null;

  return {
    id: messageRecord.id,
    text,
    senderId: messageRecord.sender.did,
    sentAt: Timestamp.fromDate(new Date(messageRecord.sentAt)),
    deleted: text === null,
    reactions: mapChatReactions(messageRecord.reactions),
    readBy: mapActorDids(messageRecord.readBy ?? messageRecord.seenBy)
  };
}

function isRawChatConvoView(
  value: unknown
): value is ChatBskyConvoDefs.ConvoView {
  if (!value || typeof value !== 'object') return false;

  const convo = value as {
    id?: unknown;
    members?: unknown;
    muted?: unknown;
    unreadCount?: unknown;
  };

  return (
    typeof convo.id === 'string' &&
    Array.isArray(convo.members) &&
    typeof convo.muted === 'boolean' &&
    typeof convo.unreadCount === 'number'
  );
}

async function mapChatConvo(
  convo: ChatBskyConvoDefs.ConvoView
): Promise<ChatConvo> {
  const convoRecord = convo as ChatBskyConvoDefs.ConvoView & {
    opened?: unknown;
    status?: unknown;
  };
  const users = await hydrateProfiles(
    convo.members as unknown as ActorProfileView[]
  );
  const visibleMembers = users.filter((user) => user.id !== sessionDid);

  return {
    id: convo.id,
    muted: convo.muted,
    opened: !!convoRecord.opened,
    unreadCount: convo.unreadCount,
    status:
      typeof convoRecord.status === 'string' && convoRecord.status
        ? convoRecord.status
        : 'accepted',
    members: (visibleMembers.length ? visibleMembers : users).map(
      ({
        id,
        name,
        username,
        photoURL,
        verified,
        followingCount,
        followersCount,
        createdAt
      }) => ({
        id,
        name,
        username,
        photoURL,
        verified,
        followingCount,
        followersCount,
        createdAt
      })
    ),
    lastMessage: mapChatMessage(convo.lastMessage)
  };
}

function sortChatMessages(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort((a, b) => +a.sentAt.toDate() - +b.sentAt.toDate());
}

export async function getChatSettings(): Promise<ChatSettings> {
  await ensureChatAccessScope();

  if (!sessionDid) throw new ChatAccessError();

  try {
    const response = await getAgent().com.atproto.repo.getRecord({
      repo: sessionDid,
      collection: CHAT_DECLARATION_COLLECTION,
      rkey: 'self'
    });
    const record = response.data
      .value as Partial<ChatBskyActorDeclaration.Record>;

    return {
      allowIncoming: normalizeChatAllowIncoming(record.allowIncoming)
    };
  } catch (error) {
    if (isRecordNotFoundError(error)) return { allowIncoming: 'all' };

    throwChatError(error);
  }
}

export async function setChatSettings(
  allowIncoming: ChatAllowIncoming
): Promise<ChatSettings> {
  await ensureChatAccessScope();

  if (!sessionDid) throw new ChatAccessError();

  const normalizedAllowIncoming = normalizeChatAllowIncoming(allowIncoming);
  const record: ChatBskyActorDeclaration.Record = {
    $type: CHAT_DECLARATION_COLLECTION,
    allowIncoming: normalizedAllowIncoming
  };

  try {
    await getAgent().com.atproto.repo.putRecord({
      repo: sessionDid,
      collection: CHAT_DECLARATION_COLLECTION,
      rkey: 'self',
      record
    });
  } catch (error) {
    throwChatError(error);
  }

  notify();
  return { allowIncoming: normalizedAllowIncoming };
}

export async function listChatConvos(
  cursor?: string,
  limit = 30
): Promise<ChatConvoPage> {
  const response = await callChat(() =>
    getChatAgent().chat.bsky.convo.listConvos({
      cursor,
      limit: Math.min(Math.max(limit, 1), 100)
    })
  );

  return {
    cursor: response.data.cursor ?? null,
    convos: await Promise.all(response.data.convos.map(mapChatConvo))
  };
}

type RawChatConvoRequestsResponse = {
  cursor?: string;
  requests?: unknown[];
};

export async function listChatConvoRequests(
  cursor?: string,
  limit = 30
): Promise<ChatConvoRequestsPage> {
  const response = await callChatQueryXrpc<RawChatConvoRequestsResponse>(
    'chat.bsky.convo.listConvoRequests',
    {
      cursor,
      limit: Math.min(Math.max(limit, 1), 100)
    }
  );
  const requests = await Promise.all(
    (response.requests ?? [])
      .filter(isRawChatConvoView)
      .map((request) => mapChatConvo(request))
  );

  return {
    cursor: response.cursor ?? null,
    requests
  };
}

export async function getChatMessages(
  convoId: string,
  cursor?: string,
  limit = 50
): Promise<ChatMessagesPage> {
  const response = await callChat(() =>
    getChatAgent().chat.bsky.convo.getMessages({
      convoId,
      cursor,
      limit: Math.min(Math.max(limit, 1), 100)
    })
  );

  return {
    cursor: response.data.cursor ?? null,
    messages: sortChatMessages(
      response.data.messages
        .map(mapChatMessage)
        .filter((message): message is ChatMessage => !!message)
    )
  };
}

export async function sendChatMessage(
  convoId: string,
  text: string
): Promise<ChatMessage> {
  const trimmedText = text.trim();
  if (!trimmedText) throw new Error('Type a message first.');

  const api = getAgent();
  const richText = new RichText({ text: trimmedText }, { cleanNewlines: true });
  await richText.detectFacets(api);

  const response = await callChat(() =>
    getChatAgent().chat.bsky.convo.sendMessage({
      convoId,
      message: {
        text: richText.text,
        facets: richText.facets
      }
    })
  );
  const message = mapChatMessage(response.data);

  if (!message) throw new Error('Bluesky did not return the sent message.');

  notify();
  return message;
}

type ChatReactionResponse = {
  message?: RawChatMessage;
};

async function updateChatReaction(
  method: 'chat.bsky.convo.addReaction' | 'chat.bsky.convo.removeReaction',
  convoId: string,
  messageId: string,
  value: string
): Promise<ChatMessage> {
  const response = await callChatXrpc<ChatReactionResponse>(method, {
    convoId,
    messageId,
    value
  });
  const message = mapChatMessage(response.message);

  if (!message) {
    throw new Error('Bluesky did not return the reacted message.');
  }

  notify();
  return message;
}

export function addChatReaction(
  convoId: string,
  messageId: string,
  value: string
): Promise<ChatMessage> {
  return updateChatReaction(
    'chat.bsky.convo.addReaction',
    convoId,
    messageId,
    value
  );
}

export function removeChatReaction(
  convoId: string,
  messageId: string,
  value: string
): Promise<ChatMessage> {
  return updateChatReaction(
    'chat.bsky.convo.removeReaction',
    convoId,
    messageId,
    value
  );
}

export async function setChatConvoMuted(
  convoId: string,
  muted: boolean
): Promise<ChatConvo> {
  const response = await callChat(() =>
    muted
      ? getChatAgent().chat.bsky.convo.muteConvo({ convoId })
      : getChatAgent().chat.bsky.convo.unmuteConvo({ convoId })
  );

  notify();
  return mapChatConvo(response.data.convo);
}

export async function acceptChatConvo(convoId: string): Promise<ChatConvo> {
  await callChatXrpc<{ rev?: string }>('chat.bsky.convo.acceptConvo', {
    convoId
  });

  const response = await callChat(() =>
    getChatAgent().chat.bsky.convo.getConvo({ convoId })
  );

  notify();
  return mapChatConvo(response.data.convo);
}

export async function leaveChatConvo(convoId: string): Promise<void> {
  await callChat(() => getChatAgent().chat.bsky.convo.leaveConvo({ convoId }));
  notify();
}

export async function blockChatParticipant(actorDid: string): Promise<void> {
  if (!sessionDid) throw new Error('Sign in with Bluesky first.');

  await getAgent().app.bsky.graph.block.create(
    { repo: sessionDid },
    {
      subject: actorDid,
      createdAt: new Date().toISOString()
    }
  );
  notify();
}

export async function reportChatParticipant(actorDid: string): Promise<void> {
  await getAgent().createModerationReport({
    reasonType: 'com.atproto.moderation.defs#reasonOther',
    reason: 'Reported from a direct message conversation.',
    subject: {
      $type: 'com.atproto.admin.defs#repoRef',
      did: actorDid
    }
  });
}

export async function markChatConvoRead(
  convoId: string,
  messageId?: string
): Promise<void> {
  await callChat(() =>
    getChatAgent().chat.bsky.convo.updateRead({ convoId, messageId })
  );
  notify();
}

export async function getChatConvoForActor(actor: string): Promise<ChatConvo> {
  const user = await getUser(actor);

  if (!user) throw new Error('That Bluesky account could not be found.');
  if (user.id === sessionDid) {
    throw new Error('You cannot start a message thread with yourself.');
  }

  const response = await callChat(() =>
    getChatAgent().chat.bsky.convo.getConvoForMembers({
      members: [user.id]
    })
  );

  return mapChatConvo(response.data.convo);
}

async function refreshCurrentUser(): Promise<User | null> {
  if (!sessionDid) return null;

  const api = getAgent();
  const appView = getAppViewAgent();
  const [profileResponse, followsResponse] = await Promise.all([
    appView.getProfile({ actor: sessionDid }),
    appView.getFollows({ actor: sessionDid, limit: 100 }).catch(() => null)
  ]);

  currentFollowing = new Set(
    followsResponse?.data.follows.map((profile) => profile.did) ?? []
  );
  currentUser = mapProfile(profileResponse.data);
  currentUser.following = Array.from(currentFollowing);
  userCache.set(currentUser.id, currentUser);
  userHandleCache.set(currentUser.username, currentUser);

  void repairMalformedOwnImagePosts(api).catch(() => undefined);

  return currentUser;
}

function getStoredOAuthSub(): string | null {
  if (!hasStorage()) return null;
  return window.localStorage.getItem(OAUTH_SUB_KEY);
}

async function activateOAuthSession(
  nextSession: OAuthSession
): Promise<AuthUser | null> {
  const previousState = {
    agent,
    credentialAgent,
    oauthSession,
    sessionDid,
    currentUser,
    currentFollowing
  };

  try {
    const did = nextSession.did as unknown as string;

    oauthSession = nextSession;
    credentialAgent = null;
    sessionDid = did;
    agent = new Agent(nextSession);

    const user = await refreshCurrentUser();
    if (user) saveAccount(user);

    if (hasStorage()) window.localStorage.setItem(OAUTH_SUB_KEY, did);
    writeCredentialSession();
    notify();

    return user
      ? { uid: user.id, displayName: user.name, photoURL: user.photoURL }
      : null;
  } catch {
    agent = previousState.agent;
    credentialAgent = previousState.credentialAgent;
    oauthSession = previousState.oauthSession;
    sessionDid = previousState.sessionDid;
    currentUser = previousState.currentUser;
    currentFollowing = previousState.currentFollowing;
    return null;
  }
}

async function activateCredentialAgent(
  nextAgent: AtpAgent,
  shouldNotify = true
): Promise<AuthUser | null> {
  const previousState = {
    agent,
    credentialAgent,
    oauthSession,
    sessionDid,
    currentUser,
    currentFollowing
  };

  try {
    if (!nextAgent.session?.did) {
      throw new Error('Bluesky did not return a session.');
    }

    oauthSession = null;
    credentialAgent = nextAgent;
    agent = nextAgent;
    sessionDid = nextAgent.session.did;

    const user = await refreshCurrentUser();

    if (hasStorage()) window.localStorage.removeItem(OAUTH_SUB_KEY);
    writeCredentialSession(nextAgent.session);
    if (shouldNotify) notify();

    return user
      ? { uid: user.id, displayName: user.name, photoURL: user.photoURL }
      : null;
  } catch {
    agent = previousState.agent;
    credentialAgent = previousState.credentialAgent;
    oauthSession = previousState.oauthSession;
    sessionDid = previousState.sessionDid;
    currentUser = previousState.currentUser;
    currentFollowing = previousState.currentFollowing;
    return null;
  }
}

async function resumeCredentialAuthUser(): Promise<AuthUser | null> {
  const storedSession = readCredentialSession();
  if (!storedSession) return null;

  const nextAgent = createCredentialAgent();

  try {
    await nextAgent.resumeSession(storedSession);
    return activateCredentialAgent(nextAgent);
  } catch {
    writeCredentialSession();
    return null;
  }
}

export async function resumeAuthUser(): Promise<AuthUser | null> {
  if (oauthInitPromise) return oauthInitPromise;

  oauthInitPromise = (async (): Promise<AuthUser | null> => {
    const client = await getOAuthClient();
    const result = await client.init();

    if (result?.session) return activateOAuthSession(result.session);

    const storedSub = getStoredOAuthSub();
    if (storedSub) {
      try {
        const user = await activateOAuthSession(
          await client.restore(storedSub)
        );
        if (user) return user;

        removeSavedAccount(storedSub);
        if (hasStorage()) window.localStorage.removeItem(OAUTH_SUB_KEY);
      } catch {
        removeSavedAccount(storedSub);
        if (hasStorage()) window.localStorage.removeItem(OAUTH_SUB_KEY);
      }
    }

    return resumeCredentialAuthUser();
  })();

  return oauthInitPromise;
}

export async function signIn(identifier: string): Promise<AuthUser> {
  if (typeof window === 'undefined') {
    throw new Error('Bluesky sign-in is only available in the browser.');
  }

  const trimmedIdentifier = identifier.trim();
  if (!trimmedIdentifier) throw new Error('Enter your Bluesky handle or DID.');

  writeCredentialSession();
  credentialAgent = null;

  const client = await getOAuthClient();
  const nextSession = await client.signIn(trimmedIdentifier);
  const user = await activateOAuthSession(nextSession);

  if (!user) throw new Error('Bluesky did not return a profile.');

  return user;
}

async function restoreFirstSavedAccount(): Promise<AuthUser | null> {
  const accounts = readSavedAccounts();
  if (!accounts.length) return null;

  const client = await getOAuthClient();

  for (const account of accounts) {
    try {
      const user = await activateOAuthSession(await client.restore(account.id));
      if (user) return user;
    } catch {
      // Try the next saved account.
    }

    removeSavedAccount(account.id);
  }

  return null;
}

export function getSavedBlueskyAccounts(): SavedBlueskyAccount[] {
  return readSavedAccounts();
}

export async function switchBlueskyAccount(id: string): Promise<AuthUser> {
  const accountId = id.trim();
  if (!accountId) throw new Error('Choose an account to switch to.');

  if (accountId === sessionDid && currentUser) {
    return {
      uid: currentUser.id,
      displayName: currentUser.name,
      photoURL: currentUser.photoURL
    };
  }

  const client = await getOAuthClient();

  try {
    const user = await activateOAuthSession(await client.restore(accountId));
    if (!user) throw new Error('Bluesky did not return a profile.');
    return user;
  } catch (error) {
    removeSavedAccount(accountId);
    notify();

    throw new Error(
      error instanceof Error ? error.message : 'Unable to switch accounts.'
    );
  }
}

export async function removeBlueskyAccount(id: string): Promise<void> {
  const accountId = id.trim();
  if (!accountId) return;

  if (accountId === sessionDid || accountId === getStoredOAuthSub()) {
    await signOut();
    return;
  }

  try {
    const client = await getOAuthClient();
    await client.revoke(accountId);
  } catch {
    // Keep local account removal reliable if the provider cannot be reached.
  }

  removeSavedAccount(accountId);
  notify();
}

export async function signOut(): Promise<void> {
  const signedOutDid = sessionDid ?? getStoredOAuthSub();

  try {
    if (oauthSession) await oauthSession.signOut();
    else if (credentialAgent?.hasSession) await credentialAgent.logout();
    else {
      const client = await getOAuthClient();
      const storedSub = getStoredOAuthSub();
      if (storedSub) await client.revoke(storedSub);
    }
  } catch {
    // Keep local sign-out reliable if the network is down.
  }

  removeSavedAccount(signedOutDid);
  clearActiveAuthState();

  const restoredUser = await restoreFirstSavedAccount();
  if (restoredUser) return;

  notify();
}

export function getCurrentUser(): User | null {
  return currentUser;
}

export function getCurrentDid(): string | null {
  return sessionDid;
}

export function getCollection(path: string): BackendCollection {
  if (path === 'users') return { collectionName: 'users', path };
  if (path === 'tweets') return { collectionName: 'tweets', path };

  const bookmarksMatch = path.match(/^users\/([^/]+)\/bookmarks$/);
  if (bookmarksMatch) {
    return {
      collectionName: 'bookmarks',
      path,
      ownerId: bookmarksMatch[1]
    };
  }

  const statsMatch = path.match(/^users\/([^/]+)\/stats$/);
  if (statsMatch) {
    return { collectionName: 'stats', path, ownerId: statsMatch[1] };
  }

  return { collectionName: 'users', path };
}

function getLimit(constraints: BackendConstraint[]): number | undefined {
  return constraints.find(
    (constraint): constraint is QueryLimit => constraint.type === 'limit'
  )?.count;
}

function getWhere(
  constraints: BackendConstraint[],
  field: string,
  op?: string
): QueryFilter | undefined {
  return constraints.find(
    (constraint): constraint is QueryFilter =>
      constraint.type === 'where' &&
      constraint.field === field &&
      (!op || constraint.op === op)
  );
}

function sortByCreatedAt<T extends { createdAt: Timestamp }>(data: T[]): T[] {
  return [...data].sort(
    (a, b) => +b.createdAt.toDate() - +a.createdAt.toDate()
  );
}

function normalizeAtIdentifier(actor: string): string | null {
  const trimmedActor = actor.trim();
  if (!trimmedActor || trimmedActor === 'null') return null;

  if (trimmedActor.startsWith('did:')) {
    try {
      ensureValidDid(trimmedActor);
      return trimmedActor;
    } catch {
      return null;
    }
  }

  const normalizedHandle = trimmedActor.toLowerCase();
  return isValidHandle(normalizedHandle) ? normalizedHandle : null;
}

export async function getUser(actor: string): Promise<User | null> {
  const normalizedActor = normalizeAtIdentifier(actor);
  if (!normalizedActor) return null;

  const cachedUser = getCachedUser(normalizedActor);
  if (cachedUser && detailedUserCache.has(cachedUser.id)) return cachedUser;

  try {
    const response = await getAppViewAgent().getProfile({
      actor: normalizedActor
    });
    return mapProfile(response.data);
  } catch (error) {
    if (isRecordNotFoundError(error)) return null;
    throw error;
  }
}

export async function getTweet(id: string): Promise<Tweet | null> {
  if (!id || id === 'null') return null;
  if (tweetCache.has(id)) return tweetCache.get(id) as Tweet;

  const uri = uriFromPostId(id);
  const response = await getAppViewAgent().getPosts({ uris: [uri] });
  const post = response.data.posts[0];

  return post ? mapPost(post) : null;
}

export async function getTweetThread(
  id: string
): Promise<TweetThreadPage | null> {
  if (!agent) return null;
  if (!id || id === 'null') return null;

  const uri = uriFromPostId(id);

  try {
    const response = await getAppViewAgent().getPostThread({
      uri,
      depth: BSKY_THREAD_REPLY_DEPTH,
      parentHeight: 100
    });
    const { thread } = response.data;

    if (!AppBskyFeedDefs.isThreadViewPost(thread)) return null;

    const { threadReplies, replies } = mapThreadReplies(thread);

    return {
      tweet: mapThreadPost(thread),
      parents: mapThreadParents(thread),
      threadReplies,
      replies
    };
  } catch (error) {
    if (isRecordNotFoundError(error)) return null;
    throw error;
  }
}

async function getPostRef(id: string): Promise<PostRef | null> {
  const cachedRef = postRefCache.get(id);
  if (cachedRef) return cachedRef;

  const tweet = await getTweet(id);
  if (!tweet) return null;

  return postRefCache.get(tweet.id) ?? null;
}

export async function listTweetStatsPage(
  tweetId: string,
  type: TweetStatsType,
  cursor?: string,
  limit = 25
): Promise<TweetStatsPage> {
  const ref = await getPostRef(tweetId);
  const pageLimit = Math.min(Math.max(limit, 1), 100);

  if (!ref) return { users: [], tweets: [], cursor: null };

  if (type === 'likes') {
    const response = await getAppViewAgent().getLikes({
      uri: ref.uri,
      cid: ref.cid,
      cursor,
      limit: pageLimit
    });

    return {
      users: await hydrateProfiles(
        response.data.likes.map(({ actor }) => actor)
      ),
      tweets: [],
      cursor: response.data.cursor ?? null
    };
  }

  if (type === 'retweets') {
    const response = await getAppViewAgent().getRepostedBy({
      uri: ref.uri,
      cid: ref.cid,
      cursor,
      limit: pageLimit
    });

    return {
      users: await hydrateProfiles(response.data.repostedBy),
      tweets: [],
      cursor: response.data.cursor ?? null
    };
  }

  const response = await getAppViewAgent().app.bsky.feed.getQuotes({
    uri: ref.uri,
    cid: ref.cid,
    cursor,
    limit: pageLimit
  });
  const quotePosts = response.data.posts.map((post) => ({
    post,
    tweet: mapPost(post)
  }));
  const users = await hydrateProfiles(
    quotePosts.map(({ post }) => post.author)
  );
  const usersByDid = new Map(users.map((user) => [user.id, user]));

  return {
    users: [],
    tweets: quotePosts.map(({ post, tweet }) => ({
      ...tweet,
      user: usersByDid.get(tweet.createdBy) ?? mapProfile(post.author)
    })),
    cursor: response.data.cursor ?? null
  };
}

async function getTimeline(limitCount?: number): Promise<Tweet[]> {
  const response = await getAppViewAgent().getTimeline({
    limit: limitCount ?? 30
  });
  return response.data.feed.map(mapFeedItem);
}

async function getAuthorFeed(
  actor: string,
  options?: { includeReplies?: boolean; onlyMedia?: boolean }
): Promise<Tweet[]> {
  const response = await getAppViewAgent().getAuthorFeed({
    actor,
    limit: 50,
    filter: options?.includeReplies ? 'posts_with_replies' : 'posts_no_replies'
  });
  const tweets = response.data.feed
    .filter((item) => item.post.author.did === actor)
    .map(mapFeedItem);
  return options?.onlyMedia ? tweets.filter((tweet) => !!tweet.images) : tweets;
}

async function getRepostedFeed(actor: string): Promise<Tweet[]> {
  const response = await getAppViewAgent().getAuthorFeed({
    actor,
    limit: 50,
    filter: 'posts_no_replies'
  });

  return response.data.feed
    .filter(
      (item) =>
        item.post.author.did !== actor &&
        item.reason &&
        AppBskyFeedDefs.isReasonRepost(item.reason) &&
        item.reason.by.did === actor
    )
    .map(mapFeedItem);
}

async function getLikedFeed(actor: string): Promise<Tweet[]> {
  const response = await getAppViewAgent()
    .getActorLikes({ actor, limit: 50 })
    .catch((error) => {
      if (isRecordNotFoundError(error)) return null;
      throw error;
    });

  if (!response) return [];

  return response.data.feed.map((item) => {
    const tweet = mapFeedItem(item);
    if (!tweet.userLikes.includes(actor)) tweet.userLikes.unshift(actor);
    return tweet;
  });
}

async function getThreadReplies(id: string): Promise<Tweet[]> {
  const uri = uriFromPostId(id);
  const response = await getAppViewAgent().getPostThread({ uri, depth: 2 });
  const thread = response.data.thread;

  if (!AppBskyFeedDefs.isThreadViewPost(thread)) return [];

  const replies = thread.replies ?? [];
  return replies.filter(AppBskyFeedDefs.isThreadViewPost).map((reply) =>
    mapPost(reply.post, {
      id,
      username: thread.post.author.handle
    })
  );
}

async function queryUsers(constraints: BackendConstraint[]): Promise<User[]> {
  const usernameFilter = getWhere(constraints, 'username', '==');
  if (typeof usernameFilter?.value === 'string') {
    const user = await getUser(usernameFilter.value);
    return user ? [user] : [];
  }

  const followingFilter = getWhere(constraints, 'followers', 'array-contains');
  if (typeof followingFilter?.value === 'string') {
    const response = await getAppViewAgent().getFollows({
      actor: followingFilter.value,
      limit: getLimit(constraints) ?? 50
    });
    return hydrateProfiles(response.data.follows);
  }

  const followersFilter = getWhere(constraints, 'following', 'array-contains');
  if (typeof followersFilter?.value === 'string') {
    const response = await getAppViewAgent().getFollowers({
      actor: followersFilter.value,
      limit: getLimit(constraints) ?? 50
    });
    return hydrateProfiles(response.data.followers);
  }

  const response = await getAppViewAgent().getSuggestions({
    limit: getLimit(constraints) ?? 20
  });
  const excludeId = getWhere(constraints, 'id', '!=')?.value;

  const users = await hydrateProfiles(response.data.actors);

  return users.filter((user) => user.id !== excludeId);
}

async function queryTweets(constraints: BackendConstraint[]): Promise<Tweet[]> {
  const createdBy = getWhere(constraints, 'createdBy', '==')?.value;
  const likedBy = getWhere(constraints, 'userLikes', 'array-contains')?.value;
  const retweetedBy = getWhere(
    constraints,
    'userRetweets',
    'array-contains'
  )?.value;
  const parentEq = getWhere(constraints, 'parent', '==');
  const parentId = getWhere(constraints, 'parent.id', '==')?.value;
  const imageFilter = getWhere(constraints, 'images', '!=');
  const limitCount = getLimit(constraints);

  if (typeof parentId === 'string') return getThreadReplies(parentId);

  if (typeof likedBy === 'string') return getLikedFeed(likedBy);

  if (typeof retweetedBy === 'string')
    return sortByCreatedAt(await getRepostedFeed(retweetedBy)).slice(
      0,
      limitCount
    );

  if (typeof createdBy === 'string') {
    const tweets = await getAuthorFeed(createdBy, {
      includeReplies: !parentEq,
      onlyMedia: !!imageFilter
    });

    return sortByCreatedAt(tweets).slice(0, limitCount);
  }

  if (parentEq?.value === null) return getTimeline(limitCount);

  return getTimeline(limitCount);
}

async function readBookmarks(_userId: string): Promise<Bookmark[]> {
  void _userId;

  const bookmarks: Bookmark[] = [];
  let cursor: string | undefined;

  do {
    const response = await callAppQueryXrpc<BookmarksResponse>(
      'app.bsky.bookmark.getBookmarks',
      { limit: 100, cursor }
    );

    response.bookmarks.forEach(({ subject, item, createdAt }) => {
      if (!subject) return;

      const id = postIdFromUri(subject.uri);

      postRefCache.set(id, subject);
      if (AppBskyFeedDefs.isPostView(item))
        mapPost(item as AppBskyFeedDefs.PostView);
      bookmarks.push({
        id,
        createdAt: createdAt
          ? Timestamp.fromDate(new Date(createdAt))
          : Timestamp.now()
      });
    });

    cursor = response.cursor;
  } while (cursor);

  return bookmarks;
}

export async function queryCollection<T>(
  collectionName: CollectionName,
  constraints: BackendConstraint[],
  ownerId?: string
): Promise<T[]> {
  if (!agent) return [];

  if (collectionName === 'users')
    return (await queryUsers(constraints)) as unknown as T[];
  if (collectionName === 'tweets')
    return (await queryTweets(constraints)) as unknown as T[];
  if (collectionName === 'bookmarks')
    return (await readBookmarks(ownerId ?? '')) as unknown as T[];

  const likes = ownerId
    ? (await getLikedFeed(ownerId)).map((tweet) => tweet.id)
    : [];
  const stats: Stats = { likes, tweets: [], updatedAt: null };
  return [stats] as unknown as T[];
}

export async function getDocument<T>(
  collectionName: CollectionName,
  id: string,
  ownerId?: string
): Promise<T | null> {
  if (!agent) return null;

  if (collectionName === 'users')
    return (await getUser(id)) as unknown as T | null;
  if (collectionName === 'tweets')
    return (await getTweet(id)) as unknown as T | null;
  if (collectionName === 'bookmarks') {
    const bookmark = (await readBookmarks(ownerId ?? '')).find(
      (item) => item.id === id
    );
    return (bookmark ?? null) as unknown as T | null;
  }

  const stats: Stats = { likes: [], tweets: [], updatedAt: null };
  return stats as unknown as T;
}

async function getQuoteRef(
  quoteTarget?: AddTweetData['quoteTarget']
): Promise<PostRef | undefined> {
  if (!quoteTarget) return undefined;

  const cachedRef = postRefCache.get(quoteTarget.id);
  if (cachedRef) return cachedRef;
  if (!quoteTarget.createdBy) return undefined;

  const uri = `at://${quoteTarget.createdBy}/app.bsky.feed.post/${quoteTarget.id}`;
  const post = (await getAppViewAgent().getPosts({ uris: [uri] })).data
    .posts[0];
  if (!post) return undefined;

  const ref = { uri: post.uri, cid: post.cid };
  postRefCache.set(quoteTarget.id, ref);
  return ref;
}

function getRepoFromAtUri(uri: string): string | null {
  return /^at:\/\/([^/]+)\//.exec(uri)?.[1] ?? null;
}

function getRkeyFromAtUri(uri: string): string | null {
  return uri.split('/').pop() ?? null;
}

function getThreadgateAllow(
  replySetting?: TweetReplySetting
): AppBskyFeedThreadgate.Record['allow'] | undefined {
  if (!replySetting || replySetting === 'everyone') return undefined;
  if (replySetting === 'none') return [];
  if (replySetting === 'following')
    return [{ $type: 'app.bsky.feed.threadgate#followingRule' }];
  if (replySetting === 'followers')
    return [{ $type: 'app.bsky.feed.threadgate#followerRule' }];

  return [{ $type: 'app.bsky.feed.threadgate#mentionRule' }];
}

async function createThreadgate(
  api: Agent,
  postUri: string,
  replySetting?: TweetReplySetting
): Promise<void> {
  const allow = getThreadgateAllow(replySetting);
  if (allow === undefined) return;

  const repo = getRepoFromAtUri(postUri);
  const rkey = getRkeyFromAtUri(postUri);
  if (!repo || !rkey) return;

  await api.app.bsky.feed.threadgate.create(
    {
      repo,
      rkey
    },
    {
      post: postUri,
      allow,
      createdAt: new Date().toISOString()
    }
  );
}

type AddTweetData = Partial<Tweet> & {
  quoteTarget?: { id: string; createdBy: string };
  replySetting?: TweetReplySetting;
};

export async function addTweet(data: AddTweetData): Promise<Tweet> {
  const api = getAgent();
  const text = data.text ?? '';
  const richText = new RichText({ text }, { cleanNewlines: true });
  await richText.detectFacets(api);

  const images = stagedImages.get(data.createdBy ?? '') ?? [];
  stagedImages.delete(data.createdBy ?? '');

  const mediaEmbed = images.length
    ? {
        $type: 'app.bsky.embed.images',
        images: await Promise.all(
          images.slice(0, 4).map(async ({ file, preview }) => {
            const preparedImage = await prepareImageForBluesky(file);
            const upload = await api.uploadBlob(preparedImage.file, {
              encoding: preparedImage.encoding
            });

            return {
              image: toPdsCompatibleBlobRef(
                upload.data.blob,
                preparedImage.file.size
              ),
              alt: preview.alt || '',
              aspectRatio: preparedImage.aspectRatio
            };
          })
        )
      }
    : undefined;
  const quoteRef = await getQuoteRef(data.quoteTarget);
  const quoteEmbed = quoteRef
    ? {
        $type: 'app.bsky.embed.record',
        record: quoteRef
      }
    : undefined;
  const embed =
    mediaEmbed && quoteEmbed
      ? {
          $type: 'app.bsky.embed.recordWithMedia',
          record: quoteEmbed,
          media: mediaEmbed
        }
      : mediaEmbed ?? quoteEmbed;

  const parentId = data.parent?.id;
  const parentRef = parentId ? await getPostRef(parentId) : undefined;
  if (parentId && !parentRef)
    throw new Error('Reply target was not available.');

  const parentReplyRef = parentId ? postReplyRefCache.get(parentId) : undefined;
  const replyRef = parentRef
    ? {
        root: parentReplyRef?.root ?? parentRef,
        parent: parentRef
      }
    : undefined;

  const postRecord: AppBskyFeedPost.Record = {
    $type: 'app.bsky.feed.post',
    text: richText.text,
    facets: richText.facets,
    embed,
    reply: replyRef,
    createdAt: new Date().toISOString()
  };
  const result = await api.post(postRecord);
  await createThreadgate(api, result.uri, data.replySetting);

  const localTweet: Tweet = {
    id: postIdFromUri(result.uri),
    text: richText.text || null,
    images: images.length ? images.map(({ preview }) => preview) : null,
    card: null,
    quotedTweet: data.quotedTweet ?? null,
    parent: data.parent ?? null,
    userLikes: [],
    createdBy: sessionDid ?? '',
    createdAt: Timestamp.now(),
    updatedAt: null,
    userReplies: 0,
    userRetweets: [],
    userQuotes: data.userQuotes ?? 0,
    bookmarkCount: data.bookmarkCount ?? 0
  };
  let visibleTweet = localTweet;

  if (mediaEmbed) {
    try {
      visibleTweet = {
        ...(await waitForPublishedPost(result.uri, true)),
        parent: localTweet.parent
      };
    } catch (error) {
      await api.deletePost(result.uri).catch(() => undefined);
      throw error;
    }
  }

  postRefCache.set(visibleTweet.id, result);
  if (replyRef) postReplyRefCache.set(visibleTweet.id, replyRef);
  tweetCache.set(visibleTweet.id, visibleTweet);
  notify();

  return visibleTweet;
}

export function stageImages(userId: string, files: FilesWithId): ImagesPreview {
  const previews = files.map((file) => ({
    id: file.id,
    src: URL.createObjectURL(file),
    alt: file.name,
    type: file.type
  }));

  stagedImages.set(
    userId,
    files.map((file, index) => ({ file, preview: previews[index] }))
  );

  return previews;
}

async function fetchStoredBlobSize(
  api: Agent,
  blob: StrictBlobRef
): Promise<number | null> {
  if (!sessionDid) return null;

  try {
    const response = await api.com.atproto.sync.getBlob({
      did: sessionDid,
      cid: String(blob.ref)
    });

    return response.data.byteLength > 0 ? response.data.byteLength : null;
  } catch {
    return null;
  }
}

async function normalizeProfileBlobForWrite(
  api: Agent,
  blob: unknown
): Promise<BlobRef | null> {
  if (!blob) return null;

  let parsedBlob: StrictBlobRef;

  try {
    parsedBlob = parseBlobRef(blob);
  } catch {
    return null;
  }

  const size =
    getBlobRefSize(parsedBlob) ?? (await fetchStoredBlobSize(api, parsedBlob));

  if (!size)
    throw new Error(
      'Bluesky did not provide a size for existing profile media.'
    );

  return toPdsCompatibleBlobRef(parsedBlob, size);
}

async function normalizeProfileRecordForWrite(
  api: Agent,
  profile: Partial<AppBskyActorProfile.Record>
): Promise<Partial<AppBskyActorProfile.Record>> {
  const nextProfile = { ...profile };

  if ('avatar' in nextProfile) {
    const avatar = await normalizeProfileBlobForWrite(api, nextProfile.avatar);
    if (avatar) nextProfile.avatar = avatar;
    else delete nextProfile.avatar;
  }

  if ('banner' in nextProfile) {
    const banner = await normalizeProfileBlobForWrite(api, nextProfile.banner);
    if (banner) nextProfile.banner = banner;
    else delete nextProfile.banner;
  }

  return nextProfile;
}

async function upsertProfileRecord(
  api: Agent,
  updateRecord: (
    existing: Partial<AppBskyActorProfile.Record>
  ) => Partial<AppBskyActorProfile.Record>
): Promise<void> {
  await api.upsertProfile(async (existing) => {
    const updated = (await normalizeProfileRecordForWrite(
      api,
      updateRecord(existing ?? {})
    )) as AppBskyActorProfile.Record;
    updated.$type = 'app.bsky.actor.profile';
    return updated;
  });
}

function normalizeProfileWebsiteForWrite(
  value: string | null | undefined
): string | null {
  const trimmedValue = value?.trim();

  if (!trimmedValue) return null;

  return /^[a-z][a-z0-9+.-]*:/i.test(trimmedValue)
    ? trimmedValue
    : `https://${trimmedValue}`;
}

export async function updateProfile(
  userId: string,
  data: Partial<User>,
  mediaFiles?: ProfileMediaFiles
): Promise<void> {
  writeThemeOverride(userId, data);

  const avatarFile = mediaFiles?.photoURL?.[0];
  const bannerFile = mediaFiles?.coverPhotoURL?.[0];
  const api = getAgent();
  const [avatarUpload, bannerUpload] = await Promise.all([
    avatarFile
      ? prepareProfileImageForBluesky(avatarFile).then((preparedImage) =>
          api
            .uploadBlob(preparedImage.file, {
              encoding: preparedImage.encoding
            })
            .then(
              ({ data }) =>
                toPdsCompatibleBlobRef(
                  data.blob,
                  preparedImage.file.size
                ) as AppBskyActorProfile.Record['avatar']
            )
        )
      : null,
    bannerFile
      ? prepareProfileImageForBluesky(bannerFile).then((preparedImage) =>
          api
            .uploadBlob(preparedImage.file, {
              encoding: preparedImage.encoding
            })
            .then(
              ({ data }) =>
                toPdsCompatibleBlobRef(
                  data.blob,
                  preparedImage.file.size
                ) as AppBskyActorProfile.Record['banner']
            )
        )
      : null
  ]);
  const shouldUpdateProfile =
    'name' in data ||
    'bio' in data ||
    'pronouns' in data ||
    'website' in data ||
    !!avatarUpload ||
    !!bannerUpload ||
    ('coverPhotoURL' in data && data.coverPhotoURL === null);

  if (shouldUpdateProfile) {
    await upsertProfileRecord(api, (existing) => {
      const nextProfile = { ...existing };

      if ('name' in data) nextProfile.displayName = data.name ?? '';
      if ('bio' in data) nextProfile.description = data.bio ?? '';
      if ('pronouns' in data) {
        const nextPronouns = data.pronouns?.trim();

        if (nextPronouns) nextProfile.pronouns = nextPronouns;
        else delete nextProfile.pronouns;
      }
      if ('website' in data) {
        const nextWebsite = normalizeProfileWebsiteForWrite(data.website);

        if (nextWebsite) nextProfile.website = nextWebsite;
        else delete nextProfile.website;
      }
      if (avatarUpload) nextProfile.avatar = avatarUpload;
      if (bannerUpload) nextProfile.banner = bannerUpload;
      else if ('coverPhotoURL' in data && data.coverPhotoURL === null)
        delete nextProfile.banner;

      return nextProfile;
    });
  }

  await refreshCurrentUser().catch(() => null);
  applyLocalProfileUpdate(userId, data);
  notify();
}

export async function followUser(targetDid: string): Promise<void> {
  const targetUser = userCache.get(targetDid);
  const wasFollowing =
    currentFollowing.has(targetDid) ||
    !!(targetUser && sessionDid && targetUser.followers.includes(sessionDid));

  await getAgent().follow(targetDid);
  currentFollowing.add(targetDid);
  if (currentUser) {
    currentUser.following = Array.from(currentFollowing);
    if (!wasFollowing) currentUser.followingCount += 1;
  }

  if (targetUser && sessionDid && !targetUser.followers.includes(sessionDid)) {
    targetUser.followers = [sessionDid, ...targetUser.followers];
    targetUser.followersCount += 1;
  }

  notify();
}

export async function unfollowUser(targetDid: string): Promise<void> {
  const targetUser = userCache.get(targetDid);
  const wasFollowing =
    currentFollowing.has(targetDid) ||
    !!(targetUser && sessionDid && targetUser.followers.includes(sessionDid));
  const followUri =
    followUriCache.get(targetDid) ??
    (await getAppViewAgent().getProfile({ actor: targetDid })).data.viewer
      ?.following;

  if (followUri) await getAgent().deleteFollow(followUri);
  currentFollowing.delete(targetDid);
  followUriCache.delete(targetDid);
  if (currentUser) {
    currentUser.following = Array.from(currentFollowing);
    if (wasFollowing) {
      currentUser.followingCount = Math.max(0, currentUser.followingCount - 1);
    }
  }

  if (targetUser && sessionDid) {
    const wasFollower = targetUser.followers.includes(sessionDid);
    targetUser.followers = targetUser.followers.filter(
      (id) => id !== sessionDid
    );
    if (wasFollower) {
      targetUser.followersCount = Math.max(0, targetUser.followersCount - 1);
    }
  }

  notify();
}

export async function likePost(
  tweetId: string,
  type?: 'like' | 'unlike'
): Promise<void> {
  const tweet = await getTweet(tweetId);
  const ref = postRefCache.get(tweetId);
  if (!tweet || !ref || !sessionDid) return;

  const liked = tweet.userLikes.includes(sessionDid);
  const shouldLike = type ? type === 'like' : !liked;
  if (shouldLike === liked) return;

  if (!shouldLike) {
    const post = (await getAppViewAgent().getPosts({ uris: [ref.uri] })).data
      .posts[0];
    if (post?.viewer?.like) await getAgent().deleteLike(post.viewer.like);
    tweet.userLikes = tweet.userLikes.filter((id) => id !== sessionDid);
  } else {
    await getAgent().like(ref.uri, ref.cid);
    tweet.userLikes = [sessionDid, ...tweet.userLikes];
  }

  notify();
}

export async function repostPost(
  tweetId: string,
  type?: 'retweet' | 'unretweet'
): Promise<void> {
  const tweet = await getTweet(tweetId);
  const ref = postRefCache.get(tweetId);
  if (!tweet || !ref || !sessionDid) return;

  const reposted = tweet.userRetweets.includes(sessionDid);
  const shouldRepost = type ? type === 'retweet' : !reposted;
  if (shouldRepost === reposted) return;

  if (!shouldRepost) {
    const post = (await getAppViewAgent().getPosts({ uris: [ref.uri] })).data
      .posts[0];
    if (post?.viewer?.repost) await getAgent().deleteRepost(post.viewer.repost);
    tweet.userRetweets = tweet.userRetweets.filter((id) => id !== sessionDid);
  } else {
    await getAgent().repost(ref.uri, ref.cid);
    tweet.userRetweets = [sessionDid, ...tweet.userRetweets];
  }

  notify();
}

export async function deletePost(tweetId: string): Promise<void> {
  const ref = postRefCache.get(tweetId);
  if (!ref) return;

  await getAgent().deletePost(ref.uri);
  tweetCache.delete(tweetId);
  notify();
}

export async function setBookmark(
  _userId: string,
  tweetId: string,
  bookmarked: boolean
): Promise<void> {
  void _userId;

  const ref = postRefCache.get(tweetId);
  if (!ref) throw new Error('Tweet reference was not available to bookmark.');

  await callAppXrpc(
    bookmarked
      ? 'app.bsky.bookmark.createBookmark'
      : 'app.bsky.bookmark.deleteBookmark',
    bookmarked ? ref : { uri: ref.uri }
  );
  notify();
}

export async function clearBookmarks(userId: string): Promise<void> {
  const bookmarks = await readBookmarks(userId);

  await Promise.all(
    bookmarks.map(async ({ id }) => {
      const ref = postRefCache.get(id);
      if (ref)
        await callAppXrpc('app.bsky.bookmark.deleteBookmark', {
          uri: ref.uri
        });
    })
  );

  notify();
}
