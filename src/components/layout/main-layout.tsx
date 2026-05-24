import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { SWRConfig } from 'swr';
import { Toaster } from 'react-hot-toast';
import { fetchJSON } from '@lib/fetch';
import { useAuth } from '@lib/context/auth-context';
import { getUserPath } from '@lib/routes';
import { LiveUpdatesProvider } from '@lib/context/live-updates-context';
import { useWindow, WindowContextProvider } from '@lib/context/window-context';
import { Sidebar } from '@components/sidebar/sidebar';
import { KeyboardShortcutsModal } from '@components/modal/keyboard-shortcuts-modal';
import type { DefaultToastOptions } from 'react-hot-toast';
import type { LayoutProps } from './common-layout';

const toastOptions: DefaultToastOptions = {
  style: {
    color: 'white',
    borderRadius: '4px',
    backgroundColor: 'rgb(var(--main-accent))'
  },
  success: { duration: 4000 }
};

function MainToaster(): JSX.Element {
  const { isMobile } = useWindow();

  return (
    <Toaster
      position='bottom-center'
      toastOptions={toastOptions}
      containerClassName={isMobile ? 'mb-12' : 'mb-0'}
    />
  );
}

export function MainLayout({ children }: LayoutProps): JSX.Element {
  const router = useRouter();
  const { user } = useAuth();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const isGKeyPressedRef = useRef(false);
  const gKeyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const username = user?.username;

  useEffect(() => {
    const handleRouteChange = (): void => {
      const currentSelected = document.querySelector('.tweet-article.selected-tweet');
      if (currentSelected) {
        currentSelected.classList.remove('selected-tweet');
      }
    };
    router.events.on('routeChangeStart', handleRouteChange);
    return () => {
      router.events.off('routeChangeStart', handleRouteChange);
    };
  }, [router]);

  useEffect(() => {
    const routesToPrefetch = ['/home', '/explore', '/notifications', '/messages', '/bookmarks', '/settings', '/lists'];
    routesToPrefetch.forEach((route) => {
      void router.prefetch(route);
    });
    if (username) {
      void router.prefetch(getUserPath(username));
    }
  }, [router, username]);

  const clickButton = (selector: string): void => {
    const btn = document.querySelector(selector) as HTMLElement;
    if (btn) btn.click();
  };

  const handleNextTweet = (): void => {
    const tweets = Array.from(document.querySelectorAll('.tweet-article'));
    if (tweets.length === 0) return;
    const currentSelected = document.querySelector('.tweet-article.selected-tweet');
    let nextIndex = 0;
    if (currentSelected) {
      const currentIndex = tweets.indexOf(currentSelected);
      nextIndex = currentIndex + 1;
      currentSelected.classList.remove('selected-tweet');
    } else {
      const viewportTop = window.scrollY;
      let minDiff = Infinity;
      tweets.forEach((el, index) => {
        const rect = el.getBoundingClientRect();
        const top = rect.top + window.scrollY;
        const diff = Math.abs(top - viewportTop);
        if (diff < minDiff) {
          minDiff = diff;
          nextIndex = index;
        }
      });
    }
    if (nextIndex < tweets.length) {
      const nextSelected = tweets[nextIndex];
      nextSelected.classList.add('selected-tweet');
      nextSelected.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (currentSelected) {
      currentSelected.classList.add('selected-tweet');
    }
  };

  const handlePrevTweet = (): void => {
    const tweets = Array.from(document.querySelectorAll('.tweet-article'));
    if (tweets.length === 0) return;
    const currentSelected = document.querySelector('.tweet-article.selected-tweet');
    let prevIndex = 0;
    if (currentSelected) {
      const currentIndex = tweets.indexOf(currentSelected);
      prevIndex = currentIndex - 1;
      currentSelected.classList.remove('selected-tweet');
    } else {
      const viewportTop = window.scrollY;
      let minDiff = Infinity;
      tweets.forEach((el, index) => {
        const rect = el.getBoundingClientRect();
        const top = rect.top + window.scrollY;
        const diff = Math.abs(top - viewportTop);
        if (diff < minDiff) {
          minDiff = diff;
          prevIndex = index;
        }
      });
    }
    if (prevIndex >= 0) {
      const prevSelected = tweets[prevIndex];
      prevSelected.classList.add('selected-tweet');
      prevSelected.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (currentSelected) {
      currentSelected.classList.add('selected-tweet');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const activeElement = document.activeElement;
      const isInput =
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.getAttribute('contenteditable') === 'true');

      if (isInput) {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          const form = activeElement.closest('form');
          if (form) {
            e.preventDefault();
            form.requestSubmit();
          }
        }
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (isGKeyPressedRef.current) {
        isGKeyPressedRef.current = false;
        if (gKeyTimeoutRef.current) clearTimeout(gKeyTimeoutRef.current);

        let targetRoute = '';
        switch (e.key.toLowerCase()) {
          case 'h':
            targetRoute = '/home';
            break;
          case 'e':
            targetRoute = '/explore';
            break;
          case 'n':
            targetRoute = '/notifications';
            break;
          case 'm':
            targetRoute = '/messages';
            break;
          case 'b':
            targetRoute = '/bookmarks';
            break;
          case 's':
            targetRoute = '/settings';
            break;
          case 'i':
            targetRoute = '/lists';
            break;
          case 'p':
            if (username) targetRoute = getUserPath(username);
            break;
        }

        if (targetRoute) {
          e.preventDefault();
          if (targetRoute === '/home' && router.asPath === '/home') {
            window.dispatchEvent(new CustomEvent('refresh-home-feed'));
          } else {
            void router.push(targetRoute);
          }
          return;
        }
      }

      switch (e.key) {
        case 'Backspace':
          e.preventDefault();
          void router.back();
          break;
        case '?':
          e.preventDefault();
          setShortcutsOpen(true);
          break;
        case 'n':
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('open-tweet-modal'));
          break;
        case '/': {
          const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
          if (searchInput) {
            e.preventDefault();
            searchInput.focus();
            searchInput.select();
          }
          break;
        }
        case 'j':
          e.preventDefault();
          handleNextTweet();
          break;
        case 'k':
          e.preventDefault();
          handlePrevTweet();
          break;
        case ' ': { // Space
          const currentSelectedForSpace = document.querySelector('.tweet-article.selected-tweet');
          const videoInSelected = currentSelectedForSpace?.querySelector('video') as HTMLVideoElement;
          if (videoInSelected) {
            e.preventDefault();
            if (videoInSelected.paused) void videoInSelected.play();
            else videoInSelected.pause();
          }
          break;
        }
        case 'l':
          e.preventDefault();
          clickButton('.tweet-article.selected-tweet button[aria-label="Like"], .tweet-article.selected-tweet button[aria-label="Unlike"]');
          break;
        case 'r':
          e.preventDefault();
          clickButton('.tweet-article.selected-tweet button[aria-label="Reply"]');
          break;
        case 't': {
          e.preventDefault();
          const currentSelected = document.querySelector('.tweet-article.selected-tweet');
          if (currentSelected) {
            const retweetBtn = currentSelected.querySelector('button[aria-label="Retweet"], button[aria-label="Undo Retweet"]') as HTMLElement;
            if (retweetBtn) {
              retweetBtn.click();
              setTimeout(() => {
                const popoverPanel = retweetBtn.closest('.relative')?.querySelector('.menu-container') as HTMLElement;
                if (popoverPanel) {
                  const actionBtn = popoverPanel.querySelector('button') as HTMLElement;
                  if (actionBtn) actionBtn.click();
                }
              }, 50);
            }
          }
          break;
        }
        case 's':
          e.preventDefault();
          clickButton('.tweet-article.selected-tweet button[aria-label="Share"]');
          break;
        case 'b':
          e.preventDefault();
          clickButton('.tweet-article.selected-tweet button[aria-label="Bookmark"], .tweet-article.selected-tweet button[aria-label="Remove from Bookmarks"]');
          break;
        case 'o':
          e.preventDefault();
          clickButton('.tweet-article.selected-tweet img[src*="preview"], .tweet-article.selected-tweet img[src*="blob"], .tweet-article.selected-tweet img');
          break;
        case 'Enter': {
          const activeTweet = document.querySelector('.tweet-article.selected-tweet');
          if (activeTweet) {
            const link = (activeTweet.querySelector('a.hover-card') ??
              activeTweet.querySelector('a[href*="/post/"]') ??
              activeTweet.querySelector('a[href*="/status/"]') ??
              activeTweet.querySelector('a[href^="/tweet/"]')) as HTMLAnchorElement;
            if (link) {
              e.preventDefault();
              link.click();
            }
          }
          break;
        }
        case 'm': {
          const activeTweetForMute = document.querySelector('.tweet-article.selected-tweet');
          const videoInMute = activeTweetForMute?.querySelector('video') as HTMLVideoElement;
          if (videoInMute) {
            e.preventDefault();
            videoInMute.muted = !videoInMute.muted;
          }
          break;
        }
        case 'g':
        case 'G':
          isGKeyPressedRef.current = true;
          if (gKeyTimeoutRef.current) clearTimeout(gKeyTimeoutRef.current);
          gKeyTimeoutRef.current = setTimeout(() => {
            isGKeyPressedRef.current = false;
          }, 1000);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (gKeyTimeoutRef.current) clearTimeout(gKeyTimeoutRef.current);
    };
  }, [username, router]);

  return (
    <div className='flex w-full justify-center gap-0 min-[1120px]:gap-4'>
      <WindowContextProvider>
        <LiveUpdatesProvider>
          <Sidebar />
          <SWRConfig value={{ fetcher: fetchJSON }}>{children}</SWRConfig>
        </LiveUpdatesProvider>
        <MainToaster />
      </WindowContextProvider>
      <KeyboardShortcutsModal open={shortcutsOpen} closeModal={() => setShortcutsOpen(false)} />
    </div>
  );
}
