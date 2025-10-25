/**
 * Neon PostgreSQL Connection Test
 * 
 * This script tests if Prisma can connect to your Neon database.
 * It bypasses NestJS to isolate database connection issues.
 * 
 * Run: node test-neon.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function testConnection() {
  console.log('='.repeat(70));
  console.log('🧪 Testing Neon PostgreSQL Connection');
  console.log('='.repeat(70));
  console.log('');

  try {
    console.log('📊 Step 1: Reading DATABASE_URL from .env...');
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL is not set in .env file');
    }
    
    // Mask password in URL for logging
    const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':****@');
    console.log('✅ DATABASE_URL found:', maskedUrl);
    console.log('');

    console.log('📊 Step 2: Initializing Prisma Client...');
    console.log('✅ Prisma Client created');
    console.log('');

    console.log('📊 Step 3: Attempting to connect to database...');
    console.log('⏱️  Timeout: 10 seconds');
    console.log('');

    // Set a timeout for the connection attempt
    const connectionPromise = prisma.$connect();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000);
    });

    await Promise.race([connectionPromise, timeoutPromise]);
    console.log('✅ Successfully connected to Neon PostgreSQL!');
    console.log('');

    console.log('📊 Step 4: Running test query (SELECT 1)...');
    const result = await prisma.$queryRaw`SELECT 1 as result`;
    console.log('✅ Test query successful:', result);
    console.log('');

    console.log('📊 Step 5: Checking database schema...');
    const tableCount = await prisma.$queryRaw`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    console.log('✅ Found', tableCount[0].count, 'tables in public schema');
    console.log('');

    console.log('📊 Step 6: Testing User table query...');
    const userCount = await prisma.user.count();
    console.log('✅ User count:', userCount);
    console.log('');

    console.log('='.repeat(70));
    console.log('🎉 SUCCESS: All database tests passed!');
    console.log('='.repeat(70));
    console.log('');
    console.log('✅ Your Neon database is working correctly.');
    console.log('✅ The issue is likely in NestJS application startup, not the database.');
    console.log('');
    console.log('📋 Next Steps:');
    console.log('   1. Check src/database/prisma.service.ts for issues');
    console.log('   2. Try making PrismaService.onModuleInit() non-blocking');
    console.log('   3. Check if other modules are interfering with startup');
    console.log('');

  } catch (error) {
    console.error('='.repeat(70));
    console.error('❌ ERROR: Database connection failed!');
    console.error('='.repeat(70));
    console.error('');
    console.error('Error Type:', error.constructor.name);
    console.error('Error Message:', error.message);
    console.error('');

    if (error.message.includes('timeout')) {
      console.error('🔍 Diagnosis: Connection timeout');
      console.error('');
      console.error('Possible causes:');
      console.error('   1. Neon database is not responding (check status.neon.tech)');
      console.error('   2. Firewall or antivirus blocking connection');
      console.error('   3. Invalid connection string in .env');
      console.error('   4. Network connectivity issues');
      console.error('');
      console.error('Solutions:');
      console.error('   1. Check Neon dashboard: https://console.neon.tech');
      console.error('   2. Verify DATABASE_URL in .env is correct');
      console.error('   3. Try pinging the Neon endpoint');
      console.error('   4. Disable antivirus temporarily and retry');
      console.error('');
    } else if (error.message.includes('authentication')) {
      console.error('🔍 Diagnosis: Authentication failed');
      console.error('');
      console.error('Possible causes:');
      console.error('   1. Incorrect database password');
      console.error('   2. User does not have access to database');
      console.error('   3. Connection string format is wrong');
      console.error('');
      console.error('Solutions:');
      console.error('   1. Copy connection string from Neon dashboard again');
      console.error('   2. Ensure you are using the POOLED connection string');
      console.error('   3. Check for extra spaces or quotes in .env');
      console.error('');
    } else if (error.message.includes('does not exist')) {
      console.error('🔍 Diagnosis: Database or table not found');
      console.error('');
      console.error('Possible causes:');
      console.error('   1. Migrations have not been run');
      console.error('   2. Wrong database name in connection string');
      console.error('   3. Database was deleted or recreated');
      console.error('');
      console.error('Solutions:');
      console.error('   1. Run: npx prisma migrate deploy');
      console.error('   2. Verify database name in Neon dashboard');
      console.error('   3. Check schema.prisma datasource configuration');
      console.error('');
    } else {
      console.error('🔍 Diagnosis: Unknown error');
      console.error('');
      console.error('Full error details:');
      console.error(error);
      console.error('');
      console.error('Stack trace:');
      console.error(error.stack);
      console.error('');
    }

    process.exit(1);
  } finally {
    console.log('📊 Disconnecting from database...');
    await prisma.$disconnect();
    console.log('✅ Disconnected successfully');
    console.log('');
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('');
  console.error('='.repeat(70));
  console.error('💥 UNCAUGHT EXCEPTION');
  console.error('='.repeat(70));
  console.error('');
  console.error('This error occurred outside of normal error handling.');
  console.error('It could indicate a serious issue with Prisma or Node.js.');
  console.error('');
  console.error('Error:', error);
  console.error('');
  console.error('Stack trace:');
  console.error(error.stack);
  console.error('');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('');
  console.error('='.repeat(70));
  console.error('💥 UNHANDLED PROMISE REJECTION');
  console.error('='.repeat(70));
  console.error('');
  console.error('A promise was rejected but not caught.');
  console.error('');
  console.error('Promise:', promise);
  console.error('Reason:', reason);
  console.error('');
  if (reason instanceof Error) {
    console.error('Stack trace:');
    console.error(reason.stack);
  }
  console.error('');
  process.exit(1);
});

// Run the test
console.log('');
testConnection();
