import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import cn from 'clsx';
import { getUserPath } from '@lib/routes';
import { HeroIcon } from '@components/ui/hero-icon';
import { Button } from '@components/ui/button';
import type { ChangeEvent, FormEvent, KeyboardEvent } from 'react';

type SearchBarProps = {
  className?: string;
  labelClassName?: string;
  placeholder?: string;
  sticky?: boolean;
  withDropdown?: boolean;
};

function getRouteParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function getProfileHandle(value: string): string | null {
  const username = value.trim().replace(/^@+/, '').toLowerCase();

  if (!username) return null;
  if (/\s/.test(username)) return null;

  return username.includes('.') ? username : `${username}.bsky.social`;
}

export function SearchBar({
  className,
  labelClassName,
  placeholder = 'Search Not Twitter',
  sticky = true,
  withDropdown = true
}: SearchBarProps): JSX.Element {
  const [inputValue, setInputValue] = useState('');
  const [focused, setFocused] = useState(false);

  const { push, query } = useRouter();

  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const trimmedInput = inputValue.trim();
  const profileHandle = getProfileHandle(trimmedInput);

  useEffect(() => {
    setInputValue(getRouteParam(query.q));
  }, [query.q]);

  const handleChange = ({
    target: { value }
  }: ChangeEvent<HTMLInputElement>): void => setInputValue(value);

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();

    if (!trimmedInput) return;

    void push({
      pathname: '/explore',
      query: { q: trimmedInput, src: 'typed_query' }
    });
  };

  const handleProfileClick = (): void => {
    if (!profileHandle) return;

    void push(getUserPath(profileHandle));
  };

  const clearInputValue = (focus?: boolean) => (): void => {
    if (focus) inputRef.current?.focus();
    else inputRef.current?.blur();

    setInputValue('');
  };

  const handleFocus = (): void => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    setFocused(true);
  };

  const handleBlur = (): void => {
    blurTimeoutRef.current = setTimeout(() => setFocused(false), 120);
  };

  const handleEscape = ({ key }: KeyboardEvent<HTMLInputElement>): void => {
    if (key === 'Escape') clearInputValue()();
  };

  return (
    <form
      className={cn(
        'hover-animation relative z-10 bg-main-background',
        sticky && 'sticky top-0 -my-2 py-2',
        className
      )}
      onSubmit={handleSubmit}
    >
      <label
        className={cn(
          `group flex h-11 items-center justify-between gap-4 rounded-full
           bg-main-search-background px-4 transition focus-within:bg-main-background
           focus-within:ring-2 focus-within:ring-main-accent`,
          labelClassName
        )}
      >
        <i>
          <HeroIcon
            className='h-5 w-5 text-light-secondary transition-colors 
                       group-focus-within:text-main-accent dark:text-dark-secondary'
            iconName='MagnifyingGlassIcon'
          />
        </i>
        <input
          className='peer flex-1 bg-transparent outline-none 
                     placeholder:text-light-secondary dark:placeholder:text-dark-secondary'
          type='text'
          placeholder={placeholder}
          ref={inputRef}
          value={inputValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyUp={handleEscape}
        />
        <Button
          className={cn(
            'accent-tab bg-main-accent p-1 opacity-0 transition hover:bg-main-accent/90 disabled:opacity-0',
            inputValue && 'focus:opacity-100 peer-focus:opacity-100'
          )}
          onClick={clearInputValue(true)}
          disabled={!inputValue}
        >
          <HeroIcon className='h-3 w-3 stroke-white' iconName='XMarkIcon' />
        </Button>
      </label>
      {withDropdown && focused && (
        <div
          className='menu-container absolute top-full left-0 right-0 mt-2 overflow-hidden
                     rounded-2xl bg-main-background py-3'
        >
          {trimmedInput ? (
            <>
              {profileHandle && (
                <button
                  className='accent-tab hover-card flex w-full items-center gap-3 px-4 py-3 text-left'
                  type='button'
                  onClick={handleProfileClick}
                >
                  <HeroIcon
                    className='h-5 w-5 text-light-secondary dark:text-dark-secondary'
                    iconName='UserCircleIcon'
                  />
                  <span className='min-w-0 truncate'>
                    Go to @{profileHandle}
                  </span>
                </button>
              )}
              <button
                className='accent-tab hover-card flex w-full items-center gap-3 px-4 py-3 text-left'
                type='submit'
              >
                <HeroIcon
                  className='h-5 w-5 text-light-secondary dark:text-dark-secondary'
                  iconName='MagnifyingGlassIcon'
                />
                <span className='min-w-0 truncate'>
                  Search for &quot;{trimmedInput}&quot;
                </span>
              </button>
            </>
          ) : (
            <p className='px-8 py-5 text-center text-[15px] text-light-secondary dark:text-dark-secondary'>
              Try searching for people, topics, or keywords
            </p>
          )}
        </div>
      )}
    </form>
  );
}
