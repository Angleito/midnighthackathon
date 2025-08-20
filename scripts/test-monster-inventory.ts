#!/usr/bin/env ts-node

/**
 * Test script for Monster Inventory Management System
 * 
 * Run this script to test the monster inventory system:
 * npx ts-node scripts/test-monster-inventory.ts
 */

import { runMonsterInventoryExample, testSwitchValidation, testCombatScenario } from '../src/examples/monsterInventoryExample';

async function main() {
  console.log('🌊 ZK Ocean Combat - Monster Inventory Test Script\n');

  try {
    console.log('Running comprehensive monster inventory example...\n');
    await runMonsterInventoryExample();

    console.log('\n' + '='.repeat(60) + '\n');

    console.log('Running switch validation tests...\n');
    await testSwitchValidation();

    console.log('\n' + '='.repeat(60) + '\n');

    console.log('Running combat scenario test...\n');
    await testCombatScenario();

    console.log('\n✅ All tests completed successfully!');
    console.log('\nMonster Inventory Management System is ready for use.');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { main as testMonsterInventory };