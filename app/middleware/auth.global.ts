/**
 * Global route guard: blocks navigation to protected pages when no session exists.
 *
 * Waits for `ready` before checking `loggedIn` to avoid a race condition where
 * the guard fires before nuxt-auth-utils has fetched the session from the server
 * (e.g. immediately after a PAT login that calls fetchUserSession + navigateTo).
 */
export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn, ready } = useUserSession();
  const localePath = useLocalePath();
  const landingPath = localePath('/');

  if (ready.value && !loggedIn.value && to.path !== landingPath) {
    return navigateTo(landingPath);
  }
});
