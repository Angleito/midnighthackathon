import { useState, useEffect, useCallback, useRef } from 'react';
import { initializeCombat, performCombatAction, getCombatSession } from '../lib/combat/engine';
import { PlayerStats, MonsterStats, CombatAction, MonsterInventory } from '../types/combat';
import { CombatStats, PrivateCombatData, CombatAction as ZKCombatAction } from '../types/zk-types';
import { transactionManager, PendingTransaction, TransactionOptions } from '../services/transactionManager';
import { monsterInventoryService, MonsterSlot } from '../services/monsterInventoryService';
import { midnightService } from '../services/midnightService';

interface CombatState {
  playerStats: PlayerStats | null;
  monsterStats: MonsterStats | null;
  combatLog: string[];
  isCombatActive: boolean;
  sessionId: bigint | null;
  currentTurn: number;
  lastActionBlock: bigint;
  combatStartTime: number;
}

interface TransactionState {
  pendingTransactions: Map<string, PendingTransaction>;
  isProcessingAction: boolean;
  lastTransactionId: string | null;
  optimisticUpdates: Map<string, any>;
}

interface MonsterSwitchState {
  inventory: MonsterInventory;
  activeMonster: MonsterSlot | null;
  benchMonsters: MonsterSlot[];
  canSwitch: boolean;
  switchCooldown: number;
  remainingSwitches: number;
  isAutoSwitching: boolean;
}

interface CombatTiming {
  turnStartTime: number;
  turnTimeoutMs: number;
  warningTimeMs: number;
  showTimeoutWarning: boolean;
  blocksPerTurn: number;
}

