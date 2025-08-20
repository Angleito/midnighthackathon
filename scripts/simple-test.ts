#!/usr/bin/env node

import { privacyService } from '../src/services/privacyService';
import { cheatPreventionService } from '../src/services/cheatPreventionService';
import { CombatStats } from '../src/contracts/ZKCombat.compact';

async function runSimpleTests() {
  console.log('🧪 Running Simple ZK Combat Tests');
  console.log('==================================');
  console.log('');

  let passed = 0;
  let failed = 0;

  // Test 1: Privacy Service - Action Commitment
  try {
    console.log('📋 Testing Action Commitment Generation...');
    const commitment = await privacyService.generateActionCommitment(
      'test_player',
      BigInt(Date.now()),
      0n, // Attack action
      BigInt(Math.random() * 1000000)
    );
    
    if (commitment.commitment && commitment.proof) {
      console.log('  ✅ Action commitment generated successfully');
      passed++;
    } else {
      throw new Error('Invalid commitment response');
    }
  } catch (error) {
    console.log('  ❌ Action commitment test failed:', error);
    failed++;
  }

  // Test 2: Privacy Service - Hidden Monster Stats
  try {
    console.log('📋 Testing Hidden Monster Stats Generation...');
    const result = await privacyService.generateHiddenMonsterStats(
      'kraken',
      5,
      BigInt(Math.random() * 1000000)
    );
    
    if (result.publicStats && result.hiddenHealth && result.publicStats.health === 0n) {
      console.log('  ✅ Hidden monster stats generated correctly');
      console.log(`    Hidden Health: ${result.hiddenHealth}`);
      console.log(`    Public Attack: ${result.publicStats.attackPower}`);
      passed++;
    } else {
      throw new Error('Monster health not properly hidden');
    }
  } catch (error) {
    console.log('  ❌ Hidden monster stats test failed:', error);
    failed++;
  }

  // Test 3: Cheat Prevention - Valid Stats
  try {
    console.log('📋 Testing Valid Stats Validation...');
    const validStats: CombatStats = {
      health: 100n,
      attackPower: 25n,
      defense: 20n,
      speed: 18n,
      magicAttack: 22n,
      magicDefense: 15n
    };
    
    const validation = cheatPreventionService.validatePlayerStats(validStats);
    
    if (validation.isValid) {
      console.log('  ✅ Valid stats accepted correctly');
      passed++;
    } else {
      throw new Error(`Valid stats rejected: ${validation.reason}`);
    }
  } catch (error) {
    console.log('  ❌ Valid stats test failed:', error);
    failed++;
  }

  // Test 4: Cheat Prevention - Invalid Stats Detection
  try {
    console.log('📋 Testing Invalid Stats Detection...');
    const invalidStats: CombatStats = {
      health: 1000n, // Too high
      attackPower: 200n, // Too high
      defense: 20n,
      speed: 18n,
      magicAttack: 22n,
      magicDefense: 15n
    };
    
    const validation = cheatPreventionService.validatePlayerStats(invalidStats);
    
    if (!validation.isValid) {
      console.log('  ✅ Invalid stats detected correctly');
      console.log(`    Reason: ${validation.reason}`);
      passed++;
    } else {
      throw new Error('Invalid stats not detected');
    }
  } catch (error) {
    console.log('  ❌ Invalid stats detection test failed:', error);
    failed++;
  }

  // Test 5: Privacy Service - Damage Proof
  try {
    console.log('📋 Testing Damage Proof Generation...');
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
    
    if (proof && proof.startsWith('zk_damage_proof_')) {
      console.log('  ✅ Damage proof generated successfully');
      console.log(`    Proof: ${proof.substring(0, 30)}...`);
      passed++;
    } else {
      throw new Error('Invalid damage proof format');
    }
  } catch (error) {
    console.log('  ❌ Damage proof test failed:', error);
    failed++;
  }

  // Test 6: Privacy Service - Equipment Bonus Calculation
  try {
    console.log('📋 Testing Equipment Bonus Calculation...');
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
        health: 10n,
        attackPower: 5n,
        defense: 0n,
        speed: 0n,
        magicAttack: 3n,
        magicDefense: 0n
      },
      isEquipped: true,
      durability: 100
    }];
    
    await privacyService.storeHiddenPlayerInfo('test_player_equipment', playerStats, equipment);
    
    const totalStats = await privacyService.calculateTotalPlayerStats('test_player_equipment');
    
    if (totalStats.attackPower === 30n && totalStats.health === 110n) { // Base + equipment
      console.log('  ✅ Equipment bonuses calculated correctly');
      console.log(`    Total Attack: ${totalStats.attackPower} (25 + 5)`);
      console.log(`    Total Health: ${totalStats.health} (100 + 10)`);
      passed++;
    } else {
      throw new Error(`Incorrect bonus calculation: Attack=${totalStats.attackPower}, Health=${totalStats.health}`);
    }
  } catch (error) {
    console.log('  ❌ Equipment bonus test failed:', error);
    failed++;
  }

  // Test 7: Cheat Prevention - Rate Limiting
  try {
    console.log('📋 Testing Rate Limiting...');
    const playerId = 'test_player_rate_limit';
    
    let rateLimited = false;
    // Simulate rapid actions
    for (let i = 0; i < 12; i++) {
      const rateLimitCheck = cheatPreventionService.checkRateLimit(playerId);
      if (rateLimitCheck.isLimited) {
        rateLimited = true;
        break;
      }
    }
    
    if (rateLimited) {
      console.log('  ✅ Rate limiting working correctly');
      passed++;
    } else {
      throw new Error('Rate limiting not triggered');
    }
  } catch (error) {
    console.log('  ❌ Rate limiting test failed:', error);
    failed++;
  }

  // Test Summary
  console.log('');
  console.log('📈 Test Results');
  console.log('===============');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

  if (failed === 0) {
    console.log('');
    console.log('🎉 All core ZK features are working correctly!');
    console.log('');
    console.log('✨ Features Tested:');
    console.log('  🔒 Zero-Knowledge Proof Generation');
    console.log('  🎭 Hidden Information Management');
    console.log('  🛡️  Cheat Prevention Mechanisms');
    console.log('  ⚔️  Combat Stat Validation');
    console.log('  🎯 Equipment Bonus Calculation');
    console.log('  ⏱️  Rate Limiting Protection');
    console.log('');
    console.log('🚀 Ready for Midnight testnet deployment!');
  } else {
    console.log('');
    console.log('⚠️  Some tests failed. Please review the implementation.');
    process.exit(1);
  }
}

// Run tests
runSimpleTests().catch(console.error);