import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  root: 'src/renderer',
  publicDir: '../../resources',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    sourcemap: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer')
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    // Faster startup - warm up transforms
    warmup: {
      clientFiles: ['./index.html', './pages/**/*.tsx', './components/**/*.tsx']
    }
  },
  // Pre-bundle heavy dependencies for faster dev startup
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'react-bootstrap',
      'react-rnd',
      'socket.io-client',
      'i18next',
      'react-i18next',
      'i18next-browser-languagedetector'
    ],
    // Force pre-bundling even if not detected
    force: false
  }
});
