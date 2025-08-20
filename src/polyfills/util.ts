// Util polyfill for browser compatibility
export function deprecate<T extends Function>(fn: T, msg: string): T {
  let warned = false;
  const deprecated = function(this: any, ...args: any[]) {
    if (!warned) {
      console.warn(`DeprecationWarning: ${msg}`);
      warned = true;
    }
    return fn.apply(this, args);
  };
  
  return deprecated as any;
}

export function inherits(ctor: any, superCtor: any): void {
  ctor.super_ = superCtor;
  ctor.prototype = Object.create(superCtor.prototype, {
    constructor: {
      value: ctor,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
}

export function inspect(obj: any, options?: any): string {
  return JSON.stringify(obj, null, 2);
}

export function format(f: string, ...args: any[]): string {
  let i = 0;
  return f.replace(/%[sdj%]/g, (x) => {
    if (x === '%%') return x;
    if (i >= args.length) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return String(Number(args[i++]));
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
}

export function isArray(arg: any): arg is any[] {
  return Array.isArray(arg);
}

export function isBoolean(arg: any): arg is boolean {
  return typeof arg === 'boolean';
}

export function isNull(arg: any): arg is null {
  return arg === null;
}

export function isNullOrUndefined(arg: any): arg is null | undefined {
  return arg == null;
}

export function isNumber(arg: any): arg is number {
  return typeof arg === 'number';
}

export function isString(arg: any): arg is string {
  return typeof arg === 'string';
}

export function isSymbol(arg: any): arg is symbol {
  return typeof arg === 'symbol';
}

export function isUndefined(arg: any): arg is undefined {
  return arg === void 0;
}

export function isRegExp(re: any): re is RegExp {
  return re instanceof RegExp;
}

export function isObject(arg: any): boolean {
  return typeof arg === 'object' && arg !== null;
}

export function isDate(d: any): d is Date {
  return d instanceof Date;
}

export function isError(e: any): e is Error {
  return e instanceof Error;
}

export function isFunction(arg: any): arg is Function {
  return typeof arg === 'function';
}

export function isPrimitive(arg: any): boolean {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||
         typeof arg === 'undefined';
}

const utilModule = {
  deprecate,
  inherits,
  inspect,
  format,
  isArray,
  isBoolean,
  isNull,
  isNullOrUndefined,
  isNumber,
  isString,
  isSymbol,
  isUndefined,
  isRegExp,
  isObject,
  isDate,
  isError,
  isFunction,
  isPrimitive
};

export default utilModule;