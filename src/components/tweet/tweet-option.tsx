import cn from 'clsx';
import { preventBubbling } from '@lib/utils';
import { AppIcon } from '@components/ui/app-icon';
import { ToolTip } from '@components/ui/tooltip';
import { NumberStats } from './number-stats';
import type { AppIconName } from '@components/ui/app-icon';

type TweetOption = {
  tip: string;
  move?: number;
  stats?: number;
  iconName: AppIconName;
  disabled?: boolean;
  className: string;
  viewTweet?: boolean;
  iconClassName: string;
  iconSizeClassName?: string;
  onClick?: (...args: unknown[]) => unknown;
};

export function TweetOption({
  tip,
  move,
  stats,
  disabled,
  iconName,
  className,
  viewTweet,
  iconClassName,
  iconSizeClassName,
  onClick
}: TweetOption): JSX.Element {
  return (
    <button
      className={cn(
        `group flex items-center gap-1 p-0 transition-colors duration-200 ease-out
         disabled:cursor-not-allowed inner:transition-colors inner:duration-200 inner:ease-out`,
        disabled && 'cursor-not-allowed',
        className
      )}
      aria-disabled={disabled}
      onClick={preventBubbling(onClick)}
    >
      <i
        className={cn(
          'relative rounded-full p-2 not-italic group-focus-visible:ring-2',
          iconClassName
        )}
      >
        <AppIcon
          className={
            iconSizeClassName ??
            (viewTweet ? 'h-[22.5px] w-[22.5px]' : 'h-[18.75px] w-[18.75px]')
          }
          iconName={iconName}
        />
        <ToolTip tip={tip} />
      </i>
      {!viewTweet && (
        <NumberStats
          className='min-w-[10px] text-left text-[13px] leading-4'
          containerClassName='-ml-1.5'
          move={move as number}
          stats={stats as number}
        />
      )}
    </button>
  );
}
