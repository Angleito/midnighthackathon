#!/usr/bin/env node

import { midnightService } from '../src/services/midnightService';
import { privacyService } from '../src/services/privacyService';
import { cheatPreventionService } from '../src/services/cheatPreventionService';
import { initializeCombat, performCombatAction, convertActionToBigInt } from '../src/lib/combat/engine';
import { CombatStats } from '../src/contracts/ZKCombat.compact';

interface TestResult {
  testName: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

interface TestSuite {
  suiteName: string;
  tests: TestResult[];
  passed: number;
  failed: number;
  totalDuration: number;
}

class ZKCombatTester {
  private testSuites: TestSuite[] = [];
  private currentSuite: TestSuite | null = null;

  async runAllTests() {
    console.log('🧪 Starting ZK Ocean Combat Test Suite');
    console.log('=====================================');
    console.log('');

    try {
      // Test suites
      await this.testMidnightIntegration();
      await this.testZKProofGeneration();
      await this.testCombatMechanics();
      await this.testPrivacyFeatures();
      await this.testCheatPrevention();
      await this.testPerformance();

      // Print summary
      this.printTestSummary();

    } catch (error) {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    }
  }

  private async testMidnightIntegration() {
    this.startSuite('Midnight Blockchain Integration');

    await this.runTest('Wallet Connection', async () => {
      const address = await midnightService.connect();
      if (!address || typeof address !== 'string') {
        throw new Error('Failed to get wallet address');
      }
      return { address };
    });

    await this.runTest('Player Profile Creation', async () => {
      const profile = await midnightService.createPlayerProfile();
      if (!profile || !profile.address) {
        throw new Error('Failed to create player profile');
      }
      return { profile };
    });

    await this.runTest('Combat Session Initialization', async () => {
      const playerStats: CombatStats = {
        health: 100n,
        attackPower: 25n,
        defense: 20n,
        speed: 18n,
        magicAttack: 22n,
        magicDefense: 15n
      };
      
      const monsterSeed = BigInt(Date.now());
      const result = await midnightService.initializeCombat(playerStats, monsterSeed);
      
      if (!result.sessionId || result.sessionId <= 0n) {
        throw new Error('Invalid session ID');
      }
      
      return { sessionId: result.sessionId, monsterStats: result.publicMonsterStats };
    });

    await this.runTest('Combat Session Retrieval', async () => {
      const sessionId = BigInt(Date.now());
      const session = await midnightService.getCombatSession(sessionId);
      
      if (!session) {
        throw new Error('Failed to retrieve combat session');
      }
      
      return { session };
    });

    this.endSuite();
  }

  private async testZKProofGeneration() {
    this.startSuite('Zero-Knowledge Proof Generation');

    await this.runTest('Combat Action Proof Generation', async () => {
      const sessionId = BigInt(Date.now());
      const action = 0n; // Attack
      const privateDamageData = {
        playerSecretSeed: BigInt(Math.random() * 1000000),
        monsterSecretSeed: BigInt(Math.random() * 1000000),
        damageRoll: BigInt(Math.floor(Math.random() * 100)),
        criticalChance: 25n
      };

      const result = await midnightService.performCombatAction(sessionId, action, privateDamageData);
      
      if (!result || typeof result.playerDamage !== 'bigint') {
        throw new Error('Invalid combat result');
      }
      
      return { result };
    });

    await this.runTest('Action Commitment Generation', async () => {
      const commitment = await privacyService.generateActionCommitment(
        'test_player',
        BigInt(Date.now()),
        0n, // Attack action
        BigInt(Math.random() * 1000000)
      );
      
      if (!commitment.commitment || !commitment.proof) {
        throw new Error('Failed to generate commitment');
      }
      
      return { commitment };
    });

    await this.runTest('Action Reveal Verification', async () => {
      const playerId = 'test_player';
      const sessionId = BigInt(Date.now());
      const action = 1n; // Magic action
      const salt = BigInt(Math.random() * 1000000);
      
      // Generate commitment
      await privacyService.generateActionCommitment(playerId, sessionId, action, salt);
      
      // Reveal and verify
      const isValid = await privacyService.revealAction(playerId, sessionId, action, salt);
      
      if (!isValid) {
        throw new Error('Action reveal failed');
      }
      
      return { revealed: true };
    });

    await this.runTest('Damage Proof Generation', async () => {
      const attackerStats: CombatStats = {
        health: 100n,
        attackPower: 30n,
        defense: 15n,
        speed: 20n,
        magicAttack: 25n,
        magicDefense: 12n
      };
      
      const defenderStats: CombatStats = {
        health: 120n,
        attackPower: 25n,
        defense: 20n,
        speed: 15n,
        magicAttack: 20n,
        magicDefense: 18n
      };
      
      const proof = await privacyService.generateDamageProof(
        attackerStats,
        defenderStats,
        BigInt(Math.random() * 100),
        Math.random() > 0.75 // 25% crit chance
      );
      
      if (!proof || !proof.startsWith('zk_damage_proof_')) {
        throw new Error('Invalid damage proof');
      }
      
      return { proof };
    });

    this.endSuite();
  }

