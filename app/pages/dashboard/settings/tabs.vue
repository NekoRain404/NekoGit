<!-- SettingsTabsRedirect — Redirects /dashboard/settings/tabs to the /dashboard/tabs settings page. -->
<script setup lang="ts">
const localePath = useLocalePath();

await navigateTo(localePath('/dashboard/tabs'), { replace: true });
</script>

<template>
  <div class="dashboard-settings-tabs-redirect" />
</template>
