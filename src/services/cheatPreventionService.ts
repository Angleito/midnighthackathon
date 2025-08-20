import { CombatAction, CombatStats, PrivateCombatData } from '../types/zk-types';
import { midnightService } from './midnightService';
import { transactionManager, type PendingTransaction } from './transactionManager';

export interface SecurityAudit {
  playerId: string;
  sessionId: bigint;
  suspiciousActivities: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  blockNumber: bigint;
  blockHash?: string;
  transactionHash?: string;
}

export interface ActionValidator {
  isValid: boolean;
  reason?: string;
  zkProofRequired: boolean;
  additionalValidation?: string[];
}

export interface TimestampProof {
  action: CombatAction;
  timestamp: number;
  blockNumber: bigint;
  blockHash: string;
  playerSignature: string;
  zkProof: string;
  turnNumber: bigint;
  sessionId: bigint;
  randomnessSeed: string;
}

export interface RateLimitCheck {
  playerId: string;
  actionsInWindow: number;
  windowStart: number;
  isLimited: boolean;
  lastActionBlock: bigint;
  consecutiveActions: number;
}

export interface BlockHashRandomness {
  blockNumber: bigint;
  blockHash: string;
  sessionId: bigint;
  turnNumber: bigint;
  combinedSeed: string;
  timestamp: number;
}

export interface TurnTimeoutConfig {
  sessionId: bigint;
  turnStartBlock: bigint;
  turnDeadline: bigint;
  playerId: string;
  isExpired: boolean;
}

export interface SessionIntegrityCheck {
  sessionId: bigint;
  expectedStateHash: string;
  actualStateHash: string;
  isValid: boolean;
  discrepancies: string[];
}

export class CheatPreventionService {
  private playerActions: Map<string, TimestampProof[]> = new Map();
  private suspiciousActivities: Map<string, SecurityAudit[]> = new Map();
  private rateLimits: Map<string, RateLimitCheck> = new Map();
  private blockHashRandomness: Map<string, BlockHashRandomness> = new Map();
  private turnTimeouts: Map<bigint, TurnTimeoutConfig> = new Map();
  private sessionIntegrity: Map<bigint, SessionIntegrityCheck> = new Map();
  private replayPrevention: Map<string, Set<string>> = new Map();
  
  private validStatRanges = {
    minHealth: 50n,
    maxHealth: 500n,
    minStat: 5n,
    maxStat: 100n,
    maxTotalStats: 400n
  };
  
  // Anti-cheat configuration
  private readonly TURN_TIMEOUT_SECONDS = 30;
  private readonly MAX_ACTIONS_PER_MINUTE = 8;
  private readonly MAX_CONSECUTIVE_ACTIONS = 3;
  private readonly MIN_BLOCK_DELAY = 1; // Must wait at least 1 block between actions
  private readonly BLOCK_HASH_CACHE_SIZE = 100;

