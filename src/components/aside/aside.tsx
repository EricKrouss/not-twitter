import { useWindow } from '@lib/context/window-context';
import { SearchBar } from './search-bar';
import type { ReactNode } from 'react';

type AsideProps = {
  children: ReactNode;
};

export function Aside({ children }: AsideProps): JSX.Element | null {
  const { width } = useWindow();

  if (width < 1024) return null;

  return (
    <aside
      className='sticky top-0 flex h-screen w-96 shrink-0 flex-col gap-4
                 self-start overflow-y-auto overscroll-contain px-4 pb-4 pt-1'
    >
      <SearchBar />
      {children}
    </aside>
  );
}
