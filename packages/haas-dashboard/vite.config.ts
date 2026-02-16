import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/mcp': 'http://localhost:3100',
      '/pending': 'http://localhost:3100',
      '/health': 'http://localhost:3100',
      '/demo': 'http://localhost:3100',
    },
  },
});
