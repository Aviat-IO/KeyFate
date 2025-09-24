import { db } from '../src/lib/db/drizzle';

async function checkMigrations() {
  try {
    console.log('Checking database connection...');

    // Check if secrets table exists
    const tableCheck = await db.execute(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'secrets';
    `);

    if (tableCheck.rows.length === 0) {
      console.log('❌ secrets table does not exist');
      return;
    }

    console.log('✅ secrets table exists');

    // Check columns in secrets table
    const columnCheck = await db.execute(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'secrets'
      ORDER BY ordinal_position;
    `);

    console.log('\n📋 Secrets table columns:');
    columnCheck.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    // Specifically check for recipient_name
    const recipientNameCheck = columnCheck.rows.find(row => row.column_name === 'recipient_name');

    if (recipientNameCheck) {
      console.log('\n✅ recipient_name column exists');
    } else {
      console.log('\n❌ recipient_name column does NOT exist');

      // Check for similar columns
      const similarColumns = columnCheck.rows.filter(row =>
        row.column_name.includes('recipient') || row.column_name.includes('name')
      );

      if (similarColumns.length > 0) {
        console.log('\n🔍 Similar columns found:');
        similarColumns.forEach(col => {
          console.log(`  - ${col.column_name}`);
        });
      }
    }

  } catch (error) {
    console.error('Error checking migrations:', error);
  }
}

checkMigrations();