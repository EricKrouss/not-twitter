import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { CustomIcon } from '@components/ui/custom-icon';
import { HeroIcon } from '@components/ui/hero-icon';

type LoggedOutTwitterLayoutProps = {
  children: ReactNode;
};

function LoggedOutThemeBoundary({
  children
}: LoggedOutTwitterLayoutProps): JSX.Element {
  useEffect(() => {
    const root = document.documentElement;
    const previousClassName = root.className;
    const previousBackground = root.style.getPropertyValue('--main-background');
    const previousSearchBackground = root.style.getPropertyValue(
      '--main-search-background'
    );
    const previousSidebarBackground = root.style.getPropertyValue(
      '--main-sidebar-background'
    );

    root.classList.remove('dark');
    root.style.setProperty('--main-background', 'var(--light-background)');
    root.style.setProperty(
      '--main-search-background',
      'var(--light-search-background)'
    );
    root.style.setProperty(
      '--main-sidebar-background',
      'var(--light-sidebar-background)'
    );

    return () => {
      root.className = previousClassName;
      root.style.setProperty('--main-background', previousBackground);
      root.style.setProperty(
        '--main-search-background',
        previousSearchBackground
      );
      root.style.setProperty(
        '--main-sidebar-background',
        previousSidebarBackground
      );
    };
  }, []);

  return <>{children}</>;
}

function LoggedOutSearch(): JSX.Element {
  const [value, setValue] = useState('');
  const { push } = useRouter();

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const query = value.trim();
    if (!query) return;

    void push({
      pathname: '/explore',
      query: { q: query, src: 'typed_query' }
    });
  };

  return (
    <form
      className='mx-5 hidden h-11 min-w-0 max-w-[525px] flex-1 md:block'
      role='search'
      onSubmit={handleSubmit}
    >
      <label
        className='flex h-full items-center gap-4 rounded-full bg-[#e6ecf0] px-5 text-[#657786]
                   focus-within:bg-white focus-within:ring-1 focus-within:ring-main-accent'
      >
        <HeroIcon
          className='h-[22px] w-[22px]'
          iconName='MagnifyingGlassIcon'
        />
        <input
          className='min-w-0 flex-1 bg-transparent text-[17px] leading-6 text-[#14171a] outline-none
                     placeholder:text-[#657786]'
          type='text'
          value={value}
          placeholder='Search Not Twitter'
          onChange={({ target: { value } }): void => setValue(value)}
        />
      </label>
    </form>
  );
}

function LoggedOutTopBar(): JSX.Element {
  return (
    <header className='border-b border-[#ccd6dd] bg-white'>
      <nav className='mx-auto flex h-14 w-full max-w-[1280px] items-center px-6'>
        <Link href='/'>
          <a className='main-tab text-[#1da1f2]' aria-label='Not Twitter'>
            <CustomIcon className='h-[31px] w-[31px]' iconName='TwitterIcon' />
          </a>
        </Link>
        <LoggedOutSearch />
        <div className='ml-auto flex items-center gap-3'>
          <Link href='/'>
            <a
              className='main-tab hidden min-w-[87px] rounded-full border border-[#1da1f2] px-4 py-1.5
                         text-center text-[15px] font-bold leading-5 text-[#1da1f2] transition
                         hover:bg-[#1da1f2]/10 sm:block'
            >
              Log in
            </a>
          </Link>
          <Link href='/'>
            <a
              className='main-tab min-w-[97px] rounded-full bg-[#1da1f2] px-4 py-2 text-center
                         text-[15px] font-bold leading-5 text-white transition hover:bg-[#1a91da]'
            >
              Sign up
            </a>
          </Link>
          <button
            className='main-tab hidden rounded-full p-2 text-[#1da1f2] transition hover:bg-[#1da1f2]/10 sm:block'
            type='button'
            aria-label='More'
          >
            <HeroIcon className='h-6 w-6' iconName='EllipsisHorizontalIcon' />
          </button>
        </div>
      </nav>
    </header>
  );
}

export function LoggedOutTwitterLayout({
  children
}: LoggedOutTwitterLayoutProps): JSX.Element {
  return (
    <LoggedOutThemeBoundary>
      <div className='min-h-screen bg-white font-twitter-chirp text-[#14171a]'>
        <LoggedOutTopBar />
        {children}
      </div>
    </LoggedOutThemeBoundary>
  );
}
