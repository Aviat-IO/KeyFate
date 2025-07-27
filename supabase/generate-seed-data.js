#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Get the encryption key from environment
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
  console.error('ENCRYPTION_KEY environment variable is required');
  process.exit(1);
}

// Decode the base64 key to get raw bytes
const ENCRYPTION_KEY_BYTES = Buffer.from(ENCRYPTION_KEY, 'base64');

// Test data to encrypt - properly distributed across users
const testSecrets = [
    // CEO (48a35ccd-e1e4-458b-86ec-5bd88a0addc7) - 3 secrets with special timing
    // - Secret 1: Triggers in 1 minute (past due)
    // - Secret 2: Reminder ready in 30 seconds, triggers in 5 minutes
    // - Secret 3: Triggers in 30 days
  {
    id: '990e8400-e29b-41d4-a716-446655440001',
    userId: '48a35ccd-e1e4-458b-86ec-5bd88a0addc7',
    title: 'Bitcoin Wallet Recovery',
    content: 'testencryptedmessagedataforbitcoinwallet',
    status: 'active',
    isTriggered: false,
    triggeredAt: null,
    lastCheckIn: 'NOW() - INTERVAL \'7 days\'',
    nextCheckIn: 'NOW() - INTERVAL \'1 minute\'',
    recipientEmail: 'ceo@aviat.io'
  },
  {
    id: '990e8400-e29b-41d4-a716-446655440002',
    userId: '48a35ccd-e1e4-458b-86ec-5bd88a0addc7',
    title: 'Buried Gold Location',
    content: 'testencryptedmessagedataforburiedgoldlocation',
    status: 'active',
    isTriggered: false,
    triggeredAt: null,
    lastCheckIn: 'NOW() - INTERVAL \'6 days 23 hours 55 minutes\'',
    nextCheckIn: 'NOW() + INTERVAL \'5 minutes\'',
    recipientEmail: 'ceo@aviat.io'
  },
  {
    id: '990e8400-e29b-41d4-a716-446655440003',
    userId: '48a35ccd-e1e4-458b-86ec-5bd88a0addc7',
    title: 'Safe Combination',
    content: 'testencryptedmessagedataforsafecombination',
    status: 'active',
    isTriggered: false,
    triggeredAt: null,
    lastCheckIn: 'NOW() - INTERVAL \'1 day\'',
    nextCheckIn: 'NOW() + INTERVAL \'1 month\'',
    recipientEmail: 'ceo@aviat.io'
  },

  // John Doe (836f82db-9912-4b34-8101-1f16b49dfa5f) - 1 secret (free tier)
  {
    id: '990e8400-e29b-41d4-a716-446655440011',
    userId: '836f82db-9912-4b34-8101-1f16b49dfa5f',
    title: 'Personal Documents Location',
    content: 'testencryptedmessagedataforpersonaldocuments',
    status: 'active',
    isTriggered: false,
    triggeredAt: null,
    lastCheckIn: 'NOW() - INTERVAL \'2 days\'',
    nextCheckIn: 'NOW() + INTERVAL \'5 days\''
  },

  // Alice Smith (2734a10c-2335-480b-8bf3-efc468cf89de) - 4 secrets (pro tier)
  {
    id: '990e8400-e29b-41d4-a716-446655440021',
    userId: '2734a10c-2335-480b-8bf3-efc468cf89de',
    title: 'Offshore Account Details',
    content: 'testencryptedmessagedataforoffshoreaccount',
    status: 'active',
    isTriggered: false,
    triggeredAt: null,
    lastCheckIn: 'NOW() - INTERVAL \'1 day\'',
    nextCheckIn: 'NOW() + INTERVAL \'6 days\''
  },
  {
    id: '990e8400-e29b-41d4-a716-446655440022',
    userId: '2734a10c-2335-480b-8bf3-efc468cf89de',
    title: 'Server Access Keys',
    content: 'testencryptedmessagedataforserveraccess',
    status: 'active',
    isTriggered: false,
    triggeredAt: null,
    lastCheckIn: 'NOW() - INTERVAL \'3 days\'',
    nextCheckIn: 'NOW() + INTERVAL \'11 days\''
  },
  {
    id: '990e8400-e29b-41d4-a716-446655440023',
    userId: '2734a10c-2335-480b-8bf3-efc468cf89de',
    title: 'Bitcoin Wallet Recovery',
    content: 'testencryptedmessagedataforbitcoinwallet2',
    status: 'paused',
    isTriggered: false,
    triggeredAt: null,
    lastCheckIn: 'NOW() - INTERVAL \'5 days\'',
    nextCheckIn: 'NOW() + INTERVAL \'2 days\''
  },
  {
    id: '990e8400-e29b-41d4-a716-446655440024',
    userId: '2734a10c-2335-480b-8bf3-efc468cf89de',
    title: 'Buried Gold Location',
    content: 'testencryptedmessagedataforburiedgold2',
    status: 'active',
    isTriggered: false,
    triggeredAt: null,
    lastCheckIn: 'NOW() - INTERVAL \'4 days\'',
    nextCheckIn: 'NOW() + INTERVAL \'3 days\''
  },

  // Bob Wilson (78dd97e7-1ce4-4a41-8fdc-69e3371f2175) - 2 secrets (pro tier)
  {
    id: '990e8400-e29b-41d4-a716-446655440031',
    userId: '78dd97e7-1ce4-4a41-8fdc-69e3371f2175',
    title: 'Safe Combination',
    content: 'testencryptedmessagedataforsafecombination2',
    status: 'active',
    isTriggered: false,
    triggeredAt: null,
    lastCheckIn: 'NOW() - INTERVAL \'1 day\'',
    nextCheckIn: 'NOW() + INTERVAL \'6 days\''
  },
  {
    id: '990e8400-e29b-41d4-a716-446655440032',
    userId: '78dd97e7-1ce4-4a41-8fdc-69e3371f2175',
    title: 'Server Access Keys',
    content: 'testencryptedmessagedataforserveraccess2',
    status: 'active',
    isTriggered: false,
    triggeredAt: null,
    lastCheckIn: 'NOW() - INTERVAL \'2 days\'',
    nextCheckIn: 'NOW() + INTERVAL \'12 days\''
  }
];

