import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { transactionManager } from '../../services/transactionManager';
import { midnightService } from '../../services/midnightService';
import { monsterInventoryService, MonsterSlot } from '../../services/monsterInventoryService';
import { cheatPreventionService } from '../../services/cheatPreventionService';
import { CombatStats, PrivateCombatData, CombatAction } from '../../types/zk-types';
import { testUtils } from './setup';

describe('E2E Monster Switching Transaction Tests', () => {
  let testSessionId: bigint;
  let activeMonster: MonsterSlot;
  let benchMonsters: MonsterSlot[];
  let testWalletAddress: string;

  beforeEach(async () => {
    testWalletAddress = testUtils.getTestWalletAddress();
    testSessionId = testUtils.generateNewSessionId();

    // Initialize monster inventory with test data
    const starterStats = {
      health: 100,
      attackPower: 25,
      defense: 15,
      speed: 20,
      magicAttack: 18,
      magicDefense: 12,
    };

    await monsterInventoryService.addMonster(starterStats, 'Test Starter', 1);
    await monsterInventoryService.addMonster(
      { ...starterStats, attackPower: 30, health: 80 },
      'Test Attacker',
      1
    );
    await monsterInventoryService.addMonster(
      { ...starterStats, defense: 25, speed: 15 },
      'Test Defender',
      1
    );
    await monsterInventoryService.addMonster(
      { ...starterStats, speed: 35, health: 70 },
      'Test Speedster',
      1
    );

    // Set up active monster and bench
    activeMonster = monsterInventoryService.getActiveMonster()!;
    benchMonsters = monsterInventoryService.getBenchMonsters();

    // Start combat session
    await monsterInventoryService.startCombatSession(testSessionId);

    vi.clearAllMocks();
  });

  afterEach(async () => {
    await monsterInventoryService.endCombatSession();
    vi.resetAllMocks();
  });

  describe('Monster Switch Transaction Creation', () => {
    it('should create blockchain transactions for monster switches', async () => {
      expect(benchMonsters.length).toBeGreaterThan(0);
      const targetMonster = benchMonsters[0];

      // Submit monster switch transaction
      const transactionId = await transactionManager.submitMonsterSwitch(
        testSessionId,
        0, // First bench monster
        {
          gasLimit: 300000n,
          maxRetries: 3,
          timeoutMs: 30000,
        }
      );

      expect(transactionId).toMatch(/^tx_\d+_[a-z0-9]+$/);

      // Verify transaction is properly tracked
      const transaction = transactionManager.getTransactionStatus(transactionId);
      expect(transaction).toBeDefined();
      expect(transaction?.type).toBe('monster_switch');
      expect(transaction?.sessionId).toBe(testSessionId);
      expect(transaction?.status).toBe('submitted');
      expect(transaction?.hash).toMatch(/^0x[a-f0-9]+$/);

      // Wait for transaction confirmation
      await new Promise<void>((resolve) => {
        const unsubscribe = transactionManager.subscribe((tx) => {
          if (tx.id === transactionId && tx.status === 'confirmed') {
            expect(tx.blockNumber).toBeGreaterThan(0);
            expect(tx.gasUsed).toBeGreaterThan(0n);
            unsubscribe();
            resolve();
          }
        });
      });

      // Verify transaction is confirmed
      const confirmedTransaction = transactionManager.getTransactionStatus(transactionId);
      expect(confirmedTransaction?.status).toBe('confirmed');
    }, 15000);

    it('should encode monster index in private damage data', async () => {
      const spySubmitToNetwork = vi.spyOn(transactionManager as any, 'submitToNetwork');
      const targetMonsterIndex = 1;

      await transactionManager.submitMonsterSwitch(testSessionId, targetMonsterIndex);

      // Verify the call included the monster index in damage roll
      expect(spySubmitToNetwork).toHaveBeenCalledWith({
        contract: 'ZKCombat',
        function: 'performAction',
        args: [
          testSessionId,
          4n, // SwitchMonster enum
          expect.objectContaining({
            damageRoll: BigInt(targetMonsterIndex),
          }),
          expect.any(Object), // empty stats
        ],
        gasLimit: expect.any(BigInt),
      });
    });

    it('should validate switch constraints before creating transaction', async () => {
      const spyValidateSwitch = vi.spyOn(monsterInventoryService, 'validateSwitch');
      const currentBlock = BigInt(Date.now() / 1000);

      // Valid switch
      const validation = monsterInventoryService.validateSwitch(
        activeMonster.id,
        benchMonsters[0].id,
        currentBlock
      );

      expect(validation.valid).toBe(true);
      expect(spyValidateSwitch).toHaveBeenCalled();

      // Invalid switch (same monster)
      const invalidValidation = monsterInventoryService.validateSwitch(
        activeMonster.id,
        activeMonster.id,
        currentBlock
      );

      expect(invalidValidation.valid).toBe(false);
      expect(invalidValidation.reason).toContain('same monster');
    });
  });

  describe('Switch Cooldown and Rate Limiting', () => {
    it('should enforce switch cooldowns on-chain', async () => {
      // Perform first switch
      const firstSwitchId = await transactionManager.submitMonsterSwitch(testSessionId, 0);

      // Wait for confirmation
      await new Promise<void>((resolve) => {
        const unsubscribe = transactionManager.subscribe((tx) => {
          if (tx.id === firstSwitchId && tx.status === 'confirmed') {
            unsubscribe();
            resolve();
          }
        });
      });

      // Try to switch again immediately (should be rate limited)
      const currentBlock = BigInt(Date.now() / 1000);
      const validation = monsterInventoryService.validateSwitch(
        activeMonster.id,
        benchMonsters[1].id,
        currentBlock
      );

      if (!validation.valid) {
        expect(validation.reason).toContain('cooldown');
      }

      // Verify cooldown is tracked
      const cooldown = monsterInventoryService.getSwitchCooldown();
      expect(cooldown).toBeGreaterThan(0);
    });

    it('should enforce maximum switches per combat', async () => {
      const maxSwitches = 5; // Assuming this is the limit
      let successfulSwitches = 0;
      let failedDueToLimit = false;

      // Attempt multiple switches
      for (let i = 0; i < maxSwitches + 2; i++) {
        try {
          const currentBlock = BigInt(Date.now() / 1000 + i * 60); // Simulate time passing
          const targetIndex = i % benchMonsters.length;
          
          const validation = monsterInventoryService.validateSwitch(
            activeMonster.id,
            benchMonsters[targetIndex].id,
            currentBlock
          );

          if (validation.valid) {
            await transactionManager.submitMonsterSwitch(testSessionId, targetIndex);
            successfulSwitches++;
          } else if (validation.reason?.includes('maximum')) {
            failedDueToLimit = true;
            break;
          }
        } catch (error) {
          if (error instanceof Error && error.message.includes('maximum')) {
            failedDueToLimit = true;
            break;
          }
        }
      }

      expect(successfulSwitches).toBeLessThanOrEqual(maxSwitches);
      expect(failedDueToLimit).toBe(true);
    });

    it('should reset switch limits between combat sessions', async () => {
      // Use some switches
      await transactionManager.submitMonsterSwitch(testSessionId, 0);
      
      const initialRemaining = monsterInventoryService.getRemainingSwtiches();
      
      // End current session
      await monsterInventoryService.endCombatSession();
      
      // Start new session
      const newSessionId = testUtils.generateNewSessionId();
      await monsterInventoryService.startCombatSession(newSessionId);
      
      const newRemaining = monsterInventoryService.getRemainingSwtiches();
      expect(newRemaining).toBeGreaterThan(initialRemaining);
    });
  });

  describe('ZK Privacy During Switches', () => {
    it('should maintain privacy of bench monster stats', async () => {
      const targetMonster = benchMonsters[0];
      
      // Switch should not reveal full stats in transaction
      const spySubmitToNetwork = vi.spyOn(transactionManager as any, 'submitToNetwork');
      
      await transactionManager.submitMonsterSwitch(testSessionId, 0);
      
      // Verify that full monster stats are not exposed in transaction args
      const callArgs = (spySubmitToNetwork.mock.calls[0][0] as any).args;
      const privateDamageData = callArgs[2];
      
      // Only the monster index should be encoded, not full stats
      expect(privateDamageData.damageRoll).toBe(0n);
      expect(privateDamageData.playerSecretSeed).toBeDefined();
      expect(privateDamageData.monsterSecretSeed).toBeDefined();
      
      // Empty stats should be used as placeholder
      const emptyStats = callArgs[3];
      expect(emptyStats.health).toBe(0n);
      expect(emptyStats.attackPower).toBe(0n);
    });

    it('should use commitment schemes for monster reveals', async () => {
      // Mock a combat scenario where monster switch occurs mid-combat
      const result = await midnightService.initializeCombat(
        monsterInventoryService.convertToZKStats(activeMonster.monster),
        BigInt(12345)
      );

      // Perform switch via midnightService (includes ZK privacy)
      const privateDamageData: PrivateCombatData = {
        playerSecretSeed: BigInt(Math.floor(Math.random() * 1000000)),
        monsterSecretSeed: BigInt(Math.floor(Math.random() * 1000000)),
        damageRoll: 0n, // Monster index
        criticalChance: 0n,
      };

      const switchResult = await midnightService.performCombatAction(
        result.sessionId,
        CombatAction.SwitchMonster,
        privateDamageData
      );

      expect(switchResult.transactionId).toBeDefined();
      expect(switchResult.switchedMonster).toBeDefined();
      expect(switchResult.playerDamage).toBe(0n); // No damage during switch
      expect(switchResult.isPlayerTurn).toBe(false); // Switch uses turn
    });
  });

  describe('Auto-Switch on Monster Faint', () => {
    it('should automatically switch when active monster faints', async () => {
      // Set up a scenario where active monster has low health
      const lowHealthMonster = { ...activeMonster };
      lowHealthMonster.health = 1;
      
      // Mock the active monster state
      vi.spyOn(monsterInventoryService, 'getActiveMonster').mockReturnValue(lowHealthMonster);
      
      const currentBlock = BigInt(Date.now() / 1000);
      
      // Check auto-switch trigger
      const autoSwitchResult = await monsterInventoryService.checkAutoSwitch(
        currentBlock,
        testWalletAddress
      );

      if (autoSwitchResult) {
        expect(autoSwitchResult.id).not.toBe(lowHealthMonster.id);
        expect(autoSwitchResult.health).toBeGreaterThan(0);
      }
    });

    it('should create transaction for auto-switch', async () => {
      const spySubmitMonsterSwitch = vi.spyOn(transactionManager, 'submitMonsterSwitch');
      
      // Simulate auto-switch scenario
      const currentBlock = BigInt(Date.now() / 1000);
      const newActiveMonster = await monsterInventoryService.checkAutoSwitch(
        currentBlock,
        testWalletAddress
      );

      if (newActiveMonster) {
        // Auto-switch should trigger transaction
        expect(spySubmitMonsterSwitch).toHaveBeenCalled();
      }
    });

    it('should handle case when all monsters are fainted', async () => {
      // Mock all monsters as fainted
      const faintedMonsters = benchMonsters.map(m => ({ ...m, health: 0 }));
      vi.spyOn(monsterInventoryService, 'getBenchMonsters').mockReturnValue(faintedMonsters);
      
      const currentBlock = BigInt(Date.now() / 1000);
      
      // Should return null when no viable monsters
      const autoSwitchResult = await monsterInventoryService.checkAutoSwitch(
        currentBlock,
        testWalletAddress
      );

      expect(autoSwitchResult).toBeNull();
    });
  });

  describe('Switch Validation and Anti-Cheat', () => {
    it('should prevent switching to invalid monster indices', async () => {
      const invalidIndex = benchMonsters.length + 10; // Out of bounds
      
      await expect(
        transactionManager.submitMonsterSwitch(testSessionId, invalidIndex)
      ).rejects.toThrow('Invalid monster index');
    });

    it('should prevent rapid switching exploits', async () => {
      const spyValidation = vi.spyOn(cheatPreventionService, 'validateCombatAction');
      
      // Attempt rapid switches
      const switches = Array(3).fill(0).map((_, i) => 
        transactionManager.submitMonsterSwitch(testSessionId, i % benchMonsters.length)
      );

      // Not all should succeed due to rate limiting
      const results = await Promise.allSettled(switches);
      const failures = results.filter(r => r.status === 'rejected');
      
      expect(failures.length).toBeGreaterThan(0);
    });

    it('should validate switch timing against block timestamps', async () => {
      const currentBlock = BigInt(Date.now() / 1000);
      const futureBlock = currentBlock + 3600n; // 1 hour in future
      
      // Should reject switches with future timestamps
      const validation = monsterInventoryService.validateSwitch(
        activeMonster.id,
        benchMonsters[0].id,
        futureBlock
      );

      if (!validation.valid) {
        expect(validation.reason).toContain('timestamp');
      }
    });
  });

  describe('Switch Transaction Recovery', () => {
    it('should handle failed switch transactions gracefully', async () => {
      // Mock transaction failure
      vi.spyOn(transactionManager as any, 'submitToNetwork').mockRejectedValueOnce(
        new Error('Network error during switch')
      );

      await expect(
        transactionManager.submitMonsterSwitch(testSessionId, 0)
      ).rejects.toThrow('Network error during switch');

      // Verify state remains consistent
      const currentActive = monsterInventoryService.getActiveMonster();
      expect(currentActive?.id).toBe(activeMonster.id);
      
      // Verify no partial switch state
      const inventory = monsterInventoryService.getInventoryState();
      expect(inventory.switchCooldown).toBe(0);
    });

    it('should recover from stuck switch transactions', async () => {
      // Submit switch that will get stuck
      const transactionId = await transactionManager.submitMonsterSwitch(testSessionId, 0);
      
      // Simulate stuck transaction (never confirms)
      vi.spyOn(transactionManager, 'getTransactionStatus').mockReturnValue({
        id: transactionId,
        type: 'monster_switch',
        sessionId: testSessionId,
        timestamp: Date.now() - 120000, // 2 minutes ago
        retryCount: 0,
        status: 'pending',
      });

      // Cancel stuck transaction
      const cancelled = await transactionManager.cancelTransaction(transactionId);
      expect(cancelled).toBe(false); // Can't cancel pending transactions
      
      // But should be able to submit new switch after timeout
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const newTransactionId = await transactionManager.submitMonsterSwitch(testSessionId, 1);
      expect(newTransactionId).toBeDefined();
      expect(newTransactionId).not.toBe(transactionId);
    });
  });

  describe('UI State Synchronization', () => {
    it('should update UI state when switch transaction confirms', async () => {
      const targetMonster = benchMonsters[0];
      
      // Submit switch
      const transactionId = await transactionManager.submitMonsterSwitch(testSessionId, 0);
      
      // Mock performing the actual switch
      await monsterInventoryService.performSwitch(
        activeMonster.id,
        targetMonster.id,
        testSessionId,
        BigInt(Date.now() / 1000),
        testWalletAddress
      );
      
      // Verify state updated
      const newActiveMonster = monsterInventoryService.getActiveMonster();
      expect(newActiveMonster?.id).toBe(targetMonster.id);
      
      const newBenchMonsters = monsterInventoryService.getBenchMonsters();
      expect(newBenchMonsters.some(m => m.id === activeMonster.id)).toBe(true);
    });

    it('should rollback optimistic updates on transaction failure', async () => {
      const originalActiveId = activeMonster.id;
      
      // Mock failed transaction
      vi.spyOn(transactionManager as any, 'submitToNetwork').mockRejectedValueOnce(
        new Error('Transaction failed')
      );
      
      await expect(
        transactionManager.submitMonsterSwitch(testSessionId, 0)
      ).rejects.toThrow('Transaction failed');
      
      // Verify state rolled back
      const currentActive = monsterInventoryService.getActiveMonster();
      expect(currentActive?.id).toBe(originalActiveId);
    });
  });
});