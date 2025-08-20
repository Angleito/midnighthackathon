import { MonsterInventory, PlayerStats, MonsterStats, CombatAction } from '../types/combat.d';
import { CombatStats } from '../types/zk-types';
import { privacyService, CommitmentProof } from './privacyService';

export interface MonsterSlot {
  id: string;
  monster: PlayerStats;
  name: string;
  isActive: boolean;
  health: number;
  maxHealth: number;
  level: number;
  experience: number;
  lastSwitchBlock: bigint;
  switchCooldownBlocks: number;
}

export interface SwitchConstraints {
  maxSwitchesPerCombat: number;
  switchCooldownBlocks: number;
  mustBeAlive: boolean;
  turnCost: number;
}

export interface MonsterSwitchAction {
  fromSlotId: string;
  toSlotId: string;
  sessionId: bigint;
  commitmentProof: CommitmentProof;
  blockNumber: bigint;
}

export interface InventoryState {
  activeSlot: string;
  roster: Map<string, MonsterSlot>;
  switchesUsedThisCombat: number;
  combatSessionId: bigint | null;
  lastActionBlock: bigint;
  inventoryVersion: number;
}

export class MonsterInventoryService {
  private state: InventoryState;
  private readonly constraints: SwitchConstraints;
  private readonly maxRosterSize = 6;
  private readonly maxBenchSize = 5;

  constructor() {
    this.constraints = {
      maxSwitchesPerCombat: 3,
      switchCooldownBlocks: 5,
      mustBeAlive: true,
      turnCost: 1
    };

    this.state = {
      activeSlot: '',
      roster: new Map(),
      switchesUsedThisCombat: 0,
      combatSessionId: null,
      lastActionBlock: 0n,
      inventoryVersion: 1
    };

    this.initializeDefaultRoster();
  }

  // Initialize with a basic starter monster
  private initializeDefaultRoster(): void {
    const starterMonster: MonsterSlot = {
      id: 'starter_001',
      monster: {
        health: 100,
        attackPower: 20,
        defense: 15,
        speed: 18,
        magicAttack: 16,
        magicDefense: 12
      },
      name: 'Ocean Serpent',
      isActive: true,
      health: 100,
      maxHealth: 100,
      level: 1,
      experience: 0,
      lastSwitchBlock: 0n,
      switchCooldownBlocks: 0
    };

    this.state.roster.set(starterMonster.id, starterMonster);
    this.state.activeSlot = starterMonster.id;
  }

  // Get current monster inventory state
  getInventoryState(): MonsterInventory {
    const activeMonster = this.getActiveMonster();
    const benchMonsters = this.getBenchMonsters();

    return {
      activeMonster: activeMonster?.monster || this.getDefaultStats(),
      benchMonsters: benchMonsters.map(slot => slot.monster),
      switchCooldown: this.getSwitchCooldown(),
      switchesUsed: this.state.switchesUsedThisCombat
    };
  }

  // Get the currently active monster
  getActiveMonster(): MonsterSlot | null {
    return this.state.roster.get(this.state.activeSlot) || null;
  }

