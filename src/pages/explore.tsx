import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { AnimatePresence, motion } from 'framer-motion';
import cn from 'clsx';
import useSWR from 'swr';
import { toast } from 'react-hot-toast';
import { useSearchTweets, useSearchUsers } from '@lib/api/search';
import {
  getInterestsSetting,
  updateInterestsSetting
} from '@lib/atproto/backend';
import { useAuth } from '@lib/context/auth-context';
import { useModal } from '@lib/hooks/useModal';
import {
  TrendsLayout,
  ProtectedLayout
} from '@components/layout/common-layout';
import { MainLayout } from '@components/layout/main-layout';
import { SEO } from '@components/common/seo';
import { MainContainer } from '@components/home/main-container';
import { Modal } from '@components/modal/modal';
import { AsideTrends, variants } from '@components/aside/aside-trends';
import { SearchBar } from '@components/aside/search-bar';
import { MobileSidebar } from '@components/sidebar/mobile-sidebar';
import { Tweet } from '@components/tweet/tweet';
import { UserCard } from '@components/user/user-card';
import { Button } from '@components/ui/button';
import { CustomIcon } from '@components/ui/custom-icon';
import { Error } from '@components/ui/error';
import { Loading } from '@components/ui/loading';
import { ToolTip } from '@components/ui/tooltip';
import type {
  SearchPeopleFilter,
  SearchPostFilter
} from '@lib/atproto/backend';
import type { ReactElement, ReactNode } from 'react';
import type { ParsedUrlQuery } from 'querystring';

type SearchTab = 'top' | 'live' | 'user' | 'image' | 'video';

type SearchTabData = {
  label: string;
  value: SearchTab;
};

const searchTabs: Readonly<SearchTabData[]> = [
  { label: 'Top', value: 'top' },
  { label: 'Latest', value: 'live' },
  { label: 'People', value: 'user' },
  { label: 'Photos', value: 'image' },
  { label: 'Videos', value: 'video' }
];

type InterestOption = {
  label: string;
  value: string;
};

const blueskyInterestOptions: Readonly<InterestOption[]> = [
  { label: 'Animals', value: 'animals' },
  { label: 'Art', value: 'art' },
  { label: 'Books', value: 'books' },
  { label: 'Comedy', value: 'comedy' },
  { label: 'Comics', value: 'comics' },
  { label: 'Culture', value: 'culture' },
  { label: 'Software Dev', value: 'software-dev' },
  { label: 'Education', value: 'education' },
  { label: 'Finance', value: 'finance' },
  { label: 'Food', value: 'food' },
  { label: 'Video Games', value: 'video-games' },
  { label: 'Journalism', value: 'journalism' },
  { label: 'Movies', value: 'movies' },
  { label: 'Music', value: 'music' },
  { label: 'Nature', value: 'nature' },
  { label: 'News', value: 'news' },
  { label: 'Pets', value: 'pets' },
  { label: 'Photography', value: 'photography' },
  { label: 'Politics', value: 'politics' },
  { label: 'Science', value: 'science' },
  { label: 'Sports', value: 'sports' },
  { label: 'Tech', value: 'tech' },
  { label: 'TV', value: 'tv' },
  { label: 'Writers', value: 'writers' }
];

function getRouteParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function getErrorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  )
    return (error as { message: string }).message;

  return 'Something went wrong.';
}

function formatInterestLabel(value: string): string {
  if (value.toLowerCase() === 'tv') return 'TV';

  return value
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(' ');
}

function getSearchTab(value: string | string[] | undefined): SearchTab {
  const tab = getRouteParam(value);
  return searchTabs.some(({ value }) => value === tab)
    ? (tab as SearchTab)
    : 'top';
}

function getPeopleFilter(query: ParsedUrlQuery): SearchPeopleFilter {
  return query.pf === 'on' ? 'followed' : 'anyone';
}

