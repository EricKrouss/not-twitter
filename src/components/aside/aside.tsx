import { useEffect, useRef, useState } from 'react';
import cn from 'clsx';
import { useWindow } from '@lib/context/window-context';
import { SearchBar } from './search-bar';
import type { ReactNode } from 'react';

type AsideProps = {
  children: ReactNode;
};

export function Aside({ children }: AsideProps): JSX.Element | null {
  const { width, height } = useWindow();
  const asideRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isScrollable, setIsScrollable] = useState(false);

  useEffect(() => {
    const aside = asideRef.current;
    const content = contentRef.current;

    if (!aside || !content) return;

    const updateScrollable = (): void => {
      const { paddingTop } = getComputedStyle(aside);
      const availableHeight =
        aside.clientHeight - parseFloat(paddingTop);

      setIsScrollable(content.scrollHeight > availableHeight + 2);
    };

    updateScrollable();
    window.addEventListener('resize', updateScrollable);

    if (!('ResizeObserver' in window))
      return () => window.removeEventListener('resize', updateScrollable);

    const resizeObserver = new ResizeObserver(updateScrollable);
    resizeObserver.observe(aside);
    resizeObserver.observe(content);

    return () => {
      window.removeEventListener('resize', updateScrollable);
      resizeObserver.disconnect();
    };
  }, [width, height]);

  if (width < 1024) return null;

  return (
    <aside
      ref={asideRef}
      className={cn(
        `scrollbar-hidden sticky top-0 h-screen w-96 shrink-0 self-start
         px-4 pb-4 pt-1`,
        isScrollable
          ? 'overflow-y-auto overscroll-contain'
          : 'overflow-y-hidden'
      )}
    >
      <div ref={contentRef} className='flex flex-col gap-4'>
        <SearchBar />
        {children}
      </div>
    </aside>
  );
}
