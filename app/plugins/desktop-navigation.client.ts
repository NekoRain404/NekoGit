import type { Event } from '@tauri-apps/api/event';
import { watch } from 'vue';

import type { DesktopNavigationAction } from '~/composables/useDesktopNavigation';

interface DesktopNavigationPayload {
  action?: unknown;
}

const desktopNavigationEvent = 'nekogit:desktop-navigation';
const desktopNavigationActions = new Set<DesktopNavigationAction>(['back', 'forward', 'home']);

const getDesktopNavigationAction = (
  event: Event<DesktopNavigationPayload>
): DesktopNavigationAction | null => {
  const action = event.payload?.action;
  return typeof action === 'string' &&
    desktopNavigationActions.has(action as DesktopNavigationAction)
    ? (action as DesktopNavigationAction)
    : null;
};

export default defineNuxtPlugin(async () => {
  const { isTauri } = await import('@tauri-apps/api/core');
  if (!isTauri()) return;

  const { listen } = await import('@tauri-apps/api/event');
  const { performDesktopNavigation } = useDesktopNavigation();
  const { canGoBack, canGoForward } = useNavigationHistory();
  const { setNavigationState } = useDesktopRuntime();
  const desktopNavigationStateUnavailable = shallowRef(false);

  const unlisten = await listen<DesktopNavigationPayload>(desktopNavigationEvent, (event) => {
    const action = getDesktopNavigationAction(event);
    if (!action) return;

    void performDesktopNavigation(action).catch((error: unknown) => {
      console.error('Failed to handle NekoGit desktop navigation.', error);
    });
  });

  const stopNavigationStateSync = watch(
    () => ({
      canGoBack: canGoBack.value,
      canGoForward: canGoForward.value,
    }),
    (state) => {
      if (desktopNavigationStateUnavailable.value) {
        return;
      }

      void setNavigationState(state).catch((error: unknown) => {
        desktopNavigationStateUnavailable.value = true;
        console.warn('Failed to sync NekoGit desktop navigation menu state.', error);
      });
    },
    { immediate: true }
  );

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      void unlisten();
      stopNavigationStateSync();
    });
  }
});
