import { monsterInventoryService, MonsterSwitchAction } from './monsterInventoryService';
import { midnightService } from './midnightService';
import { privacyService } from './privacyService';
import { CombatAction, CombatStats, PrivateCombatData, CombatResult } from '../types/zk-types';
import { MonsterInventory, CombatSession as LegacyCombatSession } from '../types/combat.d';

export interface ExtendedCombatSession {
  sessionId: bigint;
  playerAddress: string;
  playerInventory: MonsterInventory;
  monsterStats: CombatStats;
  turn: bigint;
  isActive: boolean;
  switchActionsUsed: MonsterSwitchAction[];
  lastActionBlock: bigint;
}

export interface CombatTurnResult {
  result: CombatResult;
  switchAction?: MonsterSwitchAction;
  inventoryUpdated: boolean;
  newActiveMonster?: string;
  autoSwitchOccurred: boolean;
}

export class CombatIntegrationService {
  private currentSession: ExtendedCombatSession | null = null;
  private currentBlock: bigint = 0n;

  constructor() {
    // Simulate block progression
    this.simulateBlockProgression();
  }

  // Initialize a new combat session with monster inventory integration
  async initializeCombatWithInventory(
    playerAddress: string,
    monsterSeed: bigint
  ): Promise<ExtendedCombatSession> {
    try {
      // Get current player stats from active monster
      const activeMonster = monsterInventoryService.getActiveMonster();
      if (!activeMonster) {
        throw new Error('No active monster available for combat');
      }

      const playerStats = monsterInventoryService.convertToZKStats(activeMonster.monster);

      // Initialize combat through midnight service
      const { sessionId, publicMonsterStats } = await midnightService.initializeCombat(
        playerStats,
        monsterSeed
      );

      // Start inventory combat session
      await monsterInventoryService.startCombatSession(sessionId);

      // Create extended combat session
      this.currentSession = {
        sessionId,
        playerAddress,
        playerInventory: monsterInventoryService.getInventoryState(),
        monsterStats: publicMonsterStats,
        turn: 1n,
        isActive: true,
        switchActionsUsed: [],
        lastActionBlock: this.currentBlock
      };

      console.log('Combat session initialized with monster inventory:', {
        sessionId,
        activeMonster: activeMonster.name,
        remainingSwitches: monsterInventoryService.getRemainingSwtiches()
      });

      return this.currentSession;
    } catch (error) {
      console.error('Failed to initialize combat with inventory:', error);
      throw error;
    }
  }

