import useSWR from 'swr';
import {
  searchTweets,
  searchUsers,
  type SearchPeopleFilter,
  type SearchPostFilter,
  type SearchTweetsPage,
  type SearchUsersPage
} from '@lib/atproto/backend';
import type { SWRConfiguration } from 'swr';

type SearchHookReturn<T> = {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
};

type SearchTweetsOptions = {
  filter?: SearchPostFilter;
  people?: SearchPeopleFilter;
  disabled?: boolean;
};

type SearchUsersOptions = {
  people?: SearchPeopleFilter;
  disabled?: boolean;
};

export function useSearchTweets(
  query: string,
  options?: SearchTweetsOptions,
  config?: SWRConfiguration
): SearchHookReturn<SearchTweetsPage> {
  const searchQuery = query.trim();
  const disabled = (options?.disabled ?? false) || !searchQuery;

  const { data, error } = useSWR<SearchTweetsPage, Error>(
    disabled
      ? null
      : [
          'search-tweets',
          searchQuery,
          options?.filter ?? 'top',
          options?.people ?? 'anyone'
        ],
    () =>
      searchTweets(searchQuery, {
        filter: options?.filter,
        people: options?.people
      }),
    config
  );

  return {
    data,
    error,
    loading: !disabled && !error && !data
  };
}

export function useSearchUsers(
  query: string,
  options?: SearchUsersOptions,
  config?: SWRConfiguration
): SearchHookReturn<SearchUsersPage> {
  const searchQuery = query.trim();
  const disabled = (options?.disabled ?? false) || !searchQuery;

  const { data, error } = useSWR<SearchUsersPage, Error>(
    disabled
      ? null
      : ['search-users', searchQuery, options?.people ?? 'anyone'],
    () =>
      searchUsers(searchQuery, {
        people: options?.people
      }),
    config
  );

  return {
    data,
    error,
    loading: !disabled && !error && !data
  };
}