export const useCombat = (playerId: string, monsterId: string) => {
    // Core combat state
    const [combatState, setCombatState] = useState<CombatState>({
        playerStats: null,
        monsterStats: null,
        combatLog: [],
        isCombatActive: false,
        sessionId: null,
        currentTurn: 0,
        lastActionBlock: 0n,
        combatStartTime: 0
    });

    // Transaction management state
    const [transactionState, setTransactionState] = useState<TransactionState>({
        pendingTransactions: new Map(),
        isProcessingAction: false,
        lastTransactionId: null,
        optimisticUpdates: new Map()
    });

    // Monster switching state
    const [monsterSwitchState, setMonsterSwitchState] = useState<MonsterSwitchState>({
        inventory: {
            activeMonster: { health: 0, attackPower: 0, defense: 0, speed: 0, magicAttack: 0, magicDefense: 0 },
            benchMonsters: [],
            switchCooldown: 0,
            switchesUsed: 0
        },
        activeMonster: null,
        benchMonsters: [],
        canSwitch: false,
        switchCooldown: 0,
        remainingSwitches: 0,
        isAutoSwitching: false
    });

    // Combat timing state
    const [combatTiming, setCombatTiming] = useState<CombatTiming>({
        turnStartTime: 0,
        turnTimeoutMs: 60000, // 60 seconds per turn
        warningTimeMs: 15000, // Warning at 15 seconds remaining
        showTimeoutWarning: false,
        blocksPerTurn: 10 // Estimated blocks per turn
    });

    // Error handling
    const [error, setError] = useState<string | null>(null);
    const [isRecovering, setIsRecovering] = useState<boolean>(false);

    // Refs for cleanup
    const unsubscribeRef = useRef<(() => void) | null>(null);
    const timeoutWarningRef = useRef<NodeJS.Timeout | null>(null);
    const stateRefreshRef = useRef<NodeJS.Timeout | null>(null);

    // Helper function to convert CombatAction string to ZKCombatAction enum
    const convertToZKAction = useCallback((action: CombatAction): ZKCombatAction => {
        switch (action) {
            case 'attack': return ZKCombatAction.Attack;
            case 'magic': return ZKCombatAction.Magic;
            case 'defend': return ZKCombatAction.Defend;
            case 'flee': return ZKCombatAction.Flee;
            case 'switch': return ZKCombatAction.SwitchMonster;
            default: return ZKCombatAction.Attack;
        }
    }, []);

    // Initialize combat with comprehensive setup
    const initializeCombatSession = useCallback(async () => {
        try {
            setError(null);
            setIsRecovering(false);
            
            // Initialize monster inventory for combat
            const inventoryState = monsterInventoryService.getInventoryState();
            const activeMonster = monsterInventoryService.getActiveMonster();
            const benchMonsters = monsterInventoryService.getBenchMonsters();
            
            if (!activeMonster) {
                throw new Error('No active monster available for combat');
            }

            // Initialize combat via TransactionManager
            const playerStats = monsterInventoryService.convertToZKStats(activeMonster.monster);
            const benchStats = benchMonsters.map(m => monsterInventoryService.convertToZKStats(m.monster));
            
            // Generate commitment for enemy stats
            const enemyCommitment = BigInt(Math.floor(Math.random() * 1000000000));
            const commitmentNonce = BigInt(Math.floor(Math.random() * 1000000000));
            
            const transactionId = await transactionManager.submitCombatInit(
                playerStats,
                benchStats,
                enemyCommitment,
                commitmentNonce
            );

            // Subscribe to transaction updates
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
            }
            unsubscribeRef.current = transactionManager.subscribe(handleTransactionUpdate);

            // Get combat data from engine
            const combatData = await initializeCombat(playerId, monsterId);
            
            // Start combat session in inventory service
            await monsterInventoryService.startCombatSession(combatData.sessionId);
            
            // Convert stats for UI
            const playerStatsConverted: PlayerStats = {
                health: Number(combatData.player.health),
                attackPower: Number(combatData.player.attackPower),
                defense: Number(combatData.player.defense),
                speed: Number(combatData.player.speed),
                magicAttack: Number(combatData.player.magicAttack),
                magicDefense: Number(combatData.player.magicDefense)
            };
            
            const monsterStatsConverted: MonsterStats = {
                name: 'Sea Monster',
                health: Number(combatData.monster.health || 100n),
                attackPower: Number(combatData.monster.attackPower),
                defense: Number(combatData.monster.defense),
                speed: Number(combatData.monster.speed),
                magicAttack: Number(combatData.monster.magicAttack),
                magicDefense: Number(combatData.monster.magicDefense)
            };
            
            // Update all state
            setCombatState({
                playerStats: playerStatsConverted,
                monsterStats: monsterStatsConverted,
                combatLog: ['Combat initiated! Choose your action.'],
                isCombatActive: true,
                sessionId: combatData.sessionId,
                currentTurn: 0,
                lastActionBlock: 0n,
                combatStartTime: Date.now()
            });

            setMonsterSwitchState({
                inventory: inventoryState,
                activeMonster,
                benchMonsters,
                canSwitch: benchMonsters.length > 0,
                switchCooldown: monsterInventoryService.getSwitchCooldown(),
                remainingSwitches: monsterInventoryService.getRemainingSwtiches(),
                isAutoSwitching: false
            });

            setCombatTiming(prev => ({
                ...prev,
                turnStartTime: Date.now()
            }));

            // Set up turn timeout warning
            setupTurnTimeout();
            
            console.log('Combat session initialized successfully:', combatData.sessionId);
        } catch (error) {
            console.error('Failed to initialize combat:', error);
            setError(error instanceof Error ? error.message : 'Failed to initialize combat');
        }
    }, [playerId, monsterId]);

    useEffect(() => {
        initializeCombatSession();
        
        return () => {
            // Cleanup subscriptions and timeouts
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
            }
            if (timeoutWarningRef.current) {
                clearTimeout(timeoutWarningRef.current);
            }
            if (stateRefreshRef.current) {
                clearTimeout(stateRefreshRef.current);
            }
        };
    }, [initializeCombatSession]);

    // Handle transaction updates from TransactionManager
    const handleTransactionUpdate = useCallback((transaction: PendingTransaction) => {
        setTransactionState(prev => {
            const newPending = new Map(prev.pendingTransactions);
            newPending.set(transaction.id, transaction);
            
            return {
                ...prev,
                pendingTransactions: newPending,
                lastTransactionId: transaction.id
            };
        });

        // Handle transaction confirmation
        if (transaction.status === 'confirmed') {
            handleTransactionConfirmed(transaction);
        } else if (transaction.status === 'failed') {
            handleTransactionFailed(transaction);
        }
    }, []);

    // Handle confirmed transactions
    const handleTransactionConfirmed = useCallback(async (transaction: PendingTransaction) => {
        try {
            if (transaction.type === 'monster_switch') {
                // Update monster switch state
                const newInventory = monsterInventoryService.getInventoryState();
                const newActiveMonster = monsterInventoryService.getActiveMonster();
                const newBenchMonsters = monsterInventoryService.getBenchMonsters();
                
                setMonsterSwitchState({
                    inventory: newInventory,
                    activeMonster: newActiveMonster,
                    benchMonsters: newBenchMonsters,
                    canSwitch: newBenchMonsters.length > 0,
                    switchCooldown: monsterInventoryService.getSwitchCooldown(),
                    remainingSwitches: monsterInventoryService.getRemainingSwtiches(),
                    isAutoSwitching: false
                });

                setCombatState(prev => ({
                    ...prev,
                    combatLog: [...prev.combatLog, `Switched to ${newActiveMonster?.name || 'Unknown Monster'}!`],
                    playerStats: newActiveMonster ? {
                        health: newActiveMonster.health,
                        attackPower: newActiveMonster.monster.attackPower,
                        defense: newActiveMonster.monster.defense,
                        speed: newActiveMonster.monster.speed,
                        magicAttack: newActiveMonster.monster.magicAttack,
                        magicDefense: newActiveMonster.monster.magicDefense
                    } : prev.playerStats
                }));
            }

            // Refresh combat state from blockchain
            await refreshCombatState();
            
            // Clear optimistic updates
            setTransactionState(prev => ({
                ...prev,
                optimisticUpdates: new Map(),
                isProcessingAction: false
            }));

        } catch (error) {
            console.error('Error handling transaction confirmation:', error);
        }
    }, []);

    // Handle failed transactions
    const handleTransactionFailed = useCallback((transaction: PendingTransaction) => {
        // Rollback optimistic updates
        setTransactionState(prev => {
            const optimisticUpdate = prev.optimisticUpdates.get(transaction.id);
            if (optimisticUpdate) {
                // Restore previous state
                setCombatState(optimisticUpdate.combatState);
                setMonsterSwitchState(optimisticUpdate.monsterSwitchState);
            }
            
            const newOptimistic = new Map(prev.optimisticUpdates);
            newOptimistic.delete(transaction.id);
            
            return {
                ...prev,
                optimisticUpdates: newOptimistic,
                isProcessingAction: false
            };
        });

        setCombatState(prev => ({
            ...prev,
            combatLog: [...prev.combatLog, `Action failed: ${transaction.error || 'Unknown error'}`]
        }));

        setError(transaction.error || 'Transaction failed');
    }, []);

    // Refresh combat state from blockchain
    const refreshCombatState = useCallback(async () => {
        if (!combatState.sessionId) return;

        try {
            const session = await getCombatSession(combatState.sessionId);
            if (session) {
                setCombatState(prev => ({
                    ...prev,
                    playerStats: {
                        health: Number(session.playerHealth),
                        attackPower: Number(session.player.attackPower),
                        defense: Number(session.player.defense),
                        speed: Number(session.player.speed),
                        magicAttack: Number(session.player.magicAttack),
                        magicDefense: Number(session.player.magicDefense)
                    },
                    monsterStats: {
                        name: 'Sea Monster',
                        health: Number(session.monsterHealth),
                        attackPower: Number(session.monster.attackPower),
                        defense: Number(session.monster.defense),
                        speed: Number(session.monster.speed),
                        magicAttack: Number(session.monster.magicAttack),
                        magicDefense: Number(session.monster.magicDefense)
                    },
                    currentTurn: Number(session.turn)
                }));
            }
        } catch (error) {
            console.error('Failed to refresh combat state:', error);
        }
    }, [combatState.sessionId]);

    // Setup turn timeout warning
    const setupTurnTimeout = useCallback(() => {
        if (timeoutWarningRef.current) {
            clearTimeout(timeoutWarningRef.current);
        }

        timeoutWarningRef.current = setTimeout(() => {
            setCombatTiming(prev => ({ ...prev, showTimeoutWarning: true }));
        }, combatTiming.turnTimeoutMs - combatTiming.warningTimeMs);
    }, [combatTiming.turnTimeoutMs, combatTiming.warningTimeMs]);

    // Handle combat actions with transaction management
    const handleAction = useCallback(async (action: CombatAction) => {
        if (!combatState.isCombatActive || !combatState.playerStats || !combatState.monsterStats || !combatState.sessionId) {
            return;
        }

        if (transactionState.isProcessingAction) {
            console.warn('Action already in progress, please wait...');
            return;
        }

        try {
            setError(null);
            setTransactionState(prev => ({ ...prev, isProcessingAction: true }));

            // Generate private damage data
            const privateDamageData: PrivateCombatData = {
                playerSecretSeed: BigInt(Math.floor(Math.random() * 1000000)),
                monsterSecretSeed: BigInt(Math.floor(Math.random() * 1000000)),
                damageRoll: BigInt(Math.floor(Math.random() * 100)),
                criticalChance: BigInt(25)
            };

            // Enemy stats for ZK proof
            const enemyStats: CombatStats = {
                health: BigInt(combatState.monsterStats.health),
                attackPower: BigInt(combatState.monsterStats.attackPower),
                defense: BigInt(combatState.monsterStats.defense),
                speed: BigInt(combatState.monsterStats.speed),
                magicAttack: BigInt(combatState.monsterStats.magicAttack),
                magicDefense: BigInt(combatState.monsterStats.magicDefense)
            };

            // Store current state for potential rollback
            const rollbackState = {
                combatState: { ...combatState },
                monsterSwitchState: { ...monsterSwitchState }
            };

            // Submit transaction via TransactionManager
            const transactionId = await transactionManager.submitCombatAction(
                combatState.sessionId,
                convertToZKAction(action),
                privateDamageData,
                enemyStats
            );

            // Store optimistic update for rollback
            setTransactionState(prev => {
                const newOptimistic = new Map(prev.optimisticUpdates);
                newOptimistic.set(transactionId, rollbackState);
                return {
                    ...prev,
                    optimisticUpdates: newOptimistic
                };
            });

            // Optimistic update (will be confirmed or rolled back)
            setCombatState(prev => ({
                ...prev,
                combatLog: [...prev.combatLog, `Performing ${action}... (Transaction pending)`],
                currentTurn: prev.currentTurn + 1
            }));

            // Reset turn timeout
            setCombatTiming(prev => ({
                ...prev,
                turnStartTime: Date.now(),
                showTimeoutWarning: false
            }));
            
            // Setup new turn timeout
            if (timeoutWarningRef.current) {
                clearTimeout(timeoutWarningRef.current);
            }
            timeoutWarningRef.current = setTimeout(() => {
                setCombatTiming(prev => ({ ...prev, showTimeoutWarning: true }));
            }, combatTiming.turnTimeoutMs - combatTiming.warningTimeMs);

        } catch (error) {
            console.error('Failed to perform combat action:', error);
            setError(error instanceof Error ? error.message : 'Combat action failed');
            setTransactionState(prev => ({ ...prev, isProcessingAction: false }));
            setCombatState(prev => ({
                ...prev,
                combatLog: [...prev.combatLog, 'Action failed!']
            }));
        }
    }, [combatState, monsterSwitchState, transactionState.isProcessingAction, convertToZKAction]);

    // Handle monster switching
    const handleMonsterSwitch = useCallback(async (targetMonsterId: string) => {
        if (!combatState.sessionId || !monsterSwitchState.activeMonster) {
            return;
        }

        if (transactionState.isProcessingAction) {
            console.warn('Action already in progress, please wait...');
            return;
        }

        try {
            setError(null);
            setTransactionState(prev => ({ ...prev, isProcessingAction: true }));

            // Get current block number (simulated)
            const currentBlock = BigInt(Date.now() / 1000); // Simplified block simulation

            // Validate switch
            const validation = monsterInventoryService.validateSwitch(
                monsterSwitchState.activeMonster.id,
                targetMonsterId,
                currentBlock
            );

            if (!validation.valid) {
                throw new Error(validation.reason);
            }

            // Submit monster switch transaction
            const transactionId = await transactionManager.submitMonsterSwitch(
                combatState.sessionId,
                parseInt(targetMonsterId), // Convert to monster index
                {}
            );

            // Optimistic update
            setCombatState(prev => ({
                ...prev,
                combatLog: [...prev.combatLog, 'Switching monster... (Transaction pending)']
            }));

            setMonsterSwitchState(prev => ({ ...prev, isAutoSwitching: true }));

        } catch (error) {
            console.error('Failed to switch monster:', error);
            setError(error instanceof Error ? error.message : 'Monster switch failed');
            setTransactionState(prev => ({ ...prev, isProcessingAction: false }));
        }
    }, [combatState.sessionId, monsterSwitchState.activeMonster, transactionState.isProcessingAction]);

    // Auto-switch when active monster faints
    const checkAutoSwitch = useCallback(async () => {
        if (!combatState.sessionId || !monsterSwitchState.activeMonster || monsterSwitchState.isAutoSwitching) {
            return;
        }

        if (combatState.playerStats && combatState.playerStats.health <= 0) {
            try {
                const currentBlock = BigInt(Date.now() / 1000);
                const newActiveMonster = await monsterInventoryService.checkAutoSwitch(currentBlock, playerId);
                
                if (newActiveMonster) {
                    setCombatState(prev => ({
                        ...prev,
                        combatLog: [...prev.combatLog, `${monsterSwitchState.activeMonster?.name} fainted! Automatically switching to ${newActiveMonster.name}.`],
                        playerStats: {
                            health: newActiveMonster.health,
                            attackPower: newActiveMonster.monster.attackPower,
                            defense: newActiveMonster.monster.defense,
                            speed: newActiveMonster.monster.speed,
                            magicAttack: newActiveMonster.monster.magicAttack,
                            magicDefense: newActiveMonster.monster.magicDefense
                        }
                    }));
                }
            } catch (error) {
                console.error('Auto-switch failed:', error);
                setCombatState(prev => ({
                    ...prev,
                    combatLog: [...prev.combatLog, 'All monsters fainted! Combat ended.'],
                    isCombatActive: false
                }));
            }
        }
    }, [combatState.sessionId, combatState.playerStats, monsterSwitchState.activeMonster, monsterSwitchState.isAutoSwitching, playerId]);

    // Check for auto-switch when player health changes
    useEffect(() => {
        checkAutoSwitch();
    }, [combatState.playerStats?.health, checkAutoSwitch]);

    // End combat session
    const endCombat = useCallback(async () => {
        if (combatState.sessionId) {
            await monsterInventoryService.endCombatSession();
        }
        
        setCombatState(prev => ({
            ...prev,
            isCombatActive: false
        }));

        if (timeoutWarningRef.current) {
            clearTimeout(timeoutWarningRef.current);
        }
    }, [combatState.sessionId]);

    // Recovery mechanism for failed states
    const recoverCombatState = useCallback(async () => {
        if (isRecovering) return;
        
        setIsRecovering(true);
        try {
            await refreshCombatState();
            
            // Refresh monster inventory
            const newInventory = monsterInventoryService.getInventoryState();
            const newActiveMonster = monsterInventoryService.getActiveMonster();
            const newBenchMonsters = monsterInventoryService.getBenchMonsters();
            
            setMonsterSwitchState({
                inventory: newInventory,
                activeMonster: newActiveMonster,
                benchMonsters: newBenchMonsters,
                canSwitch: newBenchMonsters.length > 0,
                switchCooldown: monsterInventoryService.getSwitchCooldown(),
                remainingSwitches: monsterInventoryService.getRemainingSwtiches(),
                isAutoSwitching: false
            });
            
            setError(null);
        } catch (error) {
            console.error('Recovery failed:', error);
        } finally {
            setIsRecovering(false);
        }
    }, [isRecovering, refreshCombatState]);

    return {
        // Core combat state
        playerStats: combatState.playerStats,
        monsterStats: combatState.monsterStats,
        combatLog: combatState.combatLog,
        isCombatActive: combatState.isCombatActive,
        sessionId: combatState.sessionId,
        currentTurn: combatState.currentTurn,
        
        // Actions
        handleAction,
        handleMonsterSwitch,
        endCombat,
        recoverCombatState,
        
        // Transaction state
        pendingTransactions: Array.from(transactionState.pendingTransactions.values()),
        isProcessingAction: transactionState.isProcessingAction,
        lastTransactionId: transactionState.lastTransactionId,
        
        // Monster switching
        inventory: monsterSwitchState.inventory,
        activeMonster: monsterSwitchState.activeMonster,
        benchMonsters: monsterSwitchState.benchMonsters,
        canSwitch: monsterSwitchState.canSwitch,
        switchCooldown: monsterSwitchState.switchCooldown,
        remainingSwitches: monsterSwitchState.remainingSwitches,
        isAutoSwitching: monsterSwitchState.isAutoSwitching,
        
        // Combat timing
        turnStartTime: combatTiming.turnStartTime,
        turnTimeoutMs: combatTiming.turnTimeoutMs,
        showTimeoutWarning: combatTiming.showTimeoutWarning,
        
        // Error handling
        error,
        isRecovering,
        
        // Transaction helpers
        getTransactionStatus: (id: string) => transactionManager.getTransactionStatus(id),
        getSessionTransactions: () => combatState.sessionId ? transactionManager.getSessionTransactions(combatState.sessionId) : [],
        cancelTransaction: (id: string) => transactionManager.cancelTransaction(id)
    };
};

// Default export if needed
export default useCombat;