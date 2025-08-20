import { useState, useEffect, useCallback } from 'react';
import { monsterInventoryService, MonsterSlot } from '../services/monsterInventoryService';
import { transactionManager, PendingTransaction } from '../services/transactionManager';

interface MonsterSwitchingState {
  activeMonster: MonsterSlot | null;
  benchMonsters: MonsterSlot[];
  allMonsters: MonsterSlot[];
  switchesUsed: number;
  maxSwitches: number;
  switchCooldown: number;
  isTransactionPending: boolean;
  pendingTransactionId: string | null;
  error: string | null;
}

export const useMonsterSwitching = (sessionId: bigint | null, playerId: string) => {
  const [state, setState] = useState<MonsterSwitchingState>({
    activeMonster: null,
    benchMonsters: [],
    allMonsters: [],
    switchesUsed: 0,
    maxSwitches: 3,
    switchCooldown: 0,
    isTransactionPending: false,
    pendingTransactionId: null,
    error: null
  });

  // Load initial monster data
  const loadMonsterData = useCallback(() => {
    try {
      const activeMonster = monsterInventoryService.getActiveMonster();
      const benchMonsters = monsterInventoryService.getBenchMonsters();
      const allMonsters = monsterInventoryService.getAllMonsters();
      const inventory = monsterInventoryService.getInventoryState();

      setState(prev => ({
        ...prev,
        activeMonster,
        benchMonsters,
        allMonsters,
        switchesUsed: inventory.switchesUsed,
        switchCooldown: inventory.switchCooldown,
        error: null
      }));
    } catch (error) {
      console.error('Failed to load monster data:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load monster data'
      }));
    }
  }, []);

  // Initialize monster inventory for combat session
  const initializeCombatSession = useCallback(async (combatSessionId: bigint) => {
    try {
      await monsterInventoryService.startCombatSession(combatSessionId);
      loadMonsterData();
    } catch (error) {
      console.error('Failed to initialize combat session:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to initialize combat session'
      }));
    }
  }, [loadMonsterData]);

  // Perform monster switch
  const performSwitch = useCallback(async (targetMonster: MonsterSlot): Promise<void> => {
    if (!sessionId) {
      throw new Error('No active combat session');
    }

    if (!state.activeMonster) {
      throw new Error('No active monster to switch from');
    }

    if (state.isTransactionPending) {
      throw new Error('Another transaction is already pending');
    }

    try {
      setState(prev => ({
        ...prev,
        isTransactionPending: true,
        error: null
      }));

      // Get current block number (simulation)
      const currentBlock = BigInt(Date.now() % 1000000);

      // Validate the switch using the service
      const validation = monsterInventoryService.validateSwitch(
        state.activeMonster.id,
        targetMonster.id,
        currentBlock
      );

      if (!validation.valid) {
        throw new Error(validation.reason || 'Switch validation failed');
      }

      // Submit monster switch transaction
      const transactionId = await transactionManager.submitMonsterSwitch(
        sessionId,
        parseInt(targetMonster.id.split('_')[1] || '0') // Extract index from ID
      );

      setState(prev => ({
        ...prev,
        pendingTransactionId: transactionId
      }));

      // Perform the actual switch in the service
      await monsterInventoryService.performSwitch(
        state.activeMonster.id,
        targetMonster.id,
        sessionId,
        currentBlock,
        playerId
      );

      // Reload monster data to reflect changes
      loadMonsterData();

    } catch (error) {
      console.error('Monster switch failed:', error);
      setState(prev => ({
        ...prev,
        isTransactionPending: false,
        pendingTransactionId: null,
        error: error instanceof Error ? error.message : 'Switch failed'
      }));
      throw error;
    }
  }, [sessionId, state.activeMonster, state.isTransactionPending, playerId, loadMonsterData]);

  // Add a new monster to the roster
  const addMonster = useCallback(async (
    monster: any, 
    name: string, 
    level: number = 1
  ): Promise<string> => {
    try {
      const monsterId = await monsterInventoryService.addMonster(monster, name, level);
      loadMonsterData();
      return monsterId;
    } catch (error) {
      console.error('Failed to add monster:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to add monster'
      }));
      throw error;
    }
  }, [loadMonsterData]);

  // Remove a monster from the roster
  const removeMonster = useCallback(async (monsterId: string): Promise<boolean> => {
    try {
      const result = await monsterInventoryService.removeMonster(monsterId);
      loadMonsterData();
      return result;
    } catch (error) {
      console.error('Failed to remove monster:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to remove monster'
      }));
      throw error;
    }
  }, [loadMonsterData]);

  // Update monster health after combat action
  const updateMonsterHealth = useCallback((monsterId: string, newHealth: number) => {
    try {
      monsterInventoryService.updateMonsterHealth(monsterId, newHealth);
      loadMonsterData();
    } catch (error) {
      console.error('Failed to update monster health:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to update monster health'
      }));
    }
  }, [loadMonsterData]);

  // Check for auto-switch when active monster faints
  const checkAutoSwitch = useCallback(async (): Promise<MonsterSlot | null> => {
    if (!sessionId) return null;

    try {
      const currentBlock = BigInt(Date.now() % 1000000);
      const switchedMonster = await monsterInventoryService.checkAutoSwitch(currentBlock, playerId);
      
      if (switchedMonster) {
        loadMonsterData();
      }
      
      return switchedMonster;
    } catch (error) {
      console.error('Auto-switch failed:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Auto-switch failed'
      }));
      return null;
    }
  }, [sessionId, playerId, loadMonsterData]);

  // End combat session
  const endCombatSession = useCallback(async () => {
    try {
      await monsterInventoryService.endCombatSession();
      loadMonsterData();
    } catch (error) {
      console.error('Failed to end combat session:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to end combat session'
      }));
    }
  }, [loadMonsterData]);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Subscribe to transaction updates
  useEffect(() => {
    if (!state.pendingTransactionId) return;

    const unsubscribe = transactionManager.subscribe((transaction: PendingTransaction) => {
      if (transaction.id === state.pendingTransactionId) {
        if (transaction.status === 'confirmed') {
          setState(prev => ({
            ...prev,
            isTransactionPending: false,
            pendingTransactionId: null
          }));
          loadMonsterData(); // Reload to get updated state
        } else if (transaction.status === 'failed' || transaction.status === 'timeout') {
          setState(prev => ({
            ...prev,
            isTransactionPending: false,
            pendingTransactionId: null,
            error: transaction.error || 'Transaction failed'
          }));
        }
      }
    });

    return unsubscribe;
  }, [state.pendingTransactionId, loadMonsterData]);

  // Load monster data on mount and when sessionId changes
  useEffect(() => {
    loadMonsterData();
  }, [loadMonsterData]);

  // Initialize combat session when sessionId is provided
  useEffect(() => {
    if (sessionId) {
      initializeCombatSession(sessionId);
    }
  }, [sessionId, initializeCombatSession]);

  return {
    // State
    activeMonster: state.activeMonster,
    benchMonsters: state.benchMonsters,
    allMonsters: state.allMonsters,
    switchesUsed: state.switchesUsed,
    maxSwitches: state.maxSwitches,
    switchCooldown: state.switchCooldown,
    isTransactionPending: state.isTransactionPending,
    error: state.error,
    
    // Actions
    performSwitch,
    addMonster,
    removeMonster,
    updateMonsterHealth,
    checkAutoSwitch,
    endCombatSession,
    clearError,
    
    // Utilities
    canSwitch: (monster: MonsterSlot) => {
      return !state.isTransactionPending && 
             monster.health > 0 && 
             state.switchesUsed < state.maxSwitches && 
             state.switchCooldown === 0;
    },
    
    getRemainingSwtiches: () => state.maxSwitches - state.switchesUsed,
    
    getInventoryState: () => monsterInventoryService.getInventoryState()
  };
};

export default useMonsterSwitching;