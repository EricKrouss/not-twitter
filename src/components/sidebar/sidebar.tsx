import Link from 'next/link';
import { useAuth } from '@lib/context/auth-context';
import { useLiveUpdates } from '@lib/context/live-updates-context';
import { useWindow } from '@lib/context/window-context';
import { useModal } from '@lib/hooks/useModal';
import { getUserPath } from '@lib/routes';
import { Modal } from '@components/modal/modal';
import { Input } from '@components/input/input';
import { CustomIcon } from '@components/ui/custom-icon';
import { Button } from '@components/ui/button';
import { SidebarLink } from './sidebar-link';
import { MoreSettings } from './more-settings';
import { navLinks } from './nav-links';
import { SidebarProfile } from './sidebar-profile';

export function Sidebar(): JSX.Element {
  const { user } = useAuth();
  const { isMobile } = useWindow();
  const { homeBadgeCount, messageCount, notificationCount } = useLiveUpdates();

  const { open, openModal, closeModal } = useModal();

  const username = user?.username as string;

  return (
    <header
      id='sidebar'
      className='flex w-0 shrink-0 transition-opacity duration-200 xs:w-20 md:w-24
                 lg:max-w-none xl:-mr-4 xl:w-full xl:max-w-xs xl:justify-end'
    >
      <Modal
        className='flex items-start justify-center'
        modalClassName='bg-main-background rounded-2xl max-w-xl w-full mt-8 overflow-hidden'
        open={open}
        closeModal={closeModal}
      >
        <Input modal closeModal={closeModal} />
      </Modal>
      <div
        className='fixed bottom-0 z-10 flex w-full flex-col justify-between border-t border-light-border 
                   bg-main-background py-0 pb-[env(safe-area-inset-bottom)] dark:border-dark-border xs:top-0 xs:h-full xs:w-auto xs:border-0
                   xs:bg-transparent xs:px-2 xs:py-3 xs:pt-2 md:px-4 xl:w-72'
      >
        <section className='flex flex-col justify-center gap-2 xs:items-center xl:items-stretch'>
          <h1 className='hidden xs:flex'>
            <Link href='/home'>
              <a
                className='custom-button main-tab text-accent-blue transition hover:bg-light-primary/10 
                           focus-visible:bg-accent-blue/10 focus-visible:!ring-accent-blue/80
                           dark:text-twitter-icon dark:hover:bg-dark-primary/10'
              >
                <CustomIcon className='h-7 w-7' iconName='TwitterIcon' />
              </a>
            </Link>
          </h1>
          <nav className='flex items-center justify-around xs:flex-col xs:justify-center xl:block'>
            {navLinks.map(({ ...linkData }) => (
              <SidebarLink
                {...linkData}
                badgeCount={
                  linkData.href === '/notifications'
                    ? notificationCount
                    : linkData.href === '/messages'
                    ? messageCount
                    : 0
                }
                badgeDot={linkData.href === '/home' && homeBadgeCount > 0}
                key={linkData.href}
              />
            ))}
            <SidebarLink
              href={getUserPath(username)}
              username={username}
              linkName='Profile'
              iconName='TwitterProfileIcon'
            />
            {!isMobile && <MoreSettings />}
          </nav>
          <Button
            className='accent-tab absolute right-4 flex h-[52px] -translate-y-[72px] items-center justify-center
                       bg-main-accent text-center text-lg font-bold text-white outline-none transition-colors
                       hover:bg-main-accent/90 active:bg-main-accent/75 xs:static xs:translate-y-0 xl:w-11/12'
            onClick={openModal}
          >
            <CustomIcon
              className='block h-6 w-6 xl:hidden'
              iconName='FeatherIcon'
            />
            <p className='hidden xl:block'>Tweet</p>
          </Button>
        </section>
        {!isMobile && <SidebarProfile />}
      </div>
    </header>
  );
}
