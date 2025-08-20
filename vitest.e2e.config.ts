import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['stream', 'crypto', 'buffer', 'process', 'util', 'net', 'fs'],
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
    setupFiles: ['./src/tests/e2e/setup.ts'],
    testTimeout: 120000, // 2 minutes for blockchain interactions
    hookTimeout: 60000,
    include: ['src/tests/e2e/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Important for blockchain state consistency
      },
    },
    sequence: {
      concurrent: false, // Sequential execution for blockchain tests
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage/e2e',
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
    'process.env.VITE_E2E_MODE': JSON.stringify('true'),
    'process.env.VITE_MIDNIGHT_TESTNET': JSON.stringify(process.env.VITE_MIDNIGHT_TESTNET || 'true'),
  },
});