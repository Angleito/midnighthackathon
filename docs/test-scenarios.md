# ZK Ocean Combat - Test Scenarios Documentation

This document outlines the comprehensive test scenarios that verify the ZK Ocean Combat game's integration with the Midnight network, ensuring every turn creates actual blockchain transactions while maintaining privacy and preventing cheating.

## Overview

The test scenarios are designed to validate that the game operates as a fully decentralized application where:

- **Every combat action** creates a real blockchain transaction
- **Monster switching** is handled as on-chain transactions with cooldowns
- **ZK proofs** protect privacy while preventing cheating
- **Block hash randomness** ensures unpredictable outcomes
- **Rate limiting** prevents exploitation and spam

## Test Scenario Categories

### 1. Complete Transaction Flow Scenarios

#### Scenario 1.1: Full Combat Session
**Description**: Tests a complete combat session from initialization to completion with all actions creating blockchain transactions.

**Steps**:
1. Initialize combat session → Creates initialization transaction
2. Perform attack action → Creates action transaction with ZK proof
3. Perform defend action → Creates defensive transaction
4. Perform magic attack → Creates magic transaction with verifiable randomness
5. Switch monster → Creates switch transaction with cooldown enforcement
6. Complete combat → Creates final state commitment transaction

**Expected Results**:
- 6 unique blockchain transactions created
- All transactions have valid hashes and block numbers
- ZK proofs generated and verified for each action
- Privacy maintained throughout (monster stats hidden until reveal)
- State consistency across all services

**Validation Points**:
```typescript
// Each action should create a transaction
expect(result.transactionId).toMatch(/^tx_\d+_[a-z0-9]+$/);
expect(result.blockNumber).toBeGreaterThan(0);
expect(result.randomnessSeed).toBeDefined();

// Privacy validation
expect(publicMonsterStats.health).toBe(0n); // Hidden during combat
expect(commitment.statsHash).toMatch(/^0x[a-f0-9]+$/);
```

#### Scenario 1.2: Transaction Confirmation Flow
**Description**: Verifies that all transactions are properly confirmed and state is updated accordingly.

**Steps**:
1. Submit multiple concurrent actions
2. Monitor transaction status changes
3. Verify confirmation order and timing
4. Validate final state consistency

**Expected Results**:
- All transactions move from 'pending' → 'submitted' → 'confirmed'
- State updates occur only after confirmation
- No orphaned or stuck transactions

#### Scenario 1.3: Transaction Error Recovery
**Description**: Tests system behavior when transactions fail and recovery mechanisms.

**Steps**:
1. Submit action that will fail (network error simulation)
2. Verify rollback of optimistic updates
3. Submit new action to verify recovery
4. Validate system state consistency

**Expected Results**:
- Failed transactions are properly handled
- State is rolled back on failure
- System can recover and continue normal operation

### 2. Monster Switching Transaction Scenarios

#### Scenario 2.1: Basic Monster Switch Transaction
**Description**: Validates that monster switching creates proper blockchain transactions.

**Steps**:
1. Start combat with active monster and bench monsters
2. Initiate monster switch to specific bench monster
3. Verify switch transaction is created and submitted
4. Confirm transaction and validate state change
5. Verify new active monster stats and cooldown enforcement

**Expected Results**:
```typescript
// Switch creates transaction
const transactionId = await transactionManager.submitMonsterSwitch(sessionId, 0);
expect(transactionId).toBeDefined();

// Transaction contains switch data
const transaction = transactionManager.getTransactionStatus(transactionId);
expect(transaction.type).toBe('monster_switch');
expect(transaction.sessionId).toBe(sessionId);

// Monster index encoded in private damage data
expect(privateDamageData.damageRoll).toBe(0n); // Target monster index
```

#### Scenario 2.2: Switch Cooldown Enforcement
**Description**: Tests that switch cooldowns are enforced on-chain and prevent rapid switching.

**Steps**:
1. Perform initial monster switch
2. Immediately attempt second switch
3. Verify second switch is rejected due to cooldown
4. Wait for cooldown period to expire
5. Verify switch is now allowed

**Expected Results**:
- Immediate second switch fails with cooldown error
- Cooldown timer is accurately tracked
- Switch becomes available after cooldown expires
- Cooldown state is persisted across sessions

#### Scenario 2.3: Maximum Switches Enforcement
**Description**: Validates that the maximum number of switches per combat is enforced.

**Steps**:
1. Perform switches up to maximum limit (typically 5)
2. Attempt additional switch beyond limit
3. Verify rejection with appropriate error
4. Start new combat session
5. Verify switch limit is reset

**Expected Results**:
- Switches allowed up to defined limit
- Additional switches rejected with clear error message
- Limit resets properly for new combat sessions

