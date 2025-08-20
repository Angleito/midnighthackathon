// Minimal HTTP polyfill for browser compatibility
export const validateHeaderName = (name: string) => {
  if (typeof name !== 'string' || !name) {
    throw new TypeError('Header name must be a valid string');
  }
  // Basic validation - real node:http has more complex rules
  if (!/^[a-zA-Z0-9\-_]+$/.test(name)) {
    throw new TypeError(`Invalid header name: ${name}`);
  }
};

export const validateHeaderValue = (value: string) => {
  if (typeof value !== 'string') {
    throw new TypeError('Header value must be a string');
  }
};

// Mock other commonly used http functions
export const STATUS_CODES: Record<number, string> = {
  200: 'OK',
  404: 'Not Found',
  500: 'Internal Server Error'
};

export default {
  validateHeaderName,
  validateHeaderValue,
  STATUS_CODES
};