import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import { useAuth } from '@lib/context/auth-context';
import { useUser } from '@lib/context/user-context';
import { getProfileRouteId } from '@lib/static-routes';
import { SEO } from '@components/common/seo';
import { UserHomeCover } from '@components/user/user-home-cover';
import { UserHomeAvatar } from '@components/user/user-home-avatar';
import { UserDetails } from '@components/user/user-details';
import { UserNav } from '@components/user/user-nav';
import { Button } from '@components/ui/button';
import { Loading } from '@components/ui/loading';
import { CustomIcon } from '@components/ui/custom-icon';
import { ToolTip } from '@components/ui/tooltip';
import { FollowButton } from '@components/ui/follow-button';
import { variants } from '@components/user/user-header';
import { UserEditProfile } from '@components/user/user-edit-profile';
import { UserShare } from '@components/user/user-share';
import type { LayoutProps } from './common-layout';

export function UserHomeLayout({ children }: LayoutProps): JSX.Element {
  const { user, isAdmin } = useAuth();
  const { user: userData, loading } = useUser();

  const {
    asPath,
    push,
    query: { id }
  } = useRouter();
  const routeId = (Array.isArray(id) ? id[0] : id) ?? getProfileRouteId(asPath);

  const coverData = userData?.coverPhotoURL
    ? { src: userData.coverPhotoURL, alt: userData.name }
    : null;

  const profileData = userData
    ? { src: userData.photoURL, alt: userData.name }
    : null;

  const { id: userId } = user ?? {};

  const isOwner = userData?.id === userId;
  const signedIn = !!user;
  const viewerBlocksUser = !!userData?.blocking;
  const viewerBlockedByUser = !!userData?.blockedBy;
  const profileIsBlocked =
    !!userData && (viewerBlockedByUser || viewerBlocksUser);

  const handleMessageClick = (): void => {
    if (userData)
      void push(`/messages?actor=${encodeURIComponent(userData.username)}`);
  };

  return (
    <>
      {userData && (
        <SEO
          title={`${`${userData.name} (@${userData.username})`} / Not Twitter`}
        />
      )}
      <motion.section {...variants} exit={undefined}>
        {loading ? (
          <Loading className='mt-5' />
        ) : !userData ? (
          <>
            <UserHomeCover />
            <div className='flex flex-col'>
              <div className='relative flex flex-col gap-3 px-4 py-3 pb-12'>
                <UserHomeAvatar />
                <p className='text-xl font-extrabold'>@{routeId}</p>
              </div>
              <div className='mx-auto w-full max-w-[250px] px-8 pt-5 text-left'>
                <p className='text-[27px] font-extrabold leading-8'>
                  This account doesn’t exist
                </p>
                <p className='mt-2 text-[15px] text-light-secondary dark:text-dark-secondary'>
                  Try searching for another.
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            <UserHomeCover coverData={coverData} />
            <div className='relative flex flex-col gap-3 px-4 py-3'>
              <div className='flex justify-between'>
                <UserHomeAvatar profileData={profileData} />
                {isOwner ? (
                  <UserEditProfile />
                ) : (
                  <div className='flex gap-2 self-start'>
                    <UserShare
                      targetId={userData.id}
                      username={userData.username}
                      blocking={userData.blocking}
                      blockingByListName={userData.blockingByListName}
                      muting={userData.muting}
                      mutingByListName={userData.mutingByListName}
                    />
                    {signedIn && !profileIsBlocked && (
                      <Button
                        className='dark-bg-tab group relative border border-light-line-reply p-2
                                   hover:bg-light-primary/10 active:bg-light-primary/20 dark:border-light-secondary
                                   dark:hover:bg-dark-primary/10 dark:active:bg-dark-primary/20'
                        onClick={handleMessageClick}
                      >
                        <CustomIcon
                          className='h-5 w-5'
                          iconName='TwitterMessagesIcon'
                        />
                        <ToolTip tip='Message' />
                      </Button>
                    )}
                    <FollowButton
                      userTargetId={userData.id}
                      userTargetUsername={userData.username}
                      userTargetFollowers={userData.followers}
                      userTargetFollowing={userData.following}
                      userTargetBlocking={userData.blocking}
                      userTargetBlockedBy={userData.blockedBy}
                      userTargetBlockingByListName={userData.blockingByListName}
                    />
                    {isAdmin && <UserEditProfile hide />}
                  </div>
                )}
              </div>
              <UserDetails {...userData} />
            </div>
          </>
        )}
      </motion.section>
      {userData &&
        (profileIsBlocked ? (
          <BlockedProfileState
            username={userData.username}
            blockedBy={viewerBlockedByUser}
            blockedByListName={userData.blockingByListName}
          />
        ) : (
          <>
            <UserNav />
            {children}
          </>
        ))}
    </>
  );
}

function BlockedProfileState({
  username,
  blockedBy,
  blockedByListName
}: {
  username: string;
  blockedBy: boolean;
  blockedByListName: string | null;
}): JSX.Element {
  const title = blockedBy ? 'You’re blocked' : `You blocked @${username}`;
  const description = blockedBy
    ? `You can’t follow or see @${username}’s Tweets.`
    : blockedByListName
    ? `This account is blocked by ${blockedByListName}.`
    : `You can view @${username}’s Tweets, but they still can’t follow or message you.`;

  return (
    <div
      className='border-t border-light-border px-8 py-10 text-left dark:border-dark-border
                 xs:px-4'
    >
      <div className='mx-auto flex w-full max-w-[360px] flex-col gap-3'>
        <p className='text-[31px] font-extrabold leading-9'>{title}</p>
        <p className='text-[15px] leading-5 text-light-secondary dark:text-dark-secondary'>
          {description}
        </p>
      </div>
    </div>
  );
}
