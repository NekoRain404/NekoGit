import { fileURLToPath } from 'node:url';

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

const resolveFromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '~': resolveFromRoot('./app'),
      '#shared': resolveFromRoot('./shared'),
      '#server': resolveFromRoot('./server'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
