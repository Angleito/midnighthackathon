/**
 * Integration Test for Monster Inventory Management System
 * 
 * This test file demonstrates the complete integration between the monster
 * inventory service, combat integration service, and ZK privacy features.
 */

import { monsterInventoryService } from '../services/monsterInventoryService';
import { combatIntegrationService } from '../services/combatIntegrationService';
import { CombatAction } from '../types/zk-types';
import { PlayerStats } from '../types/combat.d';

// Test data
const TEST_MONSTERS = {
  serpent: {
    stats: { health: 100, attackPower: 20, defense: 15, speed: 18, magicAttack: 16, magicDefense: 12 },
    name: 'Test Serpent'
  },
  kraken: {
    stats: { health: 120, attackPower: 25, defense: 20, speed: 15, magicAttack: 22, magicDefense: 18 },
    name: 'Test Kraken'
  },
  guardian: {
    stats: { health: 110, attackPower: 18, defense: 25, speed: 20, magicAttack: 15, magicDefense: 20 },
    name: 'Test Guardian'
  }
};

const TEST_PLAYER_ADDRESS = 'test_player_0x123456789abcdef';

describe('Monster Inventory Integration Tests', () => {
  beforeEach(() => {
    // Reset inventory state before each test
    const allMonsters = monsterInventoryService.getAllMonsters();
    allMonsters.forEach(monster => {
      if (monster.id !== 'starter_001') {
        try {
          monsterInventoryService.removeMonster(monster.id);
        } catch (error) {
          // Ignore errors when removing monsters
        }
      }
    });
  });

  test('should manage monster roster correctly', async () => {
    // Initial state should have starter monster
    const initialInventory = monsterInventoryService.getInventoryState();
    expect(initialInventory.activeMonster).toBeDefined();
    expect(initialInventory.benchMonsters).toHaveLength(0);

    // Add monsters to roster
    const krakenId = await monsterInventoryService.addMonster(
      TEST_MONSTERS.kraken.stats,
      TEST_MONSTERS.kraken.name,
      2
    );

    const guardianId = await monsterInventoryService.addMonster(
      TEST_MONSTERS.guardian.stats,
      TEST_MONSTERS.guardian.name,
      1
    );

    // Check roster state
    const updatedInventory = monsterInventoryService.getInventoryState();
    expect(updatedInventory.benchMonsters).toHaveLength(2);

    const allMonsters = monsterInventoryService.getAllMonsters();
    expect(allMonsters).toHaveLength(3);
    expect(allMonsters.filter(m => m.isActive)).toHaveLength(1);

    // Verify monster data
    const addedMonsters = monsterInventoryService.getBenchMonsters();
    expect(addedMonsters.some(m => m.name === TEST_MONSTERS.kraken.name)).toBe(true);
    expect(addedMonsters.some(m => m.name === TEST_MONSTERS.guardian.name)).toBe(true);
  });

  test('should validate switch constraints correctly', async () => {
    // Add test monsters
    const krakenId = await monsterInventoryService.addMonster(
      TEST_MONSTERS.kraken.stats,
      TEST_MONSTERS.kraken.name,
      2
    );

    const activeMonster = monsterInventoryService.getActiveMonster();
    expect(activeMonster).toBeDefined();

    const currentBlock = combatIntegrationService.getCurrentBlock();

    // Should fail outside combat
    const validationOutsideCombat = monsterInventoryService.validateSwitch(
      activeMonster!.id,
      krakenId,
      currentBlock
    );
    expect(validationOutsideCombat.valid).toBe(false);
    expect(validationOutsideCombat.reason).toContain('Not in combat');

    // Should fail switching to same monster
    const validationSameMonster = monsterInventoryService.validateSwitch(
      activeMonster!.id,
      activeMonster!.id,
      currentBlock
    );
    expect(validationSameMonster.valid).toBe(false);

    // Should fail switching to non-existent monster
    const validationNonExistent = monsterInventoryService.validateSwitch(
      activeMonster!.id,
      'non_existent_id',
      currentBlock
    );
    expect(validationNonExistent.valid).toBe(false);
  });

  test('should handle combat session lifecycle correctly', async () => {
    // Add test monsters
    await monsterInventoryService.addMonster(
      TEST_MONSTERS.kraken.stats,
      TEST_MONSTERS.kraken.name,
      2
    );

    // Initialize combat
    const session = await combatIntegrationService.initializeCombatWithInventory(
      TEST_PLAYER_ADDRESS,
      BigInt(12345)
    );

    expect(session).toBeDefined();
    expect(session.sessionId).toBeDefined();
    expect(session.playerAddress).toBe(TEST_PLAYER_ADDRESS);
    expect(session.isActive).toBe(true);

    // Check that combat session started in inventory service
    const currentSession = combatIntegrationService.getCurrentSession();
    expect(currentSession).toBeDefined();
    expect(currentSession!.sessionId).toBe(session.sessionId);

    // Combat statistics should be available
    const stats = combatIntegrationService.getCombatStatistics();
    expect(stats.totalMonsters).toBe(2);
    expect(stats.remainingSwitches).toBe(3);
    expect(stats.switchesUsed).toBe(0);
  });

  test('should perform monster switching in combat', async () => {
    // Setup monsters
    const krakenId = await monsterInventoryService.addMonster(
      TEST_MONSTERS.kraken.stats,
      TEST_MONSTERS.kraken.name,
      2
    );

    // Initialize combat
    await combatIntegrationService.initializeCombatWithInventory(
      TEST_PLAYER_ADDRESS,
      BigInt(54321)
    );

    const initialActive = monsterInventoryService.getActiveMonster();
    expect(initialActive).toBeDefined();

    // Check available switch targets
    const switchTargets = combatIntegrationService.getAvailableSwitchTargets();
    expect(switchTargets).toHaveLength(1);
    expect(switchTargets[0].id).toBe(krakenId);

    // Perform switch
    const switchResult = await combatIntegrationService.performCombatAction(
      CombatAction.SwitchMonster,
      krakenId
    );

    expect(switchResult.switchAction).toBeDefined();
    expect(switchResult.newActiveMonster).toBe(krakenId);
    expect(switchResult.inventoryUpdated).toBe(true);

    // Verify switch occurred
    const newActive = monsterInventoryService.getActiveMonster();
    expect(newActive).toBeDefined();
    expect(newActive!.id).toBe(krakenId);
    expect(newActive!.name).toBe(TEST_MONSTERS.kraken.name);

    // Check remaining switches
    const updatedInventory = monsterInventoryService.getInventoryState();
    expect(updatedInventory.switchesUsed).toBe(1);

    const stats = combatIntegrationService.getCombatStatistics();
    expect(stats.remainingSwitches).toBe(2);
    expect(stats.switchesUsed).toBe(1);
  });

  test('should enforce switch limits and cooldowns', async () => {
    // Setup multiple monsters
    const krakenId = await monsterInventoryService.addMonster(
      TEST_MONSTERS.kraken.stats,
      TEST_MONSTERS.kraken.name,
      2
    );

    const guardianId = await monsterInventoryService.addMonster(
      TEST_MONSTERS.guardian.stats,
      TEST_MONSTERS.guardian.name,
      1
    );

    // Initialize combat
    await combatIntegrationService.initializeCombatWithInventory(
      TEST_PLAYER_ADDRESS,
      BigInt(98765)
    );

    const activeMonster = monsterInventoryService.getActiveMonster();
    expect(activeMonster).toBeDefined();

    // Perform maximum switches (3)
    for (let i = 0; i < 3; i++) {
      const targets = combatIntegrationService.getAvailableSwitchTargets();
      if (targets.length > 0) {
        await combatIntegrationService.performCombatAction(
          CombatAction.SwitchMonster,
          targets[0].id
        );
      }
    }

    // Should not be able to switch anymore
    const canSwitch = combatIntegrationService.canPerformSwitch();
    expect(canSwitch.canSwitch).toBe(false);
    expect(canSwitch.reason).toContain('Maximum switches');

    const stats = combatIntegrationService.getCombatStatistics();
    expect(stats.remainingSwitches).toBe(0);
  });

  test('should handle monster health updates and auto-switch', async () => {
    // Setup monsters
    const krakenId = await monsterInventoryService.addMonster(
      TEST_MONSTERS.kraken.stats,
      TEST_MONSTERS.kraken.name,
      2
    );

    // Initialize combat
    await combatIntegrationService.initializeCombatWithInventory(
      TEST_PLAYER_ADDRESS,
      BigInt(11111)
    );

    const activeMonster = monsterInventoryService.getActiveMonster();
    expect(activeMonster).toBeDefined();
    expect(activeMonster!.health).toBeGreaterThan(0);

    // Damage the active monster to fainting
    monsterInventoryService.updateMonsterHealth(activeMonster!.id, 0);

    // Check auto-switch functionality
    const switchedMonster = await monsterInventoryService.checkAutoSwitch(
      combatIntegrationService.getCurrentBlock(),
      TEST_PLAYER_ADDRESS
    );

    expect(switchedMonster).toBeDefined();
    expect(switchedMonster!.id).toBe(krakenId);
    expect(switchedMonster!.health).toBeGreaterThan(0);

    // Verify new active monster
    const newActiveMonster = monsterInventoryService.getActiveMonster();
    expect(newActiveMonster!.id).toBe(krakenId);
  });

  test('should handle ZK stat conversions correctly', async () => {
    const testStats: PlayerStats = TEST_MONSTERS.serpent.stats;

    // Convert to ZK format
    const zkStats = monsterInventoryService.convertToZKStats(testStats);
    expect(zkStats.health).toBe(BigInt(testStats.health));
    expect(zkStats.attackPower).toBe(BigInt(testStats.attackPower));
    expect(zkStats.defense).toBe(BigInt(testStats.defense));

    // Convert back to regular format
    const convertedBack = monsterInventoryService.convertFromZKStats(zkStats);
    expect(convertedBack.health).toBe(testStats.health);
    expect(convertedBack.attackPower).toBe(testStats.attackPower);
    expect(convertedBack.defense).toBe(testStats.defense);
  });

  test('should handle monster leveling and experience', async () => {
    const activeMonster = monsterInventoryService.getActiveMonster();
    expect(activeMonster).toBeDefined();

    const initialLevel = activeMonster!.level;
    const initialExperience = activeMonster!.experience;
    const initialStats = { ...activeMonster!.monster };

    // Award experience (not enough to level up)
    let leveledUp = await monsterInventoryService.levelUpMonster(activeMonster!.id, 50);
    expect(leveledUp).toBe(false);

    // Award enough experience to level up
    leveledUp = await monsterInventoryService.levelUpMonster(activeMonster!.id, 100);
    expect(leveledUp).toBe(true);

    // Check that stats increased
    const updatedMonster = monsterInventoryService.getActiveMonster();
    expect(updatedMonster!.level).toBe(initialLevel + 1);
    expect(updatedMonster!.monster.health).toBeGreaterThan(initialStats.health);
    expect(updatedMonster!.monster.attackPower).toBeGreaterThan(initialStats.attackPower);
  });

  test('should persist and load inventory state', async () => {
    // Add a test monster
    const krakenId = await monsterInventoryService.addMonster(
      TEST_MONSTERS.kraken.stats,
      TEST_MONSTERS.kraken.name,
      2
    );

    // Save state
    monsterInventoryService.saveInventoryState();

    // Modify state
    await monsterInventoryService.addMonster(
      TEST_MONSTERS.guardian.stats,
      TEST_MONSTERS.guardian.name,
      1
    );

    expect(monsterInventoryService.getAllMonsters()).toHaveLength(3);

    // Load original state
    const loaded = monsterInventoryService.loadInventoryState();
    expect(loaded).toBe(true);

    // Should be back to original state
    expect(monsterInventoryService.getAllMonsters()).toHaveLength(2);
  });

  test('should export inventory data for debugging', async () => {
    // Add test monsters
    await monsterInventoryService.addMonster(
      TEST_MONSTERS.kraken.stats,
      TEST_MONSTERS.kraken.name,
      2
    );

    const exportData = monsterInventoryService.exportInventoryData();

    expect(exportData).toBeDefined();
    expect(exportData.summary).toBeDefined();
    expect(exportData.summary.totalMonsters).toBe(2);
    expect(exportData.summary.aliveMonsters).toBe(2);
    expect(exportData.summary.activeMonster).toBeDefined();
    expect(exportData.constraints).toBeDefined();
    expect(exportData.state).toBeDefined();
  });

  afterEach(async () => {
    // Clean up combat session if active
    const currentSession = combatIntegrationService.getCurrentSession();
    if (currentSession) {
      try {
        await combatIntegrationService.endCombatSession(true);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });
});

// Helper functions for testing
export const testHelpers = {
  async setupTestRoster() {
    const monsters = [];
    for (const [key, data] of Object.entries(TEST_MONSTERS)) {
      const id = await monsterInventoryService.addMonster(
        data.stats,
        data.name,
        Math.floor(Math.random() * 3) + 1
      );
      monsters.push({ id, name: data.name });
    }
    return monsters;
  },

  async simulateCombatSession() {
    await this.setupTestRoster();
    return await combatIntegrationService.initializeCombatWithInventory(
      TEST_PLAYER_ADDRESS,
      BigInt(Math.floor(Math.random() * 1000000))
    );
  },

  async performRandomActions(count: number = 5) {
    const actions = [CombatAction.Attack, CombatAction.Magic, CombatAction.Defend];
    const results = [];

    for (let i = 0; i < count; i++) {
      const action = actions[Math.floor(Math.random() * actions.length)];
      try {
        const result = await combatIntegrationService.performCombatAction(action);
        results.push(result);
        
        if (result.result.isCombatEnded) {
          break;
        }
      } catch (error) {
        console.error(`Action ${i + 1} failed:`, error);
      }
    }

    return results;
  }
};