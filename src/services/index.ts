// Export all services for easy importing
export { monsterInventoryService } from './monsterInventoryService';
export type { 
  MonsterSlot, 
  SwitchConstraints, 
  MonsterSwitchAction, 
  InventoryState 
} from './monsterInventoryService';

export { combatIntegrationService } from './combatIntegrationService';
export type {
  ExtendedCombatSession,
  CombatTurnResult
} from './combatIntegrationService';

export { midnightService } from './midnightService';
export type { CombatSession } from './midnightService';

export { privacyService } from './privacyService';
export type {
  HiddenCombatInfo,
  InventoryItem,
  CommitmentProof,
  ActionCommitment
} from './privacyService';

export { midnightWalletService } from './midnightWalletService';
export type { MidnightWalletState } from './midnightWalletService';

// Re-export existing services for completeness
export { cheatPreventionService } from './cheatPreventionService';
export { transactionManager } from './transactionManager';

// Note: Add other service exports as needed based on their actual export patterns