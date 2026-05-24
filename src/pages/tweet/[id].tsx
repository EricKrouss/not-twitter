import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { AnimatePresence } from 'framer-motion';
import useSWR from 'swr';
import {
  getTweetThread,
  getTweetThreadParentsPage,
  subscribeBackend
} from '@lib/atproto/backend';
import { isPlural } from '@lib/utils';
import { getTweetRouteId } from '@lib/static-routes';
import { PublicTweetLayout } from '@components/layout/common-layout';
import { MainContainer } from '@components/home/main-container';
import { MainHeader } from '@components/home/main-header';
import { Tweet } from '@components/tweet/tweet';
import { ViewTweet } from '@components/view/view-tweet';
import { SEO } from '@components/common/seo';
import { Loading } from '@components/ui/loading';
import { Error } from '@components/ui/error';
import type { ReactElement, ReactNode } from 'react';
import type {
  TweetThreadPage,
  TweetThreadParentsPage
} from '@lib/atproto/backend';
import type { TweetWithUser } from '@lib/types/tweet';

type ParentPageState = TweetThreadParentsPage & {
  loadingMore: boolean;
  error: boolean;
};

const initialParentPageState: ParentPageState = {
  parents: [],
  cursor: null,
  loadingMore: false,
  error: false
};

function getRouteParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function mergeParentTweets(
  olderParents: TweetWithUser[],
  currentParents: TweetWithUser[]
): TweetWithUser[] {
  const seenIds = new Set<string>();

  return [...olderParents, ...currentParents].filter(({ id }) => {
    if (seenIds.has(id)) return false;
    seenIds.add(id);
    return true;
  });
}

function hasTweet(tweets: TweetWithUser[], tweetId: string): boolean {
  return tweets.some(({ id }) => id === tweetId);
}

export default function TweetId(): JSX.Element {
  const { asPath, query: routeQuery, back } = useRouter();
  const tweetId =
    getRouteParam(routeQuery.tweetId) ??
    getRouteParam(routeQuery.id) ??
    getTweetRouteId(asPath);
  const tweetPathId = tweetId ?? 'null';

  const {
    data: threadData,
    error,
    mutate
  } = useSWR<TweetThreadPage | null, Error>(
    tweetId ? ['tweet-thread', tweetPathId] : null,
    () => getTweetThread(tweetPathId),
    { revalidateOnFocus: false }
  );

  const viewTweetRef = useRef<HTMLElement>(null);
  const [parentPage, setParentPage] = useState<ParentPageState>(
    initialParentPageState
  );

  const tweetLoading = !!tweetId && !error && threadData === undefined;
  const tweetData = threadData?.tweet ?? null;
  const parentTweets = parentPage.parents;
  const threadReplies = threadData?.threadReplies ?? [];
  const repliesData = threadData?.replies ?? [];

  const { text, images } = tweetData ?? {};

  const imagesLength = images?.length ?? 0;
  const hasParentTweets = parentTweets.length > 0;
  const hasThreadReplies = threadReplies.length > 0;
  const hasThread = hasParentTweets || hasThreadReplies;

  const pageTitle = tweetData
    ? `${tweetData.user.name} on Not Twitter: "${text ?? ''}${
        images ? ` (${imagesLength} image${isPlural(imagesLength)})` : ''
      }" / Not Twitter`
    : null;

  useEffect(() => {
    if (!threadData) {
      setParentPage(initialParentPageState);
      return;
    }

    setParentPage({
      parents: threadData.parents,
      cursor: threadData.parentCursor,
      loadingMore: false,
      error: false
    });
  }, [threadData]);

  const loadMoreParents = useCallback(async (): Promise<void> => {
    const parentCursor = parentPage.cursor;

    if (!parentCursor || parentPage.loadingMore) return;

    const scrollY = window.scrollY;
    const previousHeight = document.documentElement.scrollHeight;

    setParentPage((currentPage) => ({
      ...currentPage,
      loadingMore: true,
      error: false
    }));

    try {
      const nextPage = await getTweetThreadParentsPage(parentCursor);

      setParentPage((currentPage) => ({
        parents: mergeParentTweets(nextPage.parents, currentPage.parents),
        cursor: nextPage.cursor,
        loadingMore: false,
        error: false
      }));

      requestAnimationFrame(() => {
        const nextHeight = document.documentElement.scrollHeight;
        window.scrollTo(0, scrollY + nextHeight - previousHeight);
      });
    } catch {
      setParentPage((currentPage) => ({
        ...currentPage,
        loadingMore: false,
        error: true
      }));
    }
  }, [parentPage.cursor, parentPage.loadingMore]);

  useEffect(() => {
    if (!tweetLoading && hasParentTweets)
      viewTweetRef.current?.scrollIntoView();
  }, [hasParentTweets, tweetData?.id, tweetLoading]);

  useEffect(() => {
    if (!tweetId) return undefined;

    return subscribeBackend(
      () => {
        void mutate();
      },
      ['content']
    );
  }, [mutate, tweetId]);

  const handleReplySent = useCallback(
    (replyTweet: TweetWithUser): void => {
      void mutate((currentData) => {
        if (!currentData) return currentData;

        const replyAlreadyVisible =
          hasTweet(currentData.threadReplies, replyTweet.id) ||
          hasTweet(currentData.replies, replyTweet.id);

        if (replyAlreadyVisible) return currentData;

        return {
          ...currentData,
          tweet: currentData.tweet
            ? {
                ...currentData.tweet,
                userReplies: currentData.tweet.userReplies + 1
              }
            : currentData.tweet,
          replies: [...currentData.replies, replyTweet]
        };
      }, false);
    },
    [mutate]
  );

  return (
    <MainContainer className='!pb-[1280px]'>
      <MainHeader
        useActionButton
        title={hasThread ? 'Thread' : 'Tweet'}
        action={back}
      />
      <section>
        {tweetLoading ? (
          <Loading className='mt-5' />
        ) : !tweetData ? (
          <>
            <SEO title='Tweet not found / Not Twitter' />
            <Error message='Tweet not found' />
          </>
        ) : (
          <>
            {pageTitle && <SEO title={pageTitle} />}
            {parentPage.cursor && (
              <div
                className='border-b border-light-border px-4 py-3 text-[15px]
                           dark:border-dark-border'
              >
                {parentPage.loadingMore ? (
                  <Loading className='py-1' iconClassName='h-5 w-5' />
                ) : (
                  <button
                    className='custom-underline font-bold text-main-accent
                               disabled:cursor-wait disabled:opacity-60'
                    type='button'
                    onClick={(): void => {
                      void loadMoreParents();
                    }}
                  >
                    {parentPage.error
                      ? 'Retry earlier Tweets'
                      : 'Show earlier Tweets'}
                  </button>
                )}
              </div>
            )}
            {parentTweets.map((parentTweet) => (
              <Tweet parentTweet {...parentTweet} key={parentTweet.id} />
            ))}
            <ViewTweet
              viewTweetRef={viewTweetRef}
              onReplySent={handleReplySent}
              {...tweetData}
            />
            <AnimatePresence>
              {threadReplies.map((tweet) => (
                <Tweet
                  {...tweet}
                  onReplySent={handleReplySent}
                  key={tweet.id}
                />
              ))}
              {repliesData.map((tweet) => (
                <Tweet
                  {...tweet}
                  onReplySent={handleReplySent}
                  key={tweet.id}
                />
              ))}
            </AnimatePresence>
          </>
        )}
      </section>
    </MainContainer>
  );
}

TweetId.getLayout = (page: ReactElement): ReactNode => (
  <PublicTweetLayout>{page}</PublicTweetLayout>
);
