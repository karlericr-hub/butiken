import { defineConfig } from 'vite';

export default defineConfig({
  base: '/butiken/',
  build: {
    chunkSizeWarningLimit: 2000,
  },
});
