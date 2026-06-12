interface ClipboardWriteTextOptions {
  label?: string;
}

/** Attempt to write text to the clipboard via the Tauri plugin. */
const writeWithTauriClipboard = async (
  text: string,
  options?: ClipboardWriteTextOptions
): Promise<boolean> => {
  try {
    const { isTauri } = await import('@tauri-apps/api/core');
    if (!isTauri()) return false;

    const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
    await writeText(text, options?.label ? { label: options.label } : undefined);
    return true;
  } catch {
    return false;
  }
};

/** Fallback: write text to the clipboard via the Web Clipboard API. */
const writeWithWebClipboard = async (text: string): Promise<boolean> => {
  try {
    if (!navigator.clipboard?.writeText) return false;

    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

/** Write text to the system clipboard, preferring Tauri when available. */
export function useClipboardWriter() {
  const writeClipboardText = async (
    text: string,
    options?: ClipboardWriteTextOptions
  ): Promise<boolean> => {
    if (!import.meta.client) return false;

    if (await writeWithTauriClipboard(text, options)) return true;

    return writeWithWebClipboard(text);
  };

  return {
    writeClipboardText,
  };
}
