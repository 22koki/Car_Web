import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { allowedHosts: ['.chatgpt.site'] },
  build: { target: 'es2022', sourcemap: false },
});
