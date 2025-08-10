import { describe, it, expect } from 'vitest';
import { combatEngine } from '../src/lib/combat/engine';
import { PlayerStats, MonsterStats } from '../src/types/combat';

describe('Combat Engine', () => {
    let player: PlayerStats;
    let monster: MonsterStats;

    beforeEach(() => {
        player = {
            health: 100,
            attackPower: 20,
            defense: 5,
            speed: 10,
        };

        monster = {
            health: 80,
            attackPower: 15,
            defense: 3,
            speed: 8,
        };
    });

    it('should calculate damage correctly', () => {
        const damage = combatEngine.calculateDamage(player, monster);
        expect(damage).toBeGreaterThan(0);
        expect(damage).toBeLessThanOrEqual(player.attackPower);
    });

    it('should reduce monster health after attack', () => {
        combatEngine.attack(player, monster);
        expect(monster.health).toBeLessThan(80);
    });

    it('should not allow player health to go below zero', () => {
        player.health = 5;
        monster.attackPower = 10;
        combatEngine.attack(monster, player);
        expect(player.health).toBe(0);
    });

    it('should determine the winner correctly', () => {
        const result = combatEngine.determineWinner(player, monster);
        expect(result).toBe('Player Wins' || 'Monster Wins' || 'Draw');
    });
});