/* eslint-disable react-hooks/exhaustive-deps, @next/next/no-img-element */

import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import cn from 'clsx';
import { toast } from 'react-hot-toast';
import { preventBubbling } from '@lib/utils';
import { formatDate, formatNumber } from '@lib/date';
import { useAuth } from '@lib/context/auth-context';
import { useCollection } from '@lib/hooks/useCollection';
import { tweetsCollection } from '@lib/firebase/collections';
import { manageBookmark, manageLike, manageRetweet } from '@lib/firebase/utils';
import { getTweetPath, getUserPath } from '@lib/routes';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import { AppIcon, type AppIconName } from '@components/ui/app-icon';
import { Loading } from '@components/ui/loading';
import { TwitterVideoPlayer } from '@components/ui/twitter-video-player';
import { UserAvatar } from '@components/user/user-avatar';
import { UserName } from '@components/user/user-name';
import { UserUsername } from '@components/user/user-username';
import { Input } from '@components/input/input';
import { TweetActions } from '@components/tweet/tweet-actions';
import { TweetShare } from '@components/tweet/tweet-share';
import { TweetText } from '@components/tweet/tweet-text';
import { query, where, orderBy } from 'firebase/firestore';
import type { VariantLabels, Variants } from 'framer-motion';
import type { ImageData } from '@lib/types/file';
import type { TweetWithUser } from '@lib/types/tweet';
import type { IconName } from '@components/ui/hero-icon';

type ImageModalProps = {
  tweet?: boolean;
  imageData: ImageData;
  previewCount: number;
  tweetData?: TweetWithUser;
  selectedIndex?: number;
  handleNextIndex?: (type: 'prev' | 'next') => () => void;
  closeModal?: () => void;
};

type ArrowButton = ['prev' | 'next', string | null, IconName];

const arrowButtons: Readonly<ArrowButton[]> = [
  ['prev', null, 'ArrowLeftIcon'],
  ['next', 'order-1', 'ArrowRightIcon']
];

const mediaFade: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: 0.12, ease: 'easeOut' } }
};

type FullscreenImageModalProps = Pick<
  ImageModalProps,
  'imageData' | 'tweetData' | 'previewCount' | 'handleNextIndex' | 'closeModal'
> & {
  loading: boolean;
};

type ConversationTweetProps = {
  tweet: TweetWithUser;
  root?: boolean;
  onReply?: () => void;
};

type ConversationActionButtonProps = {
  tip: string;
  iconName: AppIconName;
  count?: number;
  active?: boolean;
  root?: boolean;
  className: string;
  iconClassName: string;
  onClick?: () => void;
};

function isVideoMedia({ src, type }: ImageData): boolean {
  return (
    !!type?.includes('video') || /\.(m3u8|mp4|mov|m4v|webm)($|\?)/i.test(src)
  );
}

