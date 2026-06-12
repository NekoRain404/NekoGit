<script setup lang="ts">
const route = useRoute();
const localePath = useLocalePath();

const owner = computed(() => String(route.params.owner ?? ''));
const repo = computed(() => String(route.params.repo ?? ''));
const branch = computed(() => {
  const value = route.query.branch;
  return Array.isArray(value) ? value[0] : value;
});

await navigateTo(
  localePath({
    path: '/dashboard',
    query: {
      tab: 'repos',
      repo: `${owner.value}/${repo.value}`,
      branch: branch.value || undefined,
    },
  }),
  { replace: true }
);
</script>

<template>
  <div />
</template>
