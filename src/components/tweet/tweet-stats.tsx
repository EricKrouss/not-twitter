/* eslint-disable react-hooks/exhaustive-deps */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import cn from 'clsx';
import { toast } from 'react-hot-toast';
import { useAuth } from '@lib/context/auth-context';
import { manageRetweet, manageLike, manageBookmark } from '@lib/atproto/utils';
import { ViewTweetStats } from '@components/view/view-tweet-stats';
import { TweetOption } from './tweet-option';
import { TweetRetweetMenu } from './tweet-retweet-menu';
import { TweetShare } from './tweet-share';
import type { Tweet, TweetWithUser } from '@lib/types/tweet';

type TweetStatsProps = Pick<
  Tweet,
  'userLikes' | 'userRetweets' | 'userReplies' | 'userQuotes' | 'bookmarkCount'
> & {
  userId: string;
  tweetId: string;
  username?: string;
  quoteTweet?: TweetWithUser;
  viewTweet?: boolean;
  openModal?: () => void;
};

export function TweetStats({
  userId,
  tweetId,
  username,
  quoteTweet,
  userLikes,
  viewTweet,
  userRetweets,
  bookmarkCount,
  userReplies: totalReplies,
  userQuotes: totalQuotes,
  openModal
}: TweetStatsProps): JSX.Element {
  const { userBookmarks } = useAuth();
  const { push } = useRouter();
  const totalLikes = userLikes.length;
  const totalTweets = userRetweets.length;
  const tweetIsBookmarked = !!userBookmarks?.some(({ id }) => id === tweetId);

  const [optimisticLikes, setOptimisticLikes] = useState(userLikes);
  const [optimisticRetweets, setOptimisticRetweets] = useState(userRetweets);
  const [optimisticBookmarked, setOptimisticBookmarked] =
    useState(tweetIsBookmarked);
  const [optimisticBookmarkCount, setOptimisticBookmarkCount] = useState(
    Math.max(bookmarkCount, tweetIsBookmarked ? 1 : 0)
  );
  const [updatingLike, setUpdatingLike] = useState(false);
  const [updatingRetweet, setUpdatingRetweet] = useState(false);
  const [updatingBookmark, setUpdatingBookmark] = useState(false);

  const currentReplies = totalReplies;
  const currentLikes = optimisticLikes.length;
  const currentTweets = optimisticRetweets.length;
  const currentQuotes = totalQuotes;
  const currentBookmarks = optimisticBookmarkCount;

  useEffect(() => {
    setOptimisticLikes(userLikes);
  }, [userLikes]);

  useEffect(() => {
    setOptimisticRetweets(userRetweets);
  }, [userRetweets]);

  useEffect(() => {
    setOptimisticBookmarked(tweetIsBookmarked);
    setOptimisticBookmarkCount(
      Math.max(bookmarkCount, tweetIsBookmarked ? 1 : 0)
    );
  }, [bookmarkCount, tweetIsBookmarked]);

  const replyMove = useMemo(
    () => (totalReplies > currentReplies ? -25 : 25),
    [totalReplies, currentReplies]
  );

  const likeMove = useMemo(
    () => (totalLikes > currentLikes ? -25 : 25),
    [totalLikes, currentLikes]
  );

  const tweetMove = useMemo(
    () => (totalTweets > currentTweets ? -25 : 25),
    [totalTweets, currentTweets]
  );

  const quoteMove = useMemo(
    () => (totalQuotes > currentQuotes ? -25 : 25),
    [totalQuotes, currentQuotes]
  );

  const bookmarkMove = useMemo(
    () => (bookmarkCount > currentBookmarks ? -25 : 25),
    [bookmarkCount, currentBookmarks]
  );

  const tweetIsLiked = optimisticLikes.includes(userId);
  const tweetIsRetweeted = optimisticRetweets.includes(userId);

  const isStatsVisible = !!(
    currentReplies ||
    currentTweets ||
    currentQuotes ||
    currentLikes
  );
  const iconSizeClassName = viewTweet
    ? 'h-[22.5px] w-[22.5px]'
    : 'h-[18.75px] w-[18.75px]';

  const redirectToLogin = useCallback((): void => {
    void push('/');
  }, [push]);

  const handleRetweet = useCallback(async (): Promise<void> => {
    if (!userId) {
      redirectToLogin();
      return;
    }

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
        tweetId
      )();
    } catch {
      setOptimisticRetweets(previousRetweets);
      toast.error('Tweet could not be retweeted');
    } finally {
      setUpdatingRetweet(false);
    }
  }, [
    optimisticRetweets,
    redirectToLogin,
    tweetId,
    tweetIsRetweeted,
    updatingRetweet,
    userId
  ]);

  const handleLike = useCallback(async (): Promise<void> => {
    if (!userId) {
      redirectToLogin();
      return;
    }

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
      await manageLike(shouldLike ? 'like' : 'unlike', userId, tweetId)();
    } catch {
      setOptimisticLikes(previousLikes);
      toast.error('Tweet could not be liked');
    } finally {
      setUpdatingLike(false);
    }
  }, [
    optimisticLikes,
    redirectToLogin,
    tweetId,
    tweetIsLiked,
    updatingLike,
    userId
  ]);

  const handleBookmark = useCallback(async (): Promise<void> => {
    if (!userId) {
      redirectToLogin();
      return;
    }

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
        tweetId
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
  }, [
    optimisticBookmarked,
    optimisticBookmarkCount,
    redirectToLogin,
    tweetId,
    updatingBookmark,
    userId
  ]);

  return (
    <>
      {viewTweet && (
        <ViewTweetStats
          tweetId={tweetId}
          likeMove={likeMove}
          tweetMove={tweetMove}
          quoteMove={quoteMove}
          replyMove={replyMove}
          currentLikes={currentLikes}
          currentTweets={currentTweets}
          currentQuotes={currentQuotes}
          currentReplies={currentReplies}
          isStatsVisible={isStatsVisible}
        />
      )}
      <div
        className={cn(
          'flex text-light-secondary inner:outline-none dark:text-dark-secondary',
          viewTweet ? 'justify-around py-2' : 'max-w-md justify-between'
        )}
      >
        <TweetOption
          className='hover:text-accent-blue focus-visible:text-accent-blue'
          iconClassName='group-hover:bg-accent-blue/10 group-active:bg-accent-blue/20 
                         group-focus-visible:bg-accent-blue/10 group-focus-visible:ring-accent-blue/80'
          tip='Reply'
          move={replyMove}
          stats={currentReplies}
          iconName='TwitterReplyIcon'
          viewTweet={viewTweet}
          iconSizeClassName={iconSizeClassName}
          onClick={userId ? openModal : redirectToLogin}
        />
        <TweetRetweetMenu
          className={cn(
            'hover:text-accent-green focus-visible:text-accent-green',
            tweetIsRetweeted && 'text-accent-green'
          )}
          iconClassName='group-hover:bg-accent-green/10 group-active:bg-accent-green/20
                         group-focus-visible:bg-accent-green/10 group-focus-visible:ring-accent-green/80'
          tip={tweetIsRetweeted ? 'Undo Retweet' : 'Retweet'}
          move={tweetMove}
          stats={currentTweets}
          viewTweet={viewTweet}
          iconSizeClassName={iconSizeClassName}
          onRetweet={handleRetweet}
          retweeted={tweetIsRetweeted}
          quoteTweet={userId ? quoteTweet : undefined}
          disabled={updatingRetweet}
        />
        <TweetOption
          className={cn(
            'hover:text-accent-pink focus-visible:text-accent-pink',
            tweetIsLiked && 'text-accent-pink'
          )}
          iconClassName='group-hover:bg-accent-pink/10 group-active:bg-accent-pink/20
                         group-focus-visible:bg-accent-pink/10 group-focus-visible:ring-accent-pink/80'
          tip={tweetIsLiked ? 'Unlike' : 'Like'}
          move={likeMove}
          stats={currentLikes}
          iconName={tweetIsLiked ? 'TwitterLikeFilledIcon' : 'TwitterLikeIcon'}
          viewTweet={viewTweet}
          iconSizeClassName={iconSizeClassName}
          onClick={handleLike}
          disabled={updatingLike}
        />
        <TweetOption
          className={cn(
            'hover:text-main-accent focus-visible:text-main-accent',
            optimisticBookmarked && 'text-main-accent'
          )}
          iconClassName='group-hover:bg-main-accent/10 group-active:bg-main-accent/20
                         group-focus-visible:bg-main-accent/10 group-focus-visible:ring-main-accent/80'
          tip={optimisticBookmarked ? 'Remove from Bookmarks' : 'Bookmark'}
          move={bookmarkMove}
          stats={viewTweet ? currentBookmarks : 0}
          iconName={
            optimisticBookmarked
              ? 'TwitterBookmarksFilledIcon'
              : 'TwitterBookmarksIcon'
          }
          viewTweet={viewTweet}
          iconSizeClassName={iconSizeClassName}
          onClick={handleBookmark}
          disabled={updatingBookmark}
        />
        <TweetShare
          tweetId={tweetId}
          username={username}
          viewTweet={viewTweet}
        />
      </div>
    </>
  );
}