  // Validate combat action before processing with enhanced block hash verification
  async validateCombatAction(
    playerId: string,
    sessionId: bigint,
    action: CombatAction,
    playerStats: CombatStats,
    privateDamageData: PrivateCombatData,
    timestamp: number,
    currentBlockNumber?: bigint,
    currentBlockHash?: string
  ): Promise<ActionValidator> {
    console.log('Validating combat action for cheat prevention...', { playerId, sessionId, action });

    try {
      // 1. Enhanced rate limiting check with block-based validation
      const rateLimitResult = await this.checkEnhancedRateLimit(playerId, currentBlockNumber);
      if (rateLimitResult.isLimited) {
        return {
          isValid: false,
          reason: 'Rate limit exceeded - too many actions in short period',
          zkProofRequired: false
        };
      }

      // 2. Turn timeout validation
      const turnTimeoutResult = await this.validateTurnTimeout(sessionId, currentBlockNumber);
      if (!turnTimeoutResult.isValid) {
        return turnTimeoutResult;
      }

      // 3. Block hash based randomness validation
      const randomnessValidation = await this.validateBlockHashRandomness(
        sessionId, action, currentBlockNumber, currentBlockHash
      );
      if (!randomnessValidation.isValid) {
        return randomnessValidation;
      }

      // 4. Replay attack prevention
      const replayValidation = this.validateReplayPrevention(playerId, sessionId, action, timestamp);
      if (!replayValidation.isValid) {
        return replayValidation;
      }

      // 5. Timestamp validation with block correlation
      if (!this.validateTimestampWithBlock(timestamp, currentBlockNumber)) {
        return {
          isValid: false,
          reason: 'Invalid timestamp - does not correlate with block data',
          zkProofRequired: false
        };
      }

      // 6. Stat validation
      const statValidation = this.validatePlayerStats(playerStats);
      if (!statValidation.isValid) {
        return statValidation;
      }

      // 7. Deterministic damage calculation validation
      const damageValidation = await this.validateDeterministicDamage(
        sessionId, action, privateDamageData, currentBlockHash
      );
      if (!damageValidation.isValid) {
        return damageValidation;
      }

      // 8. Session integrity validation
      const integrityValidation = await this.validateSessionIntegrity(sessionId);
      if (!integrityValidation.isValid) {
        return integrityValidation;
      }

      // 9. Sequence validation
      const sequenceValidation = await this.validateActionSequence(playerId, sessionId, action);
      if (!sequenceValidation.isValid) {
        return sequenceValidation;
      }

      // 10. Blockchain state validation
      const stateValidation = await this.validateBlockchainState(sessionId, timestamp);
      if (!stateValidation.isValid) {
        return stateValidation;
      }

      // All validations passed
      return {
        isValid: true,
        zkProofRequired: true,
        additionalValidation: ['block-hash-randomness', 'deterministic-damage', 'turn-sequence']
      };

    } catch (error) {
      console.error('Action validation failed:', error);
      return {
        isValid: false,
        reason: 'Validation process failed',
        zkProofRequired: false
      };
    }
  }

  // Validate player stats are within allowed ranges
  validatePlayerStats(stats: CombatStats): ActionValidator {
    const issues: string[] = [];

    if (stats.health < this.validStatRanges.minHealth || stats.health > this.validStatRanges.maxHealth) {
      issues.push(`Invalid health: ${stats.health}`);
    }

    const statsToCheck = [
      { name: 'attackPower', value: stats.attackPower },
      { name: 'defense', value: stats.defense },
      { name: 'speed', value: stats.speed },
      { name: 'magicAttack', value: stats.magicAttack },
      { name: 'magicDefense', value: stats.magicDefense }
    ];

    for (const stat of statsToCheck) {
      if (stat.value < this.validStatRanges.minStat || stat.value > this.validStatRanges.maxStat) {
        issues.push(`Invalid ${stat.name}: ${stat.value}`);
      }
    }

    // Check total stat points
    const totalStats = stats.attackPower + stats.defense + stats.speed + stats.magicAttack + stats.magicDefense;
    if (totalStats > this.validStatRanges.maxTotalStats) {
      issues.push(`Total stats too high: ${totalStats}`);
    }

    if (issues.length > 0) {
      return {
        isValid: false,
        reason: 'Invalid player stats: ' + issues.join(', '),
        zkProofRequired: false
      };
    }

    return { isValid: true, zkProofRequired: true };
  }

  // Enhanced rate limiting with block-based validation
  async checkEnhancedRateLimit(playerId: string, currentBlockNumber?: bigint): Promise<RateLimitCheck> {
    const now = Date.now();
    const windowSize = 60 * 1000; // 1 minute window
    const currentBlock = currentBlockNumber || BigInt(Math.floor(Date.now() / 1000));

    let rateLimitCheck = this.rateLimits.get(playerId);

    if (!rateLimitCheck || now - rateLimitCheck.windowStart > windowSize) {
      // Start new window
      rateLimitCheck = {
        playerId,
        actionsInWindow: 1,
        windowStart: now,
        isLimited: false,
        lastActionBlock: currentBlock,
        consecutiveActions: 1
      };
    } else {
      // Check block delay requirement
      if (currentBlock <= rateLimitCheck.lastActionBlock) {
        rateLimitCheck.isLimited = true;
        this.flagSuspiciousActivity(playerId, 0n, 'Block manipulation attempt - same block reuse', 'critical');
        this.rateLimits.set(playerId, rateLimitCheck);
        return rateLimitCheck;
      }

      // Check for rapid consecutive actions
      if (currentBlock - rateLimitCheck.lastActionBlock < this.MIN_BLOCK_DELAY) {
        rateLimitCheck.consecutiveActions++;
        if (rateLimitCheck.consecutiveActions > this.MAX_CONSECUTIVE_ACTIONS) {
          rateLimitCheck.isLimited = true;
          this.flagSuspiciousActivity(playerId, 0n, 'Rapid consecutive actions detected', 'high');
        }
      } else {
        rateLimitCheck.consecutiveActions = 1;
      }

      // Increment action count
      rateLimitCheck.actionsInWindow++;
      rateLimitCheck.lastActionBlock = currentBlock;
    }

    // Check rate limit
    if (rateLimitCheck.actionsInWindow > this.MAX_ACTIONS_PER_MINUTE) {
      rateLimitCheck.isLimited = true;
      this.flagSuspiciousActivity(playerId, 0n, 'Rate limit exceeded', 'medium');
    }

    this.rateLimits.set(playerId, rateLimitCheck);
    return rateLimitCheck;
  }

