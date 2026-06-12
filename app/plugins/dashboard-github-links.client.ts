const EXTERNAL_LINK_SELECTOR = '[data-nekogit-external]';

function isPrimaryUnmodifiedClick(event: MouseEvent) {
  return (
    event.button === 0 &&
    !event.defaultPrevented &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

function findAnchor(target: EventTarget | null) {
  return target instanceof Element ? target.closest<HTMLAnchorElement>('a[href]') : null;
}

export default defineNuxtPlugin(() => {
  const { resolveDashboardUrlTarget, navigateToDashboardUrl } = useDashboardUrlNavigation();

  const handleClick = (event: MouseEvent) => {
    if (!isPrimaryUnmodifiedClick(event)) {
      return;
    }

    const anchor = findAnchor(event.target);
    if (!anchor || anchor.hasAttribute('download') || anchor.closest(EXTERNAL_LINK_SELECTOR)) {
      return;
    }

    const href = anchor.href;
    if (!resolveDashboardUrlTarget(href)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    void navigateToDashboardUrl(href).catch((error: unknown) => {
      console.error('Failed to open GitHub link in NekoGit.', error);
    });
  };

  document.addEventListener('click', handleClick, true);
});
