/// Returns the current user settings (font, tabs, layout).
/** Read the authenticated user's persisted settings. */
export default defineEventHandler(async (event) => {
  const userLogin = await getUserSettingsLogin(event);

  return readUserSettings(userLogin);
});
