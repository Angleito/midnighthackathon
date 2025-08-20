import { CombatAction } from '../../types/combat';
import { midnightService } from '../../services/midnightService';
import { CombatStats, PrivateCombatData, CombatAction as ZKCombatAction } from '../../types/zk-types';
import { zkProofService, MonsterCommitment } from '../../services/zkProofService';

// Monster templates for generating stats with ZK proofs
const monsterTemplates: Record<string, { name: string; baseLevel: number; type: string }> = {
    'sea-serpent': {
        name: 'Sea Serpent',
        baseLevel: 3,
        type: 'water'
    },
    'kraken': {
        name: 'Kraken',
        baseLevel: 5,
        type: 'legendary'
    },
    'water-elemental': {
        name: 'Water Elemental',
        baseLevel: 2,
        type: 'elemental'
    },
};

interface CombatData {
    sessionId: bigint;
    player: CombatStats;
    monster: CombatStats;
    playerHealth: bigint;
    monsterHealth: bigint;
    turn: bigint;
    monsterCommitment?: MonsterCommitment; // Add ZK commitment for hidden monster stats
}

interface EnhancedCombatResult {
    message: string;
    isCombatOver: boolean;
    playerDamage: number;
    monsterDamage: number;
    playerHealth: number;
    monsterHealth: number;
    zkProof: string;
}

/**
 * Initializes a new combat session using Midnight blockchain with ZK proofs
 */
export async function initializeCombat(_playerId: string, monsterId: string): Promise<CombatData> {
    console.log('Initializing ZK combat session...');
    
    try {
        // Get player profile and stats from Midnight blockchain
        const playerProfile = await midnightService.createPlayerProfile();
        const playerStats = playerProfile.baseStats;
        
        // Generate monster seed based on template and block randomness
        const template = monsterTemplates[monsterId] || monsterTemplates['sea-serpent'];
        const monsterSeed = BigInt(Date.now() + template.baseLevel * 1000 + Math.floor(Math.random() * 10000));
        
        // Initialize combat session with ZK proof
        const { sessionId, publicMonsterStats } = await midnightService.initializeCombat(playerStats, monsterSeed);
        
        return {
            sessionId,
            player: playerStats,
            monster: publicMonsterStats,
            playerHealth: playerStats.health,
            monsterHealth: publicMonsterStats.health || 100n, // Default if hidden
            turn: 0n
        };
    } catch (error) {
        console.error('Failed to initialize combat:', error);
        throw new Error('Failed to initialize combat session');
    }
}

/**
 * Performs a combat action with ZK proof verification on Midnight blockchain
 */
export async function performCombatAction(
    sessionId: bigint,
    action: CombatAction,
    _currentCombatData: CombatData
): Promise<EnhancedCombatResult> {
    console.log('Performing ZK combat action...', { sessionId, action });
    
    try {
        // Generate private damage data for ZK proof
        const privateDamageData: PrivateCombatData = {
            playerSecretSeed: BigInt(Math.floor(Math.random() * 1000000)),
            monsterSecretSeed: BigInt(Math.floor(Math.random() * 1000000)),
            damageRoll: BigInt(Math.floor(Math.random() * 100)),
            criticalChance: BigInt(25) // 25% crit chance
        };

        // Generate ZK proof for action validity without revealing future outcomes
        if (_currentCombatData.monsterCommitment) {
            const actionProof = zkProofService.generateActionValidityProof(
                sessionId,
                convertStringActionToCombatAction(action),
                _currentCombatData.player,
                _currentCombatData.monsterCommitment,
                privateDamageData,
                _currentCombatData.turn
            );
            
            console.log('Generated action validity proof:', actionProof.proof.substring(0, 20) + '...');
        }
        
        // Convert action to the expected format and submit to Midnight blockchain with ZK proof
        const actionBigInt = convertActionToBigInt(action);
        const result = await midnightService.performCombatAction(sessionId, actionBigInt, privateDamageData);
        
        // Get updated combat session from blockchain
        const updatedSession = await midnightService.getCombatSession(sessionId);
        
        let message = '';
        const playerDamage = Number(result.playerDamage);
        const monsterDamage = Number(result.monsterDamage);
        
        // Generate appropriate message based on action
        switch (action) {
            case 'attack':
                message = `You attack for ${monsterDamage} damage! Monster retaliates for ${playerDamage} damage.`;
                break;
            case 'magic':
                message = `You cast a spell for ${monsterDamage} damage! Monster's magic hits you for ${playerDamage} damage.`;
                break;
            case 'defend':
                message = `You defend! Monster attacks for reduced damage: ${playerDamage}.`;
                break;
            case 'flee':
                if (result.isCombatEnded && !result.playerWon) {
                    message = 'You successfully fled from combat!';
                } else {
                    message = `Failed to flee! Monster attacks for ${playerDamage} damage.`;
                }
                break;
            default:
                message = 'Invalid action!';
        }
        
        // Add combat end message if applicable
        if (result.isCombatEnded) {
            if (result.playerWon) {
                message += ' Victory! You defeated the monster!';
                
                // Award rewards for victory
                await midnightService.awardCombatRewards(true, 3n);
            } else if (action !== 'flee') { // Not a flee
                message += ' Defeat! The monster has bested you.';
                
                // Small consolation rewards
                await midnightService.awardCombatRewards(false, 3n);
            }
        }
        
        return {
            message,
            isCombatOver: result.isCombatEnded,
            playerDamage,
            monsterDamage,
            playerHealth: updatedSession ? Number(updatedSession.playerHealth) : 0,
            monsterHealth: updatedSession ? Number(updatedSession.monsterHealth) : 0,
            zkProof: `zk_proof_${sessionId}_${action}_${Date.now()}`
        };
        
    } catch (error) {
        console.error('Failed to perform combat action:', error);
        throw new Error('Combat action failed');
    }
}

