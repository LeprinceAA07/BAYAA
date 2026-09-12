import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'BAYAA_'],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        pricing: 'pricing/index.html',
      },
    },
  },
});