  // Perform a combat action (including monster switching)
  async performCombatAction(
    action: CombatAction,
    targetMonsterId?: string
  ): Promise<CombatTurnResult> {
    if (!this.currentSession) {
      throw new Error('No active combat session');
    }

    try {
      let switchAction: MonsterSwitchAction | undefined;
      let autoSwitchOccurred = false;
      let newActiveMonster: string | undefined;

      // Handle monster switching
      if (action === CombatAction.SwitchMonster) {
        if (!targetMonsterId) {
          throw new Error('Target monster ID required for switch action');
        }

        switchAction = await this.performMonsterSwitch(targetMonsterId);
        newActiveMonster = targetMonsterId;
      }

      // Get current active monster stats for combat calculation
      const activeMonster = monsterInventoryService.getActiveMonster();
      if (!activeMonster) {
        throw new Error('No active monster available');
      }

      const playerStats = monsterInventoryService.convertToZKStats(activeMonster.monster);

      // Create private combat data
      const privateCombatData: PrivateCombatData = {
        playerSecretSeed: BigInt(Math.floor(Math.random() * 1000000)),
        monsterSecretSeed: BigInt(Math.floor(Math.random() * 1000000)),
        damageRoll: BigInt(Math.floor(Math.random() * 100)),
        criticalChance: BigInt(Math.floor(Math.random() * 100))
      };

      // Perform combat action through midnight service
      const combatResult = await midnightService.performCombatAction(
        this.currentSession.sessionId,
        action,
        privateCombatData
      );

      // Update monster health if damage was taken
      if (combatResult.monsterDamage > 0) {
        const newHealth = activeMonster.health - Number(combatResult.monsterDamage);
        monsterInventoryService.updateMonsterHealth(activeMonster.id, newHealth);

        // Check for auto-switch if monster fainted
        if (newHealth <= 0) {
          const switchedMonster = await monsterInventoryService.checkAutoSwitch(
            this.currentBlock,
            this.currentSession.playerAddress
          );
          
          if (switchedMonster) {
            autoSwitchOccurred = true;
            newActiveMonster = switchedMonster.id;
            console.log(`Auto-switched to ${switchedMonster.name} due to monster fainting`);
          }
        }
      }

      // Update session state
      this.currentSession.turn++;
      this.currentSession.lastActionBlock = this.currentBlock;
      this.currentSession.playerInventory = monsterInventoryService.getInventoryState();

      if (switchAction) {
        this.currentSession.switchActionsUsed.push(switchAction);
      }

      // Check if combat ended
      if (combatResult.isCombatEnded) {
        await this.endCombatSession(combatResult.playerWon);
      }

      return {
        result: combatResult,
        switchAction,
        inventoryUpdated: true,
        newActiveMonster,
        autoSwitchOccurred
      };
    } catch (error) {
      console.error('Failed to perform combat action:', error);
      throw error;
    }
  }

  // Perform monster switch action
  private async performMonsterSwitch(targetMonsterId: string): Promise<MonsterSwitchAction> {
    if (!this.currentSession) {
      throw new Error('No active combat session');
    }

    const activeMonster = monsterInventoryService.getActiveMonster();
    if (!activeMonster) {
      throw new Error('No active monster to switch from');
    }

    // Validate and perform the switch
    const switchAction = await monsterInventoryService.performSwitch(
      activeMonster.id,
      targetMonsterId,
      this.currentSession.sessionId,
      this.currentBlock,
      this.currentSession.playerAddress
    );

    console.log('Monster switch completed:', {
      from: activeMonster.name,
      to: monsterInventoryService.getActiveMonster()?.name,
      remainingSwitches: monsterInventoryService.getRemainingSwtiches()
    });

    return switchAction;
  }

