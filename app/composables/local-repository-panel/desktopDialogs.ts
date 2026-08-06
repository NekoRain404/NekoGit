/// Helpers for showing native desktop dialogs (error/info messages and clone destination picker).
/** Extract an error message string, falling back to a caller-provided default. */
export const getDesktopActionErrorMessage = (value: unknown, fallback: string) => {
  if (value instanceof Error && value.message) return value.message;
  if (typeof value === 'string' && value.trim()) return value;
  return fallback;
};

/** Display a native desktop dialog with an error or info message. */
export const showDesktopMessage = async (text: string, kind: 'error' | 'info') => {
  if (!import.meta.client) return;

  const { message } = await import('@tauri-apps/plugin-dialog');
  await message(text, {
    title: 'NekoGit',
    kind,
  });
};

/** Open a native directory picker for choosing a clone destination. */
export const chooseCloneDestinationDirectory = async (repositoryFullName: string) => {
  const { open } = await import('@tauri-apps/plugin-dialog');
  return open({
    title: `Clone ${repositoryFullName}`,
    directory: true,
    multiple: false,
    canCreateDirectories: true,
  });
};
