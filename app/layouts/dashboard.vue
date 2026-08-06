<!-- DashboardLayout — Dashboard app shell with navbar, quick-open palette, and page slot. -->
<script setup lang="ts">
import Navbar from '~/components/layouts/Navbar.vue';

const route = useRoute();
const quickOpenPaletteRef = useTemplateRef<{
  open: (initialValue?: string) => void;
}>('quickOpenPalette');

const isFileBrowserActive = computed(() => {
  return Boolean(route.query.repo && Object.hasOwn(route.query, 'path'));
});

const openQuickOpenPalette = () => {
  quickOpenPaletteRef.value?.open();
};

const handleGlobalQuickOpenShortcut = (event: KeyboardEvent) => {
  if (event.defaultPrevented || event.key.toLowerCase() !== 'k' || !event.ctrlKey) {
    return;
  }

  event.preventDefault();
  openQuickOpenPalette();
};

const handleDesktopQuickOpen = () => {
  openQuickOpenPalette();
};

onMounted(() => {
  window.addEventListener('keydown', handleGlobalQuickOpenShortcut);
  window.addEventListener('nekogit:quick-open', handleDesktopQuickOpen);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalQuickOpenShortcut);
  window.removeEventListener('nekogit:quick-open', handleDesktopQuickOpen);
});
</script>

<template>
  <Navbar v-if="!isFileBrowserActive" />
  <section class="hero is-fullheight-with-navbar dashboard-shell">
    <div class="hero-body dashboard-shell__body">
      <NuxtPage />
    </div>
  </section>
  <DashboardQuickOpenPalette ref="quickOpenPalette" />
</template>

<style scoped lang="scss">
.dashboard-shell__body {
  align-items: stretch;
}
</style>
