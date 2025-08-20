// Browser polyfill for node-domexception
// Provides a compatible DOMException implementation for browsers

let DOMExceptionPolyfill: typeof DOMException;

if (typeof globalThis !== 'undefined' && globalThis.DOMException) {
  // Use native browser DOMException if available
  DOMExceptionPolyfill = globalThis.DOMException;
} else {
  // Create a basic polyfill for environments without DOMException
  class DOMExceptionImpl extends Error {
    public readonly name: string;
    public readonly code: number;

    // DOMException error codes
    static readonly INDEX_SIZE_ERR = 1;
    static readonly DOMSTRING_SIZE_ERR = 2;
    static readonly HIERARCHY_REQUEST_ERR = 3;
    static readonly WRONG_DOCUMENT_ERR = 4;
    static readonly INVALID_CHARACTER_ERR = 5;
    static readonly NO_DATA_ALLOWED_ERR = 6;
    static readonly NO_MODIFICATION_ALLOWED_ERR = 7;
    static readonly NOT_FOUND_ERR = 8;
    static readonly NOT_SUPPORTED_ERR = 9;
    static readonly INUSE_ATTRIBUTE_ERR = 10;
    static readonly INVALID_STATE_ERR = 11;
    static readonly SYNTAX_ERR = 12;
    static readonly INVALID_MODIFICATION_ERR = 13;
    static readonly NAMESPACE_ERR = 14;
    static readonly INVALID_ACCESS_ERR = 15;
    static readonly VALIDATION_ERR = 16;
    static readonly TYPE_MISMATCH_ERR = 17;
    static readonly SECURITY_ERR = 18;
    static readonly NETWORK_ERR = 19;
    static readonly ABORT_ERR = 20;
    static readonly URL_MISMATCH_ERR = 21;
    static readonly QUOTA_EXCEEDED_ERR = 22;
    static readonly TIMEOUT_ERR = 23;
    static readonly INVALID_NODE_TYPE_ERR = 24;
    static readonly DATA_CLONE_ERR = 25;

    // Instance properties matching DOMException interface
    readonly INDEX_SIZE_ERR = 1;
    readonly DOMSTRING_SIZE_ERR = 2;
    readonly HIERARCHY_REQUEST_ERR = 3;
    readonly WRONG_DOCUMENT_ERR = 4;
    readonly INVALID_CHARACTER_ERR = 5;
    readonly NO_DATA_ALLOWED_ERR = 6;
    readonly NO_MODIFICATION_ALLOWED_ERR = 7;
    readonly NOT_FOUND_ERR = 8;
    readonly NOT_SUPPORTED_ERR = 9;
    readonly INUSE_ATTRIBUTE_ERR = 10;
    readonly INVALID_STATE_ERR = 11;
    readonly SYNTAX_ERR = 12;
    readonly INVALID_MODIFICATION_ERR = 13;
    readonly NAMESPACE_ERR = 14;
    readonly INVALID_ACCESS_ERR = 15;
    readonly VALIDATION_ERR = 16;
    readonly TYPE_MISMATCH_ERR = 17;
    readonly SECURITY_ERR = 18;
    readonly NETWORK_ERR = 19;
    readonly ABORT_ERR = 20;
    readonly URL_MISMATCH_ERR = 21;
    readonly QUOTA_EXCEEDED_ERR = 22;
    readonly TIMEOUT_ERR = 23;
    readonly INVALID_NODE_TYPE_ERR = 24;
    readonly DATA_CLONE_ERR = 25;

    constructor(message = '', name = 'Error') {
      super(message);
      this.name = name;
      this.code = 0;
      
      // Set prototype explicitly for proper instanceof checks
      Object.setPrototypeOf(this, DOMExceptionImpl.prototype);
    }

    get [Symbol.toStringTag]() {
      return 'DOMException';
    }
  }

  DOMExceptionPolyfill = DOMExceptionImpl as any;
}

// Ensure the polyfill is available globally
if (typeof globalThis !== 'undefined' && !globalThis.DOMException) {
  globalThis.DOMException = DOMExceptionPolyfill;
}

// Export as both named and default export to handle different import styles
export { DOMExceptionPolyfill as DOMException };
export default DOMExceptionPolyfill;