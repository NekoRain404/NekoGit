/// App plugin loading user font settings and applying the corresponding CSS variables.
const buildFontVariableCss = (appFontFamily: string, codeFontFamily: string) => {
  return `:root{--nekogit-app-font-family:${appFontFamily};--nekogit-code-font-family:${codeFontFamily};}`;
};

export default defineNuxtPlugin(async () => {
  const { settings, loadSettings, appFontFamily, codeFontFamily } = useUserSettings();
  const { loggedIn } = useUserSession();

  if (import.meta.server && loggedIn.value) {
    await loadSettings();
  }

  useHead({
    style: [
      {
        key: 'nekogit-user-font-settings',
        innerHTML: buildFontVariableCss(appFontFamily.value, codeFontFamily.value),
      },
    ],
  });

  if (import.meta.server) {
    return;
  }

  const applyFonts = () => {
    document.documentElement.style.setProperty('--nekogit-app-font-family', appFontFamily.value);
    document.documentElement.style.setProperty('--nekogit-code-font-family', codeFontFamily.value);
  };

  watch(() => settings.value.fonts, applyFonts, { deep: true, immediate: true });
  watch(
    loggedIn,
    (isLoggedIn) => {
      if (isLoggedIn) {
        void loadSettings();
      }
    },
    { immediate: true }
  );
});
