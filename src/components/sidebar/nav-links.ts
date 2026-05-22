import type { CustomIconName } from '@components/ui/custom-icon';

export type NavLink = {
  href: string;
  linkName: string;
  iconName: CustomIconName;
  disabled?: boolean;
  canBeHidden?: boolean;
  badgeCount?: number;
  badgeDot?: boolean;
};

export const navLinks: Readonly<NavLink[]> = [
  {
    href: '/home',
    linkName: 'Home',
    iconName: 'TwitterHomeIcon'
  },
  {
    href: '/explore',
    linkName: 'Explore',
    iconName: 'TwitterExploreIcon',
    canBeHidden: true
  },
  {
    href: '/notifications',
    linkName: 'Notifications',
    iconName: 'TwitterNotificationsIcon'
  },
  {
    href: '/messages',
    linkName: 'Messages',
    iconName: 'TwitterMessagesIcon'
  },
  {
    href: '/bookmarks',
    linkName: 'Bookmarks',
    iconName: 'TwitterBookmarksIcon',
    canBeHidden: true
  },
  {
    href: '/lists',
    linkName: 'Lists',
    iconName: 'TwitterListsIcon',
    canBeHidden: true
  }
];
