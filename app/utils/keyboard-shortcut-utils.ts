/// Keyboard shortcut helpers including editable-target suppression.
/**
 * Returns true when the keyboard event target is an editable element
 * (input, textarea, contentEditable) and shortcuts should be suppressed.
 */
export function shouldIgnoreKeyboardShortcutTarget(target: EventTarget | null) {
  if (typeof HTMLElement === 'undefined') {
    return false;
  }

  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tagName = target.tagName.toLowerCase();
  if (tagName === 'textarea' || tagName === 'select') {
    return true;
  }

  if (tagName !== 'input') {
    return false;
  }

  const input = target as HTMLInputElement;
  const type = input.type.toLowerCase();
  return ![
    'button',
    'checkbox',
    'color',
    'file',
    'image',
    'radio',
    'range',
    'reset',
    'submit',
  ].includes(type);
}

/**
 * Checks whether a KeyboardEvent matches the given key plus the specified
 * modifier (alt or ctrl).
 */
export function isModifiedShortcut(
  event: KeyboardEvent,
  key: string,
  modifier: 'alt' | 'ctrl',
  options: { shift?: boolean } = {}
) {
  const modifierPressed = modifier === 'alt' ? event.altKey : event.ctrlKey;
  const shiftPressed = options.shift ?? false;
  return (
    modifierPressed &&
    event.shiftKey === shiftPressed &&
    !event.metaKey &&
    event.key.toLowerCase() === key.toLowerCase()
  );
}
