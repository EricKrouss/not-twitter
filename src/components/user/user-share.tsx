import cn from 'clsx';
import { Popover } from '@headlessui/react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { preventBubbling } from '@lib/utils';
import { siteURL } from '@lib/env';
import { getUserPath } from '@lib/routes';
import { manageBlock } from '@lib/atproto/utils';
import { useAuth } from '@lib/context/auth-context';
import { useModal } from '@lib/hooks/useModal';
import { Modal } from '@components/modal/modal';
import { ActionModal } from '@components/modal/action-modal';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import { ToolTip } from '@components/ui/tooltip';
import { variants } from '@components/tweet/tweet-actions';

type UserShareProps = {
  targetId?: string;
  username: string;
  blocking?: boolean;
  blockingByListName?: string | null;
};

export function UserShare({
  targetId,
  username,
  blocking,
  blockingByListName
}: UserShareProps): JSX.Element {
  const { user } = useAuth();
  const { open, openModal, closeModal } = useModal();
  const canBlock = !!user && !!targetId && user.id !== targetId;
  const blockIsListOnly = !!blocking && !!blockingByListName;

  const handleCopy = (closeMenu: () => void) => async (): Promise<void> => {
    closeMenu();
    await navigator.clipboard.writeText(`${siteURL}${getUserPath(username)}`);
    toast.success('Copied to clipboard');
  };
  const handleOpenBlock = (closeMenu: () => void) => (): void => {
    closeMenu();
    openModal();
  };
  const handleBlock = async (): Promise<void> => {
    if (!user || !targetId) return;
    await manageBlock('block', user.id, targetId);
    closeModal();
    toast.success(`@${username} has been blocked`);
  };
  const handleUnblock = async (): Promise<void> => {
    if (!user || !targetId) return;
    await manageBlock('unblock', user.id, targetId);
    closeModal();
    toast.success(`@${username} has been unblocked`);
  };
  const actionIsUnblock = !!blocking && !blockIsListOnly;

  return (
    <>
      <Modal
        modalClassName='flex flex-col gap-6 max-w-xs bg-main-background w-full p-8 rounded-2xl'
        open={open}
        closeModal={closeModal}
      >
        <ActionModal
          title={
            actionIsUnblock ? `Unblock @${username}?` : `Block @${username}?`
          }
          description={
            actionIsUnblock
              ? 'They will be able to follow you and view your Tweets.'
              : 'They will not be able to follow you or view your Tweets, and you will not see their Tweets in your timeline.'
          }
          mainBtnLabel={actionIsUnblock ? 'Unblock' : 'Block'}
          mainBtnClassName={
            actionIsUnblock
              ? undefined
              : 'bg-accent-red hover:bg-accent-red/90 active:bg-accent-red/80'
          }
          action={actionIsUnblock ? handleUnblock : handleBlock}
          closeModal={closeModal}
        />
      </Modal>
      <Popover className='relative'>
        {({ open, close }): JSX.Element => (
          <>
            <Popover.Button
              as={Button}
              className={cn(
                `dark-bg-tab group relative border border-light-line-reply p-2
                 hover:bg-light-primary/10 active:bg-light-primary/20 dark:border-light-secondary
                 dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20`,
                open && 'bg-light-primary/10 dark:bg-dark-primary/10'
              )}
            >
              <HeroIcon className='h-5 w-5' iconName='EllipsisHorizontalIcon' />
              {!open && <ToolTip tip='More' />}
            </Popover.Button>
            <AnimatePresence>
              {open && (
                <Popover.Panel
                  className='menu-container group absolute right-0 top-11 whitespace-nowrap
                             text-light-primary dark:text-dark-primary'
                  as={motion.div}
                  {...variants}
                  static
                >
                  <Popover.Button
                    className={cn(
                      'flex w-full gap-3 rounded-md p-4 hover:bg-main-sidebar-background',
                      canBlock && 'rounded-b-none'
                    )}
                    as={Button}
                    onClick={preventBubbling(handleCopy(close))}
                  >
                    <HeroIcon iconName='LinkIcon' />
                    Copy link to Profile
                  </Popover.Button>
                  {canBlock && (
                    <Popover.Button
                      className={cn(
                        `flex w-full gap-3 rounded-md rounded-t-none p-4
                         hover:bg-main-sidebar-background`,
                        !actionIsUnblock && 'text-accent-red',
                        blockIsListOnly && 'cursor-not-allowed opacity-70'
                      )}
                      as={Button}
                      disabled={blockIsListOnly}
                      onClick={preventBubbling(handleOpenBlock(close))}
                    >
                      <HeroIcon iconName='NoSymbolIcon' />
                      {blockIsListOnly
                        ? `Blocked by ${blockingByListName}`
                        : actionIsUnblock
                        ? `Unblock @${username}`
                        : `Block @${username}`}
                    </Popover.Button>
                  )}
                </Popover.Panel>
              )}
            </AnimatePresence>
          </>
        )}
      </Popover>
    </>
  );
}
