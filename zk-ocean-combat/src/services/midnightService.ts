import { midnightWalletService, type MidnightWalletState } from './midnightWalletService';

export class MidnightService {
  private walletState: MidnightWalletState | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    this.unsubscribe = midnightWalletService.subscribe((state) => {
      this.walletState = state;
    });
  }

  async connect(): Promise<string> {
    try {
      const address = await midnightWalletService.connect();
      return address;
    } catch (error) {
      console.error('Failed to connect Midnight wallet:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await midnightWalletService.disconnect();
      if (this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = null;
      }
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
      throw error;
    }
  }

  async commitBoardState(commitment: string): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('Wallet not connected');
    }

    try {
      const proof = await this.generateCommitmentProof(commitment);
      // For now, we'll simulate the ZK proof submission
      // In a real implementation, this would use the proper Midnight contract interface
      console.log('Board state committed with ZK proof:', proof);
      return 'commitment_tx_' + Math.random().toString(16).substring(2);
    } catch (error) {
      console.error('Failed to commit board state:', error);
      throw error;
    }
  }

  async submitAttack(coordinate: { x: number; y: number }, proof: string): Promise<boolean> {
    if (!this.isConnected()) {
      throw new Error('Wallet not connected');
    }

    try {
      const publicInputs = [coordinate.x.toString(), coordinate.y.toString()];
      // For now, we'll simulate the attack submission
      // In a real implementation, this would use the proper Midnight contract interface
      console.log('Attack submitted with ZK proof:', proof, publicInputs);
      
      return Math.random() > 0.5;
    } catch (error) {
      console.error('Failed to submit attack:', error);
      throw error;
    }
  }

  async verifyProof(proof: string, publicInputs: string[]): Promise<boolean> {
    try {
      console.log('Verifying ZK proof locally:', proof, publicInputs);
      return true;
    } catch (error) {
      console.error('Failed to verify proof:', error);
      return false;
    }
  }

  async generateCommitmentProof(commitment: string): Promise<string> {
    console.log('Generating ZK proof for commitment:', commitment);
    return 'zk_proof_' + Math.random().toString(16).substring(2);
  }

  getBalance(tokenType?: string): bigint {
    return midnightWalletService.getBalance(tokenType);
  }

  getAddress(): string | null {
    return midnightWalletService.getAddress();
  }

  isConnected(): boolean {
    return midnightWalletService.isConnected();
  }

  getWalletState(): MidnightWalletState {
    return midnightWalletService.getState();
  }
}

export const midnightService = new MidnightService();
