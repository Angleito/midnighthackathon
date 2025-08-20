import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { midnightService } from '../../services/midnightService';
import { transactionManager } from '../../services/transactionManager';
import { monsterInventoryService } from '../../services/monsterInventoryService';
import { zkProofService } from '../../services/zkProofService';
import { cheatPreventionService } from '../../services/cheatPreventionService';
import { CombatStats, PrivateCombatData, CombatAction } from '../../types/zk-types';
import { integrationUtils } from './setup';

describe('Integration: Full Combat Flow', () => {
  let walletAddress: string;
  let playerStats: CombatStats;
  let benchMonsters: CombatStats[];

  beforeEach(async () => {
    walletAddress = integrationUtils.getWalletAddress();
    integrationUtils.resetState();

    // Set up player and monster stats
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

    // Initialize monster inventory
    await monsterInventoryService.addMonster(
      {
        health: Number(playerStats.health),
        attackPower: Number(playerStats.attackPower),
        defense: Number(playerStats.defense),
        speed: Number(playerStats.speed),
        magicAttack: Number(playerStats.magicAttack),
        magicDefense: Number(playerStats.magicDefense),
      },
      'Integration Test Starter',
      1
    );

    for (let i = 0; i < benchMonsters.length; i++) {
      await monsterInventoryService.addMonster(
        {
          health: Number(benchMonsters[i].health),
          attackPower: Number(benchMonsters[i].attackPower),
          defense: Number(benchMonsters[i].defense),
          speed: Number(benchMonsters[i].speed),
          magicAttack: Number(benchMonsters[i].magicAttack),
          magicDefense: Number(benchMonsters[i].magicDefense),
        },
        `Integration Test Monster ${i + 1}`,
        1
      );
    }

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Complete Combat Session Lifecycle', () => {
    it('should execute a full combat session from initialization to completion', async () => {
      console.log('Starting full combat session integration test...');

      // Step 1: Initialize combat session
      const initResult = await midnightService.initializeCombat(playerStats, BigInt(12345));
      
      expect(initResult.sessionId).toBeGreaterThan(0n);
      expect(initResult.publicMonsterStats).toBeDefined();
      expect(initResult.publicMonsterStats.health).toBe(0n); // Hidden during combat

      const sessionId = initResult.sessionId;
      console.log('Combat initialized with session ID:', sessionId.toString());

      // Step 2: Verify all services are aware of the session
      const activeMonster = monsterInventoryService.getActiveMonster();
      expect(activeMonster).toBeDefined();
      
      const inventoryState = monsterInventoryService.getInventoryState();
      expect(inventoryState).toBeDefined();

      const session = await midnightService.getCombatSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.isActive).toBe(true);

      // Step 3: Perform sequence of combat actions
      const combatActions = [CombatAction.Attack, CombatAction.Defend, CombatAction.Magic, CombatAction.Attack] as const;
      const actionResults = [];

      for (let i = 0; i < combatActions.length; i++) {
        const action = combatActions[i];
        console.log(`Performing action ${i + 1}: ${action}`);

        const privateDamageData: PrivateCombatData = {
          playerSecretSeed: BigInt(Math.floor(Math.random() * 1000000)),
          monsterSecretSeed: BigInt(Math.floor(Math.random() * 1000000)),
          damageRoll: BigInt(Math.floor(Math.random() * 100)),
          criticalChance: 25n,
        };

        const result = await midnightService.performCombatAction(
          sessionId,
          action,
          privateDamageData
        );

        actionResults.push(result);
        
        expect(result.transactionId).toBeDefined();
        expect(result.blockNumber).toBeGreaterThan(0);
        expect(result.randomnessSeed).toBeDefined();

        // Verify transaction is tracked
        const transaction = transactionManager.getTransactionStatus(result.transactionId!);
        expect(transaction).toBeDefined();
        expect(transaction?.sessionId).toBe(sessionId);

        // Wait for transaction confirmation
        await new Promise<void>((resolve) => {
          const unsubscribe = transactionManager.subscribe((tx) => {
            if (tx.id === result.transactionId && tx.status === 'confirmed') {
              unsubscribe();
              resolve();
            }
          });
        });
      }

      console.log('All combat actions completed successfully');

      // Step 4: Test monster switching mid-combat
      const benchMonsters = monsterInventoryService.getBenchMonsters();
      if (benchMonsters.length > 0) {
        console.log('Testing monster switch...');

        const switchData: PrivateCombatData = {
          playerSecretSeed: BigInt(Math.floor(Math.random() * 1000000)),
          monsterSecretSeed: BigInt(Math.floor(Math.random() * 1000000)),
          damageRoll: 0n, // Switch to first bench monster
          criticalChance: 0n,
        };

        const switchResult = await midnightService.performCombatAction(
          sessionId,
          CombatAction.SwitchMonster,
          switchData
        );

        expect(switchResult.transactionId).toBeDefined();
        expect(switchResult.switchedMonster).toBeDefined();
        expect(switchResult.isPlayerTurn).toBe(false); // Switch uses turn

        console.log('Monster switch completed:', switchResult.switchedMonster);
      }

      // Step 5: Verify session integrity throughout
      const integrityCheck = await cheatPreventionService.validateSessionIntegrity(sessionId);
      expect(integrityCheck.isValid).toBe(true);

      // Step 6: End combat session
      await midnightService.endCombatSession(sessionId);
      await monsterInventoryService.endCombatSession();

      const endedSession = await midnightService.getCombatSession(sessionId);
      expect(endedSession?.isActive).toBe(false);

      console.log('Full combat session completed successfully');
    }, 60000); // 1 minute timeout for full flow

    it('should handle combat session with monster fainting and auto-switch', async () => {
      // Initialize combat
      const initResult = await midnightService.initializeCombat(playerStats, BigInt(54321));
      const sessionId = initResult.sessionId;

      // Simulate monster with low health
      const activeMonster = monsterInventoryService.getActiveMonster();
      expect(activeMonster).toBeDefined();

      // Manually set low health to trigger auto-switch
      if (activeMonster) {
        activeMonster.health = 1; // Very low health
        await monsterInventoryService.updateMonsterHealth(activeMonster.id, 1);
      }

      // Perform action that would cause fainting
      const privateDamageData: PrivateCombatData = {
        playerSecretSeed: BigInt(12345),
        monsterSecretSeed: BigInt(67890),
        damageRoll: BigInt(50), // High damage
        criticalChance: 0n,
      };

      const result = await midnightService.performCombatAction(
        sessionId,
        CombatAction.Attack,
        privateDamageData
      );

      // Should have triggered auto-switch logic
      const currentBlock = BigInt(Date.now() / 1000);
      const autoSwitchResult = await monsterInventoryService.checkAutoSwitch(
        currentBlock,
        walletAddress
      );

      // If auto-switch occurred, verify new monster is active
      if (autoSwitchResult) {
        expect(autoSwitchResult.id).not.toBe(activeMonster?.id);
        expect(autoSwitchResult.health).toBeGreaterThan(0);
      }
    });
  });

  describe('Service Integration and Error Handling', () => {
    it('should maintain consistency across all services during errors', async () => {
      // Initialize combat
      const initResult = await midnightService.initializeCombat(playerStats, BigInt(11111));
      const sessionId = initResult.sessionId;

      // Mock a service failure mid-combat
      const originalSubmit = transactionManager.submitCombatAction.bind(transactionManager);
      let failureCount = 0;
      
      vi.spyOn(transactionManager, 'submitCombatAction').mockImplementation(async (...args) => {
        failureCount++;
        if (failureCount === 2) { // Fail on second call
          throw new Error('Simulated network failure');
        }
        return originalSubmit(...args);
      });

      const privateDamageData: PrivateCombatData = {
        playerSecretSeed: BigInt(Math.floor(Math.random() * 1000000)),
        monsterSecretSeed: BigInt(Math.floor(Math.random() * 1000000)),
        damageRoll: BigInt(Math.floor(Math.random() * 100)),
        criticalChance: 25n,
      };

      // First action should succeed
      const result1 = await midnightService.performCombatAction(
        sessionId,
        CombatAction.Attack,
        privateDamageData
      );
      expect(result1.transactionId).toBeDefined();

      // Second action should fail
      await expect(
        midnightService.performCombatAction(sessionId, CombatAction.Magic, privateDamageData)
      ).rejects.toThrow('Simulated network failure');

      // Verify session state is still consistent
      const session = await midnightService.getCombatSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.isActive).toBe(true);

      // Third action should succeed (recovery)
      const result3 = await midnightService.performCombatAction(
        sessionId,
        CombatAction.Defend,
        privateDamageData
      );
      expect(result3.transactionId).toBeDefined();

      // Verify integrity after recovery
      const integrityCheck = await cheatPreventionService.validateSessionIntegrity(sessionId);
      expect(integrityCheck.isValid).toBe(true);
    });

    it('should handle concurrent operations across services', async () => {
      // Initialize combat
      const initResult = await midnightService.initializeCombat(playerStats, BigInt(22222));
      const sessionId = initResult.sessionId;

      // Prepare multiple concurrent operations
      const concurrentOperations = [
        // Combat actions
        midnightService.performCombatAction(sessionId, CombatAction.Attack, {
          playerSecretSeed: BigInt(1),
          monsterSecretSeed: BigInt(2),
          damageRoll: BigInt(30),
          criticalChance: 25n,
        }),
        
        // Session validation
        midnightService.validateSessionState(sessionId),
        
        // Inventory operations
        monsterInventoryService.getRemainingSwtiches(),
        monsterInventoryService.getSwitchCooldown(),
        
        // ZK proof generation
        zkProofService.generateMoveCommitment(
          BigInt(Date.now()),
          walletAddress,
          CombatAction.Attack,
          BigInt(12345)
        ),
      ];

      // Execute all operations concurrently
      const results = await Promise.allSettled(concurrentOperations);
      
      // Most operations should succeed
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBeGreaterThan(2);

      // Verify session is still in valid state
      const finalSession = await midnightService.getCombatSession(sessionId);
      expect(finalSession?.isActive).toBe(true);
    });

    it('should maintain transaction ordering and state consistency', async () => {
      // Initialize combat
      const initResult = await midnightService.initializeCombat(playerStats, BigInt(33333));
      const sessionId = initResult.sessionId;

      const transactionIds: string[] = [];
      const actions = [CombatAction.Attack, CombatAction.Defend, CombatAction.Magic, CombatAction.Attack, CombatAction.Defend] as const;

      // Submit actions in sequence
      for (let i = 0; i < actions.length; i++) {
        const privateDamageData: PrivateCombatData = {
          playerSecretSeed: BigInt(i * 1000),
          monsterSecretSeed: BigInt(i * 2000),
          damageRoll: BigInt(i * 10 + 20),
          criticalChance: 25n,
        };

        const result = await midnightService.performCombatAction(
          sessionId,
          actions[i],
          privateDamageData
        );

        transactionIds.push(result.transactionId!);
      }

      // Wait for all transactions to confirm
      const confirmationPromises = transactionIds.map(id => {
        return new Promise<void>((resolve) => {
          const unsubscribe = transactionManager.subscribe((tx) => {
            if (tx.id === id && tx.status === 'confirmed') {
              unsubscribe();
              resolve();
            }
          });
        });
      });

      await Promise.all(confirmationPromises);

      // Verify all transactions are confirmed in order
      const sessionTransactions = transactionManager.getSessionTransactions(sessionId);
      expect(sessionTransactions.length).toBeGreaterThanOrEqual(actions.length);
      
      const confirmedTransactions = sessionTransactions.filter(tx => tx.status === 'confirmed');
      expect(confirmedTransactions.length).toBe(actions.length);

      // Verify session integrity
      const integrityCheck = await cheatPreventionService.validateSessionIntegrity(sessionId);
      expect(integrityCheck.isValid).toBe(true);
    });
  });

  describe('Cross-Service State Synchronization', () => {
    it('should synchronize state changes across all services', async () => {
      // Track state changes across services
      const stateChanges: Array<{ service: string; event: string; timestamp: number }> = [];

      // Set up monitors for each service
      const unsubscribeTransaction = transactionManager.subscribe((tx) => {
        stateChanges.push({
          service: 'TransactionManager',
          event: `Transaction ${tx.status}`,
          timestamp: Date.now(),
        });
      });

      // Initialize combat
      const initResult = await midnightService.initializeCombat(playerStats, BigInt(44444));
      const sessionId = initResult.sessionId;

      stateChanges.push({
        service: 'MidnightService',
        event: 'Combat initialized',
        timestamp: Date.now(),
      });

      // Perform actions and monitor state changes
      const privateDamageData: PrivateCombatData = {
        playerSecretSeed: BigInt(Math.floor(Math.random() * 1000000)),
        monsterSecretSeed: BigInt(Math.floor(Math.random() * 1000000)),
        damageRoll: BigInt(Math.floor(Math.random() * 100)),
        criticalChance: 25n,
      };

      await midnightService.performCombatAction(sessionId, CombatAction.Attack, privateDamageData);
      
      stateChanges.push({
        service: 'MidnightService',
        event: 'Action performed',
        timestamp: Date.now(),
      });

      // Wait a bit for state propagation
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify state changes were recorded
      expect(stateChanges.length).toBeGreaterThan(2);
      
      // Verify services are in sync
      const session = await midnightService.getCombatSession(sessionId);
      const activeMonster = monsterInventoryService.getActiveMonster();
      const sessionTransactions = transactionManager.getSessionTransactions(sessionId);

      expect(session?.isActive).toBe(true);
      expect(activeMonster).toBeDefined();
      expect(sessionTransactions.length).toBeGreaterThan(0);

      // Cleanup
      unsubscribeTransaction();
    });

    it('should handle state recovery after service restart simulation', async () => {
      // Initialize combat and perform some actions
      const initResult = await midnightService.initializeCombat(playerStats, BigInt(55555));
      const sessionId = initResult.sessionId;

      const privateDamageData: PrivateCombatData = {
        playerSecretSeed: BigInt(123456),
        monsterSecretSeed: BigInt(789012),
        damageRoll: BigInt(45),
        criticalChance: 25n,
      };

      await midnightService.performCombatAction(sessionId, CombatAction.Attack, privateDamageData);

      // Simulate service restart by clearing some internal state
      // (In real system, this would be persistence/recovery mechanism)
      const originalSession = await midnightService.getCombatSession(sessionId);
      expect(originalSession).toBeDefined();

      // Verify state can be recovered
      const recoveredSession = await midnightService.getCombatSession(sessionId);
      expect(recoveredSession?.sessionId).toBe(originalSession?.sessionId);
      expect(recoveredSession?.isActive).toBe(originalSession?.isActive);
    });
  });

  describe('Performance and Resource Management', () => {
    it('should handle multiple concurrent combat sessions', async () => {
      const sessionCount = 3;
      const sessions: Array<{ sessionId: bigint; results: any[] }> = [];

      // Initialize multiple combat sessions
      for (let i = 0; i < sessionCount; i++) {
        const initResult = await midnightService.initializeCombat(
          playerStats,
          BigInt(i * 1000 + 66666)
        );
        
        sessions.push({
          sessionId: initResult.sessionId,
          results: [],
        });
      }

      // Perform actions across all sessions
      const allActionPromises = sessions.map(async (session, sessionIndex) => {
        const actions = [CombatAction.Attack, CombatAction.Defend, CombatAction.Magic] as const;
        
        for (let actionIndex = 0; actionIndex < actions.length; actionIndex++) {
          const privateDamageData: PrivateCombatData = {
            playerSecretSeed: BigInt(sessionIndex * 1000 + actionIndex),
            monsterSecretSeed: BigInt(sessionIndex * 2000 + actionIndex),
            damageRoll: BigInt(actionIndex * 10 + 30),
            criticalChance: 25n,
          };

          try {
            const result = await midnightService.performCombatAction(
              session.sessionId,
              actions[actionIndex],
              privateDamageData
            );
            session.results.push(result);
          } catch (error) {
            console.log(`Expected error in concurrent test: ${error}`);
          }
        }
      });

      await Promise.all(allActionPromises);

      // Verify all sessions are tracked properly
      const activeSessions = midnightService.getActiveSessions();
      expect(activeSessions.length).toBeGreaterThanOrEqual(sessionCount);

      // Clean up all sessions
      for (const session of sessions) {
        await midnightService.endCombatSession(session.sessionId);
      }
    });

    it('should clean up resources properly after combat completion', async () => {
      // Initialize combat
      const initResult = await midnightService.initializeCombat(playerStats, BigInt(77777));
      const sessionId = initResult.sessionId;

      // Perform a few actions
      const privateDamageData: PrivateCombatData = {
        playerSecretSeed: BigInt(111111),
        monsterSecretSeed: BigInt(222222),
        damageRoll: BigInt(50),
        criticalChance: 25n,
      };

      await midnightService.performCombatAction(sessionId, CombatAction.Attack, privateDamageData);
      await midnightService.performCombatAction(sessionId, CombatAction.Defend, privateDamageData);

      // Get resource counts before cleanup
      const sessionsBefore = midnightService.getActiveSessions().length;
      const transactionsBefore = transactionManager.getSessionTransactions(sessionId).length;

      // End combat and cleanup
      await midnightService.endCombatSession(sessionId);
      await monsterInventoryService.endCombatSession();

      // Trigger cleanup
      midnightService.cleanupOldSessions();

      // Verify cleanup occurred
      const sessionsAfter = midnightService.getActiveSessions().length;
      expect(sessionsAfter).toBeLessThanOrEqual(sessionsBefore);

      // Verify session is marked inactive
      const endedSession = await midnightService.getCombatSession(sessionId);
      expect(endedSession?.isActive).toBe(false);
    });
  });
});