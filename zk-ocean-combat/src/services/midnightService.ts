import { ethers } from 'ethers';

export class MidnightService {
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.JsonRpcSigner | null = null;

  async connect(externalProvider?: any): Promise<string> {
    const eip1193 = externalProvider || (window as any).ethereum;
    if (!eip1193) {
      throw new Error('No wallet provider found.');
    }

    try {
      this.provider = new ethers.BrowserProvider(eip1193);
      if (!externalProvider) {
        await this.provider.send('eth_requestAccounts', []);
      }
      this.signer = await this.provider.getSigner();
      const address = await this.signer.getAddress();
      
      // Initialize contract here when deployed
      // this.contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, this.signer);
      
      return address;
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.provider = null;
    this.signer = null;
  }

  async commitBoardState(commitment: string): Promise<string> {
    console.log('Committing board state:', commitment);
    return '0x' + Math.random().toString(16).substring(2);
  }

  async submitAttack(coordinate: { x: number; y: number }, proof: string): Promise<boolean> {
    console.log('Submitting attack:', coordinate, proof);
    return Math.random() > 0.5; // Random hit/miss for demo
  }

  async verifyProof(proof: string, publicInputs: string[]): Promise<boolean> {
    console.log('Verifying proof:', proof, publicInputs);
    return true;
  }

  isConnected(): boolean {
    return this.signer !== null;
  }
}

export const midnightService = new MidnightService();
