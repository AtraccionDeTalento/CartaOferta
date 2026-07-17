import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// GitHub Pages debe usar exactamente el nombre del repositorio.
const REPO_NAME = 'CartaOferta';

// https://vitejs.dev/config/
export default defineConfig({
  // base es crítico para que GitHub Pages sirva los assets con la ruta correcta
  base: process.env.NODE_ENV === 'production' ? `/${REPO_NAME}/` : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // GitHub Pages sirve desde la raíz del repo o carpeta /docs
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    sourcemap: false,
    // pdfjs-dist usa top-level await; requiere un target moderno
    target: 'esnext',
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
  },
  server: {
    port: 5173,
    // El proxy solo aplica en desarrollo local
    proxy: {
      '/api': {
        target: 'http://localhost:9050',
        changeOrigin: true,
      },
    },
  },
});