  // End the current combat session
  async endCombatSession(isVictory: boolean): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    try {
      // Award experience to active monster
      const activeMonster = monsterInventoryService.getActiveMonster();
      if (activeMonster) {
        const experienceGained = isVictory ? 100 : 25;
        const leveledUp = await monsterInventoryService.levelUpMonster(
          activeMonster.id,
          experienceGained
        );

        if (leveledUp) {
          console.log(`${activeMonster.name} leveled up after combat!`);
        }
      }

      // Award combat rewards
      const monsterLevel = BigInt(activeMonster?.level || 1);
      const rewards = await midnightService.awardCombatRewards(isVictory, monsterLevel);

      // Reveal combat results with privacy service
      await privacyService.revealCombatResults(
        this.currentSession.playerAddress,
        this.currentSession.sessionId,
        isVictory
      );

      // End inventory combat session
      await monsterInventoryService.endCombatSession();

      console.log('Combat session ended:', {
        victory: isVictory,
        rewards,
        switchesUsed: this.currentSession.switchActionsUsed.length
      });

      this.currentSession = null;
    } catch (error) {
      console.error('Failed to end combat session:', error);
      throw error;
    }
  }

  // Get current combat session
  getCurrentSession(): ExtendedCombatSession | null {
    return this.currentSession;
  }

  // Get available switch targets
  getAvailableSwitchTargets(): Array<{ id: string; name: string; health: number; level: number }> {
    if (!this.currentSession) {
      return [];
    }

    const activeMonster = monsterInventoryService.getActiveMonster();
    return monsterInventoryService.getBenchMonsters()
      .filter(monster => {
        // Check if switch would be valid
        const validation = monsterInventoryService.validateSwitch(
          activeMonster?.id || '',
          monster.id,
          this.currentBlock
        );
        return validation.valid;
      })
      .map(monster => ({
        id: monster.id,
        name: monster.name,
        health: monster.health,
        level: monster.level
      }));
  }

  // Check if switching is available
  canPerformSwitch(): { canSwitch: boolean; reason?: string } {
    if (!this.currentSession) {
      return { canSwitch: false, reason: 'No active combat session' };
    }

    const remainingSwitches = monsterInventoryService.getRemainingSwtiches();
    if (remainingSwitches <= 0) {
      return { 
        canSwitch: false, 
        reason: 'Maximum switches per combat reached' 
      };
    }

    const availableTargets = this.getAvailableSwitchTargets();
    if (availableTargets.length === 0) {
      return { 
        canSwitch: false, 
        reason: 'No valid monsters available for switching' 
      };
    }

    return { canSwitch: true };
  }

  // Heal all monsters (out of combat)
  async healAllMonsters(): Promise<void> {
    if (this.currentSession) {
      throw new Error('Cannot heal monsters during combat');
    }

    const allMonsters = monsterInventoryService.getAllMonsters();
    for (const monster of allMonsters) {
      await monsterInventoryService.healMonster(monster.id, monster.maxHealth);
    }

    console.log('All monsters healed to full health');
  }

  // Get combat statistics
  getCombatStatistics(): {
    activeMonster: string;
    monstersAlive: number;
    totalMonsters: number;
    remainingSwitches: number;
    switchesUsed: number;
    currentTurn: number;
  } {
    const activeMonster = monsterInventoryService.getActiveMonster();
    const allMonsters = monsterInventoryService.getAllMonsters();
    const aliveMonsters = allMonsters.filter(m => m.health > 0);

    return {
      activeMonster: activeMonster?.name || 'None',
      monstersAlive: aliveMonsters.length,
      totalMonsters: allMonsters.length,
      remainingSwitches: monsterInventoryService.getRemainingSwtiches(),
      switchesUsed: this.currentSession?.switchActionsUsed.length || 0,
      currentTurn: Number(this.currentSession?.turn || 0)
    };
  }

  // Convert to legacy combat session format for compatibility
  toLegacyCombatSession(): LegacyCombatSession | null {
    if (!this.currentSession) {
      return null;
    }

    const activeMonster = monsterInventoryService.getActiveMonster();
    if (!activeMonster) {
      return null;
    }

    return {
      player: activeMonster.monster,
      monster: {
        name: 'Ocean Monster',
        health: Number(this.currentSession.monsterStats.health),
        attackPower: Number(this.currentSession.monsterStats.attackPower),
        defense: Number(this.currentSession.monsterStats.defense),
        speed: Number(this.currentSession.monsterStats.speed),
        magicAttack: Number(this.currentSession.monsterStats.magicAttack),
        magicDefense: Number(this.currentSession.monsterStats.magicDefense)
      },
      playerInventory: this.currentSession.playerInventory,
      turn: Number(this.currentSession.turn),
      actions: [], // Would need to track actions separately
      outcome: this.currentSession.isActive ? 'ongoing' : 'victory'
    };
  }

  // Simulate block progression for cooldowns
  private simulateBlockProgression(): void {
    setInterval(() => {
      this.currentBlock++;
    }, 5000); // New "block" every 5 seconds
  }

  // Get current block number
  getCurrentBlock(): bigint {
    return this.currentBlock;
  }

  // Force switch validation (for testing)
  validateSwitch(fromMonsterId: string, toMonsterId: string): { valid: boolean; reason?: string } {
    return monsterInventoryService.validateSwitch(fromMonsterId, toMonsterId, this.currentBlock);
  }
}

// Singleton instance
export const combatIntegrationService = new CombatIntegrationService();