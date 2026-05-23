import { formatDate } from '@lib/date';
import {
  formatProfileBirthday,
  isProfileBirthdayToday
} from '@lib/profile-birthday';
import { useAuth } from '@lib/context/auth-context';
import { TweetText } from '@components/tweet/tweet-text';
import { HeroIcon } from '@components/ui/hero-icon';
import { CustomIcon } from '@components/ui/custom-icon';
import { ToolTip } from '@components/ui/tooltip';
import { UserName } from './user-name';
import { UserFollowing } from './user-following';
import { UserFollowStats } from './user-follow-stats';
import type { IconName } from '@components/ui/hero-icon';
import type { User } from '@lib/types/user';

type UserDetailsProps = Pick<
  User,
  | 'id'
  | 'bio'
  | 'pronouns'
  | 'birthday'
  | 'name'
  | 'website'
  | 'username'
  | 'verified'
  | 'createdAt'
  | 'following'
  | 'followingCount'
  | 'followersCount'
>;

type DetailType = 'website' | 'birthday' | 'joined';

type DetailIcon = {
  detail: string | null;
  icon: IconName | 'TwitterBirthdayIcon';
  type: DetailType;
};

function getExternalHref(value: string): string {
  return /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
}

export function UserDetails({
  id,
  bio,
  pronouns,
  birthday,
  name,
  website,
  username,
  verified,
  createdAt,
  following,
  followingCount,
  followersCount
}: UserDetailsProps): JSX.Element {
  const { user: authUser } = useAuth();
  const isBirthdayToday = isProfileBirthdayToday(birthday);
  const birthdayLabel = birthday ? formatProfileBirthday(birthday) : null;
  const birthdayCelebration = isBirthdayToday
    ? authUser?.id === id
      ? 'Today is your birthday!'
      : 'Today is their birthday!'
    : null;
  const detailIcons: Readonly<DetailIcon[]> = [
    { detail: website, icon: 'LinkIcon', type: 'website' },
    {
      detail: birthdayLabel,
      icon: 'TwitterBirthdayIcon',
      type: 'birthday'
    },
    {
      detail: `Joined ${formatDate(createdAt, 'joined')}`,
      icon: 'CalendarDaysIcon',
      type: 'joined'
    }
  ];

  return (
    <>
      <div>
        <UserName
          className='-mb-1 text-xl'
          name={name}
          iconClassName='w-6 h-6'
          verified={verified}
        />
        <div className='flex flex-wrap items-center gap-x-1 gap-y-0.5 text-light-secondary dark:text-dark-secondary'>
          <p>@{username}</p>
          {pronouns && <p>{pronouns}</p>}
          <UserFollowing userTargetId={id} userTargetFollowing={following} />
        </div>
      </div>
      <div className='flex flex-col gap-2'>
        {bio && <TweetText text={bio} />}
        <div className='flex flex-wrap gap-x-3 gap-y-1 text-light-secondary dark:text-dark-secondary'>
          {detailIcons.map(({ detail, icon, type }) =>
            detail ? (
              <div
                className={
                  type === 'website'
                    ? 'flex items-center gap-1'
                    : 'flex basis-full items-center gap-1'
                }
                key={type}
              >
                <i>
                  {icon === 'TwitterBirthdayIcon' ? (
                    <CustomIcon className='h-5 w-5' iconName={icon} />
                  ) : (
                    <HeroIcon className='h-5 w-5' iconName={icon} />
                  )}
                </i>
                {type === 'website' ? (
                  <a
                    className='custom-underline text-main-accent'
                    href={getExternalHref(detail)}
                    target='_blank'
                    rel='noreferrer'
                  >
                    {detail}
                  </a>
                ) : type === 'joined' ? (
                  <button className='custom-underline group relative'>
                    {detail}
                    <ToolTip
                      className='translate-y-1'
                      tip={formatDate(createdAt, 'full')}
                    />
                  </button>
                ) : (
                  <span>
                    {detail}
                    {birthdayCelebration && (
                      <span className='font-medium text-main-accent'>
                        {' '}
                        · {birthdayCelebration}
                      </span>
                    )}
                  </span>
                )}
              </div>
            ) : null
          )}
        </div>
      </div>
      <UserFollowStats
        followingCount={followingCount}
        followersCount={followersCount}
      />
    </>
  );
}
