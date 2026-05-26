import {
  getNextTabIndexFromShortcut,
  isSubmitShortcut
} from './keyboard-shortcuts';

const baseEvent = {
  key: 'Enter',
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false
};

describe('keyboard shortcut helpers', () => {
  it('accepts Ctrl+Enter and Meta+Enter as submit shortcuts', () => {
    expect(isSubmitShortcut({ ...baseEvent, ctrlKey: true })).toBe(true);
    expect(isSubmitShortcut({ ...baseEvent, metaKey: true })).toBe(true);
  });

  it('keeps modified or plain Enter from submitting multiline fields', () => {
    expect(isSubmitShortcut(baseEvent)).toBe(false);
    expect(
      isSubmitShortcut({ ...baseEvent, ctrlKey: true, shiftKey: true })
    ).toBe(false);
    expect(isSubmitShortcut({ ...baseEvent, key: 'Tab', ctrlKey: true })).toBe(
      false
    );
  });

  it('wraps tablist arrow navigation and supports Home and End', () => {
    expect(getNextTabIndexFromShortcut('ArrowRight', 1, 3)).toBe(2);
    expect(getNextTabIndexFromShortcut('ArrowRight', 2, 3)).toBe(0);
    expect(getNextTabIndexFromShortcut('ArrowLeft', 0, 3)).toBe(2);
    expect(getNextTabIndexFromShortcut('Home', 2, 3)).toBe(0);
    expect(getNextTabIndexFromShortcut('End', 0, 3)).toBe(2);
  });
});
