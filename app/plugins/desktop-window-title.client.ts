import { watch } from 'vue';

import { buildDesktopWindowTitle } from '~/utils/desktop-window-title-utils';

export default defineNuxtPlugin(() => {
  const route = useRoute();
  const { setWindowTitle } = useDesktopRuntime();
  const syncedTitle = shallowRef('');
  const desktopTitleUnavailable = shallowRef(false);

  const syncTitle = () => {
    const title = buildDesktopWindowTitle({
      path: route.path,
      query: route.query,
    });

    document.title = title;

    if (desktopTitleUnavailable.value || syncedTitle.value === title) {
      return;
    }

    syncedTitle.value = title;
    void setWindowTitle(title).catch(() => {
      desktopTitleUnavailable.value = true;
    });
  };

  watch(() => [route.path, route.query], syncTitle, { immediate: true, deep: true });
});
