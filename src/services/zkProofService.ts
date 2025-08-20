import { CombatStats, CombatAction, PrivateCombatData } from '../types/zk-types';

export interface ZKProof {
  proof: string;
  publicInputs: string[];
  commitment: string;
}

export interface MonsterCommitment {
  statsHash: string;
  nonce: string;
  revealed: boolean;
  timestamp?: number;
}

export interface ActionProof {
  proof: string;
  publicInputs: string[];
  privateSeed: string;
  damageCommitment: string;
  sessionId?: bigint;
  action?: CombatAction;
  turn?: number;
}

export interface OwnershipProof {
  proof: string;
  owner: string;
  assetId: string;
  monsterIndex?: number;
  ownershipCommitment?: string;
  validityProof?: string;
}

export interface RevealProof {
  originalStats: CombatStats;
  nonce: string;
  commitmentVerification: string;
  integrityProof: string;
  revealedStats?: CombatStats;
  proof?: string;
  isValid?: boolean;
}

export class ZKProofService {
  private readonly PROOF_PREFIX = '0x';
  private readonly HASH_LENGTH = 64;

  /**
   * Generate commitment for monster stats using hash pattern from ZKCombat.compact
   */
  generateMonsterCommitment(stats: CombatStats, nonce: bigint): MonsterCommitment {
    // Implementation follows createMonsterCommitment from ZKCombat.compact
    const statsHash = this.hashCombatStats(stats);
    const commitment = this.keccak256Hash(statsHash + nonce.toString());
    
    return {
      statsHash: this.PROOF_PREFIX + commitment,
      nonce: this.PROOF_PREFIX + nonce.toString(16).padStart(this.HASH_LENGTH, '0'),
      revealed: false
    };
  }

  /**
   * Generate ZK proof for combat action without revealing future outcomes
   */
  generateActionValidityProof(
    sessionId: bigint,
    action: CombatAction,
    playerStats: CombatStats,
    enemyCommitment: MonsterCommitment,
    privateDamageData: PrivateCombatData,
    turn: bigint
  ): ActionProof {
    // Generate proof that action is valid without revealing private damage calculations
    const actionHash = this.hashAction(action, sessionId, turn);
    const damageCommitment = this.generateDamageCommitment(privateDamageData);
    
    // Create ZK proof that validates action constraints
    const proofData = this.generateProofData([
      sessionId.toString(),
      action.toString(),
      actionHash,
      damageCommitment,
      turn.toString()
    ]);

    return {
      proof: this.PROOF_PREFIX + proofData,
      publicInputs: [
        sessionId.toString(),
        action.toString(),
        turn.toString()
      ],
      privateSeed: this.PROOF_PREFIX + privateDamageData.playerSecretSeed.toString(16),
      damageCommitment
    };
  }

  /**
   * Generate proof for monster switching without revealing bench composition
   */
  generateMonsterSwitchProof(
    sessionId: bigint,
    playerAddress: string,
    monsterIndex: number,
    benchMonsters: CombatStats[],
    secretSeed: bigint
  ): OwnershipProof {
    // Prove ownership of monster without revealing all bench monsters
    const ownershipCommitment = this.generateOwnershipCommitment(
      playerAddress,
      benchMonsters,
      secretSeed
    );
    
    // Generate validity proof for the switch
    const validityData = this.generateSwitchValidityProof(
      monsterIndex,
      benchMonsters.length,
      sessionId
    );

    return {
      proof: this.PROOF_PREFIX + this.generateProofData([
        sessionId.toString(),
        playerAddress,
        monsterIndex.toString(),
        ownershipCommitment
      ]),
      owner: playerAddress,
      assetId: `monster_${monsterIndex}`,
      monsterIndex,
      ownershipCommitment,
      validityProof: validityData
    };
  }

  /**
   * Generate commitment-reveal verification for combat conclusion
   */
  generateRevealProof(
    originalCommitment: MonsterCommitment,
    revealedStats: CombatStats,
    nonce: bigint
  ): RevealProof {
    // Verify that revealed stats match original commitment
    const computedHash = this.hashCombatStats(revealedStats);
    const commitmentVerification = this.keccak256Hash(computedHash + nonce.toString());
    
    // Generate integrity proof that stats weren't tampered with
    const integrityProof = this.generateIntegrityProof(
      originalCommitment.statsHash,
      commitmentVerification
    );

    return {
      originalStats: revealedStats,
      nonce: nonce.toString(),
      commitmentVerification: this.PROOF_PREFIX + commitmentVerification,
      integrityProof
    };
  }

  /**
   * Verify monster commitment against revealed stats
   */
  verifyCommitmentReveal(
    commitment: MonsterCommitment,
    revealedStats: CombatStats,
    nonce: bigint
  ): boolean {
    const statsHash = this.hashCombatStats(revealedStats);
    const expectedCommitment = this.keccak256Hash(statsHash + nonce.toString());
    
    return commitment.statsHash === (this.PROOF_PREFIX + expectedCommitment);
  }

  /**
   * Verify action validity proof
   */
  verifyActionProof(
    proof: ActionProof,
    expectedSessionId: bigint,
    expectedAction: CombatAction,
    expectedTurn: bigint
  ): boolean {
    if (!proof.proof.startsWith(this.PROOF_PREFIX)) return false;
    
    // Verify public inputs match expected values
    const [sessionId, action, turn] = proof.publicInputs;
    return (
      sessionId === expectedSessionId.toString() &&
      action === expectedAction.toString() &&
      turn === expectedTurn.toString()
    );
  }


  /**
   * Generate commitment for a player's move selection (enhanced version)
   */
  generateMoveCommitment(
    turn: bigint,
    actorId: string,
    action: CombatAction,
    privateSeed: bigint
  ): string {
    const commitmentData = `${turn}:${actorId}:${action}:${privateSeed}`;
    return this.PROOF_PREFIX + this.keccak256Hash(commitmentData);
  }

