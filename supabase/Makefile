.PHONY: dev stop help status test gen-types reset-and-seed verify-seed functions-serve

# Core Supabase commands
dev:
	supabase start

stop:
	supabase stop

help:
	supabase --help

status:
	supabase status

test:
	supabase test

# Type generation
gen-types:
	@echo "Generating database types..."
	npx supabase gen types typescript --local > database.types.ts
	@echo "Copying types to functions shared directory..."
	cp database.types.ts functions/_shared/database.types.ts
	@echo "Copying types to root directory..."
	cp database.types.ts ../database.types.ts
	@echo "Database types generated and copied successfully!"

# Seed database with test data
reset-and-seed:
	@echo "🚀 Full database reset and seed process..."
	@echo ""
	@echo "Step 0: Generating seed data with current ENCRYPTION_KEY..."
	@if [ -z "$$ENCRYPTION_KEY" ]; then \
		echo "❌ Error: ENCRYPTION_KEY environment variable is required"; \
		echo "💡 Set it in your .envrc file or export it"; \
		echo "💡 Example: export ENCRYPTION_KEY=0ipPbGjZ+qwqrzR5xPkMPrP+NgkKqfef/Stoh/dRD90="; \
		exit 1; \
	fi
	@if [ -z "$$SUPABASE_SERVICE_ROLE_KEY" ]; then \
		echo "❌ Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required"; \
		echo "💡 Get it from: Supabase Dashboard > Settings > API > service_role key"; \
		echo "💡 Then run: SUPABASE_SERVICE_ROLE_KEY=your_key make reset-and-seed"; \
		echo "💡 Or use direnv: create .envrc with 'export SUPABASE_SERVICE_ROLE_KEY=your_key'"; \
		exit 1; \
	fi
	node generate-seed-data.js
	@echo ""
	@echo "Step 1: Resetting database with migrations and seed.sql..."
	supabase db reset
	@echo ""
	@echo "Step 2: Creating auth users with specific UUIDs..."
	@cd ../frontend && node create-seed-users.js
	@echo ""
	@echo "Step 3: Verifying seed data..."
	@$(MAKE) verify-seed
	@echo ""
	@echo "🎉 Seed setup complete! You can now login with:"
	@echo "  📧 ceo@aviat.io / password123 (3 secrets with special timing)"
	@echo "  📧 john.doe@example.com / password123 (free tier - 1 secret)"
	@echo "  📧 alice.smith@company.com / password123 (pro tier - 4 secrets)"
	@echo "  📧 bob.wilson@startup.io / password123 (pro tier - 2 secrets)"

# Verify seed data integrity
verify-seed:
	@echo "🔍 Verifying database state..."
	@echo ""
	@echo "Auth Users:"
	@psql $(shell supabase status --output env | grep DB_URL | cut -d'=' -f2-) -c "SELECT id, email FROM auth.users ORDER BY email;" 2>/dev/null || echo "No auth users found"
	@echo ""
	@echo "User-Secret Summary:"
	@psql $(shell supabase status --output env | grep DB_URL | cut -d'=' -f2-) -c "SELECT u.email, COUNT(s.id) as secrets, ut.tier_name FROM auth.users u LEFT JOIN secrets s ON u.id = s.user_id LEFT JOIN user_tiers ut ON u.id = ut.user_id GROUP BY u.email, ut.tier_name ORDER BY u.email;" 2>/dev/null || echo "Failed to query data"

# Development functions
functions-serve:
	supabase functions serve --env-file functions/.env.development.local --no-verify-jwt

link-staging: link-env
	@if [ -z "$$SUPABASE_PROJECT_ID_STAGING" ]; then \
		read -p "Enter Supabase staging project ID: " project_id; \
		export SUPABASE_PROJECT_ID_STAGING=$$project_id; \
	fi
	npx @dotenvx/dotenvx run -f .env.staging -- npx supabase link --project-ref $$SUPABASE_PROJECT_ID_STAGING
link-prod: link-env
	@if [ -z "$$SUPABASE_PROJECT_ID_PROD" ]; then \
		read -p "Enter Supabase production project ID: " project_id; \
		export SUPABASE_PROJECT_ID_PROD=$$project_id; \
	fi
	npx @dotenvx/dotenvx run -f .env.production -- npx supabase link --project-ref $$SUPABASE_PROJECT_ID_PROD

deploy-db-staging: link-staging
	npx @dotenvx/dotenvx run -f .env.staging -- npx supabase db push
deploy-db-prod: link-prod
	npx @dotenvx/dotenvx run -f .env.production -- npx supabase db push

deploy-config-staging: link-staging
	npx @dotenvx/dotenvx run -f .env.staging -- npx supabase config push
deploy-config-prod: link-prod
	npx @dotenvx/dotenvx run -f .env.production -- npx supabase config push

deploy-functions-staging: link-staging
	npx @dotenvx/dotenvx run -f .env.staging -- npx supabase functions deploy
	npx @dotenvx/dotenvx run -f .env.staging -- npx supabase functions deploy check-in --no-verify-jwt
deploy-functions-prod: link-prod
	npx @dotenvx/dotenvx run -f .env.production -- npx supabase functions deploy
	npx @dotenvx/dotenvx run -f .env.production -- npx supabase functions deploy check-in --no-verify-jwt
	echo "✅ Functions deployed to production successfully!"

deploy-staging: deploy-config-staging deploy-functions-staging deploy-db-staging
deploy-prod: deploy-config-prod deploy-functions-prod deploy-db-prod

link-env:
	@if [ ! -L .env ]; then ln -s ../frontend/.env.development.local .env; fi
	@if [ ! -L .env.staging ]; then ln -s ../frontend/.env.staging.local .env.staging; fi
	@if [ ! -L .env.production ]; then ln -s ../frontend/.env.production.local .env.production; fi

unlink-env:
	unlink .env
	unlink .env.staging
	unlink .env.production
