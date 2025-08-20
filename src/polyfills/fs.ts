// Browser polyfill for Node.js fs module
// Provides minimal implementation for fetch-blob compatibility

export function createReadStream() {
  throw new Error('createReadStream is not supported in browser environment');
}

export function statSync() {
  throw new Error('statSync is not supported in browser environment');
}

export function readFileSync() {
  throw new Error('readFileSync is not supported in browser environment');
}

export function writeFileSync() {
  throw new Error('writeFileSync is not supported in browser environment');
}

export function existsSync() {
  return false;
}

export function mkdirSync() {
  throw new Error('mkdirSync is not supported in browser environment');
}

export function readdirSync() {
  throw new Error('readdirSync is not supported in browser environment');
}

// Promise-based fs functions
export const promises = {
  stat() {
    return Promise.reject(new Error('fs.promises.stat is not supported in browser environment'));
  },
  readFile() {
    return Promise.reject(new Error('fs.promises.readFile is not supported in browser environment'));
  },
  writeFile() {
    return Promise.reject(new Error('fs.promises.writeFile is not supported in browser environment'));
  },
  mkdir() {
    return Promise.reject(new Error('fs.promises.mkdir is not supported in browser environment'));
  },
  readdir() {
    return Promise.reject(new Error('fs.promises.readdir is not supported in browser environment'));
  }
};

// Export all functions for named imports
const fsModule = {
  createReadStream,
  statSync,
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  promises
};

// Export default for default import
export default fsModule;