  private async testCombatMechanics() {
    this.startSuite('Combat Mechanics');

    await this.runTest('Combat Initialization', async () => {
      const combatData = await initializeCombat('test_player', 'sea-serpent');
      
      if (!combatData.sessionId || combatData.sessionId <= 0n) {
        throw new Error('Invalid combat session');
      }
      
      return { combatData };
    });

    await this.runTest('Attack Action', async () => {
      const sessionId = BigInt(Date.now());
      const mockCombatData = {
        sessionId,
        player: {
          health: 100n,
          attackPower: 25n,
          defense: 15n,
          speed: 20n,
          magicAttack: 22n,
          magicDefense: 12n
        },
        monster: {
          health: 120n,
          attackPower: 30n,
          defense: 10n,
          speed: 15n,
          magicAttack: 25n,
          magicDefense: 20n
        },
        playerHealth: 100n,
        monsterHealth: 120n,
        turn: 1n
      };
      
      const result = await performCombatAction(sessionId, convertActionToBigInt('attack'), mockCombatData);
      
      if (!result || typeof result.playerDamage !== 'number') {
        throw new Error('Invalid attack result');
      }
      
      return { result };
    });

    await this.runTest('Magic Action', async () => {
      const sessionId = BigInt(Date.now());
      const mockCombatData = {
        sessionId,
        player: {
          health: 100n,
          attackPower: 20n,
          defense: 15n,
          speed: 18n,
          magicAttack: 30n,
          magicDefense: 15n
        },
        monster: {
          health: 100n,
          attackPower: 25n,
          defense: 12n,
          speed: 16n,
          magicAttack: 20n,
          magicDefense: 10n
        },
        playerHealth: 100n,
        monsterHealth: 100n,
        turn: 1n
      };
      
      const result = await performCombatAction(sessionId, convertActionToBigInt('magic'), mockCombatData);
      
      if (!result || typeof result.monsterDamage !== 'number') {
        throw new Error('Invalid magic result');
      }
      
      return { result };
    });

    await this.runTest('Combat Rewards', async () => {
      const rewards = await midnightService.awardCombatRewards(true, 3n);
      
      if (!rewards || typeof rewards.experienceGained !== 'bigint') {
        throw new Error('Invalid rewards');
      }
      
      return { rewards };
    });

    this.endSuite();
  }

