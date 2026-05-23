import Link from 'next/link';
import { motion } from 'framer-motion';
import cn from 'clsx';
import { useAuth } from '@lib/context/auth-context';
import { useModal } from '@lib/hooks/useModal';
import { getTweetPath, getUserPath } from '@lib/routes';
import { createYouTubeCardFromText } from '@lib/youtube';
import { Modal } from '@components/modal/modal';
import { TweetReplyModal } from '@components/modal/tweet-reply-modal';
import { ImagePreview } from '@components/input/image-preview';
import { UserAvatar } from '@components/user/user-avatar';
import { UserTooltip } from '@components/user/user-tooltip';
import { UserName } from '@components/user/user-name';
import { UserUsername } from '@components/user/user-username';
import { variants } from '@components/tweet/tweet';
import { TweetActions } from '@components/tweet/tweet-actions';
import { TweetEmbed } from '@components/tweet/tweet-embed';
import { TweetStats } from '@components/tweet/tweet-stats';
import { TweetText } from '@components/tweet/tweet-text';
import { TweetDate } from '@components/tweet/tweet-date';
import { Input } from '@components/input/input';
import type { RefObject } from 'react';
import type { User } from '@lib/types/user';
import type { Tweet } from '@lib/types/tweet';

type ViewTweetProps = Tweet & {
  user: User;
  viewTweetRef?: RefObject<HTMLElement>;
};

export function ViewTweet(tweet: ViewTweetProps): JSX.Element {
  const {
    id: tweetId,
    text,
    images,
    card,
    quotedTweet,
    parent,
    userLikes,
    createdBy,
    createdAt,
    bookmarkCount,
    userRetweets,
    userReplies,
    userQuotes = 0,
    viewTweetRef,
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

  const reply = !!parent;

  const { id: parentId, username: parentUsername = username } = parent ?? {};

  return (
    <motion.article
      className={cn(
        `accent-tab h- relative flex cursor-default flex-col gap-3 border-b
         border-light-border px-4 py-3 outline-none dark:border-dark-border`,
        reply && 'scroll-m-[3.25rem] pt-0'
      )}
      {...variants}
      animate={{ ...variants.animate, transition: { duration: 0.2 } }}
      exit={undefined}
      ref={viewTweetRef}
    >
      <Modal
        className='flex items-start justify-center'
        modalClassName='bg-main-background rounded-2xl max-w-xl w-full mt-8 overflow-hidden'
        open={open}
        closeModal={closeModal}
      >
        <TweetReplyModal tweet={tweet} closeModal={closeModal} />
      </Modal>
      <div className='flex flex-col gap-2'>
        {reply && (
          <div className='flex w-12 items-center justify-center'>
            <i className='hover-animation h-2 w-0.5 bg-light-line-reply dark:bg-dark-line-reply' />
          </div>
        )}
        <div className='grid grid-cols-[auto,1fr] gap-3'>
          <UserTooltip avatar {...tweetUserData}>
            <UserAvatar src={photoURL} alt={name} username={username} />
          </UserTooltip>
          <div className='flex min-w-0 justify-between'>
            <div className='flex flex-col truncate xs:overflow-visible xs:whitespace-normal'>
              <UserTooltip {...tweetUserData}>
                <UserName
                  className='-mb-1'
                  name={name}
                  username={username}
                  verified={verified}
                />
              </UserTooltip>
              <UserTooltip {...tweetUserData}>
                <UserUsername username={username} />
              </UserTooltip>
            </div>
            <div className='px-4'>
              <TweetActions
                viewTweet
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
            </div>
          </div>
        </div>
      </div>
      {reply && (
        <p className='text-light-secondary dark:text-dark-secondary'>
          Replying to{' '}
          <Link href={getUserPath(parentUsername)}>
            <a className='custom-underline text-main-accent'>
              @{parentUsername}
            </a>
          </Link>
        </p>
      )}
      <div>
        {text && <TweetText className='text-2xl' text={text} />}
        {images && (
          <ImagePreview
            viewTweet
            tweetData={tweet}
            imagesPreview={images}
            previewCount={images.length}
          />
        )}
        <TweetEmbed
          card={displayCard}
          quotedTweet={quotedTweet}
          viewTweet
          hideQuotedTweetMedia={hideQuotedTweetMedia}
        />
        <div
          className='inner:hover-animation inner:border-b inner:border-light-border
                     dark:inner:border-dark-border'
        >
          <TweetDate viewTweet tweetLink={tweetLink} createdAt={createdAt} />
          <TweetStats
            viewTweet
            userId={userId}
            tweetId={tweetId}
            username={username}
            quoteTweet={tweet}
            userLikes={userLikes}
            bookmarkCount={bookmarkCount}
            userRetweets={userRetweets}
            userReplies={userReplies}
            userQuotes={userQuotes}
            openModal={openModal}
          />
        </div>
        {user && <Input reply parent={{ id: tweetId, username: username }} />}
      </div>
    </motion.article>
  );
}
