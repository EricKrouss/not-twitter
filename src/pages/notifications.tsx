import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import cn from 'clsx';
import useSWR from 'swr';
import { toast } from 'react-hot-toast';
import {
  listNotificationsPage,
  markNotificationsSeen
} from '@lib/atproto/backend';
import { manageBookmark, manageLike, manageRetweet } from '@lib/atproto/utils';
import { useAuth } from '@lib/context/auth-context';
import { useLiveUpdates } from '@lib/context/live-updates-context';
import { useModal } from '@lib/hooks/useModal';
import { formatDate, formatNumber } from '@lib/date';
import {
  getNotificationsPath,
  getNotificationsTab,
  getTweetPath,
  getUserPath
} from '@lib/routes';
import { preventBubbling } from '@lib/utils';
import { HomeLayout, ProtectedLayout } from '@components/layout/common-layout';
import { MainLayout } from '@components/layout/main-layout';
import { Modal } from '@components/modal/modal';
import { TweetReplyModal } from '@components/modal/tweet-reply-modal';
import { SEO } from '@components/common/seo';
import { MainContainer } from '@components/home/main-container';
import { MobileSidebar } from '@components/sidebar/mobile-sidebar';
import { UserAvatar } from '@components/user/user-avatar';
import { UserName } from '@components/user/user-name';
import { UserUsername } from '@components/user/user-username';
import { Button } from '@components/ui/button';
import { CustomIcon } from '@components/ui/custom-icon';
import { HeroIcon } from '@components/ui/hero-icon';
import { Loading } from '@components/ui/loading';
import { Error as ErrorMessage } from '@components/ui/error';
import { ToolTip } from '@components/ui/tooltip';
import { TweetEmbed } from '@components/tweet/tweet-embed';
import { TweetRetweetMenu } from '@components/tweet/tweet-retweet-menu';
import { TweetText } from '@components/tweet/tweet-text';
import type {
  NotificationItem,
  NotificationReason,
  NotificationsPage
} from '@lib/atproto/backend';
import type { NotificationsTab } from '@lib/routes';
import type { CustomIconName } from '@components/ui/custom-icon';
import type { IconName } from '@components/ui/hero-icon';
import type { ReactElement, ReactNode } from 'react';

type NotificationsTabData = {
  label: string;
  value: NotificationsTab;
};

type ReasonMeta = {
  action: string;
  color: string;
  iconName?: CustomIconName;
  heroIconName?: IconName;
};

type MentionAction = {
  kind: 'reply' | 'retweet' | 'like' | 'bookmark' | 'share';
  label: string;
  iconName: CustomIconName;
  hoverClassName: string;
  activeClassName?: string;
};

type NotificationGroup = {
  id: string;
  reason: NotificationReason;
  users: NotificationItem['user'][];
  text: string | null;
  tweet: NotificationItem['tweet'];
  targetPostId: string | null;
  isRead: boolean;
  createdAt: NotificationItem['createdAt'];
  latestNotification: NotificationItem;
};

const FOLLOW_GROUP_WINDOW_MS = 12 * 60 * 60 * 1000;
const NOTIFICATIONS_PAGE_SIZE = 80;
const NOTIFICATIONS_REFRESH_INTERVAL_MS = 15000;
const mentionActions: Readonly<MentionAction[]> = [
  {
    kind: 'reply',
    label: 'Reply',
    iconName: 'TwitterReplyIcon',
    hoverClassName: 'hover:bg-main-accent/10 hover:text-main-accent'
  },
  {
    kind: 'retweet',
    label: 'Retweet',
    iconName: 'TwitterRetweetIcon',
    hoverClassName: 'hover:bg-[#00BA7C]/10 hover:text-[#00BA7C]',
    activeClassName: '!text-[#00BA7C] dark:!text-[#00BA7C]'
  },
  {
    kind: 'like',
    label: 'Like',
    iconName: 'TwitterLikeIcon',
    hoverClassName: 'hover:bg-[#F91880]/10 hover:text-[#F91880]',
    activeClassName: '!text-[#F91880] dark:!text-[#F91880]'
  },
  {
    kind: 'bookmark',
    label: 'Bookmark',
    iconName: 'TwitterBookmarksIcon',
    hoverClassName: 'hover:bg-main-accent/10 hover:text-main-accent',
    activeClassName: '!text-main-accent'
  },
  {
    kind: 'share',
    label: 'Share',
    iconName: 'TwitterShareIcon',
    hoverClassName: 'hover:bg-main-accent/10 hover:text-main-accent'
  }
];

