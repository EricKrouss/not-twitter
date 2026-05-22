import { useRouter } from 'next/router';
import Link from 'next/link';
import cn from 'clsx';
import { getUserTabPath } from '@lib/routes';
import { getProfileRouteId, getProfileRouteView } from '@lib/static-routes';

type UserNavLinkProps = {
  name: string;
  path: string;
};

export function UserNavLink({ name, path }: UserNavLinkProps): JSX.Element {
  const {
    asPath,
    query: { id }
  } = useRouter();

  const routeId = (Array.isArray(id) ? id[0] : id) ?? getProfileRouteId(asPath);
  const routeView = getProfileRouteView(asPath);
  const userPath = getUserTabPath(routeId ?? '', path);
  const currentPath = asPath.split(/[?#]/)[0];
  const active =
    currentPath === userPath ||
    (path ? routeView === path : routeView === 'tweets');

  return (
    <Link href={userPath} scroll={false}>
      <a
        className='hover-animation main-tab dark-bg-tab flex flex-1 justify-center
                   hover:bg-light-primary/10 dark:hover:bg-dark-primary/10'
      >
        <div className='px-6 md:px-8'>
          <p
            className={cn(
              'flex flex-col gap-3 whitespace-nowrap pt-3 font-bold transition-colors duration-200',
              active
                ? 'text-light-primary dark:text-dark-primary [&>i]:scale-100 [&>i]:opacity-100'
                : 'text-light-secondary dark:text-dark-secondary'
            )}
          >
            {name}
            <i className='h-1 scale-50 rounded-full bg-main-accent opacity-0 transition duration-200' />
          </p>
        </div>
      </a>
    </Link>
  );
}
