import { vi, beforeAll, afterAll, beforeEach } from 'vitest';

// Enhanced performance monitoring utilities
class PerformanceMonitor {
  private metrics: Map<string, Array<{ value: number; timestamp: number }>> = new Map();
  private startTimes: Map<string, number> = new Map();

  startTimer(label: string): void {
    this.startTimes.set(label, performance.now());
  }

  endTimer(label: string): number {
    const startTime = this.startTimes.get(label);
    if (!startTime) {
      throw new Error(`Timer '${label}' was not started`);
    }
    
    const duration = performance.now() - startTime;
    this.recordMetric(label, duration);
    this.startTimes.delete(label);
    return duration;
  }

  recordMetric(label: string, value: number): void {
    if (!this.metrics.has(label)) {
      this.metrics.set(label, []);
    }
    
    this.metrics.get(label)!.push({
      value,
      timestamp: Date.now(),
    });
  }

  getMetrics(label: string): Array<{ value: number; timestamp: number }> {
    return this.metrics.get(label) || [];
  }

  getAverageMetric(label: string): number {
    const values = this.getMetrics(label).map(m => m.value);
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  getMaxMetric(label: string): number {
    const values = this.getMetrics(label).map(m => m.value);
    return values.length > 0 ? Math.max(...values) : 0;
  }

  getMinMetric(label: string): number {
    const values = this.getMetrics(label).map(m => m.value);
    return values.length > 0 ? Math.min(...values) : 0;
  }

  getPercentile(label: string, percentile: number): number {
    const values = this.getMetrics(label).map(m => m.value).sort((a, b) => a - b);
    if (values.length === 0) return 0;
    
    const index = Math.ceil(values.length * (percentile / 100)) - 1;
    return values[Math.max(0, index)];
  }

  clear(): void {
    this.metrics.clear();
    this.startTimes.clear();
  }

  generateReport(): string {
    let report = '\n=== Performance Report ===\n';
    
    for (const [label, _] of this.metrics) {
      const avg = this.getAverageMetric(label);
      const min = this.getMinMetric(label);
      const max = this.getMaxMetric(label);
      const p95 = this.getPercentile(label, 95);
      const p99 = this.getPercentile(label, 99);
      const count = this.getMetrics(label).length;
      
      report += `\n${label}:\n`;
      report += `  Count: ${count}\n`;
      report += `  Average: ${avg.toFixed(2)}ms\n`;
      report += `  Min: ${min.toFixed(2)}ms\n`;
      report += `  Max: ${max.toFixed(2)}ms\n`;
      report += `  95th percentile: ${p95.toFixed(2)}ms\n`;
      report += `  99th percentile: ${p99.toFixed(2)}ms\n`;
    }
    
    return report;
  }
}

// Memory monitoring utilities
class MemoryMonitor {
  private snapshots: Array<{ timestamp: number; used: number; total: number }> = [];

  takeSnapshot(): void {
    if (typeof performance !== 'undefined' && 'memory' in performance && (performance as any).memory) {
      const memory = (performance as any).memory;
      this.snapshots.push({
        timestamp: Date.now(),
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
      });
    } else {
      // Fallback for Node.js environment
      const memUsage = process.memoryUsage();
      this.snapshots.push({
        timestamp: Date.now(),
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
      });
    }
  }

  getMemoryGrowth(): number {
    if (this.snapshots.length < 2) return 0;
    
    const first = this.snapshots[0];
    const last = this.snapshots[this.snapshots.length - 1];
    return last.used - first.used;
  }

  getMaxMemoryUsage(): number {
    return Math.max(...this.snapshots.map(s => s.used));
  }

  clear(): void {
    this.snapshots = [];
  }

  generateReport(): string {
    if (this.snapshots.length === 0) return 'No memory snapshots taken';
    
    const growth = this.getMemoryGrowth();
    const max = this.getMaxMemoryUsage();
    const first = this.snapshots[0];
    const last = this.snapshots[this.snapshots.length - 1];
    
    return `\n=== Memory Report ===\n` +
           `Initial usage: ${(first.used / 1024 / 1024).toFixed(2)} MB\n` +
           `Final usage: ${(last.used / 1024 / 1024).toFixed(2)} MB\n` +
           `Memory growth: ${(growth / 1024 / 1024).toFixed(2)} MB\n` +
           `Max usage: ${(max / 1024 / 1024).toFixed(2)} MB\n` +
           `Snapshots taken: ${this.snapshots.length}`;
  }
}

// Load generation utilities
class LoadGenerator {
  private activeOperations = 0;
  private maxConcurrency = 10;

  setMaxConcurrency(max: number): void {
    this.maxConcurrency = max;
  }

  async executeWithConcurrencyLimit<T>(
    operations: Array<() => Promise<T>>
  ): Promise<Array<{ result?: T; error?: Error; duration: number }>> {
    const results: Array<{ result?: T; error?: Error; duration: number }> = [];
    const executing: Promise<void>[] = [];

    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];
      
      // Wait if we've hit the concurrency limit
      if (this.activeOperations >= this.maxConcurrency) {
        await Promise.race(executing);
      }

      const executeOperation = async (): Promise<void> => {
        this.activeOperations++;
        const startTime = performance.now();
        
        try {
          const result = await operation();
          results[i] = { result, duration: performance.now() - startTime };
        } catch (error) {
          results[i] = { 
            error: error as Error, 
            duration: performance.now() - startTime 
          };
        } finally {
          this.activeOperations--;
        }
      };

