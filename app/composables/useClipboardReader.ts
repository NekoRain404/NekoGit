/** Attempt to read clipboard text via the Tauri clipboard plugin. */
const readWithTauriClipboard = async (): Promise<string | null> => {
  try {
    const { isTauri } = await import('@tauri-apps/api/core');
    if (!isTauri()) return null;

    const { readText } = await import('@tauri-apps/plugin-clipboard-manager');
    return await readText();
  } catch {
    return null;
  }
};

/** Fallback: read clipboard text via the Web Clipboard API. */
const readWithWebClipboard = async (): Promise<string | null> => {
  try {
    if (!navigator.clipboard?.readText) return null;

    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
};

/** Read text from the system clipboard, preferring Tauri when available. */
export function useClipboardReader() {
  const readClipboardText = async (): Promise<string | null> => {
    if (!import.meta.client) return null;

    const tauriText = await readWithTauriClipboard();
    if (tauriText !== null) return tauriText;

    return readWithWebClipboard();
  };

  return {
    readClipboardText,
  };
}
