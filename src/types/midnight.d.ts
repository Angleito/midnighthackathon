// This file defines TypeScript types for interacting with the Midnight blockchain.

export interface PlayerStats {
    health: number;
    attackPower: number;
    defense: number;
    speed: number;
}

export interface MonsterStats {
    name: string;
    health: number;
    attackPower: number;
    defense: number;
    speed: number;
}

export interface CombatAction {
    type: 'attack' | 'defend' | 'flee' | 'magic';
    target?: string; // Target can be a player or monster
}

export interface CombatSession {
    player: PlayerStats;
    monster: MonsterStats;
    turn: number;
    actions: CombatAction[];
    outcome?: 'victory' | 'defeat' | 'fled';
}