  private async testPrivacyFeatures() {
    this.startSuite('Privacy and Hidden Information');

    await this.runTest('Hidden Monster Stats Generation', async () => {
      const result = await privacyService.generateHiddenMonsterStats(
        'kraken',
        5,
        BigInt(Math.random() * 1000000)
      );
      
      if (!result.publicStats || !result.hiddenHealth) {
        throw new Error('Failed to generate hidden stats');
      }
      
      // Health should be hidden (0) in public stats
      if (result.publicStats.health !== 0n) {
        throw new Error('Monster health not properly hidden');
      }
      
      return { result };
    });

    await this.runTest('Player Hidden Info Storage', async () => {
      const playerStats: CombatStats = {
        health: 100n,
        attackPower: 25n,
        defense: 20n,
        speed: 18n,
        magicAttack: 22n,
        magicDefense: 15n
      };
      
      const equipment = [{
        itemId: 1n,
        name: 'Magic Sword',
        rarity: 'rare' as const,
        statBonuses: {
          health: 0n,
          attackPower: 5n,
          defense: 0n,
          speed: 0n,
          magicAttack: 3n,
          magicDefense: 0n
        },
        isEquipped: true,
        durability: 100
      }];
      
      await privacyService.storeHiddenPlayerInfo('test_player', playerStats, equipment);
      
      const totalStats = await privacyService.calculateTotalPlayerStats('test_player');
      
      if (totalStats.attackPower !== 30n) { // 25 + 5 from equipment
        throw new Error('Equipment bonuses not calculated correctly');
      }
      
      return { totalStats };
    });

    await this.runTest('Combat Results Revelation', async () => {
      const results = await privacyService.revealCombatResults(
        'test_player',
        BigInt(Date.now()),
        true
      );
      
      if (!results || !results.playerEquipmentBonuses) {
        throw new Error('Failed to reveal combat results');
      }
      
      return { results };
    });

    this.endSuite();
  }

  private async testCheatPrevention() {
    this.startSuite('Cheat Prevention');

    await this.runTest('Valid Stats Validation', async () => {
      const validStats: CombatStats = {
        health: 100n,
        attackPower: 25n,
        defense: 20n,
        speed: 18n,
        magicAttack: 22n,
        magicDefense: 15n
      };
      
      const validation = cheatPreventionService.validatePlayerStats(validStats);
      
      if (!validation.isValid) {
        throw new Error(`Valid stats rejected: ${validation.reason}`);
      }
      
      return { validation };
    });

    await this.runTest('Invalid Stats Detection', async () => {
      const invalidStats: CombatStats = {
        health: 1000n, // Too high
        attackPower: 200n, // Too high
        defense: 20n,
        speed: 18n,
        magicAttack: 22n,
        magicDefense: 15n
      };
      
      const validation = cheatPreventionService.validatePlayerStats(invalidStats);
      
      if (validation.isValid) {
        throw new Error('Invalid stats not detected');
      }
      
      return { validation };
    });

    await this.runTest('Rate Limiting', async () => {
      const playerId = 'test_player_rate_limit';
      
      // Simulate rapid actions
      for (let i = 0; i < 12; i++) {
        const rateLimitCheck = cheatPreventionService.checkRateLimit(playerId);
        if (i >= 10 && !rateLimitCheck.isLimited) {
          throw new Error('Rate limiting not working');
        }
      }
      
      return { rateLimited: true };
    });

    await this.runTest('Action Validation', async () => {
      const playerStats: CombatStats = {
        health: 100n,
        attackPower: 25n,
        defense: 20n,
        speed: 18n,
        magicAttack: 22n,
        magicDefense: 15n
      };
      
      const validation = await cheatPreventionService.validateCombatAction(
        'test_player',
        BigInt(Date.now()),
        'attack',
        playerStats,
        Date.now()
      );
      
      if (!validation.isValid) {
        throw new Error(`Valid action rejected: ${validation.reason}`);
      }
      
      return { validation };
    });

    await this.runTest('ZK Proof Verification', async () => {
      const isValid = await cheatPreventionService.verifyActionProof(
        'test_player',
        BigInt(Date.now()),
        'attack',
        'zk_proof_test_' + Date.now()
      );
      
      if (!isValid) {
        throw new Error('Valid proof rejected');
      }
      
      return { proofValid: true };
    });

    this.endSuite();
  }