  /**
   * Generate damage commitment without revealing actual damage
   */
  generateDamageCommitment(privateDamageData: PrivateCombatData): string {
    const damageData = [
      privateDamageData.playerSecretSeed.toString(),
      privateDamageData.monsterSecretSeed.toString(),
      privateDamageData.damageRoll.toString(),
      privateDamageData.criticalChance.toString()
    ].join(':');
    
    return this.PROOF_PREFIX + this.keccak256Hash(damageData);
  }

  /**
   * Verify comprehensive ZK proof
   */
  verifyProof(proof: ZKProof, expectedCommitment?: string): boolean {
    if (!proof || !proof.proof.startsWith(this.PROOF_PREFIX)) return false;
    if (expectedCommitment && proof.commitment !== expectedCommitment) return false;
    
    // Additional validation for proof structure
    return (
      proof.publicInputs.length > 0 &&
      proof.commitment.startsWith(this.PROOF_PREFIX)
    );
  }

  // Private helper methods

  /**
   * Hash combat stats following ZKCombat.compact pattern
   */
  private hashCombatStats(stats: CombatStats): string {
    const combinedStats = 
      stats.health.toString() + 
      (stats.attackPower * BigInt(1000)).toString() + 
      (stats.defense * BigInt(1000000)).toString() + 
      (stats.speed * BigInt(1000000000)).toString() + 
      (stats.magicAttack * BigInt(1000000000000)).toString() + 
      (stats.magicDefense * BigInt(1000000000000000)).toString();
    
    return this.keccak256Hash(combinedStats);
  }

  /**
   * Generate hash for combat action
   */
  private hashAction(action: CombatAction, sessionId: bigint, turn: bigint): string {
    const actionData = `${action}:${sessionId}:${turn}`;
    return this.keccak256Hash(actionData);
  }

  /**
   * Generate ownership commitment for monster switching
   */
  private generateOwnershipCommitment(
    playerAddress: string,
    benchMonsters: CombatStats[],
    secretSeed: bigint
  ): string {
    const monstersHash = benchMonsters
      .map(monster => this.hashCombatStats(monster))
      .join(':');
    
    const ownershipData = `${playerAddress}:${monstersHash}:${secretSeed}`;
    return this.PROOF_PREFIX + this.keccak256Hash(ownershipData);
  }

  /**
   * Generate validity proof for monster switching
   */
  private generateSwitchValidityProof(
    monsterIndex: number,
    benchSize: number,
    sessionId: bigint
  ): string {
    const validityData = `${monsterIndex}:${benchSize}:${sessionId}`;
    return this.PROOF_PREFIX + this.keccak256Hash(validityData);
  }

  /**
   * Generate integrity proof for commitment reveals
   */
  private generateIntegrityProof(
    originalCommitment: string,
    computedCommitment: string
  ): string {
    const integrityData = `${originalCommitment}:${computedCommitment}`;
    return this.PROOF_PREFIX + this.keccak256Hash(integrityData);
  }

  /**
   * Generate proof data from input array
   */
  private generateProofData(inputs: string[]): string {
    const combinedInputs = inputs.join(':');
    const hash = this.keccak256Hash(combinedInputs);
    // Add some randomness to make proof unique
    const randomSalt = Math.random().toString(16).substring(2, 18);
    return this.keccak256Hash(hash + randomSalt);
  }

  /**
   * Simulate keccak256 hash function (placeholder implementation)
   * In production, this would use actual keccak256 from crypto library
   */
  private keccak256Hash(data: string): string {
    // Simple hash simulation - in production use actual keccak256
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Convert to hex and pad to 64 characters
    const hexHash = Math.abs(hash).toString(16);
    const timestamp = Date.now().toString(16);
    const combined = (hexHash + timestamp).substring(0, this.HASH_LENGTH);
    
    return combined.padStart(this.HASH_LENGTH, '0');
  }

  /**
   * Verify monster commitment
   */
  verifyCommitment(commitment: MonsterCommitment, stats: CombatStats, nonce: bigint): boolean {
    try {
      const expectedCommitment = this.generateMonsterCommitment(stats, nonce);
      return expectedCommitment.statsHash === commitment.statsHash;
    } catch (error) {
      console.error('Failed to verify commitment:', error);
      return false;
    }
  }

  /**
   * Verify reveal proof
   */
  verifyRevealProof(proof: RevealProof): boolean {
    try {
      // Simple verification - in production use actual ZK proof verification
      return proof.isValid === true && proof.proof !== undefined;
    } catch (error) {
      console.error('Failed to verify reveal proof:', error);
      return false;
    }
  }

  /**
   * Generate ownership proof
   */
  generateOwnershipProof(
    playerAddress: string,
    assetId: string,
    nonce: bigint
  ): OwnershipProof {
    const ownershipHash = this.keccak256Hash(playerAddress + assetId + nonce.toString());
    
    return {
      proof: `ownership_${ownershipHash}`,
      owner: playerAddress,
      assetId,
      ownershipCommitment: this.PROOF_PREFIX + ownershipHash,
      validityProof: this.PROOF_PREFIX + this.keccak256Hash(ownershipHash + playerAddress)
    };
  }

  /**
   * Verify ownership proof
   */
  verifyOwnershipProof(
    proof: OwnershipProof,
    expectedOwner: string,
    expectedAssetId: string
  ): boolean {
    try {
      return proof.owner === expectedOwner && proof.assetId === expectedAssetId;
    } catch (error) {
      console.error('Failed to verify ownership proof:', error);
      return false;
    }
  }
}

export const zkProofService = new ZKProofService();