      const promise = executeOperation();
      executing.push(promise);
      
      // Clean up completed operations
      promise.then(() => {
        const index = executing.indexOf(promise);
        if (index > -1) executing.splice(index, 1);
      });
    }

    // Wait for all operations to complete
    await Promise.all(executing);
    return results;
  }

  generateLoadPattern(
    baseOperation: () => Promise<any>,
    pattern: 'ramp-up' | 'constant' | 'spike' | 'wave',
    duration: number,
    maxOpsPerSecond: number
  ): Array<() => Promise<any>> {
    const operations: Array<() => Promise<any>> = [];
    const totalOps = Math.floor((duration / 1000) * maxOpsPerSecond);
    
    for (let i = 0; i < totalOps; i++) {
      let delay = 0;
      
      switch (pattern) {
        case 'ramp-up':
          delay = (i / totalOps) * (1000 / maxOpsPerSecond);
          break;
        case 'constant':
          delay = (1000 / maxOpsPerSecond);
          break;
        case 'spike':
          delay = i < totalOps / 2 ? (1000 / maxOpsPerSecond) : (1000 / (maxOpsPerSecond * 5));
          break;
        case 'wave':
          const wave = Math.sin((i / totalOps) * Math.PI * 2);
          delay = (1000 / maxOpsPerSecond) * (1 + wave) / 2;
          break;
      }
      
      operations.push(async () => {
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        return baseOperation();
      });
    }
    
    return operations;
  }
}

// Global test utilities
export const stressTestUtils = {
  performance: new PerformanceMonitor(),
  memory: new MemoryMonitor(),
  load: new LoadGenerator(),
  
  // Test configuration
  config: {
    maxConcurrentUsers: 50,
    maxConcurrentSessions: 20,
    testDurationMs: 30000, // 30 seconds
    transactionTimeoutMs: 10000, // 10 seconds
    memoryThresholdMB: 100, // Memory usage threshold
    averageResponseTimeMs: 1000, // Expected average response time
    maxResponseTimeMs: 5000, // Maximum acceptable response time
  },

  // Utility functions
  async waitForCondition(
    condition: () => boolean | Promise<boolean>,
    timeoutMs: number = 10000,
    intervalMs: number = 100
  ): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const result = await condition();
        if (result) return true;
      } catch (error) {
        // Continue waiting if condition throws
      }
      
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    
    return false;
  },

  generateRandomStats(): any {
    return {
      health: BigInt(Math.floor(Math.random() * 50) + 75), // 75-125
      attackPower: BigInt(Math.floor(Math.random() * 20) + 15), // 15-35
      defense: BigInt(Math.floor(Math.random() * 15) + 10), // 10-25
      speed: BigInt(Math.floor(Math.random() * 25) + 10), // 10-35
      magicAttack: BigInt(Math.floor(Math.random() * 20) + 10), // 10-30
      magicDefense: BigInt(Math.floor(Math.random() * 15) + 5), // 5-20
    };
  },

  generateRandomPrivateData(): any {
    return {
      playerSecretSeed: BigInt(Math.floor(Math.random() * 1000000)),
      monsterSecretSeed: BigInt(Math.floor(Math.random() * 1000000)),
      damageRoll: BigInt(Math.floor(Math.random() * 100)),
      criticalChance: BigInt(Math.floor(Math.random() * 50) + 10), // 10-60
    };
  },

  createMockUser(id: number): any {
    return {
      id,
      address: `0x${id.toString(16).padStart(40, '0')}`,
      sessionId: BigInt(Date.now() + id),
      stats: this.generateRandomStats(),
    };
  },
};

// Mock high-performance crypto for stress tests
const highPerfCrypto = {
  getRandomValues: (arr: any) => {
    // Use faster random generation for stress tests
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  },
  randomUUID: () => {
    return 'stress-' + Math.random().toString(16).substring(2, 10);
  },
};

// Set up stress test environment
beforeAll(() => {
  // Set environment for stress testing
  process.env.VITE_STRESS_TEST = 'true';
  process.env.VITE_MIDNIGHT_TESTNET = 'true';
  
  // Apply high-performance mocks
  if (typeof global !== 'undefined') {
    (global as any).crypto = highPerfCrypto;
  }
  
  console.log('Stress test environment initialized');
  console.log('Max concurrent users:', stressTestUtils.config.maxConcurrentUsers);
  console.log('Test duration:', stressTestUtils.config.testDurationMs, 'ms');
});

afterAll(() => {
  // Generate final reports
  console.log(stressTestUtils.performance.generateReport());
  console.log(stressTestUtils.memory.generateReport());
});

beforeEach(() => {
  // Clear metrics for each test
  stressTestUtils.performance.clear();
  stressTestUtils.memory.clear();
  
  // Take initial memory snapshot
  stressTestUtils.memory.takeSnapshot();
});

// Mock WebSocket with performance tracking
const MockWebSocketStress = vi.fn().mockImplementation(() => ({
  close: vi.fn(),
  send: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  readyState: 1, // OPEN
  url: 'wss://midnight-stress-test.mock',
})) as any;

// Add static properties
MockWebSocketStress.CONNECTING = 0;
MockWebSocketStress.OPEN = 1;
MockWebSocketStress.CLOSING = 2;
MockWebSocketStress.CLOSED = 3;

global.WebSocket = MockWebSocketStress;