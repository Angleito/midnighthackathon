# Monster Inventory Management System

## Overview

The Monster Inventory Management System is a comprehensive solution for managing monster rosters, switching, and combat integration in the ZK Ocean Combat game. It provides privacy-preserving monster management with ZK proof integration and implements sophisticated switching mechanics with cooldowns and constraints.

## Core Components

### 1. MonsterInventoryService (`src/services/monsterInventoryService.ts`)

The main service responsible for:
- **Monster Roster Management**: Manage up to 6 monsters (1 active + 5 bench)
- **Switch Validation**: Enforce switching rules and cooldowns
- **Monster Stats Management**: Handle health, leveling, and stat updates
- **ZK Integration**: Convert between regular and ZK-compatible stat formats
- **Persistence**: Save/load inventory state to localStorage

#### Key Features:
- **Maximum Roster Size**: 6 monsters total
- **Switch Constraints**: Max 3 switches per combat, 5-block cooldown
- **Auto-Switch**: Automatic switching when active monster faints
- **Privacy Integration**: Uses commitment proofs for switch actions

### 2. CombatIntegrationService (`src/services/combatIntegrationService.ts`)

Integration layer that connects inventory management with combat systems:
- **Combat Session Management**: Extended combat sessions with inventory state
- **Action Coordination**: Handle regular combat actions + monster switching
- **ZK Proof Generation**: Generate proofs for switch actions
- **Block Simulation**: Simulate blockchain block progression for cooldowns

### 3. Privacy Integration

The system integrates with the existing `PrivacyService` to ensure:
- **Switch Action Commitments**: Generate ZK proofs for monster switches
- **Stat Privacy**: Hide actual monster stats until reveal phase
- **Combat Privacy**: Maintain privacy during combat actions

## Monster Switching Mechanics

### Switch Constraints

```typescript
interface SwitchConstraints {
  maxSwitchesPerCombat: 3;      // Maximum switches per combat session
  switchCooldownBlocks: 5;      // Blocks before monster can be switched again
  mustBeAlive: true;            // Can only switch to alive monsters
  turnCost: 1;                  // Switching costs a turn
}
```

### Switch Validation Process

1. **Session Check**: Must be in active combat session
2. **Switch Limit**: Cannot exceed 3 switches per combat
3. **Monster Validation**: Source and target monsters must exist
4. **Health Check**: Target monster must be alive (health > 0)
5. **Cooldown Check**: Target monster must not be on cooldown
6. **Active State**: Cannot switch to already active monster

### Switch Action Flow

```typescript
// 1. Validate switch
const validation = monsterInventoryService.validateSwitch(fromId, toId, currentBlock);

// 2. Generate ZK proof
const commitmentProof = await privacyService.generateActionCommitment(
  playerId, sessionId, switchAction, secretSalt
);

// 3. Execute switch
const switchAction = await monsterInventoryService.performSwitch(
  fromId, toId, sessionId, currentBlock, playerId
);

// 4. Update combat state
// Switch counts as a turn in combat
```

## ZK Privacy Features

### Commitment Scheme for Switches

Monster switches use a commit-reveal scheme to maintain privacy:

1. **Commit Phase**: Generate commitment hash for switch action
2. **Proof Generation**: Create ZK proof of commitment knowledge
3. **Reveal Phase**: Reveal actual switch after action resolution

```typescript
// Generate commitment for switch action
const commitmentProof = await privacyService.generateActionCommitment(
  playerId,
  sessionId,
  CombatAction.SwitchMonster, // Action = 4
  secretSalt
);
```

### Stat Conversion

The system provides seamless conversion between regular and ZK stat formats:

```typescript
// Convert to ZK format for blockchain operations
const zkStats = monsterInventoryService.convertToZKStats(monster.stats);

// Convert back for UI display
const regularStats = monsterInventoryService.convertFromZKStats(zkStats);
```

## Usage Examples

### Basic Inventory Management

```typescript
import { monsterInventoryService } from './services/monsterInventoryService';

// Add a new monster
const monsterId = await monsterInventoryService.addMonster(
  { health: 120, attackPower: 25, defense: 18, speed: 22, magicAttack: 20, magicDefense: 15 },
  'Deep Sea Kraken',
  2 // level
);

// Get current inventory state
const inventory = monsterInventoryService.getInventoryState();
console.log('Active monster:', inventory.activeMonster);
console.log('Bench monsters:', inventory.benchMonsters);
```

### Combat Integration

```typescript
import { combatIntegrationService } from './services/combatIntegrationService';
import { CombatAction } from './types/zk-types';

// Initialize combat with inventory
const session = await combatIntegrationService.initializeCombatWithInventory(
  playerAddress,
  monsterSeed
);

// Perform monster switch during combat
const result = await combatIntegrationService.performCombatAction(
  CombatAction.SwitchMonster,
  targetMonsterId
);

// Continue with regular combat actions
const attackResult = await combatIntegrationService.performCombatAction(
  CombatAction.Attack
);
```

### Switch Validation

