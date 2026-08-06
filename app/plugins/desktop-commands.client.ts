/// Client plugin forwarding Tauri desktop commands to dashboard actions.
import type { Event } from '@tauri-apps/api/event';

type DesktopCommandAction =
  | 'refresh-current-view'
  | 'open-notifications'
  | 'mark-visible-notifications-read'
  | 'mark-all-notifications-read'
  | 'open-settings'
  | 'manage-views'
  | 'quick-open'
  | 'review-previous-file'
  | 'review-next-file'
  | 'review-next-unviewed-file'
  | 'review-toggle-current-file-viewed'
  | 'review-toggle-file-sidebar'
  | 'review-toggle-review-panel';

interface DesktopCommandPayload {
  action?: unknown;
}

const desktopCommandEvent = 'nekogit:desktop-command';
const desktopCommandActions = new Set<DesktopCommandAction>([
  'refresh-current-view',
  'open-notifications',
  'mark-visible-notifications-read',
  'mark-all-notifications-read',
  'open-settings',
  'manage-views',
  'quick-open',
  'review-previous-file',
  'review-next-file',
  'review-next-unviewed-file',
  'review-toggle-current-file-viewed',
  'review-toggle-file-sidebar',
  'review-toggle-review-panel',
]);

const desktopWindowCommandActions = new Set<DesktopCommandAction>([
  'refresh-current-view',
  'mark-visible-notifications-read',
  'mark-all-notifications-read',
  'quick-open',
  'review-previous-file',
  'review-next-file',
  'review-next-unviewed-file',
  'review-toggle-current-file-viewed',
  'review-toggle-file-sidebar',
  'review-toggle-review-panel',
]);

const getDesktopCommandAction = (
  event: Event<DesktopCommandPayload>
): DesktopCommandAction | null => {
  const action = event.payload?.action;
  return typeof action === 'string' && desktopCommandActions.has(action as DesktopCommandAction)
    ? (action as DesktopCommandAction)
    : null;
};

export default defineNuxtPlugin(async () => {
  const { isTauri } = await import('@tauri-apps/api/core');
  if (!isTauri()) return;

  const { listen } = await import('@tauri-apps/api/event');
  const router = useRouter();
  const localePath = useLocalePath();

  const unlisten = await listen<DesktopCommandPayload>(desktopCommandEvent, (event) => {
    const action = getDesktopCommandAction(event);
    if (!action) return;

    if (desktopWindowCommandActions.has(action)) {
      window.dispatchEvent(new CustomEvent(`nekogit:${action}`));
      return;
    }

    const route =
      action === 'open-notifications'
        ? localePath({
            path: '/dashboard',
            query: {
              tab: 'notifications',
            },
          })
        : localePath(action === 'open-settings' ? '/dashboard/settings' : '/dashboard/tabs');

    void router.push(route).catch((error: unknown) => {
      console.error('Failed to handle NekoGit desktop command.', error);
    });
  });

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      void unlisten();
    });
  }
});
