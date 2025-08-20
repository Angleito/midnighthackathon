// Browser polyfill for Node.js perf_hooks module
export class PerformanceObserver {
  constructor(_callback: (list: any) => void) {
    // Store callback but don't use it in browser polyfill
  }

  observe(_options: any) {
    // No-op in browser environment
  }

  disconnect() {
    // No-op in browser environment
  }
}

export const performance = globalThis.performance || {
  now: () => Date.now(),
  mark: (_name: string) => {},
  measure: (_name: string, _startMark?: string, _endMark?: string) => {},
  getEntriesByName: (_name: string) => [],
  getEntriesByType: (_type: string) => [],
  clearMarks: (_name?: string) => {},
  clearMeasures: (_name?: string) => {},
};

export const constants = {
  NODE_PERFORMANCE_GC_MAJOR: 1,
  NODE_PERFORMANCE_GC_MINOR: 2,
  NODE_PERFORMANCE_GC_INCREMENTAL: 4,
  NODE_PERFORMANCE_GC_WEAKCB: 8,
};

export default {
  PerformanceObserver,
  performance,
  constants,
};