```typescript
// Check if a switch is valid
const validation = monsterInventoryService.validateSwitch(
  activeMonster.id,
  targetMonster.id,
  currentBlock
);

if (!validation.valid) {
  console.error('Switch not allowed:', validation.reason);
}

// Get available switch targets
const targets = combatIntegrationService.getAvailableSwitchTargets();
```

## State Management

### Inventory State Structure

```typescript
interface InventoryState {
  activeSlot: string;                    // ID of active monster
  roster: Map<string, MonsterSlot>;      // All monsters in roster
  switchesUsedThisCombat: number;        // Switches used in current combat
  combatSessionId: bigint | null;        // Current combat session ID
  lastActionBlock: bigint;               // Last action block number
  inventoryVersion: number;              // State version for optimization
}
```

### Monster Slot Structure

```typescript
interface MonsterSlot {
  id: string;                   // Unique monster identifier
  monster: PlayerStats;         // Monster combat stats
  name: string;                 // Display name
  isActive: boolean;            // Currently active in combat
  health: number;               // Current health
  maxHealth: number;            // Maximum health
  level: number;                // Monster level
  experience: number;           // Current experience points
  lastSwitchBlock: bigint;      // Last block when switched
  switchCooldownBlocks: number; // Remaining cooldown blocks
}
```

## Persistence and State Management

### Auto-Save Features

The system automatically saves inventory state:
- **Interval Saving**: Every 30 seconds
- **Action Triggers**: After each significant change
- **Local Storage**: Persists to browser localStorage

### State Loading

```typescript
// Load saved state on initialization
const loaded = monsterInventoryService.loadInventoryState();

// Export for debugging
const exportData = monsterInventoryService.exportInventoryData();
```

## Integration with Existing Systems

### Midnight Service Integration

The inventory system integrates with the existing `MidnightService`:
- Uses existing combat initialization
- Leverages ZK proof generation
- Maintains compatibility with wallet service

### Privacy Service Integration

Extends the `PrivacyService` for switch-specific privacy:
- Action commitments for switches
- Reveal mechanisms for combat end
- Stat hiding during combat

### Contract Compatibility

Designed for compatibility with the ZKCombat.compact contract:
- Switch actions encoded as CombatAction.SwitchMonster (4)
- ZK proofs generated for all switch operations
- Commitment-reveal pattern for action privacy

## Advanced Features

### Auto-Switch on Monster Fainting

```typescript
// Automatically switch when active monster faints
const switchedMonster = await monsterInventoryService.checkAutoSwitch(
  currentBlock,
  playerId
);
```

### Monster Leveling System

```typescript
// Award experience and handle level ups
const leveledUp = await monsterInventoryService.levelUpMonster(
  monsterId,
  experienceGained
);

if (leveledUp) {
  // Monster stats automatically increased
}
```

### Healing and Recovery

```typescript
// Heal individual monster
await monsterInventoryService.healMonster(monsterId, healAmount);

// Heal all monsters (out of combat only)
await combatIntegrationService.healAllMonsters();
```

## Error Handling

The system provides comprehensive error handling:

```typescript
try {
  await monsterInventoryService.performSwitch(fromId, toId, sessionId, block, playerId);
} catch (error) {
  // Specific error messages for different failure cases:
  // - "Maximum switches per combat reached"
  // - "Target monster is fainted and cannot battle"
  // - "Monster is on cooldown. X blocks remaining"
  // - "Not in combat session"
}
```

## Testing

Comprehensive examples are provided in `src/examples/monsterInventoryExample.ts`:

```typescript
import { monsterInventoryTests } from './examples/monsterInventoryExample';

// Run full system demonstration
await monsterInventoryTests.runFullExample();

// Test specific features
await monsterInventoryTests.testSwitchValidation();
await monsterInventoryTests.testCombatScenario();
```

## Future Enhancements

### Planned Features

1. **Monster Types**: Elemental types with effectiveness bonuses
2. **Equipment System**: Items that modify monster stats
3. **Formation System**: Position-based bonuses
4. **Advanced AI**: Smart auto-switching based on combat state
5. **Breeding System**: Create new monsters from existing ones

### Scalability Considerations

- **Batch Operations**: Group multiple monster operations
- **State Compression**: Optimize state storage for larger rosters
- **Lazy Loading**: Load monster data on demand
- **Cache Management**: Intelligent caching for frequently accessed monsters

## Security Considerations

### ZK Privacy Guarantees

- **Stat Privacy**: Monster stats hidden until combat resolution
- **Action Privacy**: Switch intentions hidden via commitments
- **Timing Privacy**: Switch cooldowns prevent information leakage

### Validation Security

- **Client-Side Validation**: Immediate feedback for invalid operations
- **Server-Side Verification**: All operations verified on blockchain
- **Replay Protection**: Prevent duplicate switch actions
- **Cooldown Enforcement**: Blockchain-enforced cooldown periods

This comprehensive monster inventory system provides a solid foundation for sophisticated monster management while maintaining the privacy and security requirements of the ZK Ocean Combat game.