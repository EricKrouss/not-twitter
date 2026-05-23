import { Modal } from '@components/modal/modal';
import { HeroIcon } from '@components/ui/hero-icon';
import { Button } from '@components/ui/button';

type ShortcutItem = {
  description: string;
  keys: string[];
};

type ShortcutSection = {
  title: string;
  items: ShortcutItem[];
};

type KeyboardShortcutsModalProps = {
  open: boolean;
  closeModal: () => void;
};

const navigationSection: ShortcutSection = {
  title: 'Navigation',
  items: [
    { description: 'Shortcut help', keys: ['?'] },
    { description: 'Next post', keys: ['j'] },
    { description: 'Previous post', keys: ['k'] },
    { description: 'Page down', keys: ['Space'] },
    { description: 'Home', keys: ['g', 'h'] },
    { description: 'Explore', keys: ['g', 'e'] },
    { description: 'Notifications', keys: ['g', 'n'] },
    { description: 'Mentions', keys: ['g', 'r'] },
    { description: 'Profile', keys: ['g', 'p'] },
    { description: 'Bookmarks', keys: ['g', 'b'] },
    { description: 'Lists', keys: ['g', 'i'] },
    { description: 'Direct Messages', keys: ['g', 'm'] },
    { description: 'Settings', keys: ['g', 's'] }
  ]
};

const actionsSection: ShortcutSection = {
  title: 'Actions',
  items: [
    { description: 'New post', keys: ['n'] },
    { description: 'Send post', keys: ['⌘', 'Enter'] },
    { description: 'Search', keys: ['/'] },
    { description: 'Like', keys: ['l'] },
    { description: 'Reply', keys: ['r'] },
    { description: 'Repost', keys: ['t'] },
    { description: 'Share post', keys: ['s'] },
    { description: 'Bookmark', keys: ['b'] },
    { description: 'Open post details', keys: ['Enter'] },
    { description: 'Expand photo', keys: ['o'] },
    { description: 'Go back', keys: ['Backspace'] }
  ]
};

const mediaSection: ShortcutSection = {
  title: 'Media',
  items: [
    { description: 'Pause/Play selected Video', keys: ['k'] },
    { description: 'Pause/Play selected Video', keys: ['space'] },
    { description: 'Mute selected Video', keys: ['m'] }
  ]
};

const sections = [navigationSection, actionsSection, mediaSection];

export function KeyboardShortcutsModal({
  open,
  closeModal
}: KeyboardShortcutsModalProps): JSX.Element {
  return (
    <Modal
      className='flex items-center justify-center p-4'
      modalClassName='bg-main-background text-light-primary dark:text-dark-primary rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-light-border dark:border-dark-border'
      open={open}
      closeModal={closeModal}
    >
      {/* Header */}
      <div className='flex h-[53px] items-center gap-6 border-b border-light-border px-4 dark:border-dark-border flex-none'>
        <Button
          className='hover-animation p-1 rounded-full hover:bg-light-primary/10 dark:hover:bg-dark-primary/10'
          onClick={closeModal}
          aria-label='Close'
        >
          <HeroIcon className='h-5 w-5' iconName='XMarkIcon' />
        </Button>
        <h2 className='text-xl font-bold'>Keyboard shortcuts</h2>
      </div>

      {/* Main Content scrollable */}
      <div className='flex-1 overflow-y-auto p-6 scrollbar-hidden'>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-8'>
          {sections.map((section) => (
            <div key={section.title} className='flex flex-col gap-4'>
              <h3 className='text-lg font-extrabold text-light-primary dark:text-dark-primary border-b border-light-border pb-2 dark:border-dark-border'>
                {section.title}
              </h3>
              <div className='flex flex-col gap-3'>
                {section.items.map((item, idx) => (
                  <div
                    key={`${item.description}-${idx}`}
                    className='flex items-center justify-between gap-4 text-sm'
                  >
                    <span className='text-light-secondary dark:text-dark-secondary font-medium'>
                      {item.description}
                    </span>
                    <div className='flex items-center gap-1.5 shrink-0'>
                      {item.keys.map((key, keyIdx) => (
                        <div key={keyIdx} className='flex items-center gap-1'>
                          {keyIdx > 0 && (
                            <span className='text-xs text-light-secondary dark:text-dark-secondary font-bold'>
                              +
                            </span>
                          )}
                          <kbd className='inline-flex items-center justify-center min-w-[22px] h-6 px-1.5 text-xs font-bold font-mono text-light-primary bg-white border border-light-line-reply rounded shadow-[0_1.5px_0_0_rgba(0,0,0,0.15)]'>
                            {key}
                          </kbd>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
