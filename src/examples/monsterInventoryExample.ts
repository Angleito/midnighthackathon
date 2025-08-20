/**
 * Monster Inventory Management System Example
 * 
 * This file demonstrates how to use the comprehensive monster inventory
 * management system for the ZK Ocean Combat game.
 */

import { monsterInventoryService } from '../services/monsterInventoryService';
import { combatIntegrationService } from '../services/combatIntegrationService';
import { CombatAction } from '../types/zk-types';
import { PlayerStats } from '../types/combat.d';

// Example monster templates
const MONSTER_TEMPLATES = {
  oceanSerpent: {
    stats: {
      health: 120,
      attackPower: 25,
      defense: 18,
      speed: 22,
      magicAttack: 20,
      magicDefense: 15
    },
    name: 'Ocean Serpent'
  },
  depthKraken: {
    stats: {
      health: 150,
      attackPower: 30,
      defense: 25,
      speed: 15,
      magicAttack: 35,
      magicDefense: 20
    },
    name: 'Depth Kraken'
  },
  coralGuardian: {
    stats: {
      health: 100,
      attackPower: 18,
      defense: 30,
      speed: 20,
      magicAttack: 15,
      magicDefense: 25
    },
    name: 'Coral Guardian'
  },
  tideDancer: {
    stats: {
      health: 80,
      attackPower: 22,
      defense: 12,
      speed: 35,
      magicAttack: 28,
      magicDefense: 18
    },
    name: 'Tide Dancer'
  }
};

export class MonsterInventoryExample {
  private playerAddress = 'player_0x123456789';

  async runFullExample(): Promise<void> {
    console.log('=== ZK Ocean Combat Monster Inventory Example ===\n');

    try {
      await this.demonstrateBasicInventoryManagement();
      await this.demonstrateCombatIntegration();
      await this.demonstrateAdvancedFeatures();
    } catch (error) {
      console.error('Example failed:', error);
    }
  }

  // Demonstrate basic inventory management
  async demonstrateBasicInventoryManagement(): Promise<void> {
    console.log('1. Basic Inventory Management\n');

    // Check initial state
    console.log('Initial inventory state:');
    this.logInventoryState();

    // Add monsters to roster
    console.log('\nAdding monsters to roster...');
    const kraken = await monsterInventoryService.addMonster(
      MONSTER_TEMPLATES.depthKraken.stats,
      MONSTER_TEMPLATES.depthKraken.name,
      2
    );

    const guardian = await monsterInventoryService.addMonster(
      MONSTER_TEMPLATES.coralGuardian.stats,
      MONSTER_TEMPLATES.coralGuardian.name,
      1
    );

    const dancer = await monsterInventoryService.addMonster(
      MONSTER_TEMPLATES.tideDancer.stats,
      MONSTER_TEMPLATES.tideDancer.name,
      3
    );

    console.log('Monsters added:', { kraken, guardian, dancer });

    // Show updated inventory
    console.log('\nUpdated inventory:');
    this.logInventoryState();

    // Try to switch monsters (outside combat - should fail)
    console.log('\nTrying to switch outside combat...');
    try {
      await monsterInventoryService.performSwitch(
        'starter_001',
        kraken,
        BigInt(0),
        BigInt(100),
        this.playerAddress
      );
    } catch (error) {
      console.log('Expected error:', (error as Error).message);
    }

    // Heal and level up demonstration
    console.log('\nDamaging and healing monsters...');
    monsterInventoryService.updateMonsterHealth('starter_001', 50);
    await monsterInventoryService.healMonster('starter_001', 30);
    await monsterInventoryService.levelUpMonster('starter_001', 150);

    console.log('\nAfter healing and leveling:');
    this.logInventoryState();
  }

