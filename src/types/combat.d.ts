// This file defines TypeScript types for combat-related data structures.

export interface PlayerStats {
    health: number;
    attackPower: number;
    defense: number;
    speed: number;
    magicAttack: number;
    magicDefense: number;
}

export interface MonsterStats {
    name: string;
    health: number;
    attackPower: number;
    defense: number;
    speed: number;
    magicAttack: number;
    magicDefense: number;
}

export type CombatAction = 'attack' | 'magic' | 'defend' | 'flee' | 'switch';

export interface MonsterInventory {
    activeMonster: PlayerStats;
    benchMonsters: PlayerStats[];
    switchCooldown: number;
    switchesUsed: number;
}

export interface CombatSession {
    player: PlayerStats;
    monster: MonsterStats;
    playerInventory?: MonsterInventory;
    turn: number;
    actions: CombatAction[];
    outcome: 'ongoing' | 'victory' | 'defeat' | 'fled';
}