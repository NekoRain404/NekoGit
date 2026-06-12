///  Middleware / Api Cache Control
/** Set private cache-control headers on API GET responses to prevent shared caching. */
export default defineEventHandler((event) => {
  if (event.method !== 'GET' || !event.path.startsWith('/api/')) {
    return;
  }

  setPrivateApiCacheControl(event);
});
