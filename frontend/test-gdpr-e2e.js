const { Pool } = require('pg');

const pool = new Pool({
  connectionString: "postgresql://keyfate_app:hM65ANes82sH+hAmtmmhMB9N5lo5JFQbEjZiDn1DCpk=@localhost:54321/keyfate?sslmode=disable"
});

async function test() {
  try {
    console.log('🧪 GDPR End-to-End Test\n');
    console.log('='.repeat(80) + '\n');
    
    // Get a test user
    const users = await pool.query(`
      SELECT id, email FROM users LIMIT 1
    `);
    
    if (users.rows.length === 0) {
      console.log('❌ No users found. Create a user first.');
      return;
    }
    
    const testUser = users.rows[0];
    console.log(`Using test user: ${testUser.email} (${testUser.id.substring(0, 8)}...)\n`);
    
    // Test 1: Create a pending export job
    console.log('📤 TEST 1: Creating pending export job...');
    const exportJob = await pool.query(`
      INSERT INTO data_export_jobs (user_id, status, expires_at)
      VALUES ($1, 'pending', NOW() + INTERVAL '24 hours')
      RETURNING id, status, created_at
    `, [testUser.id]);
    
    console.log(`   ✓ Created export job: ${exportJob.rows[0].id}`);
    console.log(`   Status: ${exportJob.rows[0].status}\n`);
    
    // Test 2: Create an expired export job (for cleanup test)
    console.log('🗑️  TEST 2: Creating expired export job...');
    const expiredJob = await pool.query(`
      INSERT INTO data_export_jobs (
        user_id, 
        status, 
        file_url, 
        file_size,
        expires_at,
        completed_at
      )
      VALUES (
        $1, 
        'completed', 
        'https://storage.googleapis.com/test-bucket/test-file.json',
        1024,
        NOW() - INTERVAL '1 hour',
        NOW() - INTERVAL '25 hours'
      )
      RETURNING id, status, expires_at
    `, [testUser.id]);
    
    console.log(`   ✓ Created expired export: ${expiredJob.rows[0].id}`);
    console.log(`   Expired at: ${expiredJob.rows[0].expires_at}\n`);
    
    // Test 3: Create a deletion request past grace period
    console.log('🔥 TEST 3: Creating deletion request (past grace period)...');
    const deletionReq = await pool.query(`
      INSERT INTO account_deletion_requests (
        user_id,
        status,
        confirmation_token,
        confirmed_at,
        scheduled_deletion_at
      )
      VALUES (
        $1,
        'confirmed',
        'test-token-' || gen_random_uuid(),
        NOW() - INTERVAL '31 days',
        NOW() - INTERVAL '1 hour'
      )
      RETURNING id, status, scheduled_deletion_at
    `, [testUser.id]);
    
    console.log(`   ✓ Created deletion request: ${deletionReq.rows[0].id}`);
    console.log(`   Scheduled for: ${deletionReq.rows[0].scheduled_deletion_at}`);
    console.log(`   ⚠️  WARNING: This will delete user ${testUser.email} when process-deletions runs!\n`);
    
    // Summary
    console.log('='.repeat(80));
    console.log('📊 TEST DATA CREATED:\n');
    console.log(`✓ 1 pending export job (ready for process-exports cron)`);
    console.log(`✓ 1 expired export job (ready for cleanup-exports cron)`);
    console.log(`✓ 1 confirmed deletion request (ready for process-deletions cron)`);
    console.log('\n' + '='.repeat(80) + '\n');
    
    // Show how to test
    console.log('🎯 NEXT STEPS:\n');
    console.log('1. Test process-exports cron:');
    console.log('   gcloud scheduler jobs run keyfate-process-exports-staging --project=YOUR_PROJECT\n');
    
    console.log('2. Test cleanup-exports cron:');
    console.log('   gcloud scheduler jobs run keyfate-cleanup-exports-staging --project=YOUR_PROJECT\n');
    
    console.log('3. Test process-deletions cron (⚠️  WILL DELETE USER):');
    console.log('   gcloud scheduler jobs run keyfate-process-deletions-staging --project=YOUR_PROJECT\n');
    
    console.log('4. Or test via API with CRON_SECRET:');
    console.log('   curl -X POST "https://your-staging-url/api/cron/process-exports" \\');
    console.log('     -H "Authorization: Bearer $CRON_SECRET" \\');
    console.log('     -H "Content-Type: application/json"\n');
    
    console.log('5. Check logs:');
    console.log('   gcloud logs read --project=YOUR_PROJECT --limit=50 | grep CRON\n');
    
    console.log('6. Verify results:');
    console.log('   node test-gdpr-staging.js\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

test();
