import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['stream', 'crypto', 'buffer', 'process'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/tests/stress/setup.ts'],
    testTimeout: 300000, // 5 minutes for stress tests
    hookTimeout: 120000,
    include: ['src/tests/stress/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist'],
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 4,
        minThreads: 2,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      reportsDirectory: './coverage/stress',
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@tests': resolve(__dirname, './src/tests'),
    },
  },
  define: {
    global: 'globalThis',
    'process.env.NODE_ENV': JSON.stringify('test'),
    'process.env.VITE_STRESS_TEST': JSON.stringify('true'),
    'process.env.VITE_MIDNIGHT_TESTNET': JSON.stringify(process.env.VITE_MIDNIGHT_TESTNET || 'true'),
  },
});