function FullscreenImageModal({
  imageData,
  tweetData,
  previewCount,
  loading,
  handleNextIndex,
  closeModal
}: FullscreenImageModalProps): JSX.Element {
  const { src, alt, poster, viewCount } = imageData;

  const requireArrows = handleNextIndex && previewCount > 1;
  const isVideo = isVideoMedia(imageData);

  return (
    <div className='flex h-screen w-screen flex-col overflow-hidden bg-black text-white lg:flex-row'>
      <section className='relative flex min-h-0 flex-1 items-center justify-center bg-black'>
        {closeModal && (
          <Button
            className='absolute left-4 top-4 z-20 flex h-11 w-11 items-center justify-center bg-black/40
                       p-0 text-white backdrop-blur-sm transition-colors duration-200 ease-out
                       hover:bg-white/10 focus-visible:ring-white/70 active:bg-white/20'
            aria-label='Close'
            onClick={preventBubbling(closeModal)}
          >
            <HeroIcon iconName='XMarkIcon' />
          </Button>
        )}
        {requireArrows &&
          arrowButtons.map(([name, , iconName]) => (
            <Button
              className={cn(
                `absolute top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center
                 justify-center bg-black/40 p-0 text-white backdrop-blur-sm
                 transition-colors duration-200 ease-out hover:bg-white/10
                 focus-visible:ring-white/70 active:bg-white/20`,
                name === 'prev' ? 'left-4' : 'right-4'
              )}
              aria-label={name === 'prev' ? 'Previous media' : 'Next media'}
              onClick={preventBubbling(handleNextIndex(name))}
              key={name}
            >
              <HeroIcon iconName={iconName} />
            </Button>
          ))}
        <AnimatePresence mode='wait'>
          {loading ? (
            <motion.div
              className='flex h-full w-full items-center justify-center'
              {...mediaFade}
            >
              <Loading iconClassName='h-12 w-12 text-white' />
            </motion.div>
          ) : (
            <motion.div
              className='flex h-full w-full items-center justify-center p-4 sm:p-8 lg:px-16 lg:py-12'
              {...mediaFade}
              key={src}
            >
              {isVideo ? (
                <TwitterVideoPlayer
                  className='h-full w-full'
                  src={src}
                  poster={poster}
                  autoPlay
                  muted={false}
                  viewCount={viewCount}
                  objectFit='contain'
                />
              ) : (
                <picture className='flex h-full w-full items-center justify-center'>
                  <source srcSet={src} type='image/*' />
                  <img
                    className='h-full w-full object-contain'
                    src={src}
                    alt={alt}
                    draggable={false}
                    onClick={preventBubbling()}
                  />
                </picture>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>
      {tweetData && <MediaConversation tweet={tweetData} />}
    </div>
  );
}

function MediaConversation({ tweet }: { tweet: TweetWithUser }): JSX.Element {
  const [replyFocusRequest, setReplyFocusRequest] = useState(0);

  const repliesQuery = query(
    tweetsCollection,
    where('parent.id', '==', tweet.id),
    orderBy('createdAt', 'desc')
  );

  const { data: repliesData, loading } = useCollection(repliesQuery, {
    includeUser: true,
    allowNull: true
  });

  return (
    <aside
      className='flex h-[44vh] w-full shrink-0 flex-col border-t border-light-border bg-main-background
                 text-light-primary dark:border-dark-border dark:text-dark-primary lg:h-full lg:w-[350px]
                 lg:border-t-0 lg:border-l'
      onClick={preventBubbling(null, true)}
    >
      <header
        className='sticky top-0 z-10 flex h-[53px] shrink-0 items-center border-b border-light-border
                   bg-main-background/95 px-4 backdrop-blur-md dark:border-dark-border'
      >
        <h2 className='text-xl font-bold leading-6'>Tweet</h2>
      </header>
      <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain'>
        <ConversationTweet
          tweet={tweet}
          root
          onReply={(): void => setReplyFocusRequest((request) => request + 1)}
        />
        <div className='border-b border-light-border px-4 dark:border-dark-border'>
          <Input
            reply
            compactReply
            focusSignal={replyFocusRequest}
            parent={{ id: tweet.id, username: tweet.user.username }}
          />
        </div>
        <div className='border-b border-light-border text-[15px] dark:border-dark-border'>
          <Link href={getTweetPath(tweet.id, tweet.user.username)}>
            <a className='accent-tab hover-card block px-4 py-2.5 font-medium text-main-accent outline-none'>
              Show this thread
            </a>
          </Link>
        </div>
        {loading ? (
          <Loading className='my-5' />
        ) : repliesData?.length ? (
          repliesData.map((reply) => (
            <ConversationTweet tweet={reply} key={reply.id} />
          ))
        ) : (
          <div className='h-20' />
        )}
      </div>
    </aside>
  );
}

function ConversationTweet({
  tweet,
  root,
  onReply
}: ConversationTweetProps): JSX.Element {
  const {
    id,
    text,
    images,
    card,
    quotedTweet,
    parent,
    createdBy,
    createdAt,
    user
  } = tweet;

  const { user: authUser } = useAuth();

  const { id: ownerId, name, username, verified, photoURL } = user;
  const userId = authUser?.id as string;
  const isOwner = userId === createdBy;
  const tweetLink = getTweetPath(id, username);

  return (
    <article
      className={cn(
        'relative border-b border-light-border px-4 text-[15px] dark:border-dark-border',
        root ? 'pt-3 pb-0' : 'hover-card py-3 duration-200'
      )}
    >
      <div className='grid grid-cols-[auto,1fr] gap-3'>
        <UserAvatar
          className='mt-0.5'
          size={40}
          src={photoURL}
          alt={name}
          username={username}
        />
        <div className={cn('min-w-0', root ? 'pr-0' : 'pr-8')}>
          <div
            className={cn(
              'min-w-0 text-light-secondary dark:text-dark-secondary',
              root ? 'flex flex-col' : 'flex flex-wrap items-center gap-x-1'
            )}
          >
            <UserName
              name={name}
              username={username}
              verified={verified}
              className='text-light-primary dark:text-dark-primary'
            />
            <div className='flex min-w-0 items-center gap-1'>
              <UserUsername username={username} />
              {!root && (
                <>
                  <i>·</i>
                  <Link href={tweetLink}>
                    <a className='custom-underline whitespace-nowrap'>
                      {formatDate(createdAt, 'tweet')}
                    </a>
                  </Link>
                </>
              )}
            </div>
          </div>
          {parent && (
            <p className='mt-1 text-light-secondary dark:text-dark-secondary'>
              Replying to{' '}
              <Link href={getUserPath(parent.username)}>
                <a className='custom-underline text-main-accent'>
                  @{parent.username}
                </a>
              </Link>
            </p>
          )}
          {text && (
            <TweetText
              className={cn(
                'min-w-0 [overflow-wrap:anywhere]',
                root ? 'mt-3 text-[15px] leading-5' : 'mt-1'
              )}
              text={text}
            />
          )}
          {!root && <ConversationAttachments images={images} />}
          {root && (
            <Link href={tweetLink}>
              <a className='custom-underline mt-3 block text-[15px] text-light-secondary dark:text-dark-secondary'>
                {formatDate(createdAt, 'full')}
              </a>
            </Link>
          )}
          <ConversationActionBar tweet={tweet} root={root} onReply={onReply} />
        </div>
      </div>
      {!root && (
        <TweetActions
          isOwner={isOwner}
          ownerId={ownerId}
          tweetId={id}
          parentId={parent?.id}
          parentUsername={parent?.username}
          username={username}
          hasImages={!!images || !!card || !!quotedTweet}
          createdBy={createdBy}
        />
      )}
    </article>
  );
}

function ConversationAttachments({
  images
}: Pick<TweetWithUser, 'images'>): JSX.Element | null {
  if (!images?.length) return null;

  const previewCount = images.length;

  return (
    <div
      className={cn(
        'mt-2 grid overflow-hidden rounded-2xl border border-light-border bg-black dark:border-dark-border',
        previewCount === 1 ? 'grid-cols-1' : 'grid-cols-2',
        previewCount > 2 && 'grid-rows-2'
      )}
    >
      {images.slice(0, 4).map((media, index) => {
        const isVideo = isVideoMedia(media);

        return (
          <div
            className={cn(
              'relative overflow-hidden border-black/60 bg-black',
              previewCount === 1 ? 'h-44' : 'h-28',
              previewCount === 3 && index === 0 && 'row-span-2 h-full'
            )}
            key={media.id}
          >
            {isVideo ? (
              <TwitterVideoPlayer
                className='h-full w-full'
                src={media.src}
                poster={media.poster}
                compact
                viewCount={media.viewCount}
              />
            ) : (
              <img
                className='h-full w-full object-cover'
                src={media.src}
                alt={media.alt}
                draggable={false}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ConversationActionBar({
  tweet,
  root,
  onReply
}: ConversationTweetProps): JSX.Element {
  const { push } = useRouter();
  const { user, userBookmarks } = useAuth();

  const [optimisticLikes, setOptimisticLikes] = useState(tweet.userLikes);
  const [optimisticRetweets, setOptimisticRetweets] = useState(
    tweet.userRetweets
  );
  const [optimisticBookmarked, setOptimisticBookmarked] = useState(
    !!userBookmarks?.some(({ id }) => id === tweet.id)
  );
  const [optimisticBookmarkCount, setOptimisticBookmarkCount] = useState(
    Math.max(tweet.bookmarkCount, optimisticBookmarked ? 1 : 0)
  );
  const [updatingLike, setUpdatingLike] = useState(false);
  const [updatingRetweet, setUpdatingRetweet] = useState(false);
  const [updatingBookmark, setUpdatingBookmark] = useState(false);

  const userId = user?.id as string;
  const tweetIsLiked = optimisticLikes.includes(userId);
  const tweetIsRetweeted = optimisticRetweets.includes(userId);

  useEffect(() => setOptimisticLikes(tweet.userLikes), [tweet.userLikes]);
  useEffect(
    () => setOptimisticRetweets(tweet.userRetweets),
    [tweet.userRetweets]
  );
  useEffect(() => {
    const bookmarked = !!userBookmarks?.some(({ id }) => id === tweet.id);

    setOptimisticBookmarked(bookmarked);
    setOptimisticBookmarkCount(
      Math.max(tweet.bookmarkCount, bookmarked ? 1 : 0)
    );
  }, [tweet.bookmarkCount, tweet.id, userBookmarks]);

  const openReplyTarget = (): void => {
    void push(getTweetPath(tweet.id, tweet.user.username));
  };

  const handleRetweet = async (): Promise<void> => {
    if (updatingRetweet) return;

    const shouldRetweet = !tweetIsRetweeted;
    const previousRetweets = optimisticRetweets;

    setUpdatingRetweet(true);
    setOptimisticRetweets((currentRetweets) =>
      shouldRetweet
        ? [userId, ...currentRetweets.filter((id) => id !== userId)]
        : currentRetweets.filter((id) => id !== userId)
    );

    try {
      await manageRetweet(
        shouldRetweet ? 'retweet' : 'unretweet',
        userId,
        tweet.id
      )();
    } catch {
      setOptimisticRetweets(previousRetweets);
      toast.error('Tweet could not be retweeted');
    } finally {
      setUpdatingRetweet(false);
    }
  };

  const handleLike = async (): Promise<void> => {
    if (updatingLike) return;

    const shouldLike = !tweetIsLiked;
    const previousLikes = optimisticLikes;

    setUpdatingLike(true);
    setOptimisticLikes((currentLikes) =>
      shouldLike
        ? [userId, ...currentLikes.filter((id) => id !== userId)]
        : currentLikes.filter((id) => id !== userId)
    );

    try {
      await manageLike(shouldLike ? 'like' : 'unlike', userId, tweet.id)();
    } catch {
      setOptimisticLikes(previousLikes);
      toast.error('Tweet could not be liked');
    } finally {
      setUpdatingLike(false);
    }
  };

  const handleBookmark = async (): Promise<void> => {
    if (updatingBookmark) return;

    const shouldBookmark = !optimisticBookmarked;
    const previousBookmarked = optimisticBookmarked;
    const previousBookmarkCount = optimisticBookmarkCount;

    setUpdatingBookmark(true);
    setOptimisticBookmarked(shouldBookmark);
    setOptimisticBookmarkCount((currentCount) =>
      Math.max(0, currentCount + (shouldBookmark ? 1 : -1))
    );

    try {
      await manageBookmark(
        shouldBookmark ? 'bookmark' : 'unbookmark',
        userId,
        tweet.id
      );
      toast.success(
        shouldBookmark
          ? 'Tweet added to your Bookmarks'
          : 'Tweet removed from your Bookmarks'
      );
    } catch {
      setOptimisticBookmarked(previousBookmarked);
      setOptimisticBookmarkCount(previousBookmarkCount);
      toast.error('Tweet could not be bookmarked');
    } finally {
      setUpdatingBookmark(false);
    }
  };

  return (
    <div
      className={cn(
        'flex text-light-secondary dark:text-dark-secondary',
        root
          ? 'mt-3 justify-around border-y border-light-border px-5 py-0 dark:border-dark-border'
          : 'mt-2 max-w-md justify-between'
      )}
    >
      <ConversationActionButton
        tip='Reply'
        iconName='TwitterReplyIcon'
        count={tweet.userReplies}
        root={root}
        className='hover:text-accent-blue focus-visible:text-accent-blue'
        iconClassName='group-hover:bg-accent-blue/10 group-active:bg-accent-blue/20 group-focus-visible:bg-accent-blue/10'
        onClick={onReply ?? openReplyTarget}
      />
      <ConversationActionButton
        tip={tweetIsRetweeted ? 'Undo Retweet' : 'Retweet'}
        iconName='TwitterRetweetIcon'
        count={optimisticRetweets.length}
        active={tweetIsRetweeted}
        root={root}
        className='hover:text-accent-green focus-visible:text-accent-green'
        iconClassName='group-hover:bg-accent-green/10 group-active:bg-accent-green/20 group-focus-visible:bg-accent-green/10'
        onClick={handleRetweet}
      />
      <ConversationActionButton
        tip={tweetIsLiked ? 'Unlike' : 'Like'}
        iconName={tweetIsLiked ? 'TwitterLikeFilledIcon' : 'TwitterLikeIcon'}
        count={optimisticLikes.length}
        active={tweetIsLiked}
        root={root}
        className='hover:text-accent-pink focus-visible:text-accent-pink'
        iconClassName='group-hover:bg-accent-pink/10 group-active:bg-accent-pink/20 group-focus-visible:bg-accent-pink/10'
        onClick={handleLike}
      />
      <ConversationActionButton
        tip={optimisticBookmarked ? 'Remove from Bookmarks' : 'Bookmark'}
        iconName={
          optimisticBookmarked
            ? 'TwitterBookmarksFilledIcon'
            : 'TwitterBookmarksIcon'
        }
        count={optimisticBookmarkCount}
        active={optimisticBookmarked}
        root={root}
        className='hover:text-main-accent focus-visible:text-main-accent'
        iconClassName='group-hover:bg-main-accent/10 group-active:bg-main-accent/20 group-focus-visible:bg-main-accent/10'
        onClick={!updatingBookmark ? handleBookmark : undefined}
      />
      <TweetShare
        tweetId={tweet.id}
        username={tweet.user.username}
        viewTweet={root}
      />
    </div>
  );
}

function ConversationActionButton({
  tip,
  iconName,
  count,
  active,
  root,
  className,
  iconClassName,
  onClick
}: ConversationActionButtonProps): JSX.Element {
  const activeClassName =
    iconName === 'TwitterRetweetIcon'
      ? 'text-accent-green'
      : iconName === 'TwitterLikeFilledIcon' || iconName === 'TwitterLikeIcon'
      ? 'text-accent-pink'
      : iconName === 'TwitterBookmarksIcon' ||
        iconName === 'TwitterBookmarksFilledIcon'
      ? 'text-main-accent'
      : null;

  return (
    <button
      className={cn(
        `group flex items-center gap-1 p-0 outline-none transition-colors
         duration-200 ease-out inner:transition-colors inner:duration-200
         inner:ease-out`,
        active && activeClassName,
        className
      )}
      aria-label={tip}
      onClick={preventBubbling(onClick)}
    >
      <i
        className={cn(
          'relative rounded-full p-2 not-italic group-focus-visible:ring-2',
          iconClassName
        )}
      >
        <AppIcon
          className={root ? 'h-[22.5px] w-[22.5px]' : 'h-[18.75px] w-[18.75px]'}
          iconName={iconName}
        />
      </i>
      {!root && !!count && (
        <span className='-ml-1.5 min-w-[10px] text-left text-[13px] leading-4'>
          {formatNumber(count)}
        </span>
      )}
    </button>
  );
}

export function ImageModal({
  tweet,
  imageData,
  previewCount,
  tweetData,
  selectedIndex,
  handleNextIndex,
  closeModal
}: ImageModalProps): JSX.Element {
  const [indexes, setIndexes] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  const { src, alt } = imageData;

  const isVideo = isVideoMedia(imageData);

  const requireArrows = handleNextIndex && previewCount > 1;

  useEffect(() => {
    if (
      tweet &&
      selectedIndex !== undefined &&
      !indexes.includes(selectedIndex)
    ) {
      setLoading(true);
      setIndexes([...indexes, selectedIndex]);
    }

    const handleLoadingCompleted = (): void => setLoading(false);

    if (isVideo) {
      handleLoadingCompleted();
      return;
    }

    const media = new Image();

    media.src = src;
    media.onload = handleLoadingCompleted;
  }, [...(tweet && previewCount > 1 ? [src] : [])]);

  useEffect(() => {
    if (!requireArrows) return;

    const handleKeyDown = ({ key }: KeyboardEvent): void => {
      const callback =
        key === 'ArrowLeft'
          ? handleNextIndex('prev')
          : key === 'ArrowRight'
          ? handleNextIndex('next')
          : null;

      if (callback) callback();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleNextIndex]);

  if (tweetData)
    return (
      <FullscreenImageModal
        imageData={imageData}
        tweetData={tweetData}
        previewCount={previewCount}
        loading={loading}
        handleNextIndex={handleNextIndex}
        closeModal={closeModal}
      />
    );

  return (
    <>
      {requireArrows &&
        arrowButtons.map(([name, className, iconName]) => (
          <Button
            className={cn(
              `absolute z-10 hover:bg-light-primary/10 active:bg-light-primary/20
               dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20`,
              name === 'prev' ? 'left-2' : 'right-2',
              className
            )}
            onClick={preventBubbling(handleNextIndex(name))}
            key={name}
          >
            <HeroIcon iconName={iconName} />
          </Button>
        ))}
      <AnimatePresence mode='wait'>
        {loading ? (
          <motion.div
            className='mx-auto'
            {...mediaFade}
            exit={tweet ? (mediaFade.exit as VariantLabels) : undefined}
          >
            <Loading iconClassName='w-20 h-20' />
          </motion.div>
        ) : (
          <motion.div className='relative mx-auto' {...mediaFade} key={src}>
            {isVideo ? (
              <div className='group relative flex h-[75vh] w-[80vw] max-w-3xl md:h-[80vh]'>
                <TwitterVideoPlayer
                  className={cn('rounded-md', loading ? 'hidden' : 'block')}
                  src={src}
                  poster={imageData.poster}
                  autoPlay
                  muted={false}
                  viewCount={imageData.viewCount}
                  objectFit='contain'
                />
              </div>
            ) : (
              <picture className='group relative flex max-w-3xl'>
                <source srcSet={src} type='image/*' />
                <img
                  className='max-h-[75vh] rounded-md object-contain md:max-h-[80vh]'
                  src={src}
                  alt={alt}
                  onClick={preventBubbling()}
                />
                <a
                  className='trim-alt accent-tab absolute bottom-0 right-0 mx-2 mb-2
                             rounded-md bg-main-background/40 px-2 py-1 text-sm text-light-primary/80 opacity-0
                             transition-colors hover:bg-main-accent hover:text-white
                             focus-visible:bg-main-accent focus-visible:text-white focus-visible:opacity-100
                             group-hover:opacity-100 dark:text-dark-primary/80'
                  href={src}
                  target='_blank'
                  rel='noreferrer'
                  onClick={preventBubbling(null, true)}
                >
                  {alt}
                </a>
              </picture>
            )}
            <a
              className='custom-underline absolute left-0 -bottom-7 font-medium text-light-primary/80
                         decoration-transparent underline-offset-2 transition hover:text-light-primary hover:underline
                         hover:decoration-light-primary focus-visible:text-light-primary dark:text-dark-primary/80 
                         dark:hover:text-dark-primary dark:hover:decoration-dark-primary dark:focus-visible:text-dark-primary'
              href={src}
              target='_blank'
              rel='noreferrer'
              onClick={preventBubbling(null, true)}
            >
              Open original
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