  // Enhanced timestamp validation with block correlation
  validateTimestampWithBlock(timestamp: number, blockNumber?: bigint): boolean {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes max age
    const maxFuture = 30 * 1000; // 30 seconds max future

    // Basic timestamp validation
    const basicValidation = timestamp > (now - maxAge) && timestamp < (now + maxFuture);
    if (!basicValidation) {
      return false;
    }

    // If block number is provided, validate correlation
    if (blockNumber) {
      const estimatedBlockTime = Number(blockNumber) * 1000; // Assuming 1 second blocks
      const blockTimeDiff = Math.abs(timestamp - estimatedBlockTime);
      
      // Allow 30 second variance between timestamp and estimated block time
      if (blockTimeDiff > 30000) {
        return false;
      }
    }

    return true;
  }

  // Validate timestamp to prevent replay attacks (legacy method)
  validateTimestamp(timestamp: number): boolean {
    return this.validateTimestampWithBlock(timestamp);
  }

  // Validate action sequence for logical consistency
  async validateActionSequence(
    playerId: string,
    sessionId: bigint,
    action: CombatAction
  ): Promise<ActionValidator> {
    const playerHistory = this.playerActions.get(playerId) || [];
    
    // Get recent actions from the same session
    const sessionActions = playerHistory
      .filter(a => Math.abs(a.timestamp - Date.now()) < 10 * 60 * 1000) // Last 10 minutes
      .sort((a, b) => b.timestamp - a.timestamp);

    // Check for duplicate actions in short time
    const recentDuplicates = sessionActions
      .filter(a => a.action === action && (Date.now() - a.timestamp) < 1000)
      .length;

    if (recentDuplicates > 0) {
      this.flagSuspiciousActivity(playerId, sessionId, 'Duplicate action detected', 'high');
      return {
        isValid: false,
        reason: 'Duplicate action detected within 1 second',
        zkProofRequired: false
      };
    }

    // Check for impossible action frequency
    if (sessionActions.length > 0) {
      const lastAction = sessionActions[0];
      const timeDiff = Date.now() - lastAction.timestamp;
      
      if (timeDiff < 500) { // Minimum 500ms between actions
        this.flagSuspiciousActivity(playerId, sessionId, 'Actions too frequent', 'high');
        return {
          isValid: false,
          reason: 'Actions submitted too frequently',
          zkProofRequired: false
        };
      }
    }

    return { isValid: true, zkProofRequired: true };
  }

  // Validate current blockchain state
  async validateBlockchainState(sessionId: bigint, _timestamp: number): Promise<ActionValidator> {
    try {
      // Check if session exists and is active
      const session = await midnightService.getCombatSession(sessionId);
      if (!session) {
        return {
          isValid: false,
          reason: 'Combat session not found or inactive',
          zkProofRequired: false
        };
      }

      if (!session.isActive) {
        return {
          isValid: false,
          reason: 'Combat session has ended',
          zkProofRequired: false
        };
      }

      // Validate player health
      if (session.playerHealth <= 0n) {
        return {
          isValid: false,
          reason: 'Player is defeated and cannot take actions',
          zkProofRequired: false
        };
      }

      return { isValid: true, zkProofRequired: true };
    } catch (error) {
      console.error('Blockchain state validation failed:', error);
      return {
        isValid: false,
        reason: 'Failed to validate blockchain state',
        zkProofRequired: false
      };
    }
  }

