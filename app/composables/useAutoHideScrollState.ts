/// Stateful composable that tracks active scrolling on a scrollable element and auto-hides after a timeout.
import { onBeforeUnmount, shallowRef } from 'vue';

/** Tracks whether a scrollable element is actively scrolling, auto-hiding after a timeout. */
export default function useAutoHideScrollState(timeoutMs = 1000) {
  const isScrolling = shallowRef(false);
  let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

  const clearScrollTimeout = () => {
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
      scrollTimeout = null;
    }
  };

  const onScroll = () => {
    isScrolling.value = true;
    clearScrollTimeout();
    scrollTimeout = setTimeout(() => {
      isScrolling.value = false;
      scrollTimeout = null;
    }, timeoutMs);
  };

  onBeforeUnmount(clearScrollTimeout);

  return {
    isScrolling,
    onScroll,
  };
}
