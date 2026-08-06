/// Downloads files via a native Tauri save dialog when available, falling back to a browser download.
import { sanitizeDownloadFileName } from '~/utils/file-download-utils';

interface SaveFileOptions {
  title?: string;
}

/** Prompt a native save dialog and write bytes to the chosen path. */
const writeWithTauriSaveDialog = async (
  fileName: string,
  bytes: Uint8Array,
  options?: SaveFileOptions
): Promise<boolean> => {
  try {
    const { isTauri } = await import('@tauri-apps/api/core');
    if (!isTauri()) return false;

    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    const path = await save({
      title: options?.title ?? 'Save NekoGit file',
      defaultPath: fileName,
      canCreateDirectories: true,
    });

    if (!path) return true;

    await writeFile(path, bytes);
    return true;
  } catch {
    return false;
  }
};

/** Trigger a browser file download via a temporary anchor element. */
const writeWithBrowserDownload = (fileName: string, bytes: Uint8Array): boolean => {
  try {
    const arrayBuffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(arrayBuffer).set(bytes);

    const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
};

/** Save binary file data to disk via Tauri save dialog or browser download fallback. */
export function useFileDownloader() {
  const saveFile = async (
    fileName: string,
    bytes: Uint8Array,
    options?: SaveFileOptions
  ): Promise<boolean> => {
    if (!import.meta.client) return false;

    const safeFileName = sanitizeDownloadFileName(fileName);
    if (await writeWithTauriSaveDialog(safeFileName, bytes, options)) return true;

    return writeWithBrowserDownload(safeFileName, bytes);
  };

  return {
    saveFile,
  };
}
