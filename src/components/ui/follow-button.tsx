import { useRouter } from 'next/router';
import { useAuth } from '@lib/context/auth-context';
import { useModal } from '@lib/hooks/useModal';
import { manageBlock, manageFollow } from '@lib/atproto/utils';
import { preventBubbling } from '@lib/utils';
import { Modal } from '@components/modal/modal';
import { ActionModal } from '@components/modal/action-modal';
import { Button } from '@components/ui/button';

type FollowButtonProps = {
  userTargetId: string;
  userTargetUsername: string;
  userTargetFollowers?: string[];
  userTargetFollowing?: string[];
  userTargetBlocking?: boolean;
  userTargetBlockedBy?: boolean;
  userTargetBlockingByListName?: string | null;
};

export function FollowButton({
  userTargetId,
  userTargetUsername,
  userTargetFollowers,
  userTargetFollowing,
  userTargetBlocking,
  userTargetBlockedBy,
  userTargetBlockingByListName
}: FollowButtonProps): JSX.Element | null {
  const { user } = useAuth();
  const { push } = useRouter();
  const { open, openModal, closeModal } = useModal();

  if (user?.id === userTargetId) return null;

  const { id: userId, following } = user ?? {};

  const handleLoggedOutFollow = (): void => {
    void push('/');
  };

  const handleFollow = (): Promise<void> =>
    manageFollow('follow', userId as string, userTargetId);

  const handleUnfollow = async (): Promise<void> => {
    await manageFollow('unfollow', userId as string, userTargetId);
    closeModal();
  };

  const handleUnblock = async (): Promise<void> => {
    await manageBlock('unblock', userId as string, userTargetId);
    closeModal();
  };

  const userIsFollowed = [
    following?.includes(userTargetId),
    userTargetFollowers?.includes(userId ?? '')
  ].some(Boolean);
  const userFollowsViewer = !!userTargetFollowing?.includes(userId ?? '');
  const followLabel = userFollowsViewer ? 'Follow Back' : 'Follow';

  if (!user)
    return (
      <Button
        className='self-start border bg-light-primary px-4 py-1.5 font-bold text-white hover:bg-light-primary/90
                   focus-visible:bg-light-primary/90 active:bg-light-border/75 dark:bg-light-border
                   dark:text-light-primary dark:hover:bg-light-border/90 dark:focus-visible:bg-light-border/90
                   dark:active:bg-light-border/75'
        onClick={preventBubbling(handleLoggedOutFollow)}
      >
        Follow
      </Button>
    );

  if (userTargetBlockedBy) return null;

  if (userTargetBlocking)
    return userTargetBlockingByListName ? (
      <Button
        className='self-start border border-accent-red bg-accent-red px-4 py-1.5 font-bold text-white'
        disabled
      >
        Blocked
      </Button>
    ) : (
      <>
        <Modal
          modalClassName='flex flex-col gap-6 max-w-xs bg-main-background w-full p-8 rounded-2xl'
          open={open}
          closeModal={closeModal}
        >
          <ActionModal
            title={`Unblock @${userTargetUsername}?`}
            description='They will be able to follow you and view your Tweets.'
            mainBtnLabel='Unblock'
            action={handleUnblock}
            closeModal={closeModal}
          />
        </Modal>
        <Button
          className='min-w-[106px] self-start border border-accent-red bg-accent-red px-4 py-1.5
                     font-bold text-white hover:bg-accent-red/90 hover:before:content-["Unblock"]
                     inner:hover:hidden'
          onClick={preventBubbling(openModal)}
        >
          <span>Blocked</span>
        </Button>
      </>
    );

  return (
    <>
      <Modal
        modalClassName='flex flex-col gap-6 max-w-xs bg-main-background w-full p-8 rounded-2xl'
        open={open}
        closeModal={closeModal}
      >
        <ActionModal
          title={`Unfollow @${userTargetUsername}?`}
          description='Their Tweets will no longer show up in your home timeline. You can still view their profile, unless their Tweets are protected.'
          mainBtnLabel='Unfollow'
          action={handleUnfollow}
          closeModal={closeModal}
        />
      </Modal>
      {userIsFollowed ? (
        <Button
          className='dark-bg-tab group min-w-[106px] self-start border border-light-line-reply px-4 py-1.5
                     font-bold hover:border-accent-red hover:bg-accent-red/10 hover:text-accent-red
                     focus-visible:border-accent-red focus-visible:bg-accent-red/10 focus-visible:text-accent-red
                     dark:border-light-secondary'
          onClick={preventBubbling(openModal)}
        >
          <span className='group-hover:hidden group-focus-visible:hidden'>
            Following
          </span>
          <span className='hidden group-hover:inline group-focus-visible:inline'>
            Unfollow
          </span>
        </Button>
      ) : (
        <Button
          className='self-start border bg-light-primary px-4 py-1.5 font-bold text-white hover:bg-light-primary/90 
                     focus-visible:bg-light-primary/90 active:bg-light-border/75 dark:bg-light-border 
                     dark:text-light-primary dark:hover:bg-light-border/90 dark:focus-visible:bg-light-border/90 
                     dark:active:bg-light-border/75'
          onClick={preventBubbling(handleFollow)}
        >
          {followLabel}
        </Button>
      )}
    </>
  );
}