  // Record and validate ZK proof for action
  async recordValidatedAction(
    playerId: string,
    sessionId: bigint,
    action: CombatAction,
    zkProof: string,
    timestamp: number,
    blockNumber: bigint
  ): Promise<boolean> {
    try {
      // Verify the ZK proof
      const isValidProof = await this.verifyActionProof(playerId, sessionId, action, zkProof);
      if (!isValidProof) {
        this.flagSuspiciousActivity(playerId, sessionId, 'Invalid ZK proof', 'critical');
        return false;
      }

      // Create timestamp proof
      const timestampProof: TimestampProof = {
        action,
        timestamp,
        blockNumber,
        blockHash: await this.getBlockHash(blockNumber),
        playerSignature: await this.generatePlayerSignature(playerId, action, timestamp),
        zkProof,
        turnNumber: BigInt(0), // TODO: Get actual turn number from session
        sessionId,
        randomnessSeed: await this.getRandomnessSeed(blockNumber)
      };

      // Store action history
      const history = this.playerActions.get(playerId) || [];
      history.push(timestampProof);
      
      // Keep only last 100 actions
      if (history.length > 100) {
        history.splice(0, history.length - 100);
      }
      
      this.playerActions.set(playerId, history);

      console.log('Action recorded with proof validation:', { playerId, action, zkProof });
      return true;
    } catch (error) {
      console.error('Failed to record validated action:', error);
      this.flagSuspiciousActivity(playerId, sessionId, 'Action recording failed', 'high');
      return false;
    }
  }

  // Verify ZK proof for combat action
  async verifyActionProof(
    playerId: string,
    sessionId: bigint,
    action: CombatAction,
    zkProof: string
  ): Promise<boolean> {
    try {
      console.log('Verifying ZK proof for cheat prevention...', { playerId, sessionId, action });

      // Basic proof format validation
      if (!zkProof || !zkProof.startsWith('zk_')) {
        return false;
      }

      // Verify proof contains session and action information
      const proofData = {
        sessionId: sessionId.toString(),
        action: action.toString(),
        playerId
      };

      // In a real implementation, this would verify cryptographic ZK proof
      // For now, we simulate proof verification
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check if proof matches expected format and contains required data
      const isValid = zkProof.includes(sessionId.toString()) && 
                     zkProof.length > 20 && 
                     zkProof.includes('zk_');

      if (!isValid) {
        console.warn('ZK proof verification failed', { zkProof, proofData });
      }

      return isValid;
    } catch (error) {
      console.error('ZK proof verification error:', error);
      return false;
    }
  }

  // Flag suspicious activity for investigation
  flagSuspiciousActivity(
    playerId: string,
    sessionId: bigint,
    activity: string,
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
  ): void {
    console.warn(`🚨 Suspicious activity detected:`, { playerId, sessionId, activity, riskLevel });

    const audit: SecurityAudit = {
      playerId,
      sessionId,
      suspiciousActivities: [activity],
      riskLevel,
      timestamp: Date.now(),
      blockNumber: BigInt(Math.floor(Date.now() / 1000))
    };

    const existingAudits = this.suspiciousActivities.get(playerId) || [];
    existingAudits.push(audit);
    this.suspiciousActivities.set(playerId, existingAudits);

    // Auto-ban for critical violations
    if (riskLevel === 'critical') {
      this.temporaryBan(playerId, 'Critical security violation detected');
    }
  }

  // Temporary ban for severe violations
  private temporaryBan(playerId: string, reason: string): void {
    console.error(`🔒 Temporary ban issued for ${playerId}: ${reason}`);
    
    // In a real implementation, this would:
    // 1. Mark player as temporarily banned in database
    // 2. Prevent all actions for a specified duration
    // 3. Notify administrators for review
    
    // For now, we just log the ban
    const banDuration = 15 * 60 * 1000; // 15 minutes
    console.log(`Player ${playerId} banned for ${banDuration}ms`);
  }

  // Generate player signature for action verification
  private async generatePlayerSignature(
    playerId: string,
    action: CombatAction,
    timestamp: number
  ): Promise<string> {
    // Simulate signature generation
    const data = `${playerId}_${action}_${timestamp}`;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `sig_${Math.abs(hash).toString(16)}`;
  }

  // Get security audit for player
  getSecurityAudit(playerId: string): SecurityAudit[] {
    return this.suspiciousActivities.get(playerId) || [];
  }

  // Get player action history for investigation
  getPlayerActionHistory(playerId: string): TimestampProof[] {
    return this.playerActions.get(playerId) || [];
  }

