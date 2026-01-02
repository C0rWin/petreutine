/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}', 'components/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}', 'contexts/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}', 'services/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['components/**/*.{ts,tsx}', 'contexts/**/*.{ts,tsx}', 'services/**/*.{ts,tsx}', 'App.tsx', 'types.ts'],
      exclude: ['src/__tests__/**', 'src/vite-env.d.ts'],
      thresholds: {
        global: {
          branches: 60,
          functions: 60,
          lines: 60,
          statements: 60,
        },
      },
    },
  },
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    allowedHosts: ['petsreutine-p38ty.ondigitalocean.app'],
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