function getPostFilter(tab: SearchTab): SearchPostFilter {
  if (tab === 'live') return 'latest';
  if (tab === 'image') return 'photos';
  if (tab === 'video') return 'videos';
  return 'top';
}

function cleanQuery(
  query: Record<string, string | undefined>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(query).filter(
      (entry): entry is [string, string] => !!entry[1]
    )
  );
}

function getTabQuery(
  searchQuery: string,
  tab: SearchTab,
  query: ParsedUrlQuery
): Record<string, string> {
  return cleanQuery({
    q: searchQuery,
    src: getRouteParam(query.src) || 'typed_query',
    f: tab === 'top' ? undefined : tab,
    pf: query.pf === 'on' ? 'on' : undefined,
    lf: query.lf === 'on' ? 'on' : undefined
  });
}

function ExploreSearchHeader(): JSX.Element {
  const interestsModal = useModal();

  return (
    <>
      <header
        className='hover-animation sticky top-0 z-20 flex items-center gap-2 bg-main-background/90
                   px-4 py-1.5 backdrop-blur-md'
      >
        <MobileSidebar />
        <SearchBar
          className='min-w-0 flex-1 bg-transparent p-0'
          sticky={false}
        />
        <Button
          className='group relative p-2 hover:bg-light-primary/10 active:bg-light-primary/20
                     dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
          aria-label='Explore settings'
          onClick={interestsModal.openModal}
        >
          <CustomIcon className='h-5 w-5' iconName='TwitterSettingsIcon' />
          <ToolTip tip='Settings' />
        </Button>
      </header>
      <Modal
        className='flex items-stretch justify-center p-0 sm:items-start sm:p-4 sm:pt-10'
        modalClassName='flex h-full w-full flex-col overflow-hidden bg-main-background shadow-xl
                        sm:h-[720px] sm:max-h-[calc(100vh-48px)] sm:max-w-[600px] sm:rounded-2xl'
        open={interestsModal.open}
        closeModal={interestsModal.closeModal}
      >
        <ExploreInterestsPanel closeModal={interestsModal.closeModal} />
      </Modal>
    </>
  );
}

