import { vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// Mock Midnight network responses
const mockMidnightHandlers = [
  // Mock wallet connection
  http.post('/api/wallet/connect', () => {
    return HttpResponse.json({
      address: '0x1234567890123456789012345678901234567890',
      balance: '1000000000000000000',
      connected: true,
    });
  }),

  // Mock contract deployment/initialization
  http.post('/api/contract/deploy', () => {
    return HttpResponse.json({
      contractAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
      transactionHash: '0x' + Math.random().toString(16).substring(2, 66),
      blockNumber: Math.floor(Math.random() * 1000000) + 1000000,
    });
  }),

  // Mock transaction submission
  http.post('/api/transaction/submit', () => {
    return HttpResponse.json({
      transactionHash: '0x' + Math.random().toString(16).substring(2, 66),
      blockNumber: Math.floor(Math.random() * 1000000) + 1000000,
      gasUsed: Math.floor(Math.random() * 200000) + 100000,
      status: 'submitted',
    });
  }),

  // Mock transaction status
  http.get('/api/transaction/:hash/status', ({ params }) => {
    const { hash } = params;
    return HttpResponse.json({
      hash,
      status: Math.random() > 0.1 ? 'confirmed' : 'pending',
      blockNumber: Math.floor(Math.random() * 1000000) + 1000000,
      confirmations: Math.floor(Math.random() * 10) + 1,
    });
  }),

  // Mock block hash for randomness
  http.get('/api/block/latest', () => {
    return HttpResponse.json({
      hash: '0x' + Math.random().toString(16).substring(2, 66),
      number: Math.floor(Math.random() * 1000000) + 1000000,
      timestamp: Math.floor(Date.now() / 1000),
    });
  }),

  // Mock ZK proof generation
  http.post('/api/zk/proof/generate', () => {
    return HttpResponse.json({
      proof: 'zk_proof_' + Math.random().toString(16).substring(2, 32),
      verified: true,
      timestamp: Date.now(),
    });
  }),
];

// Setup MSW server
const server = setupServer(...mockMidnightHandlers);

// Global test state
let testWalletAddress: string;
let testContractAddress: string;
let testSessionId: bigint;

beforeAll(async () => {
  // Start MSW server
  server.listen({ onUnhandledRequest: 'warn' });
  
  // Initialize test environment
  testWalletAddress = '0x1234567890123456789012345678901234567890';
  testContractAddress = '0xabcdef1234567890abcdef1234567890abcdef12';
  testSessionId = BigInt(Date.now());
  
  // Set environment variables for testing
  process.env.VITE_E2E_MODE = 'true';
  process.env.VITE_MIDNIGHT_TESTNET = 'true';
  process.env.VITE_ZK_COMBAT_CONTRACT_ADDRESS = testContractAddress;
  
  console.log('E2E test environment initialized');
  console.log('Test wallet address:', testWalletAddress);
  console.log('Test contract address:', testContractAddress);
});

afterAll(() => {
  // Clean up MSW server
  server.close();
});

beforeEach(() => {
  // Reset MSW handlers for each test
  server.resetHandlers();
  
  // Clear any test state
  vi.clearAllMocks();
});

afterEach(() => {
  // Clean up after each test
  vi.resetAllMocks();
});

// Export test utilities
export const testUtils = {
  getTestWalletAddress: () => testWalletAddress,
  getTestContractAddress: () => testContractAddress,
  getTestSessionId: () => testSessionId,
  generateNewSessionId: () => {
    testSessionId = BigInt(Date.now() + Math.floor(Math.random() * 1000));
    return testSessionId;
  },
  server,
};

// Mock crypto functions for deterministic testing
const mockCrypto = {
  getRandomValues: (arr: any) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  },
  randomUUID: () => {
    return 'test-' + Math.random().toString(16).substring(2, 10);
  },
};

// Apply crypto mocks
if (typeof global !== 'undefined') {
  (global as any).crypto = mockCrypto;
} else if (typeof window !== 'undefined') {
  (window as any).crypto = mockCrypto;
}

// Mock WebSocket for Midnight network connections
const MockWebSocketE2E = vi.fn().mockImplementation(() => ({
  close: vi.fn(),
  send: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: 1, // OPEN
  url: 'wss://midnight-testnet.mock',
})) as any;

// Add static properties
MockWebSocketE2E.CONNECTING = 0;
MockWebSocketE2E.OPEN = 1;
MockWebSocketE2E.CLOSING = 2;
MockWebSocketE2E.CLOSED = 3;

global.WebSocket = MockWebSocketE2E;

export default server;