async function encryptData(data) {
  // Generate a random IV
  const iv = crypto.randomBytes(12);

  // Import the key
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    ENCRYPTION_KEY_BYTES,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  // Encrypt the data
  const encodedData = new TextEncoder().encode(data);
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    cryptoKey,
    encodedData
  );

  // Split the result into encrypted data and auth tag
  const encrypted = new Uint8Array(encryptedBuffer.slice(0, -16));
  const authTag = new Uint8Array(encryptedBuffer.slice(-16));

  return {
    encrypted: Buffer.from(encrypted).toString('base64'),
    iv: iv.toString('base64'),
    authTag: Buffer.from(authTag).toString('base64')
  };
}

async function generateSeedSQL() {
  console.log('Generating encrypted data for seed file...');

  const encryptedSecrets = [];

  for (const secret of testSecrets) {
    const encrypted = await encryptData(secret.content);
    encryptedSecrets.push({
      ...secret,
      ...encrypted
    });
  }

  // Read the template seed file
  const templatePath = path.join(__dirname, 'seed.sql.template');
  let seedSQL = fs.readFileSync(templatePath, 'utf8');

  // Replace the placeholder with actual encrypted data
  const secretsSQL = encryptedSecrets.map(secret => {
    const triggeredAtClause = secret.triggeredAt ? `, ${secret.triggeredAt}` : ', null';
    const recipientEmail = secret.recipientEmail || 'recipient@example.com';
    return `('${secret.id}', '${secret.userId}', '${secret.title}', 'Recipient', '${recipientEmail}', 'email', 7,
'${secret.encrypted}', '${secret.iv}', '${secret.authTag}',
3, 2, '${secret.status}', ${secret.lastCheckIn}, ${secret.nextCheckIn}, NOW() - INTERVAL '15 days', NOW(), ${secret.isTriggered}${triggeredAtClause})`;
  }).join(',\n');

  seedSQL = seedSQL.replace('{{ENCRYPTED_SECRETS}}', secretsSQL);

  // Write the generated seed file
  const outputPath = path.join(__dirname, 'seed.sql');
  fs.writeFileSync(outputPath, seedSQL);

  console.log(`Generated seed.sql with ${encryptedSecrets.length} encrypted secrets`);
  console.log('You can now run: make reset-and-seed');
  console.log('\nTo test reminder system:');
  console.log('1. Run: make reset-and-seed');
  console.log('2. Run: cd scripts && ./trigger-reminders.sh');
  console.log('3. Wait 30-60 seconds for CEO\'s "Buried Gold Location" reminder to be ready');
}

generateSeedSQL().catch(console.error);
