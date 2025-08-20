// Path polyfill for browser compatibility
export function basename(path: string, ext?: string): string {
  const segments = path.split(/[/\\]/);
  let base = segments[segments.length - 1] || '';
  
  if (ext && base.endsWith(ext)) {
    base = base.slice(0, -ext.length);
  }
  
  return base;
}

export function dirname(path: string): string {
  const segments = path.split(/[/\\]/);
  segments.pop();
  return segments.join('/') || '/';
}

export function extname(path: string): string {
  const base = basename(path);
  const lastDot = base.lastIndexOf('.');
  return lastDot > 0 ? base.slice(lastDot) : '';
}

export function join(...paths: string[]): string {
  return paths.filter(Boolean).join('/').replace(/\/+/g, '/');
}

export function resolve(...paths: string[]): string {
  return join(...paths);
}

export function relative(from: string, to: string): string {
  return to; // Simplified implementation
}

export function normalize(path: string): string {
  return path.replace(/\/+/g, '/');
}

export function isAbsolute(path: string): boolean {
  return path.startsWith('/') || /^[a-zA-Z]:/.test(path);
}

export const sep = '/';
export const delimiter = ':';

const pathModule = {
  basename,
  dirname,
  extname,
  join,
  resolve,
  relative,
  normalize,
  isAbsolute,
  sep,
  delimiter
};

export default pathModule;