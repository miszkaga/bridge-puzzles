import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    // Nasłuch na wszystkich interfejsach — bez tego tunel nie ma się do czego podpiąć
    host: true,
    // Vite 5.4.12+ odrzuca nieznane nagłówki Host; tunele mają losowe domeny
    allowedHosts: true,
    proxy: {
      // Backend widziany pod tym samym originem, więc CORS w ogóle nie wchodzi w grę
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});
