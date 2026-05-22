import cn from 'clsx';
import Link from 'next/link';
import { getUserPath } from '@lib/routes';
import { CustomIcon } from '@components/ui/custom-icon';

type UserNameProps = {
  tag?: keyof JSX.IntrinsicElements;
  name: string;
  verified: boolean;
  username?: string;
  className?: string;
  iconClassName?: string;
};

export function UserName({
  tag,
  name,
  verified,
  username,
  className,
  iconClassName
}: UserNameProps): JSX.Element {
  const CustomTag = tag ? tag : 'p';

  return (
    <Link href={username ? getUserPath(username) : '#'}>
      <a
        className={cn(
          `inline-flex min-w-0 max-w-full items-center gap-1 truncate
           align-bottom font-bold leading-[inherit]`,
          username ? 'custom-underline' : 'pointer-events-none',
          className
        )}
        tabIndex={username ? 0 : -1}
      >
        <CustomTag className='min-w-0 truncate leading-[inherit]'>
          {name}
        </CustomTag>
        {verified && (
          <i className='inline-flex shrink-0 items-center leading-none'>
            <CustomIcon
              className={iconClassName ?? 'h-5 w-5'}
              iconName='TwitterVerifiedIcon'
            />
          </i>
        )}
      </a>
    </Link>
  );
}