const notificationTabs: Readonly<NotificationsTabData[]> = [
  { label: 'All', value: 'all' },
  { label: 'Mentions', value: 'mentions' }
];

function getNotificationTime(notification: NotificationItem): number {
  return notification.createdAt.toDate().getTime();
}

function mergeNotifications(
  currentNotifications: NotificationItem[],
  nextNotifications: NotificationItem[]
): NotificationItem[] {
  const notificationsById = new Map(
    currentNotifications.map((notification) => [notification.id, notification])
  );

  nextNotifications.forEach((notification) => {
    notificationsById.set(notification.id, {
      ...notificationsById.get(notification.id),
      ...notification
    });
  });

  return Array.from(notificationsById.values()).sort(
    (a, b) => getNotificationTime(b) - getNotificationTime(a)
  );
}

function getReasonMeta(reason: NotificationReason): ReasonMeta {
  switch (reason) {
    case 'like':
      return {
        action: 'liked your Tweet',
        color: 'text-[#F91880]',
        iconName: 'TwitterLikeFilledIcon'
      };
    case 'repost':
      return {
        action: 'retweeted your Tweet',
        color: 'text-[#00BA7C]',
        iconName: 'TwitterRetweetIcon'
      };
    case 'follow':
      return {
        action: 'followed you',
        color: 'text-main-accent',
        heroIconName: 'UserIcon'
      };
    case 'mention':
      return {
        action: 'mentioned you',
        color: 'text-main-accent',
        iconName: 'TwitterReplyIcon'
      };
    case 'reply':
      return {
        action: 'replied to your Tweet',
        color: 'text-main-accent',
        iconName: 'TwitterReplyIcon'
      };
    case 'quote':
      return {
        action: 'quoted your Tweet',
        color: 'text-main-accent',
        iconName: 'TwitterReplyIcon'
      };
    case 'starterpack-joined':
      return {
        action: 'joined from your Starter Pack',
        color: 'text-main-accent',
        heroIconName: 'UserIcon'
      };
    default:
      return {
        action: 'interacted with you',
        color: 'text-main-accent',
        iconName: 'TwitterNotificationsIcon'
      };
  }
}

function getTargetHref(
  { targetPostId, user, reason }: NotificationItem,
  viewerUsername?: string
): string {
  if (!targetPostId) return getUserPath(user.username);

  const targetUsername =
    reason === 'like' || reason === 'repost' ? viewerUsername : user.username;

  return getTweetPath(targetPostId, targetUsername);
}

function isTweetNotification(reason: NotificationReason): boolean {
  return reason === 'mention' || reason === 'reply' || reason === 'quote';
}

function getFollowBucket(notification: NotificationItem): number {
  return Math.floor(getNotificationTime(notification) / FOLLOW_GROUP_WINDOW_MS);
}

function getActivityGroupKey(notification: NotificationItem): string | null {
  if (
    (notification.reason === 'like' || notification.reason === 'repost') &&
    notification.targetPostId
  )
    return `${notification.reason}:${notification.targetPostId}`;

  if (
    notification.reason === 'follow' ||
    notification.reason === 'starterpack-joined'
  )
    return `${notification.reason}:${getFollowBucket(notification)}`;

  return null;
}

