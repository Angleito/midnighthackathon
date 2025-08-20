import { vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';

// Mock global objects for integration testing
Object.defineProperty(window, 'crypto', {
  value: {
    getRandomValues: (arr: any) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
    randomUUID: () => {
      return 'integration-test-' + Math.random().toString(16).substring(2, 10);
    },
  },
});

// Mock WebSocket for integration tests
const MockWebSocketIntegration = vi.fn().mockImplementation(() => ({
  close: vi.fn(),
  send: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: 1, // OPEN
  url: 'wss://midnight-integration-test.mock',
})) as any;

// Add static properties
MockWebSocketIntegration.CONNECTING = 0;
MockWebSocketIntegration.OPEN = 1;
MockWebSocketIntegration.CLOSING = 2;
MockWebSocketIntegration.CLOSED = 3;

global.WebSocket = MockWebSocketIntegration;

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Shared test state for integration tests
const integrationTestState = {
  walletAddress: '0x1234567890123456789012345678901234567890',
  contractAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
  sessionCounter: 0,
  transactionCounter: 0,
};

// Mock localStorage with persistence across tests
const persistentStorage = (() => {
  let store: Record<string, string> = {};
  
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    length: Object.keys(store).length,
    key: (index: number) => Object.keys(store)[index] || null,
    // Additional methods for test access
    _getStore: () => ({ ...store }),
    _setStore: (newStore: Record<string, string>) => { store = newStore; },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: persistentStorage,
});

Object.defineProperty(window, 'sessionStorage', {
  value: persistentStorage,
});

// Mock MediaQueryList
Object.defineProperty(window, 'matchMedia', {
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

beforeAll(() => {
  // Set environment variables for integration testing
  process.env.VITE_INTEGRATION_TEST = 'true';
  process.env.VITE_DEV_MODE = 'true';
  process.env.VITE_ZK_COMBAT_CONTRACT_ADDRESS = integrationTestState.contractAddress;
  
  console.log('Integration test environment initialized');
});

afterAll(() => {
  // Clean up after all integration tests
  console.log('Integration test environment cleaned up');
});

beforeEach(() => {
  // Reset mocks but keep some state for integration
  vi.clearAllMocks();
  
  // Increment session counter for unique IDs
  integrationTestState.sessionCounter++;
  integrationTestState.transactionCounter = 0;
});

afterEach(() => {
  // Reset some mocks but preserve integration state
  vi.resetAllMocks();
});

// Export utilities for integration tests
export const integrationUtils = {
  getWalletAddress: () => integrationTestState.walletAddress,
  getContractAddress: () => integrationTestState.contractAddress,
  getNextSessionId: () => BigInt(Date.now() + integrationTestState.sessionCounter),
  getNextTransactionId: () => {
    integrationTestState.transactionCounter++;
    return `integration_tx_${Date.now()}_${integrationTestState.transactionCounter}`;
  },
  resetState: () => {
    integrationTestState.sessionCounter = 0;
    integrationTestState.transactionCounter = 0;
    persistentStorage.clear();
  },
  getStorageState: () => (persistentStorage as any)._getStore(),
  setStorageState: (state: Record<string, string>) => (persistentStorage as any)._setStore(state),
};