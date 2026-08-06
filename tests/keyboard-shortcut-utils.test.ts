/// Unit tests for keyboard shortcut modifier and target guards.
import { describe, expect, test, vi } from 'vitest';

import {
  isModifiedShortcut,
  shouldIgnoreKeyboardShortcutTarget,
} from '../app/utils/keyboard-shortcut-utils';

class MockElement {
  tagName: string;
  type: string;
  isContentEditable: boolean;

  constructor(tagName: string, options: { type?: string; editable?: boolean } = {}) {
    this.tagName = tagName.toUpperCase();
    this.type = options.type ?? '';
    this.isContentEditable = options.editable ?? false;
  }
}

const withMockHTMLElement = (callback: () => void) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'HTMLElement');
  vi.stubGlobal('HTMLElement', MockElement);

  try {
    callback();
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, 'HTMLElement', descriptor);
    } else {
      vi.unstubAllGlobals();
    }
  }
};

const keyboardEvent = (overrides: Partial<KeyboardEvent>): KeyboardEvent =>
  ({
    altKey: false,
    ctrlKey: false,
    shiftKey: false,
    metaKey: false,
    key: '',
    ...overrides,
  }) as KeyboardEvent;

describe('keyboard shortcut helpers', () => {
  test('ignores editable keyboard targets', () => {
    withMockHTMLElement(() => {
      const input = new MockElement('input', { type: 'text' });
      const checkbox = new MockElement('input', { type: 'checkbox' });
      const textarea = new MockElement('textarea');
      const editable = new MockElement('div', { editable: true });

      expect(shouldIgnoreKeyboardShortcutTarget(input as unknown as EventTarget)).toBe(true);
      expect(shouldIgnoreKeyboardShortcutTarget(textarea as unknown as EventTarget)).toBe(true);
      expect(shouldIgnoreKeyboardShortcutTarget(editable as unknown as EventTarget)).toBe(true);
      expect(shouldIgnoreKeyboardShortcutTarget(checkbox as unknown as EventTarget)).toBe(false);
      expect(
        shouldIgnoreKeyboardShortcutTarget(new MockElement('button') as unknown as EventTarget)
      ).toBe(false);
      expect(shouldIgnoreKeyboardShortcutTarget(null)).toBe(false);
    });
  });

  test('matches modified shortcuts without extra modifiers', () => {
    const altJ = keyboardEvent({ altKey: true, key: 'J' });
    const altShiftJ = keyboardEvent({ altKey: true, shiftKey: true, key: 'j' });
    const ctrlK = keyboardEvent({ ctrlKey: true, key: 'k' });

    expect(isModifiedShortcut(altJ, 'j', 'alt')).toBe(true);
    expect(isModifiedShortcut(altShiftJ, 'j', 'alt')).toBe(false);
    expect(isModifiedShortcut(altShiftJ, 'j', 'alt', { shift: true })).toBe(true);
    expect(isModifiedShortcut(ctrlK, 'k', 'ctrl')).toBe(true);
    expect(isModifiedShortcut(ctrlK, 'j', 'ctrl')).toBe(false);
  });

  test('is safe when HTMLElement is unavailable', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'HTMLElement');
    vi.stubGlobal('HTMLElement', undefined);

    expect(shouldIgnoreKeyboardShortcutTarget({} as EventTarget)).toBe(false);

    if (descriptor) {
      Object.defineProperty(globalThis, 'HTMLElement', descriptor);
    } else {
      vi.unstubAllGlobals();
    }
  });
});