function createNotificationGroup(
  key: string,
  notification: NotificationItem
): NotificationGroup {
  return {
    id: key,
    reason: notification.reason,
    users: [notification.user],
    text: notification.text,
    tweet: notification.tweet,
    targetPostId: notification.targetPostId,
    isRead: notification.isRead,
    createdAt: notification.createdAt,
    latestNotification: notification
  };
}

function addNotificationToGroup(
  group: NotificationGroup,
  notification: NotificationItem
): void {
  if (!group.users.some(({ id }) => id === notification.user.id))
    group.users.push(notification.user);

  if (!notification.isRead) group.isRead = false;
  if (!group.text && notification.text) group.text = notification.text;
  if (!group.tweet && notification.tweet) group.tweet = notification.tweet;

  if (
    getNotificationTime(notification) >
    getNotificationTime(group.latestNotification)
  ) {
    group.createdAt = notification.createdAt;
    group.tweet = notification.tweet;
    group.latestNotification = notification;
  }
}

function groupNotifications(
  notifications: NotificationItem[]
): NotificationGroup[] {
  const groups: NotificationGroup[] = [];
  const groupsByKey = new Map<string, NotificationGroup>();

  notifications.forEach((notification) => {
    const key = getActivityGroupKey(notification) ?? notification.id;
    const existingGroup = groupsByKey.get(key);

    if (!existingGroup) {
      const group = createNotificationGroup(key, notification);

      groupsByKey.set(key, group);
      groups.push(group);
      return;
    }

    addNotificationToGroup(existingGroup, notification);
  });

  return groups.sort(
    (a, b) =>
      getNotificationTime(b.latestNotification) -
      getNotificationTime(a.latestNotification)
  );
}

function NotificationsTabs({
  activeTab
}: {
  activeTab: NotificationsTab;
}): JSX.Element {
  return (
    <nav className='flex h-[53px] border-b border-light-border dark:border-dark-border'>
      {notificationTabs.map(({ label, value }) => {
        const active = activeTab === value;

        return (
          <Link href={getNotificationsPath(value)} scroll={false} key={value}>
            <a
              className={cn(
                `accent-tab hover-card relative flex flex-1 items-center justify-center
                 text-[15px] font-bold outline-none`,
                active
                  ? 'text-light-primary dark:text-dark-primary'
                  : 'text-light-secondary dark:text-dark-secondary'
              )}
            >
              <span>{label}</span>
              {active && (
                <i className='absolute bottom-0 h-1 w-14 rounded-full bg-main-accent' />
              )}
            </a>
          </Link>
        );
      })}
    </nav>
  );
}

function NotificationReasonIcon({
  reason
}: {
  reason: NotificationReason;
}): JSX.Element {
  const { color, heroIconName, iconName } = getReasonMeta(reason);

  return (
    <i className={cn('flex h-8 w-8 items-center justify-center', color)}>
      {iconName ? (
        <CustomIcon className='h-7 w-7' iconName={iconName} />
      ) : (
        <HeroIcon
          className='h-7 w-7'
          iconName={heroIconName as IconName}
          solid
        />
      )}
    </i>
  );
}

function NotificationAvatarStack({
  users
}: {
  users: NotificationGroup['users'];
}): JSX.Element {
  return (
    <div className='flex min-w-0 items-center -space-x-2'>
      {users.slice(0, 5).map((user) => (
        <UserAvatar
          className='rounded-full bg-main-background ring-2 ring-main-background'
          username={user.username}
          src={user.photoURL}
          alt={user.name}
          size={32}
          key={user.id}
        />
      ))}
    </div>
  );
}