  private async testPerformance() {
    this.startSuite('Performance Tests');

    await this.runTest('Proof Generation Performance', async () => {
      const startTime = Date.now();
      const iterations = 10;
      
      for (let i = 0; i < iterations; i++) {
        await privacyService.generateActionCommitment(
          `test_player_${i}`,
          BigInt(Date.now() + i),
          BigInt(i % 4),
          BigInt(Math.random() * 1000000)
        );
      }
      
      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / iterations;
      
      if (avgTime > 1000) { // Should take less than 1 second on average
        throw new Error(`Proof generation too slow: ${avgTime}ms average`);
      }
      
      return { avgTime, totalTime, iterations };
    });

    await this.runTest('Combat Action Performance', async () => {
      const startTime = Date.now();
      const iterations = 5;
      
      const mockCombatData = {
        sessionId: BigInt(Date.now()),
        player: {
          health: 100n,
          attackPower: 25n,
          defense: 15n,
          speed: 20n,
          magicAttack: 22n,
          magicDefense: 12n
        },
        monster: {
          health: 120n,
          attackPower: 30n,
          defense: 10n,
          speed: 15n,
          magicAttack: 25n,
          magicDefense: 20n
        },
        playerHealth: 100n,
        monsterHealth: 120n,
        turn: 1n
      };
      
      for (let i = 0; i < iterations; i++) {
        await performCombatAction(
          BigInt(Date.now() + i),
          convertActionToBigInt('attack'),
          mockCombatData
        );
      }
      
      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / iterations;
      
      if (avgTime > 2000) { // Should take less than 2 seconds on average
        throw new Error(`Combat actions too slow: ${avgTime}ms average`);
      }
      
      return { avgTime, totalTime, iterations };
    });

    this.endSuite();
  }

  private startSuite(suiteName: string) {
    this.currentSuite = {
      suiteName,
      tests: [],
      passed: 0,
      failed: 0,
      totalDuration: 0
    };
    console.log(`📋 ${suiteName}`);
    console.log('─'.repeat(suiteName.length + 4));
  }

  private async runTest(testName: string, testFn: () => Promise<any>): Promise<void> {
    const startTime = Date.now();
    
    try {
      const result = await testFn();
      const duration = Date.now() - startTime;
      
      const testResult: TestResult = {
        testName,
        passed: true,
        duration,
        details: result
      };
      
      this.currentSuite!.tests.push(testResult);
      this.currentSuite!.passed++;
      this.currentSuite!.totalDuration += duration;
      
      console.log(`  ✅ ${testName} (${duration}ms)`);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      const testResult: TestResult = {
        testName,
        passed: false,
        duration,
        error: error instanceof Error ? error.message : String(error)
      };
      
      this.currentSuite!.tests.push(testResult);
      this.currentSuite!.failed++;
      this.currentSuite!.totalDuration += duration;
      
      console.log(`  ❌ ${testName} (${duration}ms)`);
      console.log(`     Error: ${testResult.error}`);
    }
  }

  private endSuite() {
    if (this.currentSuite) {
      this.testSuites.push(this.currentSuite);
      console.log(`  📊 ${this.currentSuite.passed} passed, ${this.currentSuite.failed} failed (${this.currentSuite.totalDuration}ms)`);
      console.log('');
      this.currentSuite = null;
    }
  }

  private printTestSummary() {
    console.log('📈 Test Summary');
    console.log('===============');
    
    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalDuration = 0;
    
    this.testSuites.forEach(suite => {
      totalTests += suite.tests.length;
      totalPassed += suite.passed;
      totalFailed += suite.failed;
      totalDuration += suite.totalDuration;
      
      const status = suite.failed === 0 ? '✅' : '❌';
      console.log(`${status} ${suite.suiteName}: ${suite.passed}/${suite.tests.length} passed (${suite.totalDuration}ms)`);
    });
    
    console.log('');
    console.log(`🎯 Overall Results:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Passed: ${totalPassed}`);
    console.log(`   Failed: ${totalFailed}`);
    console.log(`   Success Rate: ${((totalPassed / totalTests) * 100).toFixed(1)}%`);
    console.log(`   Total Duration: ${totalDuration}ms`);
    
    if (totalFailed > 0) {
      console.log('');
      console.log('❌ Failed Tests:');
      this.testSuites.forEach(suite => {
        suite.tests.filter(test => !test.passed).forEach(test => {
          console.log(`   ${suite.suiteName}: ${test.testName} - ${test.error}`);
        });
      });
      
      process.exit(1);
    } else {
      console.log('');
      console.log('🎉 All tests passed! ZK Ocean Combat is ready for deployment.');
    }
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new ZKCombatTester();
  tester.runAllTests().catch(console.error);
}

export { ZKCombatTester };