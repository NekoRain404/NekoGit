/// Persists user settings (font, tabs, layout).
/** Merge-patch the authenticated user's settings. */
export default defineEventHandler(async (event) => {
  const userLogin = await getUserSettingsLogin(event);
  const body = await readBody(event);

  return patchUserSettings(userLogin, body);
});
