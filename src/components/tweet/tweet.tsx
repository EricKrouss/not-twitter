import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import cn from 'clsx';
import { useAuth } from '@lib/context/auth-context';
import { useModal } from '@lib/hooks/useModal';
import { getTweetPath, getUserPath } from '@lib/routes';
import { createYouTubeCardFromText } from '@lib/youtube';
import { delayScroll } from '@lib/utils';
import { Modal } from '@components/modal/modal';
import { TweetReplyModal } from '@components/modal/tweet-reply-modal';
import { ImagePreview } from '@components/input/image-preview';
import { UserAvatar } from '@components/user/user-avatar';
import { UserTooltip } from '@components/user/user-tooltip';
import { UserName } from '@components/user/user-name';
import { UserUsername } from '@components/user/user-username';
import { TweetActions } from './tweet-actions';
import { TweetEmbed } from './tweet-embed';
import { TweetStatus } from './tweet-status';
import { TweetStats } from './tweet-stats';
import { TweetDate } from './tweet-date';
import { TweetText } from './tweet-text';
import type { Variants } from 'framer-motion';
import type { Tweet } from '@lib/types/tweet';
import type { User } from '@lib/types/user';

export type TweetProps = Tweet & {
  user: User;
  modal?: boolean;
  pinned?: boolean;
  profile?: User | null;
  parentTweet?: boolean;
};

export const variants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: 0.12, ease: 'easeOut' } }
};

function BlockedTweetPlaceholder({
  username,
  blockedBy,
  parentTweet
}: {
  username: string;
  blockedBy: boolean;
  parentTweet?: boolean;
}): JSX.Element {
  return (
    <motion.article
      {...variants}
      className={cn(
        'px-4 py-3',
        !parentTweet && 'border-b border-light-border dark:border-dark-border'
      )}
    >
      <div
        className='rounded-2xl border border-light-border px-4 py-3 text-[15px]
                   dark:border-dark-border'
      >
        <p className='font-bold text-light-primary dark:text-dark-primary'>
          {blockedBy ? 'This Tweet is unavailable' : `You blocked @${username}`}
        </p>
        <p className='mt-1 text-light-secondary dark:text-dark-secondary'>
          {blockedBy
            ? `You can’t view this Tweet because @${username} blocked you.`
            : 'This Tweet is from an account you blocked.'}
        </p>
      </div>
    </motion.article>
  );
}