  // Demonstrate combat integration with switching
  async demonstrateCombatIntegration(): Promise<void> {
    console.log('\n2. Combat Integration with Monster Switching\n');

    // Initialize combat
    console.log('Initializing combat session...');
    const session = await combatIntegrationService.initializeCombatWithInventory(
      this.playerAddress,
      BigInt(12345)
    );

    console.log('Combat session started:', {
      sessionId: session.sessionId.toString(),
      activeMonster: session.playerInventory.activeMonster,
      remainingSwitches: monsterInventoryService.getRemainingSwtiches()
    });

    // Perform some combat actions
    console.log('\nPerforming attack action...');
    let result = await combatIntegrationService.performCombatAction(CombatAction.Attack);
    console.log('Attack result:', result.result);

    // Check available switch targets
    console.log('\nAvailable switch targets:');
    const switchTargets = combatIntegrationService.getAvailableSwitchTargets();
    console.log(switchTargets);

    // Perform monster switch
    if (switchTargets.length > 0) {
      console.log('\nPerforming monster switch...');
      const targetId = switchTargets[0].id;
      
      result = await combatIntegrationService.performCombatAction(
        CombatAction.SwitchMonster,
        targetId
      );

      console.log('Switch result:', {
        switchAction: result.switchAction,
        newActiveMonster: result.newActiveMonster,
        remainingSwitches: monsterInventoryService.getRemainingSwtiches()
      });
    }

    // Continue combat
    console.log('\nContinuing combat...');
    for (let turn = 0; turn < 3; turn++) {
      const action = Math.random() > 0.5 ? CombatAction.Attack : CombatAction.Magic;
      result = await combatIntegrationService.performCombatAction(action);
      
      console.log(`Turn ${turn + 1}:`, {
        action: CombatAction[action],
        playerDamage: result.result.playerDamage.toString(),
        monsterDamage: result.result.monsterDamage.toString(),
        combatEnded: result.result.isCombatEnded
      });

      if (result.result.isCombatEnded) {
        console.log('Combat ended!', {
          victory: result.result.playerWon,
          autoSwitch: result.autoSwitchOccurred
        });
        break;
      }
    }

    // Check final statistics
    console.log('\nFinal combat statistics:');
    console.log(combatIntegrationService.getCombatStatistics());
  }

  // Demonstrate advanced features
  async demonstrateAdvancedFeatures(): Promise<void> {
    console.log('\n3. Advanced Features\n');

    // Switch validation
    console.log('Testing switch validation...');
    const activeMonster = monsterInventoryService.getActiveMonster();
    const benchMonsters = monsterInventoryService.getBenchMonsters();

    if (activeMonster && benchMonsters.length > 0) {
      const validation = combatIntegrationService.validateSwitch(
        activeMonster.id,
        benchMonsters[0].id
      );
      console.log('Switch validation:', validation);
    }

    // Monster switching constraints
    console.log('\nTesting switch constraints...');
    const constraints = {
      maxSwitches: 3,
      cooldownBlocks: 5,
      turnCost: 1
    };
    console.log('Switch constraints:', constraints);

    // Auto-switch demonstration
    console.log('\nTesting auto-switch on monster fainting...');
    if (activeMonster) {
      // Simulate monster fainting
      monsterInventoryService.updateMonsterHealth(activeMonster.id, 0);
      
      try {
        const switchedMonster = await monsterInventoryService.checkAutoSwitch(
          combatIntegrationService.getCurrentBlock(),
          this.playerAddress
        );
        
        if (switchedMonster) {
          console.log('Auto-switched to:', switchedMonster.name);
        }
      } catch (error) {
        console.log('Auto-switch result:', (error as Error).message);
      }
    }

    // Persistence demonstration
    console.log('\nTesting state persistence...');
    monsterInventoryService.saveInventoryState();
    console.log('Inventory state saved to localStorage');

    // Export data for debugging
    console.log('\nExporting inventory data...');
    const exportedData = monsterInventoryService.exportInventoryData();
    console.log('Exported data summary:', exportedData.summary);

    // ZK integration demonstration
    console.log('\nZK Stats conversion example:');
    if (activeMonster) {
      const zkStats = monsterInventoryService.convertToZKStats(activeMonster.monster);
      const backToRegular = monsterInventoryService.convertFromZKStats(zkStats);
      
      console.log('Original stats:', activeMonster.monster);
      console.log('ZK stats:', zkStats);
      console.log('Converted back:', backToRegular);
    }

    // Healing all monsters
    console.log('\nHealing all monsters...');
    try {
      await combatIntegrationService.healAllMonsters();
      console.log('All monsters healed to full health');
    } catch (error) {
      console.log('Healing result:', (error as Error).message);
    }
  }

