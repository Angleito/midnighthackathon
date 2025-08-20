import type { 
  DAppConnectorAPI,
  DAppConnectorWalletAPI
} from '@midnight-ntwrk/dapp-connector-api';
import type { TokenType } from '@midnight-ntwrk/wallet-api';

export interface MidnightConnectorState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  balances: Record<TokenType, bigint>;
  isSync: boolean;
  totalBalance: bigint;
  walletAPI: DAppConnectorWalletAPI | null;
}

export interface WalletOption {
  id: string;
  name: string;
  icon?: string;
  provider: DAppConnectorAPI;
}

export class MidnightConnectorService {
  private provider: DAppConnectorAPI | null = null;
  private walletAPI: DAppConnectorWalletAPI | null = null;
  private state: MidnightConnectorState = {
    address: null,
    isConnected: false,
    isConnecting: false,
    balances: {},
    isSync: false,
    totalBalance: 0n,
    walletAPI: null,
  };
  private listeners: Set<(state: MidnightConnectorState) => void> = new Set();

  constructor() {
    this.initializeEventListeners();
  }

  private initializeEventListeners(): void {
    // Listen for wallet events if provider is available
    if (typeof window !== 'undefined') {
      window.addEventListener('midnight_walletChanged', this.handleWalletChanged.bind(this));
      window.addEventListener('midnight_accountsChanged', this.handleAccountsChanged.bind(this));
      window.addEventListener('midnight_disconnect', this.handleDisconnect.bind(this));
    }
  }

  private handleWalletChanged(event: any): void {
    console.log('Wallet changed:', event.detail);
    // Handle wallet changes if needed
  }

  private handleAccountsChanged(event: any): void {
    console.log('Accounts changed:', event.detail);
    const accounts = event.detail?.accounts || [];
    if (accounts.length === 0) {
      this.handleDisconnect();
    } else {
      this.updateState({
        ...this.state,
        address: accounts[0] || null,
      });
    }
  }

  private handleDisconnect(): void {
    console.log('Wallet disconnected');
    this.provider = null;
    this.walletAPI = null;
    this.updateState({
      address: null,
      isConnected: false,
      isConnecting: false,
      balances: {},
      isSync: false,
      totalBalance: 0n,
      walletAPI: null,
    });
  }

