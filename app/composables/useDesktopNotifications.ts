/// Sends GitHub notification payloads as native desktop notifications with permission and action handling.
import type { DashboardNotification } from '#shared/types/notifications';
import type { DashboardTab } from '~/composables/useDashboardTabs';
import { useDesktopRuntime } from '~/composables/useDesktopRuntime';
import {
  buildGitHubDesktopNotificationPayload,
  resolveGitHubDesktopNotificationPayloads,
  type DesktopNotificationPayload,
} from '~/utils/desktop-notification-utils';

let permissionPromise: Promise<boolean> | null = null;
let actionListenerPromise: Promise<unknown> | null = null;

interface DesktopNotificationTarget {
  targetUrl?: string;
  targetTab?: DashboardTab;
}

interface ShowGitHubNotificationsOptions {
  batch?: boolean;
}

/** Check if running inside a Tauri desktop shell. */
const isDesktopRuntimeAvailable = async () => {
  if (!import.meta.client) return false;

  const { isTauri } = await import('@tauri-apps/api/core');
  return isTauri();
};

/** Request and cache native notification permission (singleton). */
const ensureNotificationPermission = async () => {
  if (!permissionPromise) {
    permissionPromise = (async () => {
      if (!(await isDesktopRuntimeAvailable())) return false;

      const { isPermissionGranted, requestPermission } =
        await import('@tauri-apps/plugin-notification');
      if (await isPermissionGranted()) return true;

      return (await requestPermission()) === 'granted';
    })().catch((error) => {
      permissionPromise = null;
      throw error;
    });
  }

  return permissionPromise;
};

const dashboardTabs = new Set<DashboardTab>(['notifications', 'issues', 'pulls', 'repos']);

/** Extract navigation target metadata from a notification payload. */
const getNotificationDataTarget = (value: unknown): DesktopNotificationTarget => {
  if (!value || typeof value !== 'object') return {};

  const record = value as Record<string, unknown>;
  const data = record.data ?? record.extra;
  if (!data || typeof data !== 'object') return {};

  const targetRecord = data as Record<string, unknown>;
  const targetUrl = targetRecord.targetUrl;
  const targetTab = targetRecord.targetTab;

  return {
    targetUrl: typeof targetUrl === 'string' && targetUrl.trim() ? targetUrl : undefined,
    targetTab: dashboardTabs.has(targetTab as DashboardTab)
      ? (targetTab as DashboardTab)
      : undefined,
  };
};

/** Bring the desktop window to the foreground when a notification is activated. */
const showDesktopWindowFromNotification = async () => {
  const { showWindow } = useDesktopRuntime();
  await showWindow();
};

/** Register the Tauri notification action handler (singleton). */
const ensureNotificationActionListener = async (
  handleAction: (target: DesktopNotificationTarget) => void
) => {
  if (!actionListenerPromise) {
    actionListenerPromise = (async () => {
      if (!(await isDesktopRuntimeAvailable())) return null;

      const { onAction } = await import('@tauri-apps/plugin-notification');
      return onAction((notification) => handleAction(getNotificationDataTarget(notification)));
    })().catch((error) => {
      console.warn('Failed to register NekoGit desktop notification action listener.', error);
      return null;
    });
  }

  return actionListenerPromise;
};

/** Send native desktop notifications for GitHub events and handle click-through navigation. */
export function useDesktopNotifications() {
  const router = useRouter();
  const localePath = useLocalePath();

  const openNotificationTarget = async ({
    targetTab,
    targetUrl,
  }: DesktopNotificationTarget = {}) => {
    await showDesktopWindowFromNotification();

    if (!targetUrl && !targetTab) {
      return;
    }

    await router.push(
      localePath({
        path: '/dashboard',
        query: {
          tab: targetTab,
          url: targetUrl,
        },
      })
    );
  };

  const handleNotificationAction = (target: DesktopNotificationTarget = {}) => {
    openNotificationTarget(target).catch((error) => {
      console.warn('Failed to open NekoGit desktop notification target.', error);
    });
  };

  const buildNotificationOptions = (payload: DesktopNotificationPayload): NotificationOptions => {
    const data = {
      group: payload.group,
      number: payload.number,
      targetTab: payload.targetTab,
      targetUrl: payload.targetUrl,
    };

    return {
      body: payload.body,
      data,
    };
  };

  const sendBrowserNotification = (payload: DesktopNotificationPayload) => {
    const notification = new window.Notification(payload.title, buildNotificationOptions(payload));
    notification.onclick = () => {
      notification.close();
      handleNotificationAction({
        targetTab: payload.targetTab,
        targetUrl: payload.targetUrl,
      });
    };
  };

  const sendDesktopNotification = async (payload: DesktopNotificationPayload | null) => {
    if (!payload || !(await ensureNotificationPermission())) {
      return false;
    }

    await ensureNotificationActionListener(handleNotificationAction);
    sendBrowserNotification(payload);

    return true;
  };

  const showGitHubNotification = async (notification: DashboardNotification) => {
    return sendDesktopNotification(buildGitHubDesktopNotificationPayload(notification));
  };

  const showGitHubNotifications = async (
    notifications: DashboardNotification[],
    options: ShowGitHubNotificationsOptions = {}
  ) => {
    const payloads = resolveGitHubDesktopNotificationPayloads(notifications, options);
    const results = await Promise.all(payloads.map((payload) => sendDesktopNotification(payload)));
    return results.some(Boolean);
  };

  return {
    showGitHubNotification,
    showGitHubNotifications,
  };
}