function ExploreInterestsPanel({
  closeModal
}: {
  closeModal: () => void;
}): JSX.Element {
  const { user } = useAuth();
  const [selectedInterests, setSelectedInterests] = useState<Set<string>>(
    () => new Set()
  );
  const [savingInterest, setSavingInterest] = useState<string | null>(null);
  const {
    data: interests,
    error,
    mutate
  } = useSWR<string[], Error>(
    user ? `explore-interests:${user.id}` : null,
    getInterestsSetting,
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    if (!interests) return;

    setSelectedInterests(new Set(interests));
  }, [interests]);

  const interestOptions = useMemo(() => {
    const knownInterests = new Set(
      blueskyInterestOptions.map(({ value }) => value)
    );
    const extraInterests = Array.from(selectedInterests)
      .filter((value) => !knownInterests.has(value))
      .map((value) => ({ label: formatInterestLabel(value), value }));

    return [...blueskyInterestOptions, ...extraInterests];
  }, [selectedInterests]);

  const handleInterestToggle = async (value: string): Promise<void> => {
    if (savingInterest) return;

    const previousInterests = selectedInterests;
    const nextInterests = new Set(selectedInterests);

    if (nextInterests.has(value)) nextInterests.delete(value);
    else nextInterests.add(value);

    setSelectedInterests(nextInterests);
    setSavingInterest(value);

    try {
      const savedInterests = await updateInterestsSetting(
        Array.from(nextInterests)
      );

      await mutate(savedInterests, false);
      toast.success('Interests updated');
    } catch (error) {
      setSelectedInterests(previousInterests);
      toast.error(getErrorMessage(error));
    } finally {
      setSavingInterest(null);
    }
  };

  const renderBody = (): JSX.Element => {
    if (error)
      return (
        <div className='px-8 py-12 text-center'>
          <p className='text-xl font-extrabold'>Interests didn’t load</p>
          <p className='mt-2 text-[15px] leading-5 text-light-secondary dark:text-dark-secondary'>
            {getErrorMessage(error)}
          </p>
          <Button
            className='accent-tab mt-5 inline-flex h-10 items-center justify-center rounded-full
                       bg-main-accent px-5 py-0 text-center font-bold text-white hover:bg-main-accent/90'
            onClick={(): void => void mutate()}
          >
            Try again
          </Button>
        </div>
      );

    if (!interests)
      return (
        <div className='py-12'>
          <Loading />
        </div>
      );

    return (
      <div className='px-5 pb-8 pt-5 sm:px-8'>
        <p className='text-[15px] leading-5 text-light-secondary dark:text-dark-secondary'>
          Your selected interests help us serve you content you care about.
        </p>
        <div className='mt-4 h-px bg-light-border dark:bg-dark-border' />
        <div className='mt-4 flex flex-wrap gap-3'>
          {interestOptions.map(({ label, value }) => {
            const selected = selectedInterests.has(value);
            const saving = savingInterest === value;

            return (
              <Button
                className={cn(
                  `h-9 rounded-full border px-5 py-0 text-[15px] font-bold transition
                   focus-visible:outline focus-visible:outline-2 focus-visible:outline-main-accent`,
                  selected
                    ? `border-main-accent bg-main-accent text-white hover:bg-main-accent/90
                       disabled:bg-main-accent`
                    : `border-transparent bg-main-sidebar-background text-light-primary hover:bg-light-primary/10
                       disabled:bg-main-sidebar-background dark:text-dark-primary dark:hover:bg-dark-primary/10`,
                  savingInterest && !saving && 'opacity-70',
                  saving && 'cursor-wait'
                )}
                aria-pressed={selected}
                disabled={!!savingInterest}
                loading={saving}
                onClick={(): void => void handleInterestToggle(value)}
                key={value}
              >
                {label}
              </Button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      <header
        className='sticky top-0 z-10 flex h-[53px] shrink-0 items-center gap-5 border-b
                   border-light-border bg-main-background/90 px-3 backdrop-blur-md dark:border-dark-border'
      >
        <Button
          className='dark-bg-tab p-2 hover:bg-light-primary/10 active:bg-light-primary/20
                     dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
          aria-label='Back'
          onClick={closeModal}
        >
          <CustomIcon className='h-5 w-5' iconName='TwitterArrowLeftIcon' />
        </Button>
        <h2 className='truncate text-xl font-extrabold'>Your interests</h2>
      </header>
      <div className='min-h-0 flex-1 overflow-y-auto'>{renderBody()}</div>
    </>
  );
}

function SearchTabs({
  activeTab,
  searchQuery,
  query
}: {
  activeTab: SearchTab;
  searchQuery: string;
  query: ParsedUrlQuery;
}): JSX.Element {
  return (
    <nav className='flex border-b border-light-border dark:border-dark-border'>
      {searchTabs.map(({ label, value }) => {
        const active = activeTab === value;

        return (
          <Link
            href={{
              pathname: '/explore',
              query: getTabQuery(searchQuery, value, query)
            }}
            shallow
            key={value}
          >
            <a
              className={cn(
                `accent-tab hover-card relative flex h-[53px] flex-1 items-center justify-center
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

function SearchEmptyState({
  searchQuery
}: {
  searchQuery: string;
}): JSX.Element {
  return (
    <div className='mx-auto flex max-w-sm flex-col px-8 py-10'>
      <h2 className='text-[31px] font-extrabold leading-9'>
        No results for &quot;{searchQuery}&quot;
      </h2>
      <p className='mt-2 text-[15px] text-light-secondary dark:text-dark-secondary'>
        The term you entered did not bring up any results.
      </p>
    </div>
  );
}

function SearchResults({
  activeTab,
  searchQuery,
  query
}: {
  activeTab: SearchTab;
  searchQuery: string;
  query: ParsedUrlQuery;
}): JSX.Element {
  const people = getPeopleFilter(query);
  const showUsers = activeTab === 'top' || activeTab === 'user';
  const showTweets = activeTab !== 'user';
  const {
    data: tweetsData,
    loading: tweetsLoading,
    error: tweetsError
  } = useSearchTweets(
    searchQuery,
    {
      filter: getPostFilter(activeTab),
      people,
      disabled: !showTweets
    },
    { revalidateOnFocus: false }
  );
  const {
    data: usersData,
    loading: usersLoading,
    error: usersError
  } = useSearchUsers(
    searchQuery,
    {
      people,
      disabled: !showUsers
    },
    { revalidateOnFocus: false }
  );
  const loading = (showTweets && tweetsLoading) || (showUsers && usersLoading);
  const error = tweetsError ?? usersError;
  const tweets = tweetsData?.tweets ?? [];
  const users = usersData?.users ?? [];
  const hasUsers = users.length > 0;
  const hasTweets = tweets.length > 0;

  if (loading) return <Loading className='mt-5' />;

  if (error) return <Error message='Something went wrong while searching.' />;

  if (activeTab === 'user')
    return hasUsers ? (
      <motion.div className='mt-0.5' {...variants}>
        {users.map((user) => (
          <UserCard {...user} key={user.id} follow />
        ))}
      </motion.div>
    ) : (
      <SearchEmptyState searchQuery={searchQuery} />
    );

  if (!hasUsers && !hasTweets)
    return <SearchEmptyState searchQuery={searchQuery} />;

  return (
    <section className='mt-0.5'>
      {activeTab === 'top' && hasUsers && (
        <motion.div
          className='border-b border-light-border dark:border-dark-border'
          {...variants}
        >
          <div className='px-4 py-3 text-xl font-extrabold'>People</div>
          {users.slice(0, 3).map((user) => (
            <UserCard {...user} key={user.id} follow />
          ))}
          <Link
            href={{
              pathname: '/explore',
              query: getTabQuery(searchQuery, 'user', query)
            }}
            shallow
          >
            <a className='accent-tab hover-card block px-4 py-3 text-main-accent'>
              View all
            </a>
          </Link>
        </motion.div>
      )}
      {hasTweets ? (
        <AnimatePresence>
          {tweets.map((tweet) => (
            <Tweet {...tweet} key={tweet.id} />
          ))}
        </AnimatePresence>
      ) : (
        <SearchEmptyState searchQuery={searchQuery} />
      )}
    </section>
  );
}

export default function Explore(): JSX.Element {
  const { query } = useRouter();
  const searchQuery = getRouteParam(query.q).trim();
  const activeTab = getSearchTab(query.f);
  const searching = !!searchQuery;

  return (
    <MainContainer>
      <SEO
        title={
          searching
            ? `${searchQuery} - Not Twitter Search / Not Twitter`
            : 'Explore / Not Twitter'
        }
      />
      <ExploreSearchHeader />
      {searching ? (
        <>
          <SearchTabs
            activeTab={activeTab}
            searchQuery={searchQuery}
            query={query}
          />
          <SearchResults
            activeTab={activeTab}
            searchQuery={searchQuery}
            query={query}
          />
        </>
      ) : (
        <>
          <div className='border-y border-light-border px-4 py-3 dark:border-dark-border'>
            <h1 className='text-xl font-extrabold'>Trends for you</h1>
          </div>
          <AsideTrends inTrendsPage />
        </>
      )}
    </MainContainer>
  );
}

Explore.getLayout = (page: ReactElement): ReactNode => (
  <ProtectedLayout>
    <MainLayout>
      <TrendsLayout>{page}</TrendsLayout>
    </MainLayout>
  </ProtectedLayout>
);
