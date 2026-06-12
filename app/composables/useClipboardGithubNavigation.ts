/** Read a GitHub URL from the clipboard and navigate to it on the dashboard. */
export function useClipboardGithubNavigation() {
  const { readClipboardText } = useClipboardReader();
  const { resolveDashboardUrlTarget, navigateToDashboardUrl } = useDashboardUrlNavigation();

  const openClipboardGithubUrl = async () => {
    const text = await readClipboardText();
    const targetUrl = text?.trim() ?? '';

    if (!targetUrl || !resolveDashboardUrlTarget(targetUrl)) {
      throw new Error('Clipboard does not contain a GitHub URL that NekoGit can open.');
    }

    await navigateToDashboardUrl(targetUrl);
    return targetUrl;
  };

  return {
    openClipboardGithubUrl,
  };
}
