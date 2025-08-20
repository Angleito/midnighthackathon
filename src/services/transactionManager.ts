import { midnightWalletService } from './midnightWalletService';
import { CombatAction, CombatStats, PrivateCombatData } from '../types/zk-types';

export interface PendingTransaction {
  id: string;
  type: 'combat_action' | 'monster_switch' | 'combat_init';
  sessionId: bigint;
  action?: CombatAction;
  hash?: string;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'submitted' | 'confirmed' | 'failed' | 'timeout';
  blockNumber?: number;
  gasUsed?: bigint;
  error?: string;
}

export interface TransactionOptions {
  gasLimit?: bigint;
  maxRetries?: number;
  timeoutMs?: number;
}

export class TransactionManager {
  private pendingTransactions = new Map<string, PendingTransaction>();
  private transactionQueue: PendingTransaction[] = [];
  private isProcessing = false;
  private listeners: ((transaction: PendingTransaction) => void)[] = [];
  
  // Configuration
  private readonly MAX_RETRIES = 3;
  private readonly TIMEOUT_MS = 30000; // 30 seconds
  private readonly RETRY_DELAY_MS = 2000; // 2 seconds
  private readonly CONFIRMATION_BLOCKS = 3; // Wait for 3 block confirmations

  constructor() {
    // Start the transaction processing loop
    this.startProcessing();
  }

  /**
   * Submit a combat action transaction
   */
  async submitCombatAction(
    sessionId: bigint,
    action: CombatAction,
    privateDamageData: PrivateCombatData,
    enemyStats: CombatStats,
    options: TransactionOptions = {}
  ): Promise<string> {
    console.log('🔥 CREATING MIDNIGHT TRANSACTION FOR TURN:', {
      action,
      sessionId: sessionId.toString(),
      timestamp: new Date().toISOString()
    });
    
    const transactionId = this.generateTransactionId();
    
    const pendingTx: PendingTransaction = {
      id: transactionId,
      type: 'combat_action',
      sessionId,
      action,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending'
    };

    this.pendingTransactions.set(transactionId, pendingTx);
    this.transactionQueue.push(pendingTx);
    this.notifyListeners(pendingTx);

    try {
      // Generate ZK proof for the action
      const proof = await this.generateActionProof(sessionId, action, privateDamageData);
      
      // Submit transaction to Midnight network
      const txHash = await this.submitToNetwork({
        contract: 'ZKCombat',
        function: 'performAction',
        args: [sessionId, this.actionToEnum(action), privateDamageData, enemyStats],
        proof,
        gasLimit: options.gasLimit || 500000n
      });

      console.log('✅ MIDNIGHT TRANSACTION SUBMITTED:', {
        transactionId,
        txHash,
        action,
        status: 'submitted'
      });

      pendingTx.hash = txHash;
      pendingTx.status = 'submitted';
      this.notifyListeners(pendingTx);

      // Start monitoring for confirmation
      this.monitorTransaction(transactionId);

      return transactionId;
    } catch (error) {
      pendingTx.status = 'failed';
      pendingTx.error = error instanceof Error ? error.message : 'Unknown error';
      this.notifyListeners(pendingTx);
      throw error;
    }
  }

  /**
   * Submit a monster switch transaction
   */
  async submitMonsterSwitch(
    sessionId: bigint,
    monsterIndex: number,
    options: TransactionOptions = {}
  ): Promise<string> {
    console.log('🔥 CREATING MIDNIGHT TRANSACTION FOR MONSTER SWITCH:', {
      action: 'switch',
      monsterIndex,
      sessionId: sessionId.toString(),
      timestamp: new Date().toISOString()
    });
    
    const transactionId = this.generateTransactionId();
    
    const pendingTx: PendingTransaction = {
      id: transactionId,
      type: 'monster_switch',
      sessionId,
      action: CombatAction.SwitchMonster,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending'
    };

    this.pendingTransactions.set(transactionId, pendingTx);
    this.transactionQueue.push(pendingTx);
    this.notifyListeners(pendingTx);

    try {
      // Create private damage data for switch (contains monster index)
      const switchData: PrivateCombatData = {
        playerSecretSeed: BigInt(Math.floor(Math.random() * 1000000)),
        monsterSecretSeed: BigInt(Math.floor(Math.random() * 1000000)),
        damageRoll: BigInt(monsterIndex), // Use damage roll to pass monster index
        criticalChance: 0n
      };

      // Submit switch transaction
      const txHash = await this.submitToNetwork({
        contract: 'ZKCombat',
        function: 'performAction',
        args: [sessionId, 4n, switchData, this.getEmptyStats()], // 4n = SwitchMonster enum
        gasLimit: options.gasLimit || 300000n
      });

      pendingTx.hash = txHash;
      pendingTx.status = 'submitted';
      this.notifyListeners(pendingTx);

      this.monitorTransaction(transactionId);
      return transactionId;
    } catch (error) {
      pendingTx.status = 'failed';
      pendingTx.error = error instanceof Error ? error.message : 'Unknown error';
      this.notifyListeners(pendingTx);
      throw error;
    }
  }

