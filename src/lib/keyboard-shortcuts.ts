export const SUBMIT_KEYSHORTCUTS = 'Control+Enter Meta+Enter';

type KeyboardShortcutEvent = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
};

export function isSubmitShortcut({
  key,
  ctrlKey,
  metaKey,
  altKey,
  shiftKey
}: KeyboardShortcutEvent): boolean {
  return key === 'Enter' && (ctrlKey || metaKey) && !altKey && !shiftKey;
}

export function getNextTabIndexFromShortcut(
  key: string,
  currentIndex: number,
  tabCount: number
): number | null {
  if (currentIndex < 0 || tabCount < 1) return null;

  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (currentIndex + 1) % tabCount;
    case 'ArrowLeft':
    case 'ArrowUp':
      return (currentIndex - 1 + tabCount) % tabCount;
    case 'Home':
      return 0;
    case 'End':
      return tabCount - 1;
    default:
      return null;
  }
}
