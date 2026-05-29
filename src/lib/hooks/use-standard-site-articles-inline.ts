import { useCallback, useEffect, useMemo, useState } from 'react';

const standardSiteArticlesInlineKey = 'standardSiteArticlesInline';
const standardSiteArticlesInlineEvent =
  'not-twitter:standard-site-articles-inline';

type StandardSiteArticlesInlineSetting = {
  standardSiteArticlesInline: boolean;
  setStandardSiteArticlesInline: (value: boolean) => void;
  toggleStandardSiteArticlesInline: () => void;
};

function getStandardSiteArticlesInline(): boolean {
  if (typeof window === 'undefined') return true;

  const storedValue = localStorage.getItem(standardSiteArticlesInlineKey);

  return storedValue === null ? true : storedValue === 'true';
}

function writeStandardSiteArticlesInline(value: boolean): void {
  if (typeof window === 'undefined') return;

  localStorage.setItem(standardSiteArticlesInlineKey, value ? 'true' : 'false');
  window.dispatchEvent(new Event(standardSiteArticlesInlineEvent));
}

export function useStandardSiteArticlesInline(): StandardSiteArticlesInlineSetting {
  const [standardSiteArticlesInline, setStandardSiteArticlesInlineState] =
    useState(getStandardSiteArticlesInline);

  useEffect(() => {
    const syncStandardSiteArticlesInline = (): void =>
      setStandardSiteArticlesInlineState(getStandardSiteArticlesInline());

    const syncStorageStandardSiteArticlesInline = (
      event: StorageEvent
    ): void => {
      if (event.key && event.key !== standardSiteArticlesInlineKey) return;

      syncStandardSiteArticlesInline();
    };

    syncStandardSiteArticlesInline();
    window.addEventListener(
      standardSiteArticlesInlineEvent,
      syncStandardSiteArticlesInline
    );
    window.addEventListener('storage', syncStorageStandardSiteArticlesInline);

    return () => {
      window.removeEventListener(
        standardSiteArticlesInlineEvent,
        syncStandardSiteArticlesInline
      );
      window.removeEventListener(
        'storage',
        syncStorageStandardSiteArticlesInline
      );
    };
  }, []);

  const setStandardSiteArticlesInline = useCallback((value: boolean): void => {
    setStandardSiteArticlesInlineState(value);
    writeStandardSiteArticlesInline(value);
  }, []);

  const toggleStandardSiteArticlesInline = useCallback((): void => {
    setStandardSiteArticlesInlineState((currentValue) => {
      const nextValue = !currentValue;

      writeStandardSiteArticlesInline(nextValue);

      return nextValue;
    });
  }, []);

  return useMemo(
    () => ({
      standardSiteArticlesInline,
      setStandardSiteArticlesInline,
      toggleStandardSiteArticlesInline
    }),
    [
      standardSiteArticlesInline,
      setStandardSiteArticlesInline,
      toggleStandardSiteArticlesInline
    ]
  );
}