function GroupedNotificationText({
  group
}: {
  group: NotificationGroup;
}): JSX.Element {
  const [firstUser, secondUser] = group.users;
  const { action } = getReasonMeta(group.reason);
  const othersCount = group.users.length - 1;

  return (
    <p className='mt-2 break-words text-[15px] leading-5'>
      <UserName
        tag='span'
        name={firstUser.name}
        username={firstUser.username}
        verified={firstUser.verified}
        iconClassName='h-4 w-4'
        className='inline-flex max-w-[220px] align-bottom'
      />{' '}
      {secondUser && group.users.length === 2 ? (
        <>
          and{' '}
          <UserName
            tag='span'
            name={secondUser.name}
            username={secondUser.username}
            verified={secondUser.verified}
            iconClassName='h-4 w-4'
            className='inline-flex max-w-[220px] align-bottom'
          />{' '}
        </>
      ) : othersCount > 0 ? (
        <>and {othersCount} others </>
      ) : null}
      {action}
    </p>
  );
}

function NotificationEmptyState({
  activeTab
}: {
  activeTab: NotificationsTab;
}): JSX.Element {
  const mentions = activeTab === 'mentions';

  return (
    <div className='mx-auto flex max-w-sm flex-col px-8 py-10'>
      <h2 className='text-[31px] font-extrabold leading-9'>
        {mentions ? 'Join the conversation' : 'Nothing to see here - yet'}
      </h2>
      <p className='mt-2 text-[15px] text-light-secondary dark:text-dark-secondary'>
        {mentions
          ? "When someone mentions you, you'll find it here."
          : 'From likes to Retweets and a whole lot more, this is where all the action happens.'}
      </p>
    </div>
  );
}

function ActivityNotificationRow({
  group,
  viewerUsername
}: {
  group: NotificationGroup;
  viewerUsername: string | undefined;
}): JSX.Element {
  const { latestNotification, reason, text, isRead, createdAt } = group;
  const targetHref = getTargetHref(latestNotification, viewerUsername);

  return (
    <article
      className={cn(
        `hover-card grid grid-cols-[40px,1fr] gap-4 border-b border-light-border px-4 py-3
         dark:border-dark-border`,
        !isRead && 'bg-main-accent/[0.07]'
      )}
    >
      <div className='flex justify-end pt-1'>
        <NotificationReasonIcon reason={reason} />
      </div>
      <div className='min-w-0'>
        <div className='flex min-h-[32px] items-start justify-between gap-3'>
          <NotificationAvatarStack users={group.users} />
          <div className='flex shrink-0 items-center gap-2 text-sm leading-5 text-light-secondary dark:text-dark-secondary'>
            {!isRead && <i className='h-2 w-2 rounded-full bg-main-accent' />}
            <time>{formatDate(createdAt, 'tweet')}</time>
          </div>
        </div>
        <GroupedNotificationText group={group} />
        {text && (
          <Link href={targetHref}>
            <a className='custom-underline mt-3 block text-light-secondary dark:text-dark-secondary'>
              <TweetText className='text-[15px] leading-5' text={text} />
            </a>
          </Link>
        )}
      </div>
    </article>
  );
}

function MentionContext({
  reason,
  viewerUsername
}: {
  reason: NotificationReason;
  viewerUsername: string | undefined;
}): JSX.Element | null {
  if (reason === 'reply')
    return (
      <p className='text-[15px] leading-5 text-light-secondary dark:text-dark-secondary'>
        Replying to{' '}
        {viewerUsername ? (
          <Link href={getUserPath(viewerUsername)}>
            <a className='custom-underline text-main-accent'>
              @{viewerUsername}
            </a>
          </Link>
        ) : (
          'you'
        )}
      </p>
    );

  return null;
}