  // Clean up old data to prevent memory leaks
  cleanupOldData(): void {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours

    // Clean up old actions
    for (const [playerId, actions] of this.playerActions.entries()) {
      const filteredActions = actions.filter(action => action.timestamp > cutoffTime);
      if (filteredActions.length === 0) {
        this.playerActions.delete(playerId);
      } else {
        this.playerActions.set(playerId, filteredActions);
      }
    }

    // Clean up old audits
    for (const [playerId, audits] of this.suspiciousActivities.entries()) {
      const filteredAudits = audits.filter(audit => audit.timestamp > cutoffTime);
      if (filteredAudits.length === 0) {
        this.suspiciousActivities.delete(playerId);
      } else {
        this.suspiciousActivities.set(playerId, filteredAudits);
      }
    }

    // Clean up old rate limits
    const rateLimitCutoff = Date.now() - (60 * 60 * 1000); // 1 hour
    for (const [playerId, rateLimit] of this.rateLimits.entries()) {
      if (rateLimit.windowStart < rateLimitCutoff) {
        this.rateLimits.delete(playerId);
      }
    }
  }

  // Get comprehensive security report
  getSecurityReport(): {
    totalPlayers: number;
    suspiciousActivities: number;
    criticalViolations: number;
    rateLimit: { active: number; violations: number };
  } {
    const suspiciousCount = Array.from(this.suspiciousActivities.values())
      .reduce((sum, audits) => sum + audits.length, 0);
    
    const criticalCount = Array.from(this.suspiciousActivities.values())
      .reduce((sum, audits) => 
        sum + audits.filter(audit => audit.riskLevel === 'critical').length, 0);
    
    const rateLimitActive = Array.from(this.rateLimits.values())
      .filter(limit => limit.isLimited).length;
    
    const rateLimitViolations = Array.from(this.rateLimits.values())
      .filter(limit => limit.actionsInWindow > 10).length;

    return {
      totalPlayers: this.playerActions.size,
      suspiciousActivities: suspiciousCount,
      criticalViolations: criticalCount,
      rateLimit: {
        active: rateLimitActive,
        violations: rateLimitViolations
      }
    };
  }

  // Block hash based randomness validation
  async validateBlockHashRandomness(
    sessionId: bigint,
    action: CombatAction,
    blockNumber?: bigint,
    blockHash?: string
  ): Promise<ActionValidator> {
    try {
      if (!blockNumber || !blockHash) {
        return {
          isValid: false,
          reason: 'Block number and hash required for randomness validation',
          zkProofRequired: false
        };
      }

      // Check if block hash is in expected format
      if (!/^0x[a-fA-F0-9]+$/.test(blockHash) && !/^[a-fA-F0-9]+$/.test(blockHash)) {
        return {
          isValid: false,
          reason: 'Invalid block hash format',
          zkProofRequired: false
        };
      }

      // Verify block hash hasn't been reused for this session
      const existingRandomness = Array.from(this.blockHashRandomness.values())
        .filter(r => r.sessionId === sessionId && r.blockHash === blockHash);
      
      if (existingRandomness.length > 0) {
        return {
          isValid: false,
          reason: 'Block hash reuse detected - potential randomness manipulation',
          zkProofRequired: false
        };
      }

      return { isValid: true, zkProofRequired: true };
    } catch (error) {
      console.error('Block hash randomness validation failed:', error);
      return {
        isValid: false,
        reason: 'Block hash validation error',
        zkProofRequired: false
      };
    }
  }

  // Turn timeout validation
  async validateTurnTimeout(sessionId: bigint, currentBlockNumber?: bigint): Promise<ActionValidator> {
    try {
      const currentBlock = currentBlockNumber || BigInt(Math.floor(Date.now() / 1000));
      const timeout = this.turnTimeouts.get(sessionId);

      if (!timeout) {
        // Initialize timeout for new session
        const newTimeout: TurnTimeoutConfig = {
          sessionId,
          turnStartBlock: currentBlock,
          turnDeadline: currentBlock + BigInt(this.TURN_TIMEOUT_SECONDS),
          playerId: '',
          isExpired: false
        };
        this.turnTimeouts.set(sessionId, newTimeout);
        return { isValid: true, zkProofRequired: true };
      }

      // Check if turn has expired
      if (currentBlock > timeout.turnDeadline) {
        timeout.isExpired = true;
        this.turnTimeouts.set(sessionId, timeout);
        return {
          isValid: false,
          reason: `Turn timeout exceeded - deadline was block ${timeout.turnDeadline}, current is ${currentBlock}`,
          zkProofRequired: false
        };
      }

      return { isValid: true, zkProofRequired: true };
    } catch (error) {
      console.error('Turn timeout validation failed:', error);
      return {
        isValid: false,
        reason: 'Turn timeout validation error',
        zkProofRequired: false
      };
    }
  }

