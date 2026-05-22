import Link from 'next/link';
import cn from 'clsx';
import { preventBubbling } from '@lib/utils';
import { AppIcon } from '@components/ui/app-icon';
import type { AppIconName } from '@components/ui/app-icon';

type MobileSidebarLinkProps = {
  href: string;
  linkName: string;
  iconName: AppIconName;
  disabled?: boolean;
  bottom?: boolean;
};

export function MobileSidebarLink({
  href,
  bottom,
  linkName,
  iconName,
  disabled
}: MobileSidebarLinkProps): JSX.Element {
  return (
    <Link href={href} key={href}>
      <a
        className={cn(
          `custom-button accent-tab accent-bg-tab flex items-center rounded-full text-left font-bold 
           transition hover:bg-light-primary/10 focus-visible:ring-2 first:focus-visible:ring-[#878a8c]
           dark:hover:bg-dark-primary/10 dark:focus-visible:ring-white`,
          bottom ? 'gap-5 px-4 py-3 text-base' : 'gap-5 px-4 py-3 text-xl',
          disabled && 'cursor-not-allowed'
        )}
        onClick={disabled ? preventBubbling() : undefined}
      >
        <AppIcon
          className={bottom ? 'h-6 w-6' : 'h-7 w-7'}
          iconName={iconName}
        />
        {linkName}
      </a>
    </Link>
  );
}
