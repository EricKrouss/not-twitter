import { useRouter } from 'next/router';
import useSWR from 'swr';
import { getUser, postIdFromUri } from '@lib/atproto/backend';
import { SEO } from '@components/common/seo';
import { PublicTweetLayout } from '@components/layout/common-layout';
import { MainContainer } from '@components/home/main-container';
import { MainHeader } from '@components/home/main-header';
import { QuoteTweetsFeed } from '@components/view/quote-tweets-feed';
import { Loading } from '@components/ui/loading';
import { Error } from '@components/ui/error';
import type { ReactElement, ReactNode } from 'react';

function getRouteParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default function ProfileTweetQuoteTweets(): JSX.Element {
  const { query: routeQuery, back } = useRouter();
  const actor = getRouteParam(routeQuery.actor);
  const rkey = getRouteParam(routeQuery.rkey);

  const { data: userProfile, error: profileError } = useSWR(
    actor ? ['user-profile', actor] : null,
    () => getUser(actor!)
  );

  const resolvedDid = userProfile?.id;
  const tweetId = resolvedDid && rkey ? postIdFromUri(`at://${resolvedDid}/app.bsky.feed.post/${rkey}`) : null;
  const profileLoading = !!actor && !profileError && userProfile === undefined;

  return (
    <MainContainer className='!pb-[1280px]'>
      <SEO title='Quote Tweets / Not Twitter' />
      <MainHeader useActionButton title='Quote Tweets' action={back} />
      {profileLoading ? (
        <Loading className='mt-5' />
      ) : tweetId ? (
        <QuoteTweetsFeed tweetId={tweetId} />
      ) : (
        <Error message='Tweet not found' />
      )}
    </MainContainer>
  );
}

ProfileTweetQuoteTweets.getLayout = (page: ReactElement): ReactNode => (
  <PublicTweetLayout>{page}</PublicTweetLayout>
);
