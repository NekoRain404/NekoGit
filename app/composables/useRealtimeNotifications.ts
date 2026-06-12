import { onUnmounted, ref, toValue } from 'vue';
import type { MaybeRefOrGetter, Ref } from 'vue';

import type { DashboardNotification } from '#shared/types/notifications';
import type { DashboardFetchOptions } from '~/composables/useGithubData';

interface UseRealtimeNotificationsOptions {
  intervalMs?: number;
  page?: MaybeRefOrGetter<number>;
  fetchNotifications?: (page?: number, options?: DashboardFetchOptions) => Promise<unknown>;
  notifications?: Ref<DashboardNotification[]>;
}

interface RealtimeNotificationsEvents {
  onNewNotifications: (notifications: DashboardNotification[]) => void;
}

const DEFAULT_INTERVAL_MS = 60_000;

/** Poll GitHub notifications on an interval and emit new arrivals to listeners. */
export function useRealtimeNotifications(options: UseRealtimeNotificationsOptions = {}) {
  const { intervalMs = DEFAULT_INTERVAL_MS, page = 1 } = options;

  const fallbackDataSource =
    !options.fetchNotifications || !options.notifications ? useGithubData() : null;
  const fallbackFetchNotifications = fallbackDataSource?.fetchNotifications;
  const fallbackNotifications = fallbackDataSource?.notifications;
  const fetchNotifications = options.fetchNotifications ?? fallbackFetchNotifications;
  const notifications = options.notifications ?? fallbackNotifications;

  if (!fetchNotifications || !notifications) {
    throw new Error('Realtime notifications require a notification data source.');
  }

  const isPolling = ref(false);
  const hasInitialized = ref(false);
  const previousNotificationIds = ref<Set<string>>(new Set());
  const listeners = ref<Set<RealtimeNotificationsEvents['onNewNotifications']>>(new Set());

  let intervalId: ReturnType<typeof setInterval> | null = null;
  let pollInFlight: Promise<void> | null = null;
  let startGeneration = 0;
  let isDisposed = false;

  const toNotificationId = (notification: DashboardNotification, fallbackIndex: number) => {
    if (notification.id === undefined || notification.id === null) {
      return `fallback-${fallbackIndex}`;
    }

    return String(notification.id);
  };

  const emitNewNotifications = (newNotifications: DashboardNotification[]) => {
    if (newNotifications.length === 0) return;

    for (const listener of listeners.value) {
      listener(newNotifications);
    }
  };

  const captureNotificationIds = (items: DashboardNotification[]) => {
    return new Set(items.map((item, index) => toNotificationId(item, index)));
  };

  const resolvePage = () => {
    const value = Number(toValue(page));
    return Number.isSafeInteger(value) && value > 0 ? value : 1;
  };

  const getFetchedNotifications = (result: unknown) => {
    if (!result || typeof result !== 'object') {
      return notifications.value;
    }

    const items = (result as { items?: unknown }).items;
    return Array.isArray(items) ? (items as DashboardNotification[]) : notifications.value;
  };

  const poll = async () => {
    const result = await fetchNotifications(resolvePage(), { force: true, silent: true });

    const currentNotifications = getFetchedNotifications(result);
    const currentIds = captureNotificationIds(currentNotifications);

    if (!hasInitialized.value) {
      previousNotificationIds.value = currentIds;
      hasInitialized.value = true;
      return;
    }

    const newNotifications = currentNotifications.filter((item, index) => {
      const id = toNotificationId(item, index);
      return item.unread !== false && !previousNotificationIds.value.has(id);
    });

    if (newNotifications.length > 0) {
      emitNewNotifications(newNotifications);
    }

    previousNotificationIds.value = currentIds;
  };

  const runPoll = async () => {
    if (pollInFlight) return pollInFlight;

    pollInFlight = poll().finally(() => {
      pollInFlight = null;
    });

    return pollInFlight;
  };

  const start = async () => {
    if (isPolling.value || isDisposed) return;

    const generation = startGeneration + 1;
    startGeneration = generation;
    isPolling.value = true;

    try {
      await runPoll();
    } catch (error) {
      if (generation === startGeneration && !isDisposed) {
        isPolling.value = false;
      }
      throw error;
    }

    if (generation !== startGeneration || isDisposed) return;

    intervalId = setInterval(() => {
      void runPoll().catch((error) => {
        console.warn('Failed to poll GitHub notifications.', error);
      });
    }, intervalMs);
  };

  const stop = () => {
    startGeneration += 1;

    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }

    isPolling.value = false;
    hasInitialized.value = false;
    previousNotificationIds.value = new Set();
  };

  const onNewNotifications = (callback: RealtimeNotificationsEvents['onNewNotifications']) => {
    listeners.value.add(callback);

    return () => {
      listeners.value.delete(callback);
    };
  };

  onUnmounted(() => {
    isDisposed = true;
    stop();
    listeners.value.clear();
  });

  return {
    isPolling,
    start,
    stop,
    onNewNotifications,
  };
}
