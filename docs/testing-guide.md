# ZK Ocean Combat - Comprehensive Testing Guide

This guide covers the complete testing infrastructure for the ZK Ocean Combat Midnight network integration, including end-to-end transaction flow testing, monster switching verification, anti-cheat validation, and performance testing.

## Table of Contents

1. [Overview](#overview)
2. [Test Types](#test-types)
3. [Setup and Configuration](#setup-and-configuration)
4. [Running Tests](#running-tests)
5. [Test Coverage](#test-coverage)
6. [Performance Benchmarks](#performance-benchmarks)
7. [Troubleshooting](#troubleshooting)

## Overview

The testing suite is designed to verify that every combat turn, monster switch, and game action creates actual blockchain transactions on the Midnight network while maintaining zero-knowledge privacy and preventing cheating.

### Key Testing Areas

- **Transaction Flow**: Every game action creates verified blockchain transactions
- **Monster Switching**: Blockchain-based monster switching with cooldowns and limits
- **Anti-Cheat Systems**: ZK proofs, block hash randomness, and rate limiting
- **Privacy Protection**: Commitment-reveal patterns and zero-knowledge proofs
- **Performance**: High-load scenarios and resource management
- **Integration**: All services working together seamlessly

## Test Types

### 1. Unit Tests (`npm run test`)
- Individual service functionality
- ZK proof generation and verification
- Transaction manager operations
- Monster inventory management

### 2. Integration Tests (`npm run test:integration`)
- Full combat flow from initialization to completion
- Cross-service communication and state synchronization
- Error handling and recovery mechanisms
- Session lifecycle management

### 3. End-to-End Tests (`npm run test:e2e`)
- Complete transaction flows with Midnight network simulation
- Monster switching as blockchain transactions
- Anti-cheat and privacy verification
- Real-world scenario testing

### 4. Stress Tests (`npm run test:stress`)
- High-volume concurrent transactions
- Multiple simultaneous combat sessions
- Memory leak detection
- Performance under load

### 5. Coverage Tests (`npm run test:coverage`)
- Code coverage analysis
- Test completeness verification
- Missing test identification

## Setup and Configuration

### Prerequisites

1. **Node.js** (v18+ recommended)
2. **npm** or **bun** package manager
3. **Midnight development environment** (optional for full integration)

### Installation

```bash
# Install dependencies
npm install

# Install test-specific dependencies
npm install --save-dev vitest @vitest/ui @vitest/coverage-v8 playwright msw fake-indexeddb
```

### Environment Variables

Create a `.env.test` file for test configuration:

```env
# Test Environment Configuration
VITE_DEV_MODE=true
VITE_E2E_MODE=false
VITE_INTEGRATION_TEST=false
VITE_STRESS_TEST=false

# Midnight Network Configuration
VITE_MIDNIGHT_TESTNET=true
VITE_ZK_COMBAT_CONTRACT_ADDRESS=0xabcdef1234567890abcdef1234567890abcdef12

# Test Performance Thresholds
VITE_MAX_RESPONSE_TIME_MS=5000
VITE_MEMORY_THRESHOLD_MB=100
VITE_MAX_CONCURRENT_USERS=50
```

## Running Tests

### Basic Test Commands

```bash
# Run all unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run with UI interface
npm run test:ui

# Generate coverage report
npm run test:coverage
```

### Specialized Test Suites

```bash
# End-to-End Transaction Flow Tests
npm run test:e2e

# Integration Tests
npm run test:integration

# Performance and Stress Tests
npm run test:stress
```

### Test Configuration Options

```bash
# Run tests with specific timeout
npm run test -- --testTimeout=60000

# Run only specific test files
npm run test -- transaction-flow.test.ts

# Run tests with verbose output
npm run test -- --reporter=verbose

# Run tests in parallel
npm run test -- --threads

# Run tests with coverage threshold
npm run test:coverage -- --coverage.statements=80 --coverage.branches=75
```

## Test Coverage

### Current Coverage Targets

| Component | Statements | Branches | Functions | Lines |
|-----------|------------|----------|-----------|--------|
| Services | 85% | 80% | 90% | 85% |
| Transaction Manager | 90% | 85% | 95% | 90% |
| ZK Proof Service | 88% | 82% | 92% | 88% |
| Anti-Cheat Service | 92% | 88% | 95% | 92% |
| Monster Inventory | 85% | 80% | 90% | 85% |

### Coverage Reports

Coverage reports are generated in multiple formats:

- **HTML Report**: `coverage/index.html`
- **JSON Report**: `coverage/coverage-final.json`
- **Text Report**: Console output during test run

```bash
# View HTML coverage report
npm run test:coverage && open coverage/index.html
```

## Test Scenarios

### 1. Complete Combat Flow Verification

**Test**: `src/tests/e2e/transaction-flow.test.ts`

Verifies that a complete combat session creates proper blockchain transactions:

```typescript
// Example test flow
1. Initialize combat → Blockchain transaction created
2. Perform attack action → Transaction with ZK proof
3. Defend action → Rate-limited transaction
4. Magic attack → Verifiable randomness used
5. Monster switch → Switch transaction with cooldown
6. Combat end → Final state committed to blockchain
```

**Expected Results**:
- All actions create unique transaction IDs
- ZK proofs are generated and verified
- Block hash randomness prevents prediction
- Rate limiting prevents rapid actions
- Final state is consistent across all services

### 2. Monster Switching Transaction Verification

**Test**: `src/tests/e2e/monster-switching.test.ts`

Validates that monster switches are handled as blockchain transactions:

```typescript
// Test scenarios
- Switch during combat creates transaction
- Switch cooldowns are enforced on-chain
- Maximum switches per combat enforced
- Auto-switch on monster faint
- Privacy maintained during switch
- Invalid switches rejected
```

### 3. Anti-Cheat and Privacy Verification

**Test**: `src/tests/e2e/anti-cheat-privacy.test.ts`

Ensures the game prevents cheating and maintains privacy:

```typescript
// Anti-cheat tests
- Block hash randomness verification
- Commitment-reveal pattern validation
- Turn timeout enforcement
- Rate limiting verification
- Replay attack prevention

// Privacy tests
- Monster stats hidden during combat
- Private damage data protection
- ZK proof verification
- Anonymous transaction logs
```

### 4. Performance and Load Testing

**Test**: `src/tests/stress/performance-stress.test.ts`

Validates system performance under various load conditions:

```typescript
// Performance scenarios
- 50 concurrent transactions
- Multiple simultaneous combat sessions
- Sustained load testing (10 ops/sec for 15 seconds)
- Memory leak detection
- Error handling under load
- Resource cleanup verification
```

## Performance Benchmarks

### Expected Performance Metrics

| Metric | Target | Acceptable |
|--------|--------|------------|
| Transaction Response Time | < 1000ms | < 2000ms |
| Combat Action Processing | < 500ms | < 1000ms |
| Monster Switch Time | < 300ms | < 600ms |
| ZK Proof Generation | < 200ms | < 400ms |
| Memory Growth per Operation | < 100KB | < 200KB |
| Concurrent Users Supported | 50+ | 20+ |

### Performance Test Results

Run performance tests to get current benchmarks:

```bash
npm run test:stress
```

Sample output:
```
=== Performance Report ===

transaction_duration:
  Count: 50
  Average: 245.67ms
  Min: 123.45ms
  Max: 456.78ms
  95th percentile: 389.12ms
  99th percentile: 445.67ms

=== Memory Report ===
Initial usage: 45.67 MB
Final usage: 52.34 MB
Memory growth: 6.67 MB
Max usage: 58.91 MB
```

## CI/CD Integration

### GitHub Actions Configuration

Create `.github/workflows/test.yml`:

```yaml
name: Comprehensive Testing

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test
      
      - name: Run integration tests
        run: npm run test:integration
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Generate coverage
        run: npm run test:coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

### Pre-commit Hooks

Set up pre-commit testing with Husky:

```bash
# Install Husky
npm install --save-dev husky

# Set up pre-commit hook
npx husky add .husky/pre-commit "npm run test"
```

## Troubleshooting

### Common Issues

#### 1. Test Timeouts

**Problem**: Tests failing due to timeouts
**Solution**: Increase timeout in test configuration

```typescript
// In test file
it('should handle long operation', async () => {
  // test code
}, 30000); // 30 second timeout

// In vitest config
export default defineConfig({
  test: {
    testTimeout: 60000, // 60 seconds
  },
});
```

#### 2. Memory Issues

**Problem**: Tests failing due to memory constraints
**Solution**: Increase Node.js memory limit

```bash
# Increase memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
npm run test:stress
```

#### 3. Network Mocking Issues

**Problem**: Real network requests in tests
**Solution**: Verify MSW setup

```typescript
// Ensure MSW is properly configured
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const server = setupServer(
  http.post('/api/*', () => HttpResponse.json({ success: true }))
);
```

#### 4. Transaction State Issues

**Problem**: Inconsistent transaction states
**Solution**: Ensure proper cleanup

```typescript
afterEach(async () => {
  // Clean up pending transactions
  await transactionManager.cancelAllPending();
  
  // Reset service states
  await midnightService.cleanupOldSessions();
  await monsterInventoryService.reset();
});
```

### Debug Mode

Enable debug logging for troubleshooting:

```bash
# Enable debug mode
DEBUG=zk-combat:* npm run test

# Verbose test output
npm run test -- --reporter=verbose --no-coverage
```

### Test Data Inspection

```bash
# Save test artifacts
npm run test -- --reporter=json --outputFile=test-results.json

# Generate detailed HTML report
npm run test:coverage -- --reporter=html
```

## Best Practices

### 1. Test Organization

- Group related tests in `describe` blocks
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Clean up resources in `afterEach`

### 2. Mocking Strategy

- Mock external services (Midnight network)
- Use real implementations for core logic
- Provide deterministic test data
- Simulate error conditions

### 3. Performance Testing

- Set realistic performance targets
- Test under various load conditions
- Monitor memory usage
- Verify resource cleanup

### 4. Privacy Testing

- Verify data hiding mechanisms
- Test ZK proof generation/verification
- Validate commitment schemes
- Check for information leakage

## Conclusion

This comprehensive testing suite ensures that the ZK Ocean Combat game correctly implements blockchain transactions for every game action while maintaining privacy and preventing cheating. Regular execution of these tests validates the integrity and performance of the Midnight network integration.

For questions or issues with testing, please refer to the troubleshooting section or create an issue in the project repository.