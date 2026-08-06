/// Provides a reactive ISO timestamp refreshed once on client mount for relative time displays.
import { onMounted, readonly } from 'vue';

const relativeTimeNowStateKey = 'nekogit-relative-time-now';

let clientNowInitialized = false;

/** Provide a reactive ISO timestamp that updates once on client mount, for relative time displays. */
export default function useRelativeTimeNow() {
  const now = useState<string>(relativeTimeNowStateKey, () => new Date().toISOString());

  if (import.meta.client && !clientNowInitialized) {
    clientNowInitialized = true;
    onMounted(() => {
      now.value = new Date().toISOString();
    });
  }

  return readonly(now);
}