#### Scenario 2.4: Auto-Switch on Monster Faint
**Description**: Tests automatic switching when active monster faints.

**Steps**:
1. Set up combat with low-health active monster
2. Perform action that causes monster to faint
3. Verify auto-switch is triggered
4. Confirm new monster is automatically activated
5. Validate auto-switch creates transaction

**Expected Results**:
- Auto-switch triggers when monster health reaches 0
- New monster is selected from available bench monsters
- Auto-switch creates blockchain transaction
- Combat continues with new active monster

### 3. Anti-Cheat and Privacy Scenarios

#### Scenario 3.1: Block Hash Randomness Verification
**Description**: Ensures that combat outcomes use verifiable block hash randomness to prevent prediction.

**Steps**:
1. Perform combat action and capture block hash used
2. Verify randomness seed is derived from block hash
3. Attempt to predict outcome with same inputs
4. Verify outcomes are deterministic with same block hash
5. Verify different block hashes produce different outcomes

**Expected Results**:
```typescript
// Randomness is verifiable and deterministic
const seed1 = await cheatPreventionService.generateVerifiableRandomnessSeed(
  sessionId, turn, blockHash1, timestamp
);
const seed2 = await cheatPreventionService.generateVerifiableRandomnessSeed(
  sessionId, turn, blockHash1, timestamp
);
expect(seed1).toBe(seed2); // Same inputs = same output

// Different block hashes produce different outcomes
const seed3 = await cheatPreventionService.generateVerifiableRandomnessSeed(
  sessionId, turn, blockHash2, timestamp
);
expect(seed1).not.toBe(seed3);
```

#### Scenario 3.2: Commitment-Reveal Pattern
**Description**: Validates that monster stats are hidden during combat and only revealed at the end.

**Steps**:
1. Initialize combat with monster commitment
2. Verify monster stats are hidden (health = 0 in public view)
3. Perform combat actions without revealing stats
4. Complete combat and trigger reveal
5. Verify revealed stats match original committed stats

**Expected Results**:
- Monster health is hidden (0n) during combat
- Commitment hash is generated and stored
- Reveal proof validates against original commitment
- Full stats are only available after combat ends

#### Scenario 3.3: Rate Limiting and Rapid Action Prevention
**Description**: Tests that rapid actions are prevented through rate limiting.

**Steps**:
1. Perform first combat action
2. Immediately attempt second action (within rate limit window)
3. Verify second action is rejected
4. Wait for rate limit window to expire
5. Verify action is now allowed

**Expected Results**:
- Rapid actions are rejected with rate limit error
- Rate limit timing is enforced accurately
- Actions become available after cooldown
- Rate limiting doesn't affect legitimate gameplay

#### Scenario 3.4: Replay Attack Prevention
**Description**: Ensures that ZK proofs cannot be reused (replay attacks prevented).

**Steps**:
1. Generate ZK proof for combat action
2. Use proof for legitimate action
3. Attempt to reuse same proof for different action
4. Verify replay is detected and rejected
5. Confirm proof uniqueness requirements

**Expected Results**:
- Each proof is unique and tied to specific action
- Proof reuse is detected and prevented
- Nonce tracking prevents replay attacks
- System maintains proof usage history

### 4. Performance and Load Scenarios

#### Scenario 4.1: Concurrent User Load Testing
**Description**: Tests system performance with multiple concurrent users.

**Steps**:
1. Simulate 50 concurrent users
2. Each user performs complete combat session
3. Monitor transaction processing times
4. Verify no transaction conflicts or failures
5. Measure system resource usage

**Expected Results**:
- All users can perform actions concurrently
- Transaction processing times remain under 2 seconds
- No transaction ID collisions
- Memory usage stays within acceptable limits
- Success rate > 90% under load

#### Scenario 4.2: Sustained Load Testing
**Description**: Tests system performance under sustained load over time.

**Steps**:
1. Generate constant load (10 operations/second for 15 seconds)
2. Monitor transaction processing throughout test
3. Measure memory growth and resource usage
4. Verify performance doesn't degrade over time
5. Check for memory leaks or resource accumulation

**Expected Results**:
```typescript
// Performance metrics should remain stable
const averageResponseTime = performance.getAverageMetric('transaction_duration');
expect(averageResponseTime).toBeLessThan(1000); // < 1 second

const memoryGrowth = memory.getMemoryGrowth();
expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024); // < 100MB
```

#### Scenario 4.3: Transaction Spike Handling
**Description**: Tests system behavior during sudden transaction spikes.

**Steps**:
1. Establish baseline load (5 ops/second)
2. Create sudden spike (25 ops/second for 2 seconds)
3. Return to normal load
4. Monitor performance degradation during spike
5. Verify system recovery after spike

