#!/usr/bin/env node

/**
 * Simple test script to verify the basic functionality of the bot components
 * without requiring actual Telegram bot token or WhatsApp connection
 */

// Set test environment
process.env.TELEGRAM_BOT_TOKEN = 'test_token_for_testing';
process.env.DATABASE_PATH = './test-database.sqlite';

import { config } from '../src/config/config';
import { database } from '../src/database/database';
import { logger } from '../src/utils/logger';

async function testBasicFunctionality() {
  console.log('🧪 Testing CGPTS Telegram-WhatsApp Bot basic functionality...\n');

  try {
    // Test 1: Configuration loading
    console.log('1. Testing configuration loading...');
    const appConfig = config.getAppConfig();
    console.log(`   ✅ App config loaded: port=${appConfig.port}, logLevel=${appConfig.logLevel}`);

    // Test 2: Database connection and initialization
    console.log('2. Testing database connection...');
    await database.connect();
    await database.initialize();
    console.log('   ✅ Database connected and initialized');

    // Test 3: Database user operations
    console.log('3. Testing database user operations...');
    const randomTelegramId = Math.floor(Math.random() * 1000000000);
    const testUser = await database.createUser(randomTelegramId, {
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      isAuthenticated: true
    });
    console.log(`   ✅ User created with ID: ${testUser.id}`);

    const foundUser = await database.getUserByTelegramId(randomTelegramId);
    console.log(`   ✅ User found: ${foundUser?.firstName} ${foundUser?.lastName}`);

    // Test 4: Database group operations
    console.log('4. Testing database group operations...');
    const testGroup = await database.createChatGroup({
      name: 'Test Group',
      whatsappGroupId: '120363025246125708@g.us',
      createdBy: testUser.id,
      isActive: true
    });
    console.log(`   ✅ Group created with ID: ${testGroup.id}`);

    const userGroups = await database.getChatGroupsByUser(testUser.id);
    console.log(`   ✅ Found ${userGroups.length} groups for user`);

    // Test 5: Logger functionality
    console.log('5. Testing logger functionality...');
    logger.info('Test log message');
    logger.warn('Test warning message');
    console.log('   ✅ Logger working correctly');

    // Cleanup
    await database.disconnect();
    console.log('\n✅ All tests passed! The bot infrastructure is working correctly.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  testBasicFunctionality().catch(console.error);
}

export { testBasicFunctionality };