  /**
   * Detect available Midnight wallet providers with retry mechanism
   */
  async detectWallets(retryCount: number = 5): Promise<WalletOption[]> {
    const wallets: WalletOption[] = [];

    if (typeof window === 'undefined') {
      return wallets;
    }

    // Check for injected Midnight providers at different injection points
    const midnight = (window as any).midnight;
    const cardano = (window as any).cardano;
    const lace = (window as any).lace;
    
    console.log('Checking for wallet injections:');
    console.log('- window.midnight:', !!midnight);
    console.log('- window.cardano:', !!cardano);
    console.log('- window.lace:', !!lace);
    
    // Debug: Check what's available in cardano object
    if (cardano) {
      console.log('- window.cardano.lace:', !!cardano.lace);
      console.log('- window.cardano keys:', Object.keys(cardano));
      if (cardano.lace) {
        console.log('- cardano.lace keys:', Object.keys(cardano.lace));
      }
    }
    
    // Check if Lace is injected directly at window.lace (some versions do this)
    if (lace && typeof lace.enable === 'function') {
      console.log('Found Lace wallet at window.lace');
      wallets.push({
        id: 'lace-direct',
        name: 'Lace Midnight Preview',
        provider: lace,
      });
    }
    
    // Check if Lace is available through cardano namespace (Cardano compatibility mode)
    if (cardano && cardano.lace && typeof cardano.lace.enable === 'function') {
      console.log('Found Lace wallet at window.cardano.lace');
      wallets.push({
        id: 'cardano-lace',
        name: 'Lace Midnight Preview (Cardano)',
        provider: cardano.lace,
      });
    }
    
    // Check for any Cardano wallets that might support Midnight
    if (cardano && Object.keys(cardano).length > 0) {
      for (const [walletName, walletObj] of Object.entries(cardano)) {
        if (walletObj && typeof (walletObj as any).enable === 'function') {
          console.log(`Found Cardano wallet: ${walletName}`);
          // Check if this wallet supports Midnight functionality
          const wallet = walletObj as any;
          if (wallet.experimental?.midnight || wallet.midnight || walletName.toLowerCase().includes('lace')) {
            console.log(`Wallet ${walletName} may support Midnight`);
            wallets.push({
              id: `cardano-${walletName}`,
              name: `${walletName} (Midnight Support)`,
              provider: wallet,
            });
          }
        }
      }
    }
    
    if (midnight) {
      console.log('window.midnight object found:', Object.keys(midnight));
      // Check for Lace Midnight Preview wallet first
      const laceProvider = midnight.lace;
      if (laceProvider && typeof laceProvider.enable === 'function') {
        console.log('Found Lace Midnight Preview wallet');
        wallets.push({
          id: 'midnight-lace',
          name: 'Lace Midnight Preview',
          provider: laceProvider,
        });
      }
      
      // Also check for other potential Midnight wallet providers
      const otherProviderNames = ['nufi', 'vespr', 'gero', 'yoroi', 'begin'];
      for (const name of otherProviderNames) {
        const provider = midnight[name];
        if (provider && typeof provider.enable === 'function') {
          console.log(`Found additional Midnight wallet: ${name}`);
          wallets.push({
            id: `midnight-${name}`,
            name: this.getWalletDisplayName(name),
            provider: provider,
          });
        }
      }

      // If there's a default provider without specific wallet names
      if (midnight.enable && typeof midnight.enable === 'function' && wallets.length === 0) {
        wallets.push({
          id: 'midnight-default',
          name: 'Midnight Wallet',
          provider: midnight,
        });
      }
    } 
    
    // Only retry if no wallets were found at all injection points
    if (wallets.length === 0 && retryCount > 0) {
      // Wallet extension might not have injected yet, retry after a short delay
      console.log(`No wallet detected at any injection point, retrying... (${retryCount} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 500));
      return this.detectWallets(retryCount - 1);
    } else if (wallets.length === 0) {
      console.warn('No wallet extension found after all retries.');
      console.warn('Please check:');
      console.warn('1. Lace Midnight Preview is installed from Chrome Web Store');
      console.warn('2. Extension permissions are set to "On all sites"');
      console.warn('3. Extension is enabled and pinned to toolbar');
    }

    return wallets;
  }

  private getWalletDisplayName(id: string): string {
    const names: Record<string, string> = {
      lace: 'Lace Midnight Preview',
      nufi: 'NuFi Wallet',
      vespr: 'Vespr Wallet',
      gero: 'Gero Wallet',
      yoroi: 'Yoroi Wallet',
      begin: 'Begin Wallet',
    };
    return names[id] || `${id.charAt(0).toUpperCase()}${id.slice(1)} Wallet`;
  }

  /**
   * Check if any Midnight wallet is available
   */
  isWalletAvailable(): boolean {
    return typeof window !== 'undefined' && !!(window as any).midnight;
  }

  /**
   * Connect to a specific wallet provider
   */
  async connect(walletId?: string): Promise<string> {
    if (this.state.isConnecting) {
      throw new Error('Connection already in progress');
    }

    this.updateState({ ...this.state, isConnecting: true });

    try {
      const wallets = await this.detectWallets();
      
      if (wallets.length === 0) {
        throw new Error('No Midnight wallets detected. Please install a compatible wallet extension.');
      }

      // Use specified wallet or first available
      let selectedWallet = wallets[0];
      if (walletId) {
        const wallet = wallets.find(w => w.id === walletId);
        if (!wallet) {
          throw new Error(`Wallet "${walletId}" not found`);
        }
        selectedWallet = wallet;
      }

      console.log('Connecting to wallet:', selectedWallet.name);
      this.provider = selectedWallet.provider;

      // Check if already enabled
      const isEnabled = await this.provider.isEnabled();
      if (!isEnabled) {
        // Request access
        this.walletAPI = await this.provider.enable();
      } else {
        // Already enabled, get wallet API directly (this might not work for all wallets)
        this.walletAPI = await this.provider.enable();
      }

      // Get wallet state - Lace wallet API doesn't have state() method
      // Log available methods for debugging
      console.log('Available wallet API methods:', Object.getOwnPropertyNames(this.walletAPI));
      console.log('Wallet API prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(this.walletAPI)));
      
      // Try to get address through available methods
      let address = null;
      try {
        // Try different methods that might be available
        // Note: These methods may not be available in current API version
        // TODO: Update to use correct API methods when available
        console.log('Address retrieval methods not available in current API version');
        console.log('Retrieved address from wallet:', address);
      } catch (error) {
        console.warn('Could not get address from wallet API:', error);
        // Continue without address for now
      }

      // For now, we'll set basic state - balances would need to be fetched differently
      this.updateState({
        address,
        isConnected: true,
        isConnecting: false,
        balances: {}, // TODO: Implement balance fetching
        isSync: true, // TODO: Implement sync status
        totalBalance: 0n,
        walletAPI: this.walletAPI,
      });

      console.log('Successfully connected to wallet:', address);
      return address || '';
    } catch (error) {
      console.error('Failed to connect to wallet:', error);
      this.updateState({
        ...this.state,
        isConnecting: false,
      });
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('state is not a function')) {
          throw new Error('Wallet API incompatibility: This wallet version may not be fully supported. Please try a different wallet or update your browser extension.');
        } else if (error.message.includes('User denied')) {
          throw new Error('Connection denied: Please accept the wallet connection request to continue.');
        } else if (error.message.includes('ApiError')) {
          throw new Error('Wallet API error: The wallet extension may not be properly installed or enabled.');
        }
      }
      
      throw error;
    }
  }

  /**
   * Disconnect from current wallet
   */
  async disconnect(): Promise<void> {
    if (!this.provider) {
      return;
    }

    try {
      // The DApp connector API doesn't have a disconnect method
      // The wallet will handle disconnection through its own UI
      console.log('Disconnecting from wallet...');
    } catch (error) {
      console.warn('Error during wallet disconnect:', error);
    } finally {
      this.handleDisconnect();
    }
  }

  /**
   * Get current balances
   */
  async getBalances(): Promise<Record<TokenType, bigint>> {
    if (!this.walletAPI || !this.state.isConnected) {
      return {};
    }

    try {
      // The DApp connector API doesn't expose balances directly
      // This would need to be implemented by querying the indexer
      // For now, return empty balances
      return {};
    } catch (error) {
      console.error('Failed to get balances:', error);
      return {};
    }
  }

  /**
   * Create a transfer transaction
   */
  async createTransferTransaction(_outputs: Array<{
    amount: bigint;
    tokenType: TokenType;
    receiverAddress: string;
  }>): Promise<any> {
    if (!this.walletAPI || !this.state.isConnected) {
      throw new Error('Wallet not connected');
    }

    // The DApp connector API doesn't have transfer transaction creation
    // This would need to be implemented using the wallet's balanceAndProveTransaction method
    throw new Error('Transfer transaction creation not yet implemented for extension wallets');
  }

  /**
   * Sign and submit a transaction
   */
  async signAndSubmitTransaction(transaction: any): Promise<string> {
    if (!this.walletAPI || !this.state.isConnected) {
      throw new Error('Wallet not connected');
    }

    try {
      const result = await this.walletAPI.submitTransaction(transaction);
      return result;
    } catch (error) {
      console.error('Failed to submit transaction:', error);
      throw error;
    }
  }

  /**
   * Get wallet information
   */
  getWalletInfo(): any | null {
    return this.provider;
  }

  /**
   * Format address for display
   */
  formatAddress(address: string): string {
    if (!address) return '';
    
    if (address.length <= 10) return address;
    
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  }

  /**
   * Get current state
   */
  getState(): MidnightConnectorState {
    return { ...this.state };
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: MidnightConnectorState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private updateState(newState: MidnightConnectorState): void {
    this.state = newState;
    this.listeners.forEach(listener => listener(this.state));
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state.isConnected;
  }

  /**
   * Get current address
   */
  getAddress(): string | null {
    return this.state.address;
  }

  /**
   * Get balance for specific token type
   */
  getBalance(tokenType?: TokenType): bigint {
    if (!this.state.isConnected) {
      return 0n;
    }

    if (tokenType) {
      return this.state.balances[tokenType] || 0n;
    }

    return this.state.totalBalance;
  }
}

export const midnightConnectorService = new MidnightConnectorService();