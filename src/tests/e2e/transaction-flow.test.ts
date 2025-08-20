import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { transactionManager, PendingTransaction } from '../../services/transactionManager';
import { midnightService } from '../../services/midnightService';
import { zkProofService } from '../../services/zkProofService';
import { cheatPreventionService } from '../../services/cheatPreventionService';
import { monsterInventoryService } from '../../services/monsterInventoryService';
import { CombatStats, PrivateCombatData, CombatAction } from '../../types/zk-types';
import { testUtils } from './setup';

describe('E2E Transaction Flow Tests', () => {
  let testWalletAddress: string;
  let testSessionId: bigint;
  let playerStats: CombatStats;
  let benchMonsters: CombatStats[];
  let privateDamageData: PrivateCombatData;

  beforeEach(async () => {
    testWalletAddress = testUtils.getTestWalletAddress();
    testSessionId = testUtils.generateNewSessionId();
    
    // Initialize test data
    playerStats = {
      health: 100n,
      attackPower: 25n,
      defense: 15n,
      speed: 20n,
      magicAttack: 18n,
      magicDefense: 12n,
    };

    benchMonsters = [
      {
        health: 80n,
        attackPower: 22n,
        defense: 18n,
        speed: 16n,
        magicAttack: 20n,
        magicDefense: 14n,
      },
      {
        health: 90n,
        attackPower: 30n,
        defense: 10n,
        speed: 25n,
        magicAttack: 15n,
        magicDefense: 8n,
      },
    ];

    privateDamageData = {
      playerSecretSeed: BigInt(Math.floor(Math.random() * 1000000)),
      monsterSecretSeed: BigInt(Math.floor(Math.random() * 1000000)),
      damageRoll: BigInt(Math.floor(Math.random() * 100)),
      criticalChance: 25n,
    };

    // Reset services
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Combat Initialization Transaction Flow', () => {
    it('should create a complete blockchain transaction for combat initialization', async () => {
      const enemyCommitment = BigInt('0x' + Math.random().toString(16).substring(2, 16));
      const commitmentNonce = BigInt(Math.floor(Math.random() * 1000000));

      // Step 1: Submit combat initialization transaction
      const transactionId = await transactionManager.submitCombatInit(
        playerStats,
        benchMonsters,
        enemyCommitment,
        commitmentNonce,
        {
          gasLimit: 800000n,
          maxRetries: 3,
          timeoutMs: 60000,
        }
      );

      expect(transactionId).toMatch(/^tx_\d+_[a-z0-9]+$/);

      // Step 2: Verify transaction is tracked properly
      const transaction = transactionManager.getTransactionStatus(transactionId);
      expect(transaction).toBeDefined();
      expect(transaction?.type).toBe('combat_init');
      expect(transaction?.status).toBe('submitted');
      expect(transaction?.hash).toMatch(/^0x[a-f0-9]+$/);

      // Step 3: Wait for transaction confirmation
      await new Promise((resolve) => {
        const unsubscribe = transactionManager.subscribe((tx: PendingTransaction) => {
          if (tx.id === transactionId && tx.status === 'confirmed') {
            expect(tx.blockNumber).toBeGreaterThan(0);
            expect(tx.gasUsed).toBeGreaterThan(0n);
            unsubscribe();
            resolve(void 0);
          }
        });
      });

      // Step 4: Verify transaction is confirmed
      const confirmedTransaction = transactionManager.getTransactionStatus(transactionId);
      expect(confirmedTransaction?.status).toBe('confirmed');
      expect(confirmedTransaction?.blockNumber).toBeGreaterThan(0);
    }, 15000);

    it('should handle initialization failure and rollback properly', async () => {
      // Mock a failing transaction
      vi.spyOn(transactionManager as any, 'submitToNetwork').mockRejectedValueOnce(
        new Error('Network error: insufficient gas')
      );

      const enemyCommitment = BigInt('0x' + Math.random().toString(16).substring(2, 16));
      const commitmentNonce = BigInt(Math.floor(Math.random() * 1000000));

      await expect(
        transactionManager.submitCombatInit(
          playerStats,
          benchMonsters,
          enemyCommitment,
          commitmentNonce
        )
      ).rejects.toThrow('Network error: insufficient gas');

      // Verify no orphaned transactions
      const sessionTransactions = transactionManager.getSessionTransactions(testSessionId);
      expect(sessionTransactions.length).toBe(0);
    });

    it('should validate ZK proofs during initialization', async () => {
      const spyProofGeneration = vi.spyOn(zkProofService, 'generateMonsterCommitment');
      const spyProofVerification = vi.spyOn(zkProofService, 'verifyCommitment');

      // Initialize combat via midnightService
      const result = await midnightService.initializeCombat(playerStats, BigInt(12345));

      expect(spyProofGeneration).toHaveBeenCalled();
      expect(result.sessionId).toBeGreaterThan(0n);
      expect(result.publicMonsterStats).toBeDefined();

      // Verify commitment was generated
      const commitment = spyProofGeneration.mock.results[0]?.value;
      expect(commitment).toBeDefined();
      expect(commitment.statsHash).toMatch(/^0x[a-f0-9]+$/);
    });
  });

  describe('Combat Action Transaction Flow', () => {
    let sessionId: bigint;

    beforeEach(async () => {
      // Initialize a combat session first
      const result = await midnightService.initializeCombat(playerStats, BigInt(12345));
      sessionId = result.sessionId;
    });

    it('should create blockchain transactions for each combat action', async () => {
      const actions = [CombatAction.Attack, CombatAction.Magic, CombatAction.Defend] as const;
      const transactionIds: string[] = [];

      for (const action of actions) {
        // Submit action transaction
        const transactionId = await transactionManager.submitCombatAction(
          sessionId,
          action,
          privateDamageData,
          playerStats
        );

        transactionIds.push(transactionId);

        // Verify transaction is properly tracked
        const transaction = transactionManager.getTransactionStatus(transactionId);
        expect(transaction?.type).toBe('combat_action');
        expect(transaction?.action).toBe(action);
        expect(transaction?.sessionId).toBe(sessionId);
      }

      // Wait for all transactions to confirm
      const confirmationPromises = transactionIds.map((id) => {
        return new Promise<void>((resolve) => {
          const unsubscribe = transactionManager.subscribe((tx: PendingTransaction) => {
            if (tx.id === id && tx.status === 'confirmed') {
              unsubscribe();
              resolve();
            }
          });
        });
      });

      await Promise.all(confirmationPromises);

      // Verify all transactions are confirmed
      for (const id of transactionIds) {
        const transaction = transactionManager.getTransactionStatus(id);
        expect(transaction?.status).toBe('confirmed');
      }
    }, 30000);

    it('should generate and verify ZK proofs for each action', async () => {
      const spyProofGeneration = vi.spyOn(zkProofService, 'generateActionValidityProof');
      const spyProofVerification = vi.spyOn(zkProofService, 'verifyActionProof');

      // Perform combat action
      const result = await midnightService.performCombatAction(
        sessionId,
        CombatAction.Attack,
        privateDamageData
      );

      expect(spyProofGeneration).toHaveBeenCalledWith(
        sessionId,
        CombatAction.Attack,
        expect.any(Object), // playerStats
        expect.any(Object), // monsterCommitment
        privateDamageData,
        expect.any(BigInt) // turn
      );

      expect(spyProofVerification).toHaveBeenCalled();
      expect(result.transactionId).toBeDefined();
      expect(result.randomnessSeed).toBeDefined();
    });

    it('should enforce turn timeouts and block-based validation', async () => {
      const spyValidation = vi.spyOn(cheatPreventionService, 'validateCombatAction');

      // Perform action
      await midnightService.performCombatAction(sessionId, CombatAction.Attack, privateDamageData);

      expect(spyValidation).toHaveBeenCalledWith(
        testWalletAddress,
        sessionId,
        CombatAction.Attack,
        expect.any(Object), // playerStats
        privateDamageData,
        expect.any(Number), // timestamp
        expect.any(BigInt), // currentBlock
        expect.any(String) // currentBlockHash
      );

      // Verify validation passed
      expect(spyValidation.mock.results[0]?.value).resolves.toMatchObject({
        isValid: true,
      });
    });

    it('should handle transaction failures and maintain state consistency', async () => {
      // Mock a transaction failure
      const originalSubmit = (transactionManager as any).submitToNetwork;
      let callCount = 0;
      vi.spyOn(transactionManager as any, 'submitToNetwork').mockImplementation((...args) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Network congestion - transaction failed');
        }
        return originalSubmit.apply(transactionManager, args);
      });

      // First attempt should fail
      await expect(
        transactionManager.submitCombatAction(
          sessionId,
          CombatAction.Attack,
          privateDamageData,
          playerStats
        )
      ).rejects.toThrow('Network congestion - transaction failed');

      // Second attempt should succeed
      const transactionId = await transactionManager.submitCombatAction(
        sessionId,
        CombatAction.Attack,
        privateDamageData,
        playerStats
      );

      expect(transactionId).toBeDefined();
      
      // Verify transaction is properly tracked
      const transaction = transactionManager.getTransactionStatus(transactionId);
      expect(transaction?.status).toBe('submitted');
    });
  });

  describe('Transaction Queue Management', () => {
    let sessionId: bigint;

    beforeEach(async () => {
      const result = await midnightService.initializeCombat(playerStats, BigInt(12345));
      sessionId = result.sessionId;
    });

    it('should handle multiple concurrent transactions properly', async () => {
      const concurrentActions = Array(5).fill(0).map((_, i) => ({
        action: [CombatAction.Attack, CombatAction.Magic, CombatAction.Defend, CombatAction.Attack, CombatAction.Magic][i] as any,
        data: {
          ...privateDamageData,
          playerSecretSeed: BigInt(i * 12345),
        },
      }));

      // Submit all transactions concurrently
      const transactionPromises = concurrentActions.map(({ action, data }) =>
        transactionManager.submitCombatAction(sessionId, action, data, playerStats)
      );

      const transactionIds = await Promise.all(transactionPromises);

      // Verify all transactions are tracked
      expect(transactionIds).toHaveLength(5);
      transactionIds.forEach((id) => {
        const transaction = transactionManager.getTransactionStatus(id);
        expect(transaction).toBeDefined();
        expect(transaction?.sessionId).toBe(sessionId);
      });

      // Verify session transactions
      const sessionTransactions = transactionManager.getSessionTransactions(sessionId);
      expect(sessionTransactions.length).toBeGreaterThanOrEqual(5);
    });

    it('should prevent transaction conflicts and maintain order', async () => {
      const spyRecordAction = vi.spyOn(cheatPreventionService, 'recordValidatedAction');

      // Submit sequential actions
      const action1Id = await transactionManager.submitCombatAction(
        sessionId,
        CombatAction.Attack,
        privateDamageData,
        playerStats
      );

      const action2Id = await transactionManager.submitCombatAction(
        sessionId,
        CombatAction.Defend,
        privateDamageData,
        playerStats
      );

      // Wait for confirmations
      await Promise.all([
        new Promise<void>((resolve) => {
          const unsubscribe = transactionManager.subscribe((tx) => {
            if (tx.id === action1Id && tx.status === 'confirmed') {
              unsubscribe();
              resolve();
            }
          });
        }),
        new Promise<void>((resolve) => {
          const unsubscribe = transactionManager.subscribe((tx) => {
            if (tx.id === action2Id && tx.status === 'confirmed') {
              unsubscribe();
              resolve();
            }
          });
        }),
      ]);

      // Verify actions were recorded in order
      expect(spyRecordAction).toHaveBeenCalledTimes(2);
    });
  });

  describe('State Synchronization', () => {
    it('should synchronize local state with blockchain state', async () => {
      const sessionId = testUtils.generateNewSessionId();
      
      // Initialize combat
      const result = await midnightService.initializeCombat(playerStats, BigInt(54321));
      
      // Get initial session state
      const initialSession = await midnightService.getCombatSession(result.sessionId);
      expect(initialSession).toBeDefined();
      expect(initialSession?.isActive).toBe(true);

      // Perform action
      const actionResult = await midnightService.performCombatAction(
        result.sessionId,
        CombatAction.Attack,
        privateDamageData
      );

      expect(actionResult.transactionId).toBeDefined();
      expect(actionResult.blockNumber).toBeGreaterThan(0);

      // Verify state is updated
      const updatedSession = await midnightService.getCombatSession(result.sessionId);
      expect(updatedSession?.turn).toBeGreaterThan(initialSession?.turn || 0n);
    });

    it('should handle state recovery after network errors', async () => {
      const result = await midnightService.initializeCombat(playerStats, BigInt(54321));
      
      // Simulate network error
      const originalValidateState = midnightService.validateSessionState.bind(midnightService);
      vi.spyOn(midnightService, 'validateSessionState').mockRejectedValueOnce(
        new Error('Network timeout')
      );

      // Should handle error gracefully
      const isValid = await midnightService.validateSessionState(result.sessionId);
      expect(isValid).toBe(false);

      // Restore function and verify recovery
      midnightService.validateSessionState = originalValidateState;
      const recoveredValid = await midnightService.validateSessionState(result.sessionId);
      expect(recoveredValid).toBe(true);
    });
  });

  describe('Gas Optimization and Fee Management', () => {
    it('should optimize gas usage for different transaction types', async () => {
      const sessionId = testUtils.generateNewSessionId();
      const gasLimits: Record<string, bigint> = {};

      // Test different transaction types with gas tracking
      const initId = await transactionManager.submitCombatInit(
        playerStats,
        benchMonsters,
        BigInt('0x12345'),
        BigInt(67890),
        { gasLimit: 800000n }
      );

      const actionId = await transactionManager.submitCombatAction(
        sessionId,
        CombatAction.Attack,
        privateDamageData,
        playerStats,
        { gasLimit: 500000n }
      );

      const switchId = await transactionManager.submitMonsterSwitch(
        sessionId,
        1,
        { gasLimit: 300000n }
      );

      // Wait for confirmations and track gas usage
      const transactions = [initId, actionId, switchId];
      for (const id of transactions) {
        await new Promise<void>((resolve) => {
          const unsubscribe = transactionManager.subscribe((tx) => {
            if (tx.id === id && tx.status === 'confirmed') {
              gasLimits[tx.type] = tx.gasUsed || 0n;
              unsubscribe();
              resolve();
            }
          });
        });
      }

      // Verify gas usage is reasonable
      expect(gasLimits.combat_init).toBeGreaterThan(0n);
      expect(gasLimits.combat_action).toBeGreaterThan(0n);
      expect(gasLimits.monster_switch).toBeGreaterThan(0n);

      // Switch should use less gas than initialization
      expect(gasLimits.monster_switch).toBeLessThan(gasLimits.combat_init);
    }, 20000);
  });
});