  // Deterministic damage calculation validation
  async validateDeterministicDamage(
    sessionId: bigint,
    action: CombatAction,
    privateDamageData: PrivateCombatData,
    blockHash?: string
  ): Promise<ActionValidator> {
    try {
      if (!blockHash) {
        return {
          isValid: false,
          reason: 'Block hash required for deterministic damage validation',
          zkProofRequired: false
        };
      }

      // Validate damage data ranges
      if (privateDamageData.damageRoll < 0n || privateDamageData.damageRoll > 100n) {
        return {
          isValid: false,
          reason: 'Invalid damage roll - must be between 0 and 100',
          zkProofRequired: false
        };
      }

      if (privateDamageData.criticalChance < 0n || privateDamageData.criticalChance > 50n) {
        return {
          isValid: false,
          reason: 'Invalid critical chance - must be between 0 and 50',
          zkProofRequired: false
        };
      }

      // Validate secret seeds are non-zero
      if (privateDamageData.playerSecretSeed === 0n || privateDamageData.monsterSecretSeed === 0n) {
        return {
          isValid: false,
          reason: 'Secret seeds cannot be zero',
          zkProofRequired: false
        };
      }

      return { isValid: true, zkProofRequired: true };
    } catch (error) {
      console.error('Deterministic damage validation failed:', error);
      return {
        isValid: false,
        reason: 'Damage validation error',
        zkProofRequired: false
      };
    }
  }

  // Replay attack prevention
  validateReplayPrevention(
    playerId: string,
    sessionId: bigint,
    action: CombatAction,
    timestamp: number
  ): ActionValidator {
    try {
      const playerReplays = this.replayPrevention.get(playerId) || new Set();
      const actionKey = `${sessionId}_${timestamp}_${action}`;

      if (playerReplays.has(actionKey)) {
        this.flagSuspiciousActivity(playerId, sessionId, 'Replay attack detected', 'critical');
        return {
          isValid: false,
          reason: 'Action replay detected - identical action already submitted',
          zkProofRequired: false
        };
      }

      return { isValid: true, zkProofRequired: true };
    } catch (error) {
      console.error('Replay prevention validation failed:', error);
      return {
        isValid: false,
        reason: 'Replay validation error',
        zkProofRequired: false
      };
    }
  }

  // Session integrity validation
  async validateSessionIntegrity(sessionId: bigint): Promise<ActionValidator> {
    try {
      const session = await midnightService.getCombatSession(sessionId);
      if (!session) {
        return {
          isValid: false,
          reason: 'Session not found',
          zkProofRequired: false
        };
      }

      // Generate expected state hash
      const expectedStateHash = await this.generateSessionStateHash(session);
      
      const existingIntegrity = this.sessionIntegrity.get(sessionId);
      if (existingIntegrity) {
        // Compare with existing state
        if (existingIntegrity.expectedStateHash !== expectedStateHash) {
          existingIntegrity.isValid = false;
          existingIntegrity.discrepancies.push('State hash mismatch detected');
          this.sessionIntegrity.set(sessionId, existingIntegrity);
          
          return {
            isValid: false,
            reason: 'Session integrity violation - state hash mismatch',
            zkProofRequired: false
          };
        }
      } else {
        // Create new integrity check
        const integrityCheck: SessionIntegrityCheck = {
          sessionId,
          expectedStateHash,
          actualStateHash: expectedStateHash,
          isValid: true,
          discrepancies: []
        };
        this.sessionIntegrity.set(sessionId, integrityCheck);
      }

      return { isValid: true, zkProofRequired: true };
    } catch (error) {
      console.error('Session integrity validation failed:', error);
      return {
        isValid: false,
        reason: 'Session integrity validation error',
        zkProofRequired: false
      };
    }
  }