  // Get all bench monsters (non-active)
  getBenchMonsters(): MonsterSlot[] {
    return Array.from(this.state.roster.values())
      .filter(slot => !slot.isActive && slot.health > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // Get all monsters in roster
  getAllMonsters(): MonsterSlot[] {
    return Array.from(this.state.roster.values())
      .sort((a, b) => {
        if (a.isActive) return -1;
        if (b.isActive) return 1;
        return a.name.localeCompare(b.name);
      });
  }

  // Add a new monster to the roster
  async addMonster(
    monster: PlayerStats,
    name: string,
    level: number = 1
  ): Promise<string> {
    if (this.state.roster.size >= this.maxRosterSize) {
      throw new Error(`Roster is full. Maximum ${this.maxRosterSize} monsters allowed.`);
    }

    const monsterId = `monster_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const monsterSlot: MonsterSlot = {
      id: monsterId,
      monster,
      name,
      isActive: false,
      health: monster.health,
      maxHealth: monster.health,
      level,
      experience: 0,
      lastSwitchBlock: 0n,
      switchCooldownBlocks: 0
    };

    this.state.roster.set(monsterId, monsterSlot);
    this.state.inventoryVersion++;

    console.log(`Added new monster to roster: ${name} (${monsterId})`);
    return monsterId;
  }

  // Remove a monster from the roster
  async removeMonster(monsterId: string): Promise<boolean> {
    const monster = this.state.roster.get(monsterId);
    if (!monster) {
      throw new Error('Monster not found in roster');
    }

    if (monster.isActive) {
      throw new Error('Cannot remove the active monster. Switch to another monster first.');
    }

    if (this.state.roster.size <= 1) {
      throw new Error('Cannot remove the last monster in your roster');
    }

    this.state.roster.delete(monsterId);
    this.state.inventoryVersion++;

    console.log(`Removed monster from roster: ${monster.name} (${monsterId})`);
    return true;
  }

  // Validate if a switch is possible
  validateSwitch(fromSlotId: string, toSlotId: string, currentBlock: bigint): {
    valid: boolean;
    reason?: string;
  } {
    // Check if switching is enabled for this combat
    if (this.state.combatSessionId === null) {
      return { valid: false, reason: 'Not in combat session' };
    }

    // Check switch limit
    if (this.state.switchesUsedThisCombat >= this.constraints.maxSwitchesPerCombat) {
      return { 
        valid: false, 
        reason: `Maximum switches per combat reached (${this.constraints.maxSwitchesPerCombat})` 
      };
    }

    // Check source monster
    const fromMonster = this.state.roster.get(fromSlotId);
    if (!fromMonster) {
      return { valid: false, reason: 'Source monster not found' };
    }

    if (!fromMonster.isActive) {
      return { valid: false, reason: 'Source monster is not active' };
    }

    // Check target monster
    const toMonster = this.state.roster.get(toSlotId);
    if (!toMonster) {
      return { valid: false, reason: 'Target monster not found' };
    }

    if (toMonster.isActive) {
      return { valid: false, reason: 'Target monster is already active' };
    }

    // Check if target monster is alive
    if (this.constraints.mustBeAlive && toMonster.health <= 0) {
      return { valid: false, reason: 'Target monster is fainted and cannot battle' };
    }

    // Check cooldown
    const blocksSinceLastSwitch = currentBlock - toMonster.lastSwitchBlock;
    if (blocksSinceLastSwitch < BigInt(this.constraints.switchCooldownBlocks)) {
      const blocksRemaining = BigInt(this.constraints.switchCooldownBlocks) - blocksSinceLastSwitch;
      return { 
        valid: false, 
        reason: `Monster is on cooldown. ${blocksRemaining} blocks remaining.` 
      };
    }

    return { valid: true };
  }

  // Perform a monster switch with ZK privacy
  async performSwitch(
    fromSlotId: string,
    toSlotId: string,
    sessionId: bigint,
    currentBlock: bigint,
    playerId: string
  ): Promise<MonsterSwitchAction> {
    // Validate the switch
    const validation = this.validateSwitch(fromSlotId, toSlotId, currentBlock);
    if (!validation.valid) {
      throw new Error(`Invalid switch: ${validation.reason}`);
    }

    try {
      // Generate commitment proof for the switch action
      const switchAction = BigInt(4); // Switch action ID
      const secretSalt = BigInt(Math.floor(Math.random() * 1000000));
      
      const commitmentProof = await privacyService.generateActionCommitment(
        playerId,
        sessionId,
        switchAction,
        secretSalt
      );

      // Execute the switch
      const fromMonster = this.state.roster.get(fromSlotId)!;
      const toMonster = this.state.roster.get(toSlotId)!;

      // Update monster states
      fromMonster.isActive = false;
      fromMonster.lastSwitchBlock = currentBlock;

      toMonster.isActive = true;
      toMonster.lastSwitchBlock = currentBlock;
      toMonster.switchCooldownBlocks = this.constraints.switchCooldownBlocks;

      // Update inventory state
      this.state.activeSlot = toSlotId;
      this.state.switchesUsedThisCombat++;
      this.state.lastActionBlock = currentBlock;
      this.state.inventoryVersion++;

      const switchActionData: MonsterSwitchAction = {
        fromSlotId,
        toSlotId,
        sessionId,
        commitmentProof,
        blockNumber: currentBlock
      };

      console.log(`Monster switch executed: ${fromMonster.name} -> ${toMonster.name}`, {
        switchesUsed: this.state.switchesUsedThisCombat,
        maxSwitches: this.constraints.maxSwitchesPerCombat
      });

      return switchActionData;
    } catch (error) {
      console.error('Failed to perform monster switch:', error);
      throw error;
    }
  }

  // Start a new combat session
  async startCombatSession(sessionId: bigint): Promise<void> {
    this.state.combatSessionId = sessionId;
    this.state.switchesUsedThisCombat = 0;
    this.state.inventoryVersion++;

    // Reset cooldowns for new combat
    for (const monster of this.state.roster.values()) {
      monster.switchCooldownBlocks = 0;
    }

    console.log(`Started combat session: ${sessionId}`);
  }

  // End the current combat session
  async endCombatSession(): Promise<void> {
    this.state.combatSessionId = null;
    this.state.switchesUsedThisCombat = 0;
    this.state.inventoryVersion++;

    console.log('Combat session ended');
  }

  // Update monster health after damage
  updateMonsterHealth(monsterId: string, newHealth: number): void {
    const monster = this.state.roster.get(monsterId);
    if (!monster) {
      throw new Error('Monster not found');
    }

    monster.health = Math.max(0, Math.min(newHealth, monster.maxHealth));
    this.state.inventoryVersion++;

    if (monster.health <= 0 && monster.isActive) {
      console.log(`Active monster ${monster.name} fainted. Auto-switching required.`);
    }
  }

  // Check if active monster is fainted and auto-switch if needed
  async checkAutoSwitch(currentBlock: bigint, playerId: string): Promise<MonsterSlot | null> {
    const activeMonster = this.getActiveMonster();
    if (!activeMonster || activeMonster.health > 0) {
      return null;
    }

    // Find the first available monster
    const availableMonsters = this.getBenchMonsters().filter(m => m.health > 0);
    if (availableMonsters.length === 0) {
      throw new Error('No monsters available for battle. All monsters are fainted!');
    }

    // Auto-switch to the first available monster
    const targetMonster = availableMonsters[0];
    console.log(`Auto-switching from fainted ${activeMonster.name} to ${targetMonster.name}`);

    if (this.state.combatSessionId) {
      await this.performSwitch(
        activeMonster.id,
        targetMonster.id,
        this.state.combatSessionId,
        currentBlock,
        playerId
      );
    }

    return targetMonster;
  }

  // Heal a monster
  async healMonster(monsterId: string, healAmount: number): Promise<void> {
    const monster = this.state.roster.get(monsterId);
    if (!monster) {
      throw new Error('Monster not found');
    }

    const oldHealth = monster.health;
    monster.health = Math.min(monster.maxHealth, monster.health + healAmount);
    this.state.inventoryVersion++;

    console.log(`Healed ${monster.name}: ${oldHealth} -> ${monster.health}`);
  }

  // Level up a monster
  async levelUpMonster(monsterId: string, experienceGained: number): Promise<boolean> {
    const monster = this.state.roster.get(monsterId);
    if (!monster) {
      throw new Error('Monster not found');
    }

    monster.experience += experienceGained;
    const experienceNeeded = monster.level * 100; // Simple leveling formula

    if (monster.experience >= experienceNeeded) {
      monster.level++;
      monster.experience -= experienceNeeded;

      // Increase stats on level up
      const statIncrease = Math.floor(monster.level * 2);
      monster.monster.health += statIncrease;
      monster.monster.attackPower += Math.floor(statIncrease * 0.8);
      monster.monster.defense += Math.floor(statIncrease * 0.6);
      monster.monster.speed += Math.floor(statIncrease * 0.4);
      monster.monster.magicAttack += Math.floor(statIncrease * 0.7);
      monster.monster.magicDefense += Math.floor(statIncrease * 0.5);

      monster.maxHealth = monster.monster.health;
      monster.health = monster.maxHealth; // Full heal on level up

      this.state.inventoryVersion++;

      console.log(`${monster.name} leveled up to level ${monster.level}!`);
      return true;
    }

    return false;
  }

  // Get switch cooldown for current active monster
  getSwitchCooldown(): number {
    const activeMonster = this.getActiveMonster();
    if (!activeMonster) return 0;

    return Math.max(0, activeMonster.switchCooldownBlocks);
  }

  // Get remaining switches for current combat
  getRemainingSwtiches(): number {
    return Math.max(0, this.constraints.maxSwitchesPerCombat - this.state.switchesUsedThisCombat);
  }

  // Convert monster stats to ZK-compatible format
  convertToZKStats(monster: PlayerStats): CombatStats {
    return {
      health: BigInt(monster.health),
      attackPower: BigInt(monster.attackPower),
      defense: BigInt(monster.defense),
      speed: BigInt(monster.speed),
      magicAttack: BigInt(monster.magicAttack),
      magicDefense: BigInt(monster.magicDefense)
    };
  }

  // Convert ZK stats back to regular format
  convertFromZKStats(zkStats: CombatStats): PlayerStats {
    return {
      health: Number(zkStats.health),
      attackPower: Number(zkStats.attackPower),
      defense: Number(zkStats.defense),
      speed: Number(zkStats.speed),
      magicAttack: Number(zkStats.magicAttack),
      magicDefense: Number(zkStats.magicDefense)
    };
  }

  // Persist inventory state to localStorage
  saveInventoryState(): void {
    try {
      const serializedState = {
        activeSlot: this.state.activeSlot,
        roster: Array.from(this.state.roster.entries()).map(([slotId, slot]) => [
          slotId,
          {
            ...slot,
            monster: slot.monster ? {
              ...slot.monster,
              health: slot.monster.health.toString(),
              attackPower: slot.monster.attackPower.toString(),
              defense: slot.monster.defense.toString(),
              speed: slot.monster.speed.toString(),
              magicAttack: slot.monster.magicAttack.toString(),
              magicDefense: slot.monster.magicDefense.toString()
            } : null,
            lastSwitchBlock: slot.lastSwitchBlock.toString()
          }
        ]),
        switchesUsedThisCombat: this.state.switchesUsedThisCombat,
        combatSessionId: this.state.combatSessionId?.toString() || null,
        lastActionBlock: this.state.lastActionBlock.toString(),
        inventoryVersion: this.state.inventoryVersion
      };

      localStorage.setItem('zkocean_monster_inventory', JSON.stringify(serializedState));
    } catch (error) {
      console.error('Failed to save inventory state:', error);
    }
  }

  // Load inventory state from localStorage
  loadInventoryState(): boolean {
    try {
      const saved = localStorage.getItem('zkocean_monster_inventory');
      if (!saved) return false;

      const parsed = JSON.parse(saved);
      
      this.state.activeSlot = parsed.activeSlot;
      this.state.roster = new Map(parsed.roster.map(([slotId, slot]: [string, any]) => [
        slotId,
        {
          ...slot,
          monster: slot.monster ? {
            ...slot.monster,
            health: BigInt(slot.monster.health),
            attackPower: BigInt(slot.monster.attackPower),
            defense: BigInt(slot.monster.defense),
            speed: BigInt(slot.monster.speed),
            magicAttack: BigInt(slot.monster.magicAttack),
            magicDefense: BigInt(slot.monster.magicDefense)
          } : null,
          lastSwitchBlock: BigInt(slot.lastSwitchBlock)
        }
      ]));
      this.state.switchesUsedThisCombat = parsed.switchesUsedThisCombat;
      this.state.combatSessionId = parsed.combatSessionId ? BigInt(parsed.combatSessionId) : null;
      this.state.lastActionBlock = BigInt(parsed.lastActionBlock);
      this.state.inventoryVersion = parsed.inventoryVersion;

      console.log('Loaded inventory state from localStorage');
      return true;
    } catch (error) {
      console.error('Failed to load inventory state:', error);
      return false;
    }
  }

  // Get default stats for when no monster is available
  private getDefaultStats(): PlayerStats {
    return {
      health: 1,
      attackPower: 1,
      defense: 1,
      speed: 1,
      magicAttack: 1,
      magicDefense: 1
    };
  }

  // Export inventory data for debugging
  exportInventoryData(): any {
    return {
      state: {
        ...this.state,
        roster: Array.from(this.state.roster.entries()),
        combatSessionId: this.state.combatSessionId?.toString()
      },
      constraints: this.constraints,
      summary: {
        totalMonsters: this.state.roster.size,
        activeMonster: this.getActiveMonster()?.name,
        aliveMonsters: Array.from(this.state.roster.values()).filter(m => m.health > 0).length,
        remainingSwitches: this.getRemainingSwtiches()
      }
    };
  }
}

// Singleton instance
export const monsterInventoryService = new MonsterInventoryService();

// Auto-save inventory state every 30 seconds
setInterval(() => {
  monsterInventoryService.saveInventoryState();
}, 30000);

// Load state on initialization
if (typeof window !== 'undefined') {
  monsterInventoryService.loadInventoryState();
}