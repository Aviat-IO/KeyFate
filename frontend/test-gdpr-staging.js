const { Pool } = require('pg');

const pool = new Pool({
  connectionString: "postgresql://keyfate_app:hM65ANes82sH+hAmtmmhMB9N5lo5JFQbEjZiDn1DCpk=@localhost:54321/keyfate?sslmode=disable"
});

async function test() {
  try {
    console.log('🔍 Testing GDPR tables in staging...\n');
    
    // Test 1: Check if tables exist
    console.log('1️⃣ Checking if GDPR tables exist...');
    const tablesCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'data_export_jobs'
      ) as export_jobs_exists,
      EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'account_deletion_requests'
      ) as deletion_requests_exists
    `);
    console.log(tablesCheck.rows[0]);
    
    if (!tablesCheck.rows[0].export_jobs_exists || !tablesCheck.rows[0].deletion_requests_exists) {
      console.log('\n❌ GDPR tables do not exist! Run migrations first.');
      process.exit(1);
    }
    console.log('✅ GDPR tables exist\n');
    
    // Test 2: Check counts
    console.log('2️⃣ Checking GDPR data counts...');
    const counts = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM data_export_jobs) as total_export_jobs,
        (SELECT COUNT(*) FROM data_export_jobs WHERE status = 'pending') as pending_exports,
        (SELECT COUNT(*) FROM data_export_jobs WHERE status = 'completed') as completed_exports,
        (SELECT COUNT(*) FROM data_export_jobs WHERE expires_at < NOW()) as expired_exports,
        (SELECT COUNT(*) FROM account_deletion_requests) as total_deletion_requests,
        (SELECT COUNT(*) FROM account_deletion_requests WHERE status = 'confirmed') as confirmed_deletions
    `);
    console.log(counts.rows[0]);
    console.log();
    
    // Test 3: Recent export jobs
    console.log('3️⃣ Recent export jobs (last 5):');
    const exports = await pool.query(`
      SELECT id, user_id, status, created_at, expires_at 
      FROM data_export_jobs 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    if (exports.rows.length === 0) {
      console.log('   (No export jobs found)');
    } else {
      exports.rows.forEach(row => {
        console.log(`   - ${row.id.substring(0, 8)}... | User: ${row.user_id.substring(0, 8)}... | Status: ${row.status}`);
      });
    }
    console.log();
    
    // Test 4: Recent deletion requests
    console.log('4️⃣ Recent deletion requests (last 5):');
    const deletions = await pool.query(`
      SELECT id, user_id, status, scheduled_deletion_at, created_at 
      FROM account_deletion_requests 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    if (deletions.rows.length === 0) {
      console.log('   (No deletion requests found)');
    } else {
      deletions.rows.forEach(row => {
        console.log(`   - ${row.id.substring(0, 8)}... | User: ${row.user_id.substring(0, 8)}... | Status: ${row.status}`);
      });
    }
    console.log();
    
    // Test 5: Check users (to create test data if needed)
    console.log('5️⃣ Checking for test users...');
    const users = await pool.query(`
      SELECT id, email 
      FROM users 
      ORDER BY created_at DESC 
      LIMIT 3
    `);
    if (users.rows.length === 0) {
      console.log('   ⚠️  No users found - create a user first to test GDPR features');
    } else {
      console.log(`   Found ${users.rows.length} users (showing first 3):`);
      users.rows.forEach(row => {
        console.log(`   - ${row.id.substring(0, 8)}... | ${row.email}`);
      });
    }
    
    console.log('\n✅ Database connectivity test complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

test();