function MentionActionButton({
  action,
  tweet,
  tweetUser,
  viewerId,
  openReplyModal
}: {
  action: MentionAction;
  tweet: NotificationItem['tweet'];
  tweetUser: NotificationItem['user'];
  viewerId: string | undefined;
  openReplyModal: () => void;
}): JSX.Element {
  const { userBookmarks } = useAuth();
  const [optimisticLikes, setOptimisticLikes] = useState(
    tweet?.userLikes ?? []
  );
  const [optimisticRetweets, setOptimisticRetweets] = useState(
    tweet?.userRetweets ?? []
  );
  const [optimisticBookmarked, setOptimisticBookmarked] = useState(
    !!(tweet && userBookmarks?.some(({ id }) => id === tweet.id))
  );
  const [updatingLike, setUpdatingLike] = useState(false);
  const [updatingRetweet, setUpdatingRetweet] = useState(false);
  const [updatingBookmark, setUpdatingBookmark] = useState(false);

  useEffect(() => {
    setOptimisticLikes(tweet?.userLikes ?? []);
  }, [tweet?.userLikes]);

  useEffect(() => {
    setOptimisticRetweets(tweet?.userRetweets ?? []);
  }, [tweet?.userRetweets]);

  const bookmarked = !!(
    tweet && userBookmarks?.some(({ id }) => id === tweet.id)
  );

  useEffect(() => {
    setOptimisticBookmarked(bookmarked);
  }, [bookmarked]);

  const liked = !!(tweet && viewerId && optimisticLikes.includes(viewerId));
  const retweeted = !!(
    tweet &&
    viewerId &&
    optimisticRetweets.includes(viewerId)
  );
  const handleLike = useCallback(async (): Promise<void> => {
    if (!tweet || !viewerId || updatingLike) return;

    const shouldLike = !liked;
    const previousLikes = optimisticLikes;

    setUpdatingLike(true);
    setOptimisticLikes((currentLikes) =>
      shouldLike
        ? [viewerId, ...currentLikes.filter((id) => id !== viewerId)]
        : currentLikes.filter((id) => id !== viewerId)
    );

    try {
      await manageLike(shouldLike ? 'like' : 'unlike', viewerId, tweet.id)();
    } catch {
      setOptimisticLikes(previousLikes);
      toast.error('Tweet could not be liked');
    } finally {
      setUpdatingLike(false);
    }
  }, [liked, optimisticLikes, tweet, updatingLike, viewerId]);
  const handleRetweet = useCallback(async (): Promise<void> => {
    if (!tweet || !viewerId || updatingRetweet) return;

    const shouldRetweet = !retweeted;
    const previousRetweets = optimisticRetweets;

    setUpdatingRetweet(true);
    setOptimisticRetweets((currentRetweets) =>
      shouldRetweet
        ? [viewerId, ...currentRetweets.filter((id) => id !== viewerId)]
        : currentRetweets.filter((id) => id !== viewerId)
    );

    try {
      await manageRetweet(
        shouldRetweet ? 'retweet' : 'unretweet',
        viewerId,
        tweet.id
      )();
    } catch {
      setOptimisticRetweets(previousRetweets);
      toast.error('Tweet could not be retweeted');
    } finally {
      setUpdatingRetweet(false);
    }
  }, [optimisticRetweets, retweeted, tweet, updatingRetweet, viewerId]);
  const handleBookmark = useCallback(async (): Promise<void> => {
    if (!tweet || !viewerId || updatingBookmark) return;

    const shouldBookmark = !optimisticBookmarked;
    const previousBookmarked = optimisticBookmarked;

    setUpdatingBookmark(true);
    setOptimisticBookmarked(shouldBookmark);

    try {
      await manageBookmark(
        shouldBookmark ? 'bookmark' : 'unbookmark',
        viewerId,
        tweet.id
      );
      toast.success(
        shouldBookmark
          ? 'Tweet added to your Bookmarks'
          : 'Tweet removed from your Bookmarks'
      );
    } catch {
      setOptimisticBookmarked(previousBookmarked);
      toast.error('Tweet could not be bookmarked');
    } finally {
      setUpdatingBookmark(false);
    }
  }, [optimisticBookmarked, tweet, updatingBookmark, viewerId]);
  const active =
    (action.kind === 'like' && liked) ||
    (action.kind === 'retweet' && retweeted) ||
    (action.kind === 'bookmark' && optimisticBookmarked);
  const stats =
    action.kind === 'reply'
      ? tweet?.userReplies ?? 0
      : action.kind === 'retweet'
      ? optimisticRetweets.length
      : action.kind === 'like'
      ? optimisticLikes.length
      : 0;
  const iconName =
    action.kind === 'like' && liked
      ? 'TwitterLikeFilledIcon'
      : action.kind === 'bookmark' && optimisticBookmarked
      ? 'TwitterBookmarksFilledIcon'
      : action.iconName;
  const onClick =
    action.kind === 'reply'
      ? preventBubbling(() => {
          if (tweet && viewerId) openReplyModal();
        })
      : action.kind === 'like'
      ? preventBubbling(() => {
          void handleLike();
        })
      : action.kind === 'bookmark'
      ? preventBubbling(() => {
          void handleBookmark();
        })
      : undefined;
  const disabled =
    !tweet ||
    (action.kind === 'like' && updatingLike) ||
    (action.kind === 'bookmark' && updatingBookmark);

  if (action.kind === 'retweet')
    return (
      <TweetRetweetMenu
        className={cn(
          `dark-bg-tab -ml-2 flex h-9 min-w-[36px] items-center gap-2 rounded-full p-0
           text-light-secondary transition dark:text-dark-secondary`,
          action.hoverClassName,
          active && action.activeClassName
        )}
        iconClassName='group-hover:bg-[#00BA7C]/10 group-active:bg-[#00BA7C]/20
                       group-focus-visible:bg-[#00BA7C]/10 group-focus-visible:ring-[#00BA7C]/80'
        tip={retweeted ? 'Undo Retweet' : action.label}
        move={0}
        stats={stats}
        statsContainerClassName='ml-0'
        iconSizeClassName='h-[18.75px] w-[18.75px]'
        onRetweet={handleRetweet}
        retweeted={retweeted}
        quoteTweet={tweet ? { ...tweet, user: tweetUser } : null}
        disabled={updatingRetweet || !tweet}
      />
    );

  return (
    <Button
      className={cn(
        `dark-bg-tab -ml-2 flex h-9 min-w-[36px] items-center gap-2 rounded-full p-0
         text-light-secondary transition dark:text-dark-secondary`,
        action.hoverClassName,
        active && action.activeClassName
      )}
      aria-label={
        action.kind === 'like' && liked
          ? 'Unlike'
          : action.kind === 'bookmark' && optimisticBookmarked
          ? 'Remove from Bookmarks'
          : action.label
      }
      title={
        action.kind === 'like' && liked
          ? 'Unlike'
          : action.kind === 'bookmark' && optimisticBookmarked
          ? 'Remove from Bookmarks'
          : action.label
      }
      onClick={onClick}
      disabled={disabled}
    >
      <CustomIcon
        className='h-[18.75px] w-[18.75px] shrink-0'
        iconName={iconName}
      />
      {!!stats && (
        <span className='min-w-[10px] text-left text-[13px] leading-4'>
          {formatNumber(stats)}
        </span>
      )}
    </Button>
  );
}

function TweetNotificationRow({
  group,
  viewerId,
  viewerUsername
}: {
  group: NotificationGroup;
  viewerId: string | undefined;
  viewerUsername: string | undefined;
}): JSX.Element {
  const { latestNotification, reason, text, isRead, createdAt } = group;
  const { user } = latestNotification;
  const targetHref = getTargetHref(latestNotification, viewerUsername);
  const quotedTweet =
    reason === 'quote' ? group.tweet?.quotedTweet ?? null : null;
  const {
    open: replyOpen,
    openModal: openReplyModal,
    closeModal: closeReplyModal
  } = useModal();
  const tweetWithUser = group.tweet ? { ...group.tweet, user } : null;

  return (
    <>
      <Modal
        className='flex items-start justify-center'
        modalClassName='bg-main-background rounded-2xl max-w-xl w-full my-8 overflow-hidden'
        open={replyOpen}
        closeModal={closeReplyModal}
      >
        {tweetWithUser && (
          <TweetReplyModal tweet={tweetWithUser} closeModal={closeReplyModal} />
        )}
      </Modal>
      <article
        className={cn(
          `hover-card border-b border-light-border px-4 py-3 outline-none duration-200
           dark:border-dark-border`,
          !isRead && 'bg-main-accent/[0.07]'
        )}
      >
        <div className='grid grid-cols-[48px,1fr] gap-3'>
          <UserAvatar
            className='mt-0.5 [&>figure>span]:[transition:200ms]'
            username={user.username}
            src={user.photoURL}
            alt={user.name}
          />
          <div className='min-w-0'>
            <div className='flex items-start justify-between gap-3'>
              <div className='min-w-0'>
                <div className='flex min-w-0 items-center gap-1 text-[15px] leading-5 text-light-secondary dark:text-dark-secondary'>
                  <UserName
                    name={user.name}
                    username={user.username}
                    verified={user.verified}
                    iconClassName='h-4 w-4'
                    className='min-w-0 text-light-primary dark:text-dark-primary'
                  />
                  <UserUsername
                    username={user.username}
                    className='hidden min-w-0 xs:block'
                  />
                  <span>·</span>
                  <Link href={targetHref}>
                    <a className='custom-underline shrink-0'>
                      <time>{formatDate(createdAt, 'tweet')}</time>
                    </a>
                  </Link>
                  {!isRead && (
                    <i className='ml-1 h-2 w-2 shrink-0 rounded-full bg-main-accent' />
                  )}
                </div>
                <MentionContext
                  reason={reason}
                  viewerUsername={viewerUsername}
                />
              </div>
              <Button
                className='dark-bg-tab -mt-2 shrink-0 p-2 text-light-secondary hover:bg-main-accent/10
                           hover:text-main-accent dark:text-dark-secondary'
                aria-label='More'
                title='More'
              >
                <CustomIcon className='h-5 w-5' iconName='TwitterMoreIcon' />
              </Button>
            </div>
            {text && (
              <Link href={targetHref}>
                <a className='mt-1 block'>
                  <TweetText className='text-[15px] leading-5' text={text} />
                </a>
              </Link>
            )}
            {quotedTweet && (
              <div className='mt-3 max-w-xl'>
                <TweetEmbed card={null} quotedTweet={quotedTweet} />
              </div>
            )}
            <div className='mt-3 flex max-w-md justify-between pr-8'>
              {mentionActions.map((action) => (
                <MentionActionButton
                  action={action}
                  tweet={group.tweet}
                  tweetUser={user}
                  viewerId={viewerId}
                  openReplyModal={openReplyModal}
                  key={action.label}
                />
              ))}
            </div>
          </div>
        </div>
      </article>
    </>
  );
}

function NotificationRow({
  group,
  viewerUsername,
  viewerId
}: {
  group: NotificationGroup;
  viewerUsername: string | undefined;
  viewerId: string | undefined;
}): JSX.Element {
  return isTweetNotification(group.reason) ? (
    <TweetNotificationRow
      group={group}
      viewerId={viewerId}
      viewerUsername={viewerUsername}
    />
  ) : (
    <ActivityNotificationRow group={group} viewerUsername={viewerUsername} />
  );
}

export default function Notifications(): JSX.Element {
  const { user } = useAuth();
  const { asPath } = useRouter();
  const { clearNotifications, refreshLiveUpdates } = useLiveUpdates();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const seenMarkedTabs = useMemo(() => new Set<NotificationsTab>(), []);
  const activeTab = getNotificationsTab(asPath);
  const mentionsOnly = activeTab === 'mentions';

  const { data, error } = useSWR<NotificationsPage, Error>(
    ['notifications', activeTab],
    () =>
      listNotificationsPage(undefined, {
        mentionsOnly,
        limit: NOTIFICATIONS_PAGE_SIZE
      }),
    {
      refreshInterval: NOTIFICATIONS_REFRESH_INTERVAL_MS,
      revalidateOnFocus: true
    }
  );

  useEffect(() => {
    setNotifications([]);
    setCursor(null);
    setLoadingMore(false);
  }, [activeTab]);

  useEffect(() => {
    if (!data) return;

    setNotifications((currentNotifications) =>
      currentNotifications.length
        ? mergeNotifications(currentNotifications, data.notifications)
        : data.notifications
    );
    setCursor(data.cursor);

    if (!seenMarkedTabs.has(activeTab)) {
      seenMarkedTabs.add(activeTab);
      void markNotificationsSeen()
        .then(() => {
          clearNotifications();
          void refreshLiveUpdates();
        })
        .catch(() => undefined);
    }
  }, [activeTab, clearNotifications, data, refreshLiveUpdates, seenMarkedTabs]);

  const handleLoadMore = async (): Promise<void> => {
    if (!cursor || loadingMore) return;

    setLoadingMore(true);

    try {
      const nextPage = await listNotificationsPage(cursor, {
        mentionsOnly,
        limit: NOTIFICATIONS_PAGE_SIZE
      });

      setCursor(nextPage.cursor);
      setNotifications((currentNotifications) =>
        mergeNotifications(currentNotifications, nextPage.notifications)
      );
    } finally {
      setLoadingMore(false);
    }
  };

  const loading = !data && !error;
  const loadMoreInView = (): void => {
    void handleLoadMore();
  };
  const notificationGroups = useMemo(
    () => groupNotifications(notifications),
    [notifications]
  );

  return (
    <MainContainer>
      <SEO
        title={
          mentionsOnly
            ? 'Mentions / Not Twitter'
            : 'Notifications / Not Twitter'
        }
      />
      <header className='hover-animation sticky top-0 z-20 bg-main-background/80 backdrop-blur-md'>
        <div className='flex h-[53px] items-center justify-between px-4'>
          <div className='flex min-w-0 items-center gap-8'>
            <MobileSidebar />
            <h2 className='truncate text-xl font-bold'>Notifications</h2>
          </div>
          <Button
            className='dark-bg-tab group relative p-2 hover:bg-light-primary/10 active:bg-light-primary/20 
                       dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
            aria-label='Notification settings'
          >
            <CustomIcon className='h-5 w-5' iconName='TwitterSettingsIcon' />
            <ToolTip tip='Settings' />
          </Button>
        </div>
        <NotificationsTabs activeTab={activeTab} />
      </header>
      <section className='mt-0.5 xs:mt-0'>
        {loading ? (
          <Loading className='mt-5' />
        ) : error ? (
          <ErrorMessage message={error.message || 'Something went wrong'} />
        ) : !notificationGroups.length ? (
          <NotificationEmptyState activeTab={activeTab} />
        ) : (
          <>
            <AnimatePresence>
              {notificationGroups.map((group) => (
                <NotificationRow
                  group={group}
                  viewerId={user?.id}
                  viewerUsername={user?.username}
                  key={group.id}
                />
              ))}
            </AnimatePresence>
            {cursor && (
              <motion.div
                className='border-b border-light-border dark:border-dark-border'
                viewport={{ margin: '0px 0px 1000px' }}
                onViewportEnter={loadMoreInView}
              >
                <Loading className='mt-5' />
              </motion.div>
            )}
          </>
        )}
      </section>
    </MainContainer>
  );
}

Notifications.getLayout = (page: ReactElement): ReactNode => (
  <ProtectedLayout>
    <MainLayout>
      <HomeLayout>{page}</HomeLayout>
    </MainLayout>
  </ProtectedLayout>
);