  // Utility method to log current inventory state
  private logInventoryState(): void {
    const state = monsterInventoryService.getInventoryState();
    const allMonsters = monsterInventoryService.getAllMonsters();
    
    console.log('Active Monster:', state.activeMonster);
    console.log('Bench Monsters:', state.benchMonsters.length);
    console.log('All Monsters:', allMonsters.map(m => ({
      name: m.name,
      level: m.level,
      health: `${m.health}/${m.maxHealth}`,
      active: m.isActive
    })));
    console.log('Switches Used:', state.switchesUsed);
    console.log('Switch Cooldown:', state.switchCooldown);
  }
}

// Example usage
export async function runMonsterInventoryExample(): Promise<void> {
  const example = new MonsterInventoryExample();
  await example.runFullExample();
}

// Test individual features
export async function testSwitchValidation(): Promise<void> {
  console.log('=== Switch Validation Test ===');
  
  const activeMonster = monsterInventoryService.getActiveMonster();
  const benchMonsters = monsterInventoryService.getBenchMonsters();
  
  if (activeMonster && benchMonsters.length > 0) {
    const currentBlock = combatIntegrationService.getCurrentBlock();
    
    // Test valid switch
    let validation = monsterInventoryService.validateSwitch(
      activeMonster.id,
      benchMonsters[0].id,
      currentBlock
    );
    console.log('Valid switch test:', validation);
    
    // Test invalid switch (same monster)
    validation = monsterInventoryService.validateSwitch(
      activeMonster.id,
      activeMonster.id,
      currentBlock
    );
    console.log('Invalid switch test (same monster):', validation);
    
    // Test switch to non-existent monster
    validation = monsterInventoryService.validateSwitch(
      activeMonster.id,
      'non_existent_id',
      currentBlock
    );
    console.log('Invalid switch test (non-existent):', validation);
  }
}

export async function testCombatScenario(): Promise<void> {
  console.log('=== Full Combat Scenario Test ===');
  
  const playerAddress = 'test_player_0x789';
  
  try {
    // Initialize combat
    const session = await combatIntegrationService.initializeCombatWithInventory(
      playerAddress,
      BigInt(54321)
    );
    
    console.log('Combat initialized');
    
    // Perform multiple actions including switches
    const actions = [
      CombatAction.Attack,
      CombatAction.SwitchMonster,
      CombatAction.Magic,
      CombatAction.Defend,
      CombatAction.Attack
    ];
    
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const targets = combatIntegrationService.getAvailableSwitchTargets();
      
      let result;
      if (action === CombatAction.SwitchMonster && targets.length > 0) {
        result = await combatIntegrationService.performCombatAction(action, targets[0].id);
      } else if (action !== CombatAction.SwitchMonster) {
        result = await combatIntegrationService.performCombatAction(action);
      } else {
        console.log(`Skipping switch action - no valid targets`);
        continue;
      }
      
      console.log(`Action ${i + 1} (${CombatAction[action]}):`, {
        playerDamage: result.result.playerDamage.toString(),
        monsterDamage: result.result.monsterDamage.toString(),
        switchOccurred: !!result.switchAction,
        autoSwitch: result.autoSwitchOccurred
      });
      
      if (result.result.isCombatEnded) {
        console.log('Combat ended early');
        break;
      }
    }
    
    console.log('Final statistics:', combatIntegrationService.getCombatStatistics());
    
  } catch (error) {
    console.error('Combat scenario failed:', error);
  }
}

// Export all test functions
export const monsterInventoryTests = {
  runFullExample: runMonsterInventoryExample,
  testSwitchValidation,
  testCombatScenario
};