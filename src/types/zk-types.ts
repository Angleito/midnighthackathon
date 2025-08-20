// Centralized ZK types for the application

export interface CombatStats {
  health: bigint;
  attackPower: bigint;
  defense: bigint;
  speed: bigint;
  magicAttack: bigint;
  magicDefense: bigint;
}

export enum CombatAction {
  Attack = 0,
  Magic = 1,
  Defend = 2,
  Flee = 3,
  SwitchMonster = 4
}

export interface CombatResult {
  playerDamage: bigint;
  monsterDamage: bigint;
  isPlayerTurn: boolean;
  isCombatEnded: boolean;
  playerWon: boolean;
  transactionId?: string;
  blockNumber?: number;
  randomnessSeed?: string;
  switchedMonster?: string;
}

export interface PrivateCombatData {
  playerSecretSeed: bigint;
  monsterSecretSeed: bigint;
  damageRoll: bigint;
  criticalChance: bigint;
}

export interface PlayerProfile {
  address: string;
  level: bigint;
  experience: bigint;
  totalCombatsWon: bigint;
  totalCombatsLost: bigint;
  baseStats: CombatStats;
  statPoints: bigint;
  lastCombatBlock: bigint;
}

export interface LootDrop {
  itemIds: bigint[];
  experienceGained: bigint;
  goldGained: bigint;
}

export interface StatUpgradeProof {
  playerAddress: string;
  newStats: CombatStats;
  pointsSpent: bigint;
  secretSalt: bigint;
}