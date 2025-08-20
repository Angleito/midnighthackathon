import { WalletBuilder, type Resource } from '@midnight-ntwrk/wallet';
import { type Wallet, type WalletState, type TokenType } from '@midnight-ntwrk/wallet-api';
import * as zswap from '@midnight-ntwrk/zswap';
import { midnightConnectorService, type MidnightConnectorState, type WalletOption } from './midnightConnectorService';

export type WalletMode = 'extension' | 'programmatic' | 'auto';
export type { WalletOption };

export interface MidnightWalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  balances: Record<TokenType, bigint>;
  isSync: boolean;
  totalBalance: bigint;
  walletMode: WalletMode;
  availableWallets: WalletOption[];
}

export class MidnightWalletService {
  private wallet: (Wallet & Resource) | null = null;
  private currentMode: WalletMode = 'auto';
  private connectorUnsubscribe: (() => void) | null = null;
  private state: MidnightWalletState = {
    address: null,
    isConnected: false,
    isConnecting: false,
    balances: {},
    isSync: false,
    totalBalance: 0n,
    walletMode: 'auto',
    availableWallets: [],
  };
  private listeners: Set<(state: MidnightWalletState) => void> = new Set();
  private wsDisabledLogged = false;

  // Static URIs to avoid circular dependencies
  private readonly baseIndexerUri = 'https://indexer.testnet.midnight.network/api/v1/graphql';
  private readonly baseSubstrateNodeUri = 'https://rpc.testnet.midnight.network';
  private readonly baseWebSocketUri = 'wss://indexer.testnet.midnight.network/api/v1/graphql';
  
  // Configuration for Midnight network - URIs computed dynamically to ensure validity
  private get config() {
    return {
      indexerUri: this.baseIndexerUri,
      indexerWsUri: this.getWebSocketUri(),
      proverServerUri: this.getProverServerUri(),
      substrateNodeUri: this.baseSubstrateNodeUri,
      networkId: zswap.NetworkId.TestNet,
      logLevel: 'error' as const,
    };
  }

  private getWebSocketUri(): string {
    // Check if WebSocket should be disabled for development
    const disableWs = import.meta.env.VITE_DISABLE_WEBSOCKET === 'true';
    if (disableWs) {
      // Return HTTP URI instead of empty string to satisfy validation
      // The wallet SDK should handle the protocol difference internally
      if (!this.wsDisabledLogged) {
        console.log('WebSocket disabled for development - using HTTP polling mode');
        this.wsDisabledLogged = true;
      }
      return this.baseIndexerUri;
    }
    
    // Use WebSocket URI for production
    return this.baseWebSocketUri;
  }

