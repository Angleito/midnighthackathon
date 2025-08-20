// Browser polyfill for Node.js net module
// Provides minimal implementation of functions needed by node-fetch

export function isIP(input: string): number {
  // IPv4 regex pattern
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  
  // IPv6 regex pattern (simplified)
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
  
  if (ipv4Regex.test(input)) {
    return 4;
  }
  
  if (ipv6Regex.test(input)) {
    return 6;
  }
  
  return 0;
}

export function isIPv4(input: string): boolean {
  return isIP(input) === 4;
}

export function isIPv6(input: string): boolean {
  return isIP(input) === 6;
}

// Mock functions for other net module functions that might be needed
export function createServer() {
  throw new Error('createServer is not supported in browser environment');
}

export function createConnection() {
  throw new Error('createConnection is not supported in browser environment');
}

export function connect() {
  throw new Error('connect is not supported in browser environment');
}

// Export all functions for named imports
const netModule = {
  isIP,
  isIPv4,
  isIPv6,
  createServer,
  createConnection,
  connect
};

// Export default for default import
export default netModule;