  /**
   * Submit combat initialization transaction
   */
  async submitCombatInit(
    playerStats: CombatStats,
    benchMonsters: CombatStats[],
    enemyCommitment: bigint,
    commitmentNonce: bigint,
    options: TransactionOptions = {}
  ): Promise<string> {
    const transactionId = this.generateTransactionId();
    
    const pendingTx: PendingTransaction = {
      id: transactionId,
      type: 'combat_init',
      sessionId: 0n, // Will be set after transaction
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending'
    };

    this.pendingTransactions.set(transactionId, pendingTx);
    this.transactionQueue.push(pendingTx);
    this.notifyListeners(pendingTx);

    try {
      const txHash = await this.submitToNetwork({
        contract: 'ZKCombat',
        function: 'initializeCombat',
        args: [playerStats, benchMonsters, enemyCommitment, commitmentNonce],
        gasLimit: options.gasLimit || 800000n
      });

      pendingTx.hash = txHash;
      pendingTx.status = 'submitted';
      this.notifyListeners(pendingTx);

      this.monitorTransaction(transactionId);
      return transactionId;
    } catch (error) {
      pendingTx.status = 'failed';
      pendingTx.error = error instanceof Error ? error.message : 'Unknown error';
      this.notifyListeners(pendingTx);
      throw error;
    }
  }

  /**
   * Get transaction status
   */
  getTransactionStatus(transactionId: string): PendingTransaction | null {
    return this.pendingTransactions.get(transactionId) || null;
  }

  /**
   * Get all pending transactions for a session
   */
  getSessionTransactions(sessionId: bigint): PendingTransaction[] {
    return Array.from(this.pendingTransactions.values())
      .filter(tx => tx.sessionId === sessionId);
  }

  /**
   * Subscribe to transaction updates
   */
  subscribe(listener: (transaction: PendingTransaction) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Cancel a pending transaction
   */
  async cancelTransaction(transactionId: string): Promise<boolean> {
    const tx = this.pendingTransactions.get(transactionId);
    if (!tx || tx.status !== 'pending') {
      return false;
    }

    tx.status = 'failed';
    tx.error = 'Cancelled by user';
    this.notifyListeners(tx);
    return true;
  }

  // Private methods

  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private async submitToNetwork(params: {
    contract: string;
    function: string;
    args: any[];
    proof?: string;
    gasLimit?: bigint;
  }): Promise<string> {
    // For now, simulate network submission
    // In a real implementation, this would call the actual Midnight network
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (!midnightWalletService.isConnected()) {
      throw new Error('Wallet not connected');
    }

    // Simulate transaction hash
    const txHash = `0x${Math.random().toString(16).substring(2)}${Date.now().toString(16)}`;
    console.log(`Submitting ${params.function} to ${params.contract}:`, {
      args: params.args,
      gasLimit: params.gasLimit,
      hash: txHash
    });

    return txHash;
  }

  private async generateActionProof(
    sessionId: bigint,
    action: CombatAction,
    privateDamageData: PrivateCombatData
  ): Promise<string> {
    // Simulate ZK proof generation
    await new Promise(resolve => setTimeout(resolve, 150));
    return `zk_proof_${sessionId}_${action}_${Date.now()}`;
  }

  private actionToEnum(action: CombatAction): bigint {
    switch (action) {
      case CombatAction.Attack: return 0n;
      case CombatAction.Magic: return 1n;
      case CombatAction.Defend: return 2n;
      case CombatAction.Flee: return 3n;
      case CombatAction.SwitchMonster: return 4n;
      default: return 0n;
    }
  }

  private getEmptyStats(): CombatStats {
    return {
      health: 0n,
      attackPower: 0n,
      defense: 0n,
      speed: 0n,
      magicAttack: 0n,
      magicDefense: 0n
    };
  }

  private async monitorTransaction(transactionId: string): Promise<void> {
    const tx = this.pendingTransactions.get(transactionId);
    if (!tx) return;

    // Simulate network monitoring
    setTimeout(async () => {
      if (tx.status === 'submitted') {
        // Simulate confirmation
        if (Math.random() > 0.1) { // 90% success rate
          tx.status = 'confirmed';
          tx.blockNumber = Math.floor(Math.random() * 1000000) + 1000000;
          tx.gasUsed = BigInt(Math.floor(Math.random() * 200000) + 100000);
        } else {
          tx.status = 'failed';
          tx.error = 'Transaction reverted';
        }
        this.notifyListeners(tx);
      }
    }, 3000 + Math.random() * 2000); // 3-5 second confirmation time
  }

  private notifyListeners(transaction: PendingTransaction): void {
    this.listeners.forEach(listener => {
      try {
        listener(transaction);
      } catch (error) {
        console.error('Error in transaction listener:', error);
      }
    });
  }

  private startProcessing(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;

    const processQueue = async () => {
      // Process timeouts
      const now = Date.now();
      this.pendingTransactions.forEach((tx) => {
        if (tx.status === 'pending' && now - tx.timestamp > this.TIMEOUT_MS) {
          tx.status = 'timeout';
          tx.error = 'Transaction timed out';
          this.notifyListeners(tx);
        }
      });

      // Clean up old transactions (older than 1 hour)
      const oneHourAgo = now - 3600000;
      this.pendingTransactions.forEach((tx, id) => {
        if (tx.timestamp < oneHourAgo && 
            ['confirmed', 'failed', 'timeout'].includes(tx.status)) {
          this.pendingTransactions.delete(id);
        }
      });

      // Continue processing
      setTimeout(processQueue, 5000); // Check every 5 seconds
    };

    processQueue();
  }
}

export const transactionManager = new TransactionManager();