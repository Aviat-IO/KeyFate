import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

// Local development may use an ignored .env.local file. Railway and CI inject
// DATABASE_URL directly; never print the URL or related environment inventory.
const envLocalPath = '.env.local';
if (fs.existsSync(envLocalPath)) dotenv.config({ path: envLocalPath });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for migrations');

const config = defineConfig({
	schema: './src/lib/db/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: {
		url: databaseUrl
	},
	verbose: true,
	strict: true
});

export default config;