export function Tweet(tweet: TweetProps): JSX.Element {
  const {
    id: tweetId,
    text,
    modal,
    images,
    card,
    quotedTweet,
    parent,
    pinned,
    profile,
    userLikes,
    createdBy,
    createdAt,
    bookmarkCount,
    parentTweet,
    userReplies,
    userQuotes = 0,
    userRetweets,
    user: tweetUserData
  } = tweet;

  const { id: ownerId, name, username, verified, photoURL } = tweetUserData;

  const { user } = useAuth();

  const { open, openModal, closeModal } = useModal();

  const tweetLink = getTweetPath(tweetId, username);
  const displayCard = card ?? createYouTubeCardFromText(text);
  const hideQuotedTweetMedia = !!images?.length || !!displayCard;

  const userId = user?.id ?? '';

  const isOwner = userId === createdBy;
  const tweetIsHiddenByBlock =
    !isOwner && (tweetUserData.blocking || tweetUserData.blockedBy);

  const { id: parentId, username: parentUsername = username } = parent ?? {};

  const {
    id: profileId,
    name: profileName,
    username: profileUsername
  } = profile ?? {};

  const reply = !!parent;
  const tweetIsRetweeted = userRetweets.includes(profileId ?? '');

  if (tweetIsHiddenByBlock)
    return (
      <BlockedTweetPlaceholder
        username={username}
        blockedBy={tweetUserData.blockedBy}
        parentTweet={parentTweet}
      />
    );

  return (
    <motion.article
      {...(!modal ? variants : {})}
      className='tweet-article'
      data-tweet-id={tweetId}
      animate={{
        ...variants.animate,
        ...(parentTweet && { transition: { duration: 0.2 } })
      }}
    >
      <Modal
        className='flex items-start justify-center'
        modalClassName='bg-main-background rounded-2xl max-w-xl w-full my-8 overflow-hidden'
        open={open}
        closeModal={closeModal}
      >
        <TweetReplyModal tweet={tweet} closeModal={closeModal} />
      </Modal>
      <Link href={tweetLink} scroll={!reply}>
        <a
          className={cn(
            `accent-tab hover-card relative flex flex-col 
             gap-y-4 px-4 py-3 outline-none duration-200`,
            parentTweet
              ? 'mt-0.5 pt-2.5 pb-0'
              : 'border-b border-light-border dark:border-dark-border'
          )}
          draggable={false}
          onClick={delayScroll(200)}
        >
          <div className='grid grid-cols-[auto,1fr] gap-x-3 gap-y-1'>
            <AnimatePresence initial={false}>
              {modal ? null : pinned ? (
                <TweetStatus type='pin'>Pinned Tweet</TweetStatus>
              ) : (
                tweetIsRetweeted && (
                  <TweetStatus type='tweet'>
                    <Link
                      href={
                        profileUsername ? getUserPath(profileUsername) : '#'
                      }
                    >
                      <a className='custom-underline truncate'>
                        {userId === profileId ? 'You' : profileName} Retweeted
                      </a>
                    </Link>
                  </TweetStatus>
                )
              )}
            </AnimatePresence>
            <div className='flex flex-col items-center gap-2'>
              <UserTooltip avatar modal={modal} {...tweetUserData}>
                <UserAvatar src={photoURL} alt={name} username={username} />
              </UserTooltip>
              {parentTweet && (
                <i className='hover-animation h-full w-0.5 bg-light-line-reply dark:bg-dark-line-reply' />
              )}
            </div>
            <div className='flex min-w-0 flex-col'>
              <div className='flex justify-between gap-2 text-light-secondary dark:text-dark-secondary'>
                <div className='flex gap-1 truncate xs:overflow-visible xs:whitespace-normal'>
                  <UserTooltip modal={modal} {...tweetUserData}>
                    <UserName
                      name={name}
                      username={username}
                      verified={verified}
                      className='text-light-primary dark:text-dark-primary'
                    />
                  </UserTooltip>
                  <UserTooltip modal={modal} {...tweetUserData}>
                    <UserUsername username={username} />
                  </UserTooltip>
                  <TweetDate tweetLink={tweetLink} createdAt={createdAt} />
                </div>
                <div className='px-4'>
                  {!modal && (
                    <TweetActions
                      isOwner={isOwner}
                      ownerId={ownerId}
                      tweetId={tweetId}
                      parentId={parentId}
                      parentUsername={parentUsername}
                      username={username}
                      hasImages={!!images || !!displayCard || !!quotedTweet}
                      createdBy={createdBy}
                      blocking={tweetUserData.blocking}
                      blockingByListName={tweetUserData.blockingByListName}
                      muting={tweetUserData.muting}
                      mutingByListName={tweetUserData.mutingByListName}
                    />
                  )}
                </div>
              </div>
              {(reply || modal) && (
                <p
                  className={cn(
                    'text-light-secondary dark:text-dark-secondary',
                    modal && 'order-1 my-2'
                  )}
                >
                  Replying to{' '}
                  <Link href={getUserPath(parentUsername)}>
                    <a className='custom-underline text-main-accent'>
                      @{parentUsername}
                    </a>
                  </Link>
                </p>
              )}
              {text && <TweetText text={text} />}
              <div className='mt-1 flex flex-col gap-2'>
                {images && (
                  <ImagePreview
                    tweet
                    tweetData={tweet}
                    imagesPreview={images}
                    previewCount={images.length}
                  />
                )}
                <TweetEmbed
                  card={displayCard}
                  quotedTweet={quotedTweet}
                  hideQuotedTweetMedia={hideQuotedTweetMedia}
                />
                {!modal && (
                  <TweetStats
                    userId={userId}
                    tweetId={tweetId}
                    username={username}
                    quoteTweet={tweet}
                    userLikes={userLikes}
                    bookmarkCount={bookmarkCount}
                    userReplies={userReplies}
                    userQuotes={userQuotes}
                    userRetweets={userRetweets}
                    openModal={openModal}
                  />
                )}
              </div>
            </div>
          </div>
        </a>
      </Link>
    </motion.article>
  );
}
