/// Client plugin handling API 401 responses by clearing the session and redirecting once.
import { handleUnauthorizedApiResponse } from '#shared/utils/api-unauthorized';

type GlobalFetch = typeof $fetch;

export default defineNuxtPlugin(() => {
  const { clear } = useUserSession();

  const wrappedFetch = ($fetch as GlobalFetch).create({
    onResponseError({ request, response }) {
      if (response.status !== 401) {
        return;
      }

      void handleUnauthorizedApiResponse({
        request,
        clearSession: clear,
        redirect: () => navigateTo('/', { replace: true }),
      });
    },
  });

  (globalThis as unknown as { $fetch: typeof $fetch }).$fetch = wrappedFetch;
});