**Expected Results**:
- System handles spikes without crashing
- Performance degradation < 3x baseline during spike
- Quick recovery to normal performance after spike
- No lost transactions during spike

### 5. Integration and Service Coordination Scenarios

#### Scenario 5.1: Cross-Service State Synchronization
**Description**: Validates that all services maintain consistent state throughout combat.

**Steps**:
1. Initialize combat across all services
2. Perform actions that affect multiple services
3. Verify state consistency across services
4. Simulate service restart and verify state recovery
5. Test state synchronization under load

**Expected Results**:
- All services have consistent view of game state
- State changes propagate correctly between services
- Service restart doesn't cause state inconsistency
- Recovery mechanisms restore proper state

#### Scenario 5.2: Error Propagation and Recovery
**Description**: Tests how errors in one service affect others and recovery mechanisms.

**Steps**:
1. Start normal combat session
2. Force error in one service (e.g., transaction manager)
3. Verify error handling in dependent services
4. Test recovery mechanisms
5. Verify system returns to normal operation

**Expected Results**:
- Errors are properly isolated to affected services
- Dependent services handle errors gracefully
- Recovery mechanisms restore normal operation
- User experience is minimally impacted

### 6. Privacy Protection Scenarios

#### Scenario 6.1: Data Privacy Verification
**Description**: Ensures that private data is not exposed in transactions or logs.

**Steps**:
1. Generate private damage data with secret seeds
2. Submit transaction with private data
3. Inspect transaction data and logs
4. Verify private seeds are not exposed
5. Confirm only necessary data is public

**Expected Results**:
```typescript
// Private data should not be in transaction logs
expect(transactionLog).not.toContain(privateData.playerSecretSeed.toString());
expect(transactionLog).not.toContain(privateData.monsterSecretSeed.toString());

// Only public commitments should be visible
expect(publicCommitment.statsHash).toBeDefined();
expect(publicCommitment.nonce).toBeDefined();
```

#### Scenario 6.2: ZK Proof Integrity
**Description**: Validates that ZK proofs correctly protect sensitive information.

**Steps**:
1. Generate ZK proof for combat action
2. Verify proof validates correctly
3. Attempt to extract private information from proof
4. Verify proof fails with modified inputs
5. Confirm zero-knowledge property

**Expected Results**:
- Valid proofs pass verification
- Invalid proofs fail verification
- Private information cannot be extracted from proofs
- Proof modification is detected

## Running Test Scenarios

### Command Line Usage

```bash
# Run all scenarios
./scripts/run-comprehensive-tests.sh

# Run specific scenario category
./scripts/test-specific-scenarios.sh transaction-flow
./scripts/test-specific-scenarios.sh monster-switching
./scripts/test-specific-scenarios.sh anti-cheat
./scripts/test-specific-scenarios.sh performance
./scripts/test-specific-scenarios.sh integration
./scripts/test-specific-scenarios.sh privacy

# Run individual test files
npm run test:e2e -- transaction-flow.test.ts
npm run test:e2e -- monster-switching.test.ts
npm run test:e2e -- anti-cheat-privacy.test.ts
```

### Continuous Integration

All scenarios should pass in CI/CD pipeline:

```yaml
# GitHub Actions example
- name: Run Transaction Flow Tests
  run: ./scripts/test-specific-scenarios.sh transaction-flow

- name: Run Monster Switching Tests
  run: ./scripts/test-specific-scenarios.sh monster-switching

- name: Run Anti-Cheat Tests
  run: ./scripts/test-specific-scenarios.sh anti-cheat
```

## Success Criteria

### Functional Requirements
- ✅ All combat actions create blockchain transactions
- ✅ Monster switching operates via on-chain transactions
- ✅ ZK proofs protect privacy and prevent cheating
- ✅ Block hash randomness ensures unpredictable outcomes
- ✅ Rate limiting prevents exploitation

### Performance Requirements
- ✅ Transaction processing < 2 seconds average
- ✅ System supports 20+ concurrent users
- ✅ Memory growth < 100MB during extended sessions
- ✅ 95th percentile response time < 5 seconds

### Security Requirements
- ✅ Private data never exposed in logs or transactions
- ✅ ZK proofs cannot be replayed or forged
- ✅ Monster stats remain hidden during combat
- ✅ Randomness cannot be predicted or manipulated

### Integration Requirements
- ✅ All services maintain consistent state
- ✅ Error recovery mechanisms function correctly
- ✅ Cross-service communication is reliable
- ✅ State synchronization works under load

## Conclusion

These comprehensive test scenarios ensure that ZK Ocean Combat operates as a true blockchain-based game where every action has on-chain consequences while maintaining the privacy and fairness that make zero-knowledge gaming compelling. Regular execution of these scenarios validates the integrity of the Midnight network integration and provides confidence in the game's decentralized architecture.