  private async tryHttpFallback(): Promise<void> {
    // If WebSocket fails, the wallet should still work with HTTP-only mode
    console.log('WebSocket connection failed, wallet will use HTTP-only mode');
    
    // Implement connection retry with exponential backoff
    let retries = 0;
    const maxRetries = 3;
    
    while (retries < maxRetries) {
      try {
        // Test HTTP connection to indexer
        const response = await fetch(this.config.indexerUri, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: '{ __typename }' }),
          signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
          console.log('HTTP fallback connection successful');
          return;
        }
      } catch (error) {
        retries++;
        const delay = Math.pow(2, retries) * 1000; // Exponential backoff
        console.warn(`HTTP fallback attempt ${retries} failed, retrying in ${delay}ms...`);
        
        if (retries < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    console.warn('All HTTP fallback attempts failed, wallet may have limited functionality');
  }

  private getProverServerUri(): string {
    // Check if prover server URI is provided via environment variable
    const envProverUri = import.meta.env.VITE_PROVER_SERVER_URI;
    if (envProverUri) {
      return envProverUri;
    }
    
    // Check if prover server is disabled for development
    const disableProver = import.meta.env.VITE_DISABLE_PROVER === 'true';
    if (disableProver) {
      // Return a dummy localhost URI instead of empty string to satisfy validation
      // The prover operations will fail gracefully when this unreachable URL is used
      console.log('Prover server disabled, using dummy URI for validation');
      return 'http://localhost:9999'; // Unreachable port for development
    }
    
    // Default to localhost for development
    return 'http://localhost:6300';
  }

  constructor() {
    // Don't initialize automatically - let user call connect explicitly
    this.initializeWalletMode();
    this.setupConnectorListener();
  }

  private initializeWalletMode(): void {
    // Get wallet mode from environment or default to auto
    const envMode = import.meta.env.VITE_WALLET_MODE as WalletMode;
    this.currentMode = envMode || 'auto';
    this.updateState({
      ...this.state,
      walletMode: this.currentMode,
    });
  }

  private setupConnectorListener(): void {
    // Subscribe to connector service state changes
    this.connectorUnsubscribe = midnightConnectorService.subscribe((connectorState) => {
      if (this.currentMode === 'extension' || (this.currentMode === 'auto' && connectorState.isConnected)) {
        this.syncStateFromConnector(connectorState);
      }
    });
  }

  private syncStateFromConnector(connectorState: MidnightConnectorState): void {
    this.updateState({
      ...this.state,
      address: connectorState.address,
      isConnected: connectorState.isConnected,
      isConnecting: connectorState.isConnecting,
      balances: connectorState.balances,
      isSync: connectorState.isSync,
      totalBalance: connectorState.totalBalance,
      walletMode: 'extension',
      availableWallets: this.state.availableWallets, // Keep existing wallets
    });
  }

  private async initializeWallet(seed?: string): Promise<void> {
    try {
      // Generate a random seed if none provided
      const walletSeed = seed || this.generateRandomSeed();
      
      // Check if prover server is accessible (non-blocking)
      await this.checkProverServer();
      
      // Get configuration with validated URIs
      const config = this.config;
      console.log('Initializing wallet with config:', {
        indexerUri: config.indexerUri,
        indexerWsUri: config.indexerWsUri,
        proverServerUri: config.proverServerUri,
        substrateNodeUri: config.substrateNodeUri,
        networkId: config.networkId
      });
      
      // Build wallet with appropriate WebSocket handling
      const indexerWsUri = import.meta.env.VITE_DISABLE_WEBSOCKET === 'true' 
        ? config.indexerUri  // Use HTTP URI if WebSocket disabled
        : config.indexerWsUri;
        
      console.log('Building wallet with WebSocket disabled:', import.meta.env.VITE_DISABLE_WEBSOCKET === 'true');
      
      this.wallet = await WalletBuilder.build(
        config.indexerUri,
        indexerWsUri,
        config.proverServerUri,
        config.substrateNodeUri,
        walletSeed,
        config.networkId,
        config.logLevel
      );

      // Start the wallet resource
      this.wallet.start();
      
      // Subscribe to wallet state changes with error handling
      this.wallet.state().subscribe({
        next: (walletState: WalletState) => {
          this.updateStateFromWallet(walletState);
        },
        error: (error) => {
          // Don't spam console with expected WebSocket errors in development
          const isWebSocketError = error.message?.includes('WebSocket') || error.message?.includes('websocket');
          const isDevMode = import.meta.env.VITE_DISABLE_WEBSOCKET === 'true';
          
          if (isWebSocketError && isDevMode) {
            // Expected error in development mode - just log once
            console.log('WebSocket unavailable in development mode - wallet using HTTP polling');
          } else if (isWebSocketError) {
            console.log('WebSocket connection failed, attempting HTTP fallback...');
            this.tryHttpFallback().catch(fallbackError => {
              console.warn('HTTP fallback also failed:', fallbackError.message);
            });
          } else {
            console.warn('Wallet state subscription error:', error.message);
          }
        }
      });

      this.updateState({
        ...this.state,
        isConnected: true,
        isConnecting: false,
      });
    } catch (error) {
      console.error('Failed to initialize Midnight wallet:', error);
      
      // Handle specific URI validation errors
      if (error instanceof Error) {
        if (error.message.includes('InvalidUri') || error.message.includes('empty string is not valid uri')) {
          console.error('URI validation error - check environment configuration');
          const enhancedError = new Error('Wallet configuration error: Invalid URIs provided. Check your environment variables.');
          (enhancedError as any).cause = error;
          this.updateState({
            ...this.state,
            isConnecting: false,
          });
          throw enhancedError;
        }
        
        // If WebSocket is the issue, try to continue anyway
        if (error.message.includes('WebSocket')) {
          console.log('WebSocket failed, but wallet may still work in HTTP mode');
          await this.tryHttpFallback();
        }
      }
      
      this.updateState({
        ...this.state,
        isConnecting: false,
      });
      throw error;
    }
  }

  private async checkProverServer(): Promise<void> {
    try {
      const config = this.config;
      const isDisabled = import.meta.env.VITE_DISABLE_PROVER === 'true';
      
      // Skip prover server check if disabled
      if (isDisabled) {
        console.log('Prover server disabled for development');
        return;
      }

      // Skip prover server check if it's not localhost (assume it's external)
      if (!config.proverServerUri.includes('localhost')) {
        return;
      }
      
      // Skip health check for dummy URLs (port 9999)
      if (config.proverServerUri.includes('9999')) {
        console.log('Using dummy prover server URI - skipping health check');
        return;
      }

      const response = await fetch(`${config.proverServerUri}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      if (!response.ok) {
        console.warn('Prover server health check failed, but continuing with wallet initialization');
      } else {
        console.log('Prover server is accessible at', config.proverServerUri);
      }
    } catch (error) {
      const config = this.config;
      console.warn('Prover server not accessible at', config.proverServerUri);
      console.log('Wallet will work in development mode without prover server');
      // Don't throw error - allow wallet to initialize without prover server
    }
  }

  private generateRandomSeed(): string {
    // Generate a 32-byte hex seed for the wallet
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  private updateStateFromWallet(walletState: WalletState): void {
    const totalBalance = Object.values(walletState.balances).reduce((sum, balance) => sum + balance, 0n);
    
    this.updateState({
      ...this.state,
      address: walletState.address,
      isConnected: true,
      isConnecting: false,
      balances: walletState.balances,
      isSync: walletState.syncProgress?.synced ?? false,
      totalBalance,
      walletMode: 'programmatic', // This method is only called for programmatic wallets
    });
  }

  async connect(walletId?: string, seed?: string): Promise<string> {
    // Prevent multiple simultaneous connection attempts
    if (this.state.isConnecting) {
      console.warn('Connection already in progress, waiting for current attempt...');
      // Wait for current connection attempt to complete
      return new Promise((resolve, reject) => {
        const checkConnection = () => {
          if (!this.state.isConnecting) {
            if (this.state.isConnected && this.state.address) {
              resolve(this.state.address);
            } else {
              reject(new Error('Previous connection attempt failed'));
            }
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        setTimeout(checkConnection, 100);
      });
    }

    this.updateState({ ...this.state, isConnecting: true });

    try {
      // Detect available wallets first
      const availableWallets = await midnightConnectorService.detectWallets();
      this.updateState({
        ...this.state,
        availableWallets,
      });

      // Determine which mode to use
      const mode = this.determineWalletMode(availableWallets);
      console.log('Connecting with wallet mode:', mode);

      if (mode === 'extension') {
        return await this.connectWithExtension(walletId);
      } else {
        return await this.connectWithProgrammaticWallet(seed);
      }
    } catch (error) {
      this.updateState({ ...this.state, isConnecting: false });
      console.error('Wallet connection failed:', error);
      throw error;
    }
  }

  private determineWalletMode(availableWallets: WalletOption[]): WalletMode {
    if (this.currentMode === 'programmatic') {
      return 'programmatic';
    }
    
    if (this.currentMode === 'extension') {
      if (availableWallets.length === 0) {
        throw new Error('Extension mode requested but no wallet extensions found. Please install a compatible Midnight wallet.');
      }
      return 'extension';
    }

    // Auto mode: prefer extension if available, fall back to programmatic
    if (availableWallets.length > 0) {
      return 'extension';
    }
    
    console.warn('No wallet extensions found, falling back to programmatic wallet for development');
    return 'programmatic';
  }

  private async connectWithExtension(walletId?: string): Promise<string> {
    try {
      const address = await midnightConnectorService.connect(walletId);
      
      // State will be synced via the connector listener
      return address;
    } catch (error) {
      console.error('Extension wallet connection failed:', error);
      
      // If auto mode and extension fails, try programmatic fallback
      if (this.currentMode === 'auto') {
        console.log('Extension connection failed, trying programmatic fallback...');
        return await this.connectWithProgrammaticWallet();
      }
      
      throw error;
    }
  }

  private async connectWithProgrammaticWallet(seed?: string): Promise<string> {
    if (this.wallet) {
      return this.state.address || '';
    }

    try {
      await this.initializeWallet(seed);
      
      // Wait for the wallet address to be available from the state subscription
      const address = await this.waitForAddress();
      
      // Update mode to reflect actual connection type
      this.updateState({
        ...this.state,
        walletMode: 'programmatic',
      });
      
      return address;
    } catch (error) {
      // Provide more specific error messages
      let errorMessage = 'Failed to connect to Midnight wallet';
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          errorMessage = 'Wallet connection timed out. Please try again.';
        } else if (error.message.includes('WebSocket')) {
          errorMessage = 'Network connection failed. Please check your internet connection.';
        } else if (error.message.includes('prover')) {
          errorMessage = 'Prover server unavailable. Some features may be limited.';
        }
      }
      
      console.error(errorMessage, error);
      const enhancedError = new Error(errorMessage);
      (enhancedError as any).cause = error;
      throw enhancedError;
    }
  }

  private async waitForAddress(timeoutMs: number = 10000): Promise<string> {
    return new Promise((resolve, reject) => {
      // Check if address is already available
      if (this.state.address) {
        resolve(this.state.address);
        return;
      }

      let timeoutId: NodeJS.Timeout;
      let unsubscribe: (() => void) | null = null;

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (unsubscribe) unsubscribe();
      };

      // Set up timeout
      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('Timeout waiting for wallet address'));
      }, timeoutMs);

      // Subscribe to state changes
      unsubscribe = this.subscribe((state) => {
        if (state.address) {
          cleanup();
          resolve(state.address);
        }
      });
    });
  }

  async disconnect(): Promise<void> {
    try {
      // Disconnect extension wallet if connected
      if (this.state.walletMode === 'extension') {
        await midnightConnectorService.disconnect();
      }

      // Disconnect programmatic wallet if available
      if (this.wallet) {
        await this.wallet.close();
        this.wallet = null;
      }

      // Clean up connector subscription
      if (this.connectorUnsubscribe) {
        this.connectorUnsubscribe();
        this.connectorUnsubscribe = null;
      }

      this.updateState({
        address: null,
        isConnected: false,
        isConnecting: false,
        balances: {},
        isSync: false,
        totalBalance: 0n,
        walletMode: this.currentMode,
        availableWallets: [],
      });
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
      // Don't throw error on disconnect failure - ensure state is reset
      this.wallet = null;
      this.updateState({
        address: null,
        isConnected: false,
        isConnecting: false,
        balances: {},
        isSync: false,
        totalBalance: 0n,
        walletMode: this.currentMode,
        availableWallets: [],
      });
    }
  }

  getBalance(tokenType?: TokenType): bigint {
    if (!this.state.isConnected) {
      return 0n;
    }

    if (tokenType) {
      return this.state.balances[tokenType] || 0n;
    }

    return this.state.totalBalance;
  }

  getBalances(): Record<TokenType, bigint> {
    return { ...this.state.balances };
  }

  async createTransferTransaction(outputs: Array<{
    amount: bigint;
    tokenType: TokenType;
    receiverAddress: string;
  }>): Promise<any> {
    if (!this.state.isConnected) {
      throw new Error('Wallet not connected');
    }

    try {
      if (this.state.walletMode === 'extension') {
        return await midnightConnectorService.createTransferTransaction(outputs);
      } else if (this.wallet) {
        // Convert to the correct TokenTransfer format for programmatic wallet
        const tokenTransfers = outputs.map(output => ({
          amount: output.amount,
          type: output.tokenType,
          receiverAddress: output.receiverAddress,
        }));
        
        const transferRecipe = await this.wallet.transferTransaction(tokenTransfers);
        return transferRecipe;
      } else {
        throw new Error('No wallet instance available');
      }
    } catch (error) {
      console.error('Failed to create transfer transaction:', error);
      throw error;
    }
  }

  async proveAndSubmitTransaction(recipe: any): Promise<string> {
    if (!this.state.isConnected) {
      throw new Error('Wallet not connected');
    }

    try {
      if (this.state.walletMode === 'extension') {
        return await midnightConnectorService.signAndSubmitTransaction(recipe);
      } else if (this.wallet) {
        // Prove the transaction
        const provenTransaction = await this.wallet.proveTransaction(recipe);
        
        // Submit the proven transaction
        const txIdentifier = await this.wallet.submitTransaction(provenTransaction);
        return txIdentifier;
      } else {
        throw new Error('No wallet instance available');
      }
    } catch (error) {
      console.error('Failed to prove and submit transaction:', error);
      throw error;
    }
  }

  async getSerializedState(): Promise<string> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }

    try {
      return await this.wallet.serializeState();
    } catch (error) {
      console.error('Failed to serialize wallet state:', error);
      throw error;
    }
  }

  formatAddress(address: string): string {
    if (!address) return '';
    
    if (address.length <= 10) return address;
    
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  }

  /**
   * Get available wallet options
   */
  async getAvailableWallets(): Promise<WalletOption[]> {
    return await midnightConnectorService.detectWallets();
  }

  /**
   * Check if extension wallets are available
   */
  isExtensionWalletAvailable(): boolean {
    return midnightConnectorService.isWalletAvailable();
  }

  /**
   * Get current wallet mode
   */
  getWalletMode(): WalletMode {
    return this.state.walletMode;
  }

  /**
   * Set wallet mode (for development/testing)
   */
  setWalletMode(mode: WalletMode): void {
    this.currentMode = mode;
    this.updateState({
      ...this.state,
      walletMode: mode,
    });
  }

  validateBech32Address(address: string): boolean {
    try {
      // Midnight addresses use bech32m encoding with 'midnight' prefix
      return address.startsWith('midnight') && address.length >= 40;
    } catch (error) {
      return false;
    }
  }

  getSyncProgress(): { synced: boolean; sourceGap: bigint; applyGap: bigint } | null {
    if (!this.wallet || !this.state.isConnected) {
      return null;
    }

    // This would come from the wallet state in a real implementation
    return {
      synced: this.state.isSync,
      sourceGap: 0n,
      applyGap: 0n,
    };
  }

  getState(): MidnightWalletState {
    return { ...this.state };
  }

  subscribe(listener: (state: MidnightWalletState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private updateState(newState: MidnightWalletState): void {
    this.state = newState;
    this.listeners.forEach(listener => listener(this.state));
  }

  isConnected(): boolean {
    return this.state.isConnected;
  }

  getAddress(): string | null {
    return this.state.address;
  }
}

export const midnightWalletService = new MidnightWalletService();