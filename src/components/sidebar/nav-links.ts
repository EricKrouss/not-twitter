import type { CustomIconName } from '@components/ui/custom-icon';

export type NavLink = {
  href: string;
  linkName: string;
  iconName: CustomIconName;
  activeIconName?: CustomIconName;
  disabled?: boolean;
  canBeHidden?: boolean;
  badgeCount?: number;
  badgeDot?: boolean;
};

export function isNavLinkActive(currentPath: string, href: string): boolean {
  const pathname = normalizePath(currentPath);
  const targetPathname = normalizePath(href);

  return (
    pathname === targetPathname || pathname.startsWith(`${targetPathname}/`)
  );
}

function normalizePath(path: string): string {
  return (path.split(/[?#]/)[0] || '/').replace(/\/+$/g, '') || '/';
}

export const navLinks: Readonly<NavLink[]> = [
  {
    href: '/home',
    linkName: 'Home',
    iconName: 'TwitterHomeIcon',
    activeIconName: 'TwitterHomeFilledIcon'
  },
  {
    href: '/explore',
    linkName: 'Explore',
    iconName: 'TwitterExploreIcon',
    activeIconName: 'TwitterExploreFilledIcon',
    canBeHidden: true
  },
  {
    href: '/notifications',
    linkName: 'Notifications',
    iconName: 'TwitterNotificationsIcon',
    activeIconName: 'TwitterNotificationsFilledIcon'
  },
  {
    href: '/messages',
    linkName: 'Messages',
    iconName: 'TwitterMessagesIcon',
    activeIconName: 'TwitterMessagesFilledIcon'
  },
  {
    href: '/bookmarks',
    linkName: 'Bookmarks',
    iconName: 'TwitterBookmarksIcon',
    activeIconName: 'TwitterBookmarksFilledIcon',
    canBeHidden: true
  },
  {
    href: '/lists',
    linkName: 'Lists',
    iconName: 'TwitterListsIcon',
    activeIconName: 'TwitterListsFilledIcon',
    canBeHidden: true
  }
];
