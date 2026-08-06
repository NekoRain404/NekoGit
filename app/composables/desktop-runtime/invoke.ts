/// Helper that invokes Tauri desktop commands safely with client-only and isTauri runtime guards.
/** Invoke a Tauri desktop command with client-side and runtime guards. */
export const invokeDesktopCommand = async <T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> => {
  if (!import.meta.client) {
    throw new Error('Desktop runtime is only available in the client.');
  }

  const { invoke, isTauri } = await import('@tauri-apps/api/core');
  if (!isTauri()) {
    throw new Error('Desktop runtime is not available in this browser.');
  }

  return invoke<T>(command, args);
};

/** Extract a human-readable message from an unknown error value. */
export const getCommandErrorMessage = (value: unknown) => {
  if (value instanceof Error) return value.message;
  if (typeof value === 'string') return value;
  return 'Desktop command failed.';
};
