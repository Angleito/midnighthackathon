import { WalletBuilder, type Resource } from '@midnight-ntwrk/wallet';
import { type Wallet, type WalletState, type TokenType } from '@midnight-ntwrk/wallet-api';
import * as zswap from '@midnight-ntwrk/zswap';

export interface MidnightWalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  balances: Record<TokenType, bigint>;
  isSync: boolean;
  totalBalance: bigint;
}

export class MidnightWalletService {
  private wallet: (Wallet & Resource) | null = null;
  private state: MidnightWalletState = {
    address: null,
    isConnected: false,
    isConnecting: false,
    balances: {},
    isSync: false,
    totalBalance: 0n,
  };
  private listeners: Set<(state: MidnightWalletState) => void> = new Set();

  // Configuration for Midnight network
  private readonly config = {
    indexerUri: 'https://indexer.testnet.midnight.network/api/v1/graphql',
    indexerWsUri: 'wss://indexer.testnet.midnight.network/api/v1/graphql',
    proverServerUri: 'http://localhost:6300',
    substrateNodeUri: 'https://rpc.testnet.midnight.network',
    networkId: zswap.NetworkId.TestNet,
    logLevel: 'error' as const,
  };

  constructor() {
    // Don't initialize automatically - let user call connect explicitly
  }

  private async initializeWallet(seed?: string): Promise<void> {
    try {
      // Generate a random seed if none provided
      const walletSeed = seed || this.generateRandomSeed();
      
      this.wallet = await WalletBuilder.build(
        this.config.indexerUri,
        this.config.indexerWsUri,
        this.config.proverServerUri,
        this.config.substrateNodeUri,
        walletSeed,
        this.config.networkId,
        this.config.logLevel
      );

      // Start the wallet resource
      this.wallet.start();
      
      // Subscribe to wallet state changes
      this.wallet.state().subscribe((walletState: WalletState) => {
        this.updateStateFromWallet(walletState);
      });

      this.updateState({
        ...this.state,
        isConnected: true,
        isConnecting: false,
      });
    } catch (error) {
      console.error('Failed to initialize Midnight wallet:', error);
      this.updateState({
        ...this.state,
        isConnecting: false,
      });
      throw error;
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
      address: walletState.address,
      isConnected: true,
      isConnecting: false,
      balances: walletState.balances,
      isSync: walletState.syncProgress?.synced ?? false,
      totalBalance,
    });
  }

  async connect(seed?: string): Promise<string> {
    if (this.wallet) {
      return this.state.address || '';
    }

    this.updateState({ ...this.state, isConnecting: true });

    try {
      await this.initializeWallet(seed);
      
      if (!this.state.address) {
        throw new Error('Failed to get wallet address after initialization');
      }

      return this.state.address;
    } catch (error) {
      this.updateState({ ...this.state, isConnecting: false });
      console.error('Failed to connect to Midnight wallet:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.wallet) {
      return;
    }

    try {
      await this.wallet.close();
      this.wallet = null;
      this.updateState({
        address: null,
        isConnected: false,
        isConnecting: false,
        balances: {},
        isSync: false,
        totalBalance: 0n,
      });
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
      throw error;
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
    if (!this.wallet || !this.state.isConnected) {
      throw new Error('Wallet not connected');
    }

    try {
      // Convert to the correct TokenTransfer format
      const tokenTransfers = outputs.map(output => ({
        amount: output.amount,
        type: output.tokenType,
        receiverAddress: output.receiverAddress,
      }));
      
      const transferRecipe = await this.wallet.transferTransaction(tokenTransfers);
      return transferRecipe;
    } catch (error) {
      console.error('Failed to create transfer transaction:', error);
      throw error;
    }
  }

  async proveAndSubmitTransaction(recipe: any): Promise<string> {
    if (!this.wallet || !this.state.isConnected) {
      throw new Error('Wallet not connected');
    }

    try {
      // Prove the transaction
      const provenTransaction = await this.wallet.proveTransaction(recipe);
      
      // Submit the proven transaction
      const txIdentifier = await this.wallet.submitTransaction(provenTransaction);
      return txIdentifier;
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