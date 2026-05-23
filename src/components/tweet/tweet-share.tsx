import cn from 'clsx';
import { Popover } from '@headlessui/react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { preventBubbling } from '@lib/utils';
import { siteURL } from '@lib/env';
import { getTweetPath } from '@lib/routes';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import { CustomIcon } from '@components/ui/custom-icon';
import { ToolTip } from '@components/ui/tooltip';
import { variants } from './tweet-actions';

type TweetShareProps = {
  tweetId: string;
  username?: string | null;
  viewTweet?: boolean;
  isBookmarked: boolean;
  onBookmark: () => Promise<void>;
  disabled: boolean;
};

export function TweetShare({
  tweetId,
  username,
  viewTweet,
  isBookmarked,
  onBookmark,
  disabled
}: TweetShareProps): JSX.Element {
  const handleCopy = (closeMenu: () => void) => async (): Promise<void> => {
    closeMenu();
    await navigator.clipboard.writeText(
      `${siteURL}${getTweetPath(tweetId, username)}`
    );
    toast.success('Copied to clipboard');
  };

  const handleBookmarkToggle = (closeMenu: () => void) => async (): Promise<void> => {
    closeMenu();
    await onBookmark();
  };

  return (
    <Popover className='relative'>
      {({ open, close }): JSX.Element => (
        <>
          <Popover.Button
            className={cn(
              `group relative flex min-w-[34.75px] items-center gap-2 p-0 outline-none
               transition-colors duration-200 ease-out hover:text-accent-blue
               focus-visible:text-accent-blue`,
              open && 'text-accent-blue inner:bg-accent-blue/10'
            )}
            aria-label='Share'
          >
            <i
              className='relative rounded-full p-2 not-italic duration-200 group-hover:bg-accent-blue/10 
                         group-focus-visible:bg-accent-blue/10 group-focus-visible:ring-2 
                         group-focus-visible:ring-accent-blue/80 group-active:bg-accent-blue/20'
            >
              <CustomIcon
                className={
                  viewTweet
                    ? 'h-[22.5px] w-[22.5px]'
                    : 'h-[18.75px] w-[18.75px]'
                }
                iconName='TwitterShareIcon'
              />
              {!open && <ToolTip tip='Share' />}
            </i>
          </Popover.Button>
          <AnimatePresence>
            {open && (
              <Popover.Panel
                className='menu-container group absolute right-0 top-11 whitespace-nowrap text-light-primary dark:text-dark-primary'
                as={motion.div}
                {...variants}
                static
              >
                <Popover.Button
                  className='accent-tab flex w-full gap-3 rounded-md p-4 hover:bg-main-sidebar-background'
                  as={Button}
                  onClick={preventBubbling(handleCopy(close))}
                >
                  <HeroIcon iconName='LinkIcon' />
                  Copy link to Tweet
                </Popover.Button>
                <Popover.Button
                  className='accent-tab flex w-full gap-3 rounded-md p-4 hover:bg-main-sidebar-background'
                  as={Button}
                  disabled={disabled}
                  onClick={preventBubbling(handleBookmarkToggle(close))}
                >
                  <CustomIcon
                    iconName={
                      isBookmarked
                        ? 'TwitterBookmarksFilledIcon'
                        : 'TwitterBookmarksIcon'
                    }
                    className='h-5 w-5'
                  />
                  {isBookmarked ? 'Remove from Bookmarks' : 'Bookmark'}
                </Popover.Button>
              </Popover.Panel>
            )}
          </AnimatePresence>
        </>
      )}
    </Popover>
  );
}
