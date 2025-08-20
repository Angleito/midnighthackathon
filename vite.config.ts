import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
  plugins: [
    react(),
    wasm(),
    nodePolyfills({
      include: ['buffer', 'process', 'util', 'events'],
      exclude: ['net', 'fs', 'path', 'crypto', 'stream'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    })
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      'stream': 'stream-browserify',
      'node:stream': 'stream-browserify',
      'node:http': resolve(__dirname, './src/polyfills/http.ts'),
      'node:url': resolve(__dirname, './src/polyfills/url.ts'),
      'node:fs': resolve(__dirname, './src/polyfills/fs.ts'),
      'node:path': resolve(__dirname, './src/polyfills/path.ts'),
      'node:util': resolve(__dirname, './src/polyfills/util.ts'),
      'net': resolve(__dirname, './src/polyfills/net.ts'),
      'node:net': resolve(__dirname, './src/polyfills/net.ts'),
      'node-domexception': resolve(__dirname, './src/polyfills/domexception.ts'),
      'perf_hooks': resolve(__dirname, './src/polyfills/perf_hooks.ts'),
    },
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    exclude: [
      '@midnight-ntwrk/wallet', 
      '@midnight-ntwrk/wallet-api', 
      '@midnight-ntwrk/zswap',
      'node-fetch',
      'net', 
      'node-domexception',
      'perf_hooks',
      'fs',
      'worker_threads'
    ],
  },
  server: {
    port: 5173,
  },
});