  // Generate verifiable randomness seed from block hash
  async generateVerifiableRandomnessSeed(
    sessionId: bigint,
    turnNumber: bigint,
    blockHash: string,
    timestamp: number
  ): Promise<string> {
    // Combine block hash with session data for verifiable randomness
    const components = [
      blockHash,
      sessionId.toString(),
      turnNumber.toString(),
      Math.floor(timestamp / 1000).toString()
    ];
    
    // Simple hash combination (in practice, use keccak256 or similar)
    let combined = components.join('_');
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return `randomness_${Math.abs(hash).toString(16)}_${sessionId}_${turnNumber}`;
  }

  // Generate session state hash for integrity checking
  async generateSessionStateHash(session: any): Promise<string> {
    const stateComponents = [
      session.sessionId.toString(),
      session.playerHealth.toString(),
      session.monsterHealth.toString(),
      session.turn.toString(),
      session.isActive.toString()
    ];
    
    const stateString = stateComponents.join('|');
    let hash = 0;
    for (let i = 0; i < stateString.length; i++) {
      const char = stateString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return `state_${Math.abs(hash).toString(16)}`;
  }

  // Update turn timeout for new turn
  updateTurnTimeout(sessionId: bigint, playerId: string, currentBlockNumber?: bigint): void {
    const currentBlock = currentBlockNumber || BigInt(Math.floor(Date.now() / 1000));
    const timeout: TurnTimeoutConfig = {
      sessionId,
      turnStartBlock: currentBlock,
      turnDeadline: currentBlock + BigInt(this.TURN_TIMEOUT_SECONDS),
      playerId,
      isExpired: false
    };
    this.turnTimeouts.set(sessionId, timeout);
  }

  // Get block hash randomness for session
  getBlockHashRandomness(sessionId: bigint, turnNumber: bigint): BlockHashRandomness | null {
    return this.blockHashRandomness.get(`${sessionId}_${turnNumber}`) || null;
  }

  // Get turn timeout status
  getTurnTimeoutStatus(sessionId: bigint): TurnTimeoutConfig | null {
    return this.turnTimeouts.get(sessionId) || null;
  }

  // Get session integrity status
  getSessionIntegrityStatus(sessionId: bigint): SessionIntegrityCheck | null {
    return this.sessionIntegrity.get(sessionId) || null;
  }

  // Integration with TransactionManager
  async validateWithTransactionManager(
    playerId: string,
    sessionId: bigint,
    action: CombatAction,
    transactionId?: string
  ): Promise<ActionValidator> {
    try {
      if (transactionId) {
        const transaction = transactionManager.getTransactionStatus(transactionId);
        if (!transaction) {
          return {
            isValid: false,
            reason: 'Transaction not found in manager',
            zkProofRequired: false
          };
        }

        if (transaction.status === 'failed' || transaction.status === 'timeout') {
          return {
            isValid: false,
            reason: `Transaction ${transaction.status}`,
            zkProofRequired: false
          };
        }

        if (transaction.sessionId !== sessionId) {
          return {
            isValid: false,
            reason: 'Transaction session mismatch',
            zkProofRequired: false
          };
        }
      }

      return { isValid: true, zkProofRequired: true };
    } catch (error) {
      console.error('Transaction manager validation failed:', error);
      return {
        isValid: false,
        reason: 'Transaction validation error',
        zkProofRequired: false
      };
    }
  }

  private async getBlockHash(blockNumber: bigint): Promise<string> {
    try {
      // Get block hash from midnight service
      const block = await midnightService.getBlock(blockNumber);
      return block?.hash || '0x0000000000000000000000000000000000000000000000000000000000000000';
    } catch (error) {
      console.warn('Failed to get block hash:', error);
      return '0x0000000000000000000000000000000000000000000000000000000000000000';
    }
  }

  private async getRandomnessSeed(blockNumber: bigint): Promise<string> {
    try {
      // Generate randomness seed based on block hash
      const blockHash = await this.getBlockHash(blockNumber);
      return blockHash.slice(0, 16); // Use first 16 chars as seed
    } catch (error) {
      console.warn('Failed to get randomness seed:', error);
      return '0000000000000000';
    }
  }
}

export const cheatPreventionService = new CheatPreventionService();

// Clean up old data every hour
setInterval(() => {
  cheatPreventionService.cleanupOldData();
}, 60 * 60 * 1000);