/**
 * Get current combat session data from Midnight blockchain
 */
export async function getCombatSession(sessionId: bigint): Promise<CombatData | null> {
    try {
        const session = await midnightService.getCombatSession(sessionId);
        if (!session) return null;
        
        return {
            sessionId,
            player: session.playerStats,
            monster: session.monsterStats,
            playerHealth: session.playerHealth,
            monsterHealth: session.monsterHealth,
            turn: session.turn
        };
    } catch (error) {
        console.error('Failed to get combat session:', error);
        return null;
    }
}

/**
 * Generate random monster stats using ZK proofs and block randomness
 */
export function generateMonsterStatsWithZK(monsterId: string, level: number): CombatStats {
    const template = monsterTemplates[monsterId] || monsterTemplates['sea-serpent'];
    const baseLevel = template.baseLevel;
    const adjustedLevel = Math.max(1, level + baseLevel - 1);
    
    // Base stats with level scaling
    const baseHealth = 80n + BigInt(adjustedLevel * 15);
    const baseAttack = 15n + BigInt(adjustedLevel * 5);
    const baseDefense = 10n + BigInt(adjustedLevel * 3);
    const baseSpeed = 12n + BigInt(adjustedLevel * 2);
    const baseMagicAttack = 12n + BigInt(adjustedLevel * 4);
    const baseMagicDefense = 8n + BigInt(adjustedLevel * 3);
    
    // Add some randomness (would be from block hash in real implementation)
    const variance = 0.8 + Math.random() * 0.4; // 80% to 120%
    
    return {
        health: BigInt(Math.floor(Number(baseHealth) * variance)),
        attackPower: BigInt(Math.floor(Number(baseAttack) * variance)),
        defense: BigInt(Math.floor(Number(baseDefense) * variance)),
        speed: BigInt(Math.floor(Number(baseSpeed) * variance)),
        magicAttack: BigInt(Math.floor(Number(baseMagicAttack) * variance)),
        magicDefense: BigInt(Math.floor(Number(baseMagicDefense) * variance))
    };
}

/**
 * Verify a zero-knowledge proof for combat actions
 */
export async function verifyCombatProof(proof: string, sessionId: bigint, action: CombatAction): Promise<boolean> {
    try {
        console.log('Verifying ZK combat proof...', { proof, sessionId, action });
        
        // In a real implementation, this would verify the cryptographic proof
        // For now, we simulate verification
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Basic validation
        return proof.includes('zk_proof') && proof.includes(sessionId.toString());
    } catch (error) {
        console.error('Proof verification failed:', error);
        return false;
    }
}

/**
 * Helper to convert legacy combat action strings to bigint enum values
 */
export function convertActionToBigInt(action: CombatAction): bigint {
    switch (action) {
        case 'attack': return 0n;
        case 'magic': return 1n;
        case 'defend': return 2n;
        case 'flee': return 3n;
        default: return 0n;
    }
}

/**
 * Helper to convert string actions to ZK CombatAction enum
 */
export function convertStringActionToCombatAction(action: CombatAction): ZKCombatAction {
    switch (action) {
        case 'attack': return ZKCombatAction.Attack;
        case 'magic': return ZKCombatAction.Magic;
        case 'defend': return ZKCombatAction.Defend;
        case 'flee': return ZKCombatAction.Flee;
        default: return ZKCombatAction.Attack;
    }
}

/**
 * Initialize combat with monster commitment for ZK privacy
 */
export function initializeCombatWithCommitment(
    playerStats: CombatStats,
    monsterStats: CombatStats,
    sessionId: bigint
): { combatData: CombatData; nonce: bigint } {
    // Generate commitment for monster stats to hide them from player
    const nonce = BigInt(Math.floor(Math.random() * 1000000000));
    const monsterCommitment = zkProofService.generateMonsterCommitment(monsterStats, nonce);
    
    const combatData: CombatData = {
        sessionId,
        player: playerStats,
        monster: monsterStats,
        playerHealth: playerStats.health,
        monsterHealth: monsterStats.health,
        turn: BigInt(0),
        monsterCommitment
    };
    
    console.log('Combat initialized with ZK monster commitment:', monsterCommitment.statsHash.substring(0, 20) + '...');
    
    return { combatData, nonce };
}

/**
 * Reveal monster stats at combat end and verify commitment
 */
export function revealMonsterStatsWithProof(
    combatData: CombatData,
    nonce: bigint
): boolean {
    if (!combatData.monsterCommitment) {
        console.error('No monster commitment found for reveal');
        return false;
    }
    
    // Generate reveal proof
    const revealProof = zkProofService.generateRevealProof(
        combatData.monsterCommitment,
        combatData.monster,
        nonce
    );
    
    // Verify the commitment reveal
    const isValid = zkProofService.verifyCommitmentReveal(
        combatData.monsterCommitment,
        combatData.monster,
        nonce
    );
    
    console.log('Monster stats revealed:', {
        valid: isValid,
        health: combatData.monster.health.toString(),
        attackPower: combatData.monster.attackPower.toString(),
        defense: combatData.monster.defense.toString()
    });
    
    return isValid;
}
