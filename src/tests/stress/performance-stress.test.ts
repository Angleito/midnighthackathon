import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { midnightService } from '../../services/midnightService';
import { transactionManager } from '../../services/transactionManager';
import { monsterInventoryService } from '../../services/monsterInventoryService';
import { zkProofService } from '../../services/zkProofService';
import { cheatPreventionService } from '../../services/cheatPreventionService';
import { CombatAction } from '../../types/zk-types';
import { stressTestUtils } from './setup';

describe('Performance and Stress Tests', () => {
  beforeEach(() => {
    stressTestUtils.performance.clear();
    stressTestUtils.memory.clear();
    stressTestUtils.memory.takeSnapshot();
  });

  afterEach(() => {
    stressTestUtils.memory.takeSnapshot();
    
    // Log performance metrics for this test
    console.log('\nTest Performance Summary:');
    const memoryGrowth = stressTestUtils.memory.getMemoryGrowth();
    console.log(`Memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)} MB`);
  });

  describe('Transaction Load Testing', () => {
    it('should handle high volume of concurrent transactions', async () => {
      const concurrentTransactions = 50;
      const maxResponseTime = stressTestUtils.config.maxResponseTimeMs;
      
      console.log(`Testing ${concurrentTransactions} concurrent transactions...`);
      
      // Prepare test data
      const testOperations = Array(concurrentTransactions).fill(0).map((_, i) => {
        const sessionId = BigInt(Date.now() + i);
        const stats = stressTestUtils.generateRandomStats();
        const privateData = stressTestUtils.generateRandomPrivateData();
        
        return async () => {
          stressTestUtils.performance.startTimer(`transaction_${i}`);
          
          try {
            const transactionId = await transactionManager.submitCombatAction(
              sessionId,
              CombatAction.Attack,
              privateData,
              stats
            );
            
            const duration = stressTestUtils.performance.endTimer(`transaction_${i}`);
            stressTestUtils.performance.recordMetric('transaction_duration', duration);
            
            return { transactionId, success: true };
          } catch (error) {
            const duration = stressTestUtils.performance.endTimer(`transaction_${i}`);
            stressTestUtils.performance.recordMetric('transaction_error_duration', duration);
            
            return { error, success: false };
          }
        };
      });

      // Execute with concurrency control
      stressTestUtils.load.setMaxConcurrency(20);
      const results = await stressTestUtils.load.executeWithConcurrencyLimit(testOperations);
      
      // Analyze results
      const successfulTransactions = results.filter(r => !r.error).length;
      const failedTransactions = results.filter(r => r.error).length;
      const averageResponseTime = stressTestUtils.performance.getAverageMetric('transaction_duration');
      const maxResponseTimeRecorded = stressTestUtils.performance.getMaxMetric('transaction_duration');
      const p95ResponseTime = stressTestUtils.performance.getPercentile('transaction_duration', 95);
      
      console.log(`Successful: ${successfulTransactions}, Failed: ${failedTransactions}`);
      console.log(`Average response time: ${averageResponseTime.toFixed(2)}ms`);
      console.log(`95th percentile: ${p95ResponseTime.toFixed(2)}ms`);
      console.log(`Max response time: ${maxResponseTimeRecorded.toFixed(2)}ms`);
      
      // Assertions
      expect(successfulTransactions).toBeGreaterThan(concurrentTransactions * 0.8); // At least 80% success
      expect(averageResponseTime).toBeLessThan(stressTestUtils.config.averageResponseTimeMs);
      expect(maxResponseTimeRecorded).toBeLessThan(maxResponseTime);
      expect(p95ResponseTime).toBeLessThan(maxResponseTime);
    }, 60000);

    it('should maintain performance under sustained load', async () => {
      const operationsPerSecond = 10;
      const testDurationSeconds = 15;
      const totalOperations = operationsPerSecond * testDurationSeconds;
      
      console.log(`Testing sustained load: ${operationsPerSecond} ops/sec for ${testDurationSeconds} seconds`);
      
      const baseOperation = async () => {
        const sessionId = BigInt(Date.now() + Math.random() * 1000);
        const stats = stressTestUtils.generateRandomStats();
        const privateData = stressTestUtils.generateRandomPrivateData();
        
        const startTime = performance.now();
        
        try {
          await transactionManager.submitCombatAction(sessionId, CombatAction.Attack, privateData, stats);
          const duration = performance.now() - startTime;
          stressTestUtils.performance.recordMetric('sustained_load_duration', duration);
          return { success: true, duration };
        } catch (error) {
          const duration = performance.now() - startTime;
          stressTestUtils.performance.recordMetric('sustained_load_error', duration);
          return { success: false, duration, error };
        }
      };

      // Generate constant load pattern
      const operations = stressTestUtils.load.generateLoadPattern(
        baseOperation,
        'constant',
        testDurationSeconds * 1000,
        operationsPerSecond
      );

      const testStartTime = performance.now();
      const results = await stressTestUtils.load.executeWithConcurrencyLimit(operations);
      const testEndTime = performance.now();
      
      // Analyze sustained load performance
      const successCount = results.filter(r => r.result?.success).length;
      const failureCount = results.filter(r => r.error || !r.result?.success).length;
      const averageDuration = stressTestUtils.performance.getAverageMetric('sustained_load_duration');
      const actualTestDuration = testEndTime - testStartTime;
      const actualThroughput = (successCount / actualTestDuration) * 1000; // ops per second
      
      console.log(`Completed ${successCount} operations successfully, ${failureCount} failed`);
      console.log(`Actual test duration: ${actualTestDuration.toFixed(0)}ms`);
      console.log(`Actual throughput: ${actualThroughput.toFixed(2)} ops/sec`);
      console.log(`Average operation duration: ${averageDuration.toFixed(2)}ms`);
      
      // Memory usage check
      const memoryGrowth = stressTestUtils.memory.getMemoryGrowth();
      console.log(`Memory growth during test: ${(memoryGrowth / 1024 / 1024).toFixed(2)} MB`);
      
      // Assertions
      expect(successCount).toBeGreaterThan(totalOperations * 0.7); // At least 70% success under load
      expect(actualThroughput).toBeGreaterThan(operationsPerSecond * 0.5); // At least 50% of target throughput
      expect(memoryGrowth).toBeLessThan(stressTestUtils.config.memoryThresholdMB * 1024 * 1024);
    }, 30000);

    it('should handle transaction spikes without degradation', async () => {
      const normalLoad = 5;
      const spikeLoad = 25;
      const spikeDurationMs = 2000;
      
      console.log(`Testing spike from ${normalLoad} to ${spikeLoad} ops/sec`);
      
      // Create baseline performance
      const baselineOperations = Array(normalLoad).fill(0).map(() => async () => {
        const sessionId = BigInt(Date.now() + Math.random() * 1000);
        const stats = stressTestUtils.generateRandomStats();
        const privateData = stressTestUtils.generateRandomPrivateData();
        
        const startTime = performance.now();
        await transactionManager.submitCombatAction(sessionId, CombatAction.Attack, privateData, stats);
        const duration = performance.now() - startTime;
        stressTestUtils.performance.recordMetric('baseline_duration', duration);
        return duration;
      });

      // Execute baseline
      await stressTestUtils.load.executeWithConcurrencyLimit(baselineOperations);
      const baselineAverage = stressTestUtils.performance.getAverageMetric('baseline_duration');
      
      // Create spike load
      const spikeOperations = Array(spikeLoad).fill(0).map(() => async () => {
        const sessionId = BigInt(Date.now() + Math.random() * 1000);
        const stats = stressTestUtils.generateRandomStats();
        const privateData = stressTestUtils.generateRandomPrivateData();
        
        const startTime = performance.now();
        try {
          await transactionManager.submitCombatAction(sessionId, CombatAction.Magic, privateData, stats);
          const duration = performance.now() - startTime;
          stressTestUtils.performance.recordMetric('spike_duration', duration);
          return { success: true, duration };
        } catch (error) {
          const duration = performance.now() - startTime;
          stressTestUtils.performance.recordMetric('spike_error_duration', duration);
          return { success: false, duration };
        }
      });

      // Execute spike
      stressTestUtils.load.setMaxConcurrency(15);
      const spikeResults = await stressTestUtils.load.executeWithConcurrencyLimit(spikeOperations);
      
      const spikeSuccessCount = spikeResults.filter(r => r.result?.success).length;
      const spikeAverage = stressTestUtils.performance.getAverageMetric('spike_duration');
      const spikeP95 = stressTestUtils.performance.getPercentile('spike_duration', 95);
      
      console.log(`Baseline average: ${baselineAverage.toFixed(2)}ms`);
      console.log(`Spike average: ${spikeAverage.toFixed(2)}ms`);
      console.log(`Spike 95th percentile: ${spikeP95.toFixed(2)}ms`);
      console.log(`Spike success rate: ${(spikeSuccessCount / spikeLoad * 100).toFixed(1)}%`);
      
      // Assertions - performance should not degrade significantly during spikes
      expect(spikeAverage).toBeLessThan(baselineAverage * 3); // No more than 3x degradation
      expect(spikeSuccessCount).toBeGreaterThan(spikeLoad * 0.6); // At least 60% success during spike
      expect(spikeP95).toBeLessThan(stressTestUtils.config.maxResponseTimeMs);
    }, 45000);
  });

  describe('Combat Session Concurrency', () => {
    it('should handle multiple concurrent combat sessions', async () => {
      const concurrentSessions = 15;
      const actionsPerSession = 5;
      
      console.log(`Testing ${concurrentSessions} concurrent combat sessions`);
      
      const sessionOperations = Array(concurrentSessions).fill(0).map((_, sessionIndex) => {
        return async () => {
          const sessionId = BigInt(Date.now() + sessionIndex * 1000);
          const stats = stressTestUtils.generateRandomStats();
          const results: any[] = [];
          
          stressTestUtils.performance.startTimer(`session_${sessionIndex}`);
          
          try {
            // Initialize combat
            const initResult = await midnightService.initializeCombat(stats, BigInt(sessionIndex + 12345));
            results.push({ type: 'init', result: initResult });
            
            // Perform multiple actions
            for (let actionIndex = 0; actionIndex < actionsPerSession; actionIndex++) {
              const privateData = stressTestUtils.generateRandomPrivateData();
              const actions = [CombatAction.Attack, CombatAction.Defend, CombatAction.Magic, CombatAction.Attack, CombatAction.Defend] as const;
              const action = actions[actionIndex];
              
              try {
                const actionResult = await midnightService.performCombatAction(
                  initResult.sessionId,
                  action,
                  privateData
                );
                results.push({ type: 'action', action, result: actionResult });
              } catch (error) {
                results.push({ type: 'action', action, error });
              }
            }
            
            // End session
            await midnightService.endCombatSession(initResult.sessionId);
            results.push({ type: 'end', success: true });
            
            const duration = stressTestUtils.performance.endTimer(`session_${sessionIndex}`);
            stressTestUtils.performance.recordMetric('session_duration', duration);
            
            return { sessionIndex, results, success: true };
          } catch (error) {
            const duration = stressTestUtils.performance.endTimer(`session_${sessionIndex}`);
            stressTestUtils.performance.recordMetric('session_error_duration', duration);
            
            return { sessionIndex, error, success: false };
          }
        };
      });

      // Execute concurrent sessions
      stressTestUtils.load.setMaxConcurrency(10);
      const sessionResults = await stressTestUtils.load.executeWithConcurrencyLimit(sessionOperations);
      
      // Analyze results
      const successfulSessions = sessionResults.filter(r => r.result?.success).length;
      const failedSessions = sessionResults.filter(r => r.error || !r.result?.success).length;
      const averageSessionDuration = stressTestUtils.performance.getAverageMetric('session_duration');
      const maxSessionDuration = stressTestUtils.performance.getMaxMetric('session_duration');
      
      console.log(`Successful sessions: ${successfulSessions}, Failed: ${failedSessions}`);
      console.log(`Average session duration: ${averageSessionDuration.toFixed(2)}ms`);
      console.log(`Max session duration: ${maxSessionDuration.toFixed(2)}ms`);
      
      // Verify session isolation
      const totalActionsExpected = concurrentSessions * actionsPerSession;
      let totalActionsPerformed = 0;
      
      sessionResults.forEach(session => {
        if (session.result?.results) {
          const actionCount = session.result.results.filter((r: any) => r.type === 'action').length;
          totalActionsPerformed += actionCount;
        }
      });
      
      console.log(`Actions performed: ${totalActionsPerformed} / ${totalActionsExpected} expected`);
      
      // Assertions
      expect(successfulSessions).toBeGreaterThan(concurrentSessions * 0.7); // At least 70% success
      expect(averageSessionDuration).toBeLessThan(stressTestUtils.config.maxResponseTimeMs * actionsPerSession);
      expect(totalActionsPerformed).toBeGreaterThan(totalActionsExpected * 0.6); // At least 60% of actions completed
    }, 90000);

    it('should prevent cross-session interference', async () => {
      const sessionCount = 8;
      const isolationTestSessions: any[] = [];
      
      console.log(`Testing session isolation with ${sessionCount} sessions`);
      
      // Initialize multiple sessions simultaneously
      const initPromises = Array(sessionCount).fill(0).map(async (_, i) => {
        const stats = stressTestUtils.generateRandomStats();
        const sessionId = BigInt(Date.now() + i * 100);
        
        try {
          const result = await midnightService.initializeCombat(stats, BigInt(i + 54321));
          isolationTestSessions.push({
            index: i,
            sessionId: result.sessionId,
            originalStats: stats,
            publicStats: result.publicMonsterStats,
          });
          return result;
        } catch (error) {
          console.log(`Session ${i} initialization failed:`, error);
          return null;
        }
      });

      await Promise.all(initPromises);
      
      // Perform actions on different sessions concurrently
      const actionPromises = isolationTestSessions.map(async (session, index) => {
        if (!session) return null;
        
        const privateData = {
          ...stressTestUtils.generateRandomPrivateData(),
          playerSecretSeed: BigInt(index * 1000), // Unique per session
        };
        
        try {
          const result = await midnightService.performCombatAction(
            session.sessionId,
            CombatAction.Attack,
            privateData
          );
          
          return {
            sessionIndex: index,
            sessionId: session.sessionId,
            result,
            privateData,
          };
        } catch (error) {
          return {
            sessionIndex: index,
            sessionId: session.sessionId,
            error,
          };
        }
      });

      const actionResults = await Promise.all(actionPromises);
      
      // Verify session isolation
      const successfulActions = actionResults.filter(r => r && r.result).length;
      const uniqueSessionIds = new Set(actionResults.map(r => r?.sessionId.toString()).filter(Boolean));
      const uniqueTransactionIds = new Set(actionResults.map(r => r?.result?.transactionId).filter(Boolean));
      
      console.log(`Successful actions: ${successfulActions}`);
      console.log(`Unique sessions: ${uniqueSessionIds.size}`);
      console.log(`Unique transactions: ${uniqueTransactionIds.size}`);
      
      // Clean up sessions
      const cleanupPromises = isolationTestSessions.map(session => {
        if (session?.sessionId) {
          return midnightService.endCombatSession(session.sessionId);
        }
        return Promise.resolve();
      });
      
      await Promise.all(cleanupPromises);
      
      // Assertions
      expect(successfulActions).toBeGreaterThan(sessionCount * 0.5); // At least 50% success
      expect(uniqueSessionIds.size).toBe(isolationTestSessions.length); // All sessions unique
      expect(uniqueTransactionIds.size).toBe(successfulActions); // All transactions unique
    }, 60000);
  });

  describe('Memory and Resource Management', () => {
    it('should not have memory leaks during extended operation', async () => {
      const operationCount = 100;
      const memoryCheckInterval = 20;
      
      console.log(`Testing memory usage over ${operationCount} operations`);
      
      const initialMemory = stressTestUtils.memory.takeSnapshot();
      const memoryReadings: number[] = [];
      
      for (let i = 0; i < operationCount; i++) {
        // Perform various operations
        const stats = stressTestUtils.generateRandomStats();
        const privateData = stressTestUtils.generateRandomPrivateData();
        const sessionId = BigInt(Date.now() + i);
        
        try {
          // Transaction operations
          await transactionManager.submitCombatAction(sessionId, CombatAction.Attack, privateData, stats);
          
          // ZK proof operations
          const commitment = zkProofService.generateMonsterCommitment(stats, BigInt(i));
          zkProofService.verifyCommitment(commitment, stats, BigInt(i));
          
          // Anti-cheat operations
          await cheatPreventionService.generateVerifiableRandomnessSeed(
            sessionId,
            BigInt(i),
            `0x${i.toString(16).padStart(40, '0')}`,
            Date.now()
          );
          
          // Memory check
          if (i % memoryCheckInterval === 0) {
            stressTestUtils.memory.takeSnapshot();
            const currentGrowth = stressTestUtils.memory.getMemoryGrowth();
            memoryReadings.push(currentGrowth);
            
            if (i > 0) {
              console.log(`Operation ${i}: Memory growth ${(currentGrowth / 1024 / 1024).toFixed(2)} MB`);
            }
          }
        } catch (error) {
          // Expected in stress test environment
          console.log(`Operation ${i} failed (expected in stress test):`, error);
        }
      }
      
      const finalMemoryGrowth = stressTestUtils.memory.getMemoryGrowth();
      const maxMemoryUsage = stressTestUtils.memory.getMaxMemoryUsage();
      
      console.log(`Final memory growth: ${(finalMemoryGrowth / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Max memory usage: ${(maxMemoryUsage / 1024 / 1024).toFixed(2)} MB`);
      
      // Check for memory leak patterns
      const memoryGrowthPerOperation = finalMemoryGrowth / operationCount;
      console.log(`Memory growth per operation: ${(memoryGrowthPerOperation / 1024).toFixed(2)} KB`);
      
      // Assertions
      expect(finalMemoryGrowth).toBeLessThan(stressTestUtils.config.memoryThresholdMB * 1024 * 1024);
      expect(memoryGrowthPerOperation).toBeLessThan(100 * 1024); // Less than 100KB per operation
      
      // Memory should not grow linearly (indicating a leak)
      if (memoryReadings.length > 3) {
        const earlyGrowth = memoryReadings[1] - memoryReadings[0];
        const lateGrowth = memoryReadings[memoryReadings.length - 1] - memoryReadings[memoryReadings.length - 2];
        
        // Late growth should not be significantly higher than early growth
        expect(lateGrowth).toBeLessThan(earlyGrowth * 3);
      }
    }, 120000);

    it('should handle resource cleanup under load', async () => {
      const resourceIntensiveOperations = 30;
      
      console.log(`Testing resource cleanup with ${resourceIntensiveOperations} intensive operations`);
      
      const cleanupTestOperations = Array(resourceIntensiveOperations).fill(0).map((_, i) => {
        return async () => {
          const sessionId = BigInt(Date.now() + i * 10);
          const stats = stressTestUtils.generateRandomStats();
          
          try {
            // Create session
            const initResult = await midnightService.initializeCombat(stats, BigInt(i + 99999));
            
            // Perform actions
            const privateData = stressTestUtils.generateRandomPrivateData();
            await midnightService.performCombatAction(initResult.sessionId, CombatAction.Attack, privateData);
            await midnightService.performCombatAction(initResult.sessionId, CombatAction.Defend, privateData);
            
            // Force cleanup
            await midnightService.endCombatSession(initResult.sessionId);
            midnightService.cleanupOldSessions();
            
            return { success: true, sessionId: initResult.sessionId };
          } catch (error) {
            return { success: false, error };
          }
        };
      });

      const beforeCleanup = stressTestUtils.memory.getMaxMemoryUsage();
      
      // Execute resource intensive operations
      stressTestUtils.load.setMaxConcurrency(8);
      const results = await stressTestUtils.load.executeWithConcurrencyLimit(cleanupTestOperations);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const afterCleanup = stressTestUtils.memory.getMaxMemoryUsage();
      const successfulOperations = results.filter(r => r.result?.success).length;
      
      console.log(`Successful cleanup operations: ${successfulOperations}`);
      console.log(`Memory before cleanup: ${(beforeCleanup / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Memory after cleanup: ${(afterCleanup / 1024 / 1024).toFixed(2)} MB`);
      
      // Verify active sessions are cleaned up
      const activeSessions = midnightService.getActiveSessions();
      console.log(`Active sessions remaining: ${activeSessions.length}`);
      
      // Assertions
      expect(successfulOperations).toBeGreaterThan(resourceIntensiveOperations * 0.6);
      expect(activeSessions.length).toBeLessThan(resourceIntensiveOperations * 0.2); // Most sessions cleaned up
    }, 90000);
  });

  describe('Error Handling Under Load', () => {
    it('should maintain system stability during error conditions', async () => {
      const operationCount = 50;
      const errorRate = 0.3; // 30% operations will fail
      
      console.log(`Testing error handling with ${operationCount} operations (${errorRate * 100}% error rate)`);
      
      const errorTestOperations = Array(operationCount).fill(0).map((_, i) => {
        return async () => {
          const sessionId = BigInt(Date.now() + i * 5);
          const stats = stressTestUtils.generateRandomStats();
          const privateData = stressTestUtils.generateRandomPrivateData();
          
          // Introduce random errors
          const shouldFail = Math.random() < errorRate;
          
          try {
            if (shouldFail) {
              // Simulate various error conditions
              const errorType = Math.floor(Math.random() * 3);
              switch (errorType) {
                case 0:
                  throw new Error('Simulated network timeout');
                case 1:
                  // Invalid data
                  await transactionManager.submitCombatAction(
                    sessionId,
                    CombatAction.Attack as any,
                    { ...privateData, playerSecretSeed: -1n }, // Invalid seed
                    stats
                  );
                  break;
                case 2:
                  // Invalid session
                  await midnightService.performCombatAction(
                    sessionId + 999999n, // Non-existent session
                    CombatAction.Attack,
                    privateData
                  );
                  break;
              }
            } else {
              // Normal operation
              await transactionManager.submitCombatAction(sessionId, CombatAction.Attack, privateData, stats);
            }
            
            return { success: true, operation: i };
          } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error', operation: i };
          }
        };
      });

      // Execute operations with error injection
      stressTestUtils.load.setMaxConcurrency(12);
      const results = await stressTestUtils.load.executeWithConcurrencyLimit(errorTestOperations);
      
      const successCount = results.filter(r => r.result?.success).length;
      const errorCount = results.filter(r => !r.result?.success).length;
      const actualErrorRate = errorCount / operationCount;
      
      console.log(`Successful operations: ${successCount}`);
      console.log(`Failed operations: ${errorCount}`);
      console.log(`Actual error rate: ${(actualErrorRate * 100).toFixed(1)}%`);
      
      // System should continue operating despite errors
      const memoryAfterErrors = stressTestUtils.memory.getMemoryGrowth();
      console.log(`Memory growth after errors: ${(memoryAfterErrors / 1024 / 1024).toFixed(2)} MB`);
      
      // Test recovery by performing successful operations
      const recoveryOperations = Array(10).fill(0).map((_, i) => {
        return async () => {
          const sessionId = BigInt(Date.now() + i + 100000);
          const stats = stressTestUtils.generateRandomStats();
          const privateData = stressTestUtils.generateRandomPrivateData();
          
          await transactionManager.submitCombatAction(sessionId, CombatAction.Defend, privateData, stats);
          return { recovery: true };
        };
      });

      const recoveryResults = await stressTestUtils.load.executeWithConcurrencyLimit(recoveryOperations);
      const recoverySuccessCount = recoveryResults.filter(r => r.result?.recovery).length;
      
      console.log(`Recovery operations successful: ${recoverySuccessCount} / 10`);
      
      // Assertions
      expect(actualErrorRate).toBeGreaterThan(errorRate * 0.5); // Errors were actually injected
      expect(successCount).toBeGreaterThan(operationCount * (1 - errorRate) * 0.7); // Most non-error operations succeeded
      expect(recoverySuccessCount).toBeGreaterThan(7); // System recovered well
      expect(memoryAfterErrors).toBeLessThan(stressTestUtils.config.memoryThresholdMB * 1024 * 1024);
    }, 120000);
  });
});