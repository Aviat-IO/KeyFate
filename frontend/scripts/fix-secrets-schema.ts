import { db } from '../src/lib/db/drizzle';

async function fixSecretsSchema() {
  try {
    console.log('🔍 Checking current secrets table structure...');

    // Check if the table exists
    const tableExists = await db.execute(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'secrets'
      );
    `);

    if (!tableExists.rows[0]?.exists) {
      console.log('❌ Secrets table does not exist. Running full migration...');

      // Read and execute the migration file
      const fs = require('fs');
      const path = require('path');
      const migrationPath = path.join(__dirname, '../drizzle/0000_chubby_daimon_hellstrom.sql');
      const migrationSql = fs.readFileSync(migrationPath, 'utf8');

      await db.execute(migrationSql);
      console.log('✅ Migration executed successfully');
      return;
    }

    // Check current columns
    const columns = await db.execute(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'secrets'
      ORDER BY ordinal_position;
    `);

    console.log('📋 Current table structure:');
    columns.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });

    // Check for recipient_name specifically
    const hasRecipientName = columns.rows.some(row => row.column_name === 'recipient_name');

    if (!hasRecipientName) {
      console.log('\n❌ recipient_name column missing!');

      // Check for alternative names
      const nameColumns = columns.rows.filter(row =>
        row.column_name.includes('name') || row.column_name.includes('recipient')
      );

      if (nameColumns.length > 0) {
        console.log('🔍 Found similar columns:');
        nameColumns.forEach(col => console.log(`  - ${col.column_name}`));

        // If we find a differently named column, we might need to rename it
        if (nameColumns.some(col => col.column_name === 'recipientname')) {
          console.log('🔧 Found recipientname column, renaming to recipient_name...');
          await db.execute(`ALTER TABLE secrets RENAME COLUMN recipientname TO recipient_name;`);
          console.log('✅ Renamed column successfully');
        }
      } else {
        console.log('🔧 Adding missing recipient_name column...');
        await db.execute(`ALTER TABLE secrets ADD COLUMN recipient_name text NOT NULL DEFAULT '';`);
        console.log('✅ Added recipient_name column');
      }
    } else {
      console.log('✅ recipient_name column exists');
    }

    // Check all required columns exist
    const requiredColumns = [
      'id', 'user_id', 'title', 'recipient_name', 'recipient_email',
      'recipient_phone', 'contact_method', 'check_in_days', 'status',
      'server_share', 'iv', 'auth_tag', 'sss_shares_total', 'sss_threshold'
    ];

    const existingColumns = columns.rows.map(row => row.column_name);
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

    if (missingColumns.length > 0) {
      console.log('\n❌ Missing required columns:', missingColumns);
      console.log('🔧 This requires a full schema update. Please run: npm run db:push');
    } else {
      console.log('\n✅ All required columns present');
    }

  } catch (error) {
    console.error('❌ Error checking/fixing schema:', error);
  }
}

// Run if called directly
if (require.main === module) {
  fixSecretsSchema().then(() => {
    console.log('Schema check/fix completed');
    process.exit(0);
  }).catch(error => {
    console.error('Schema fix failed:', error);
    process.exit(1);
  });
}

export { fixSecretsSchema };