.PHONY: install dev stop clean test migrate seed deploy-staging deploy-prod help status reset-db debug-db test-db-connection clean-db ensure-database create-database db-tunnel-staging db-tunnel-prod db-migrate-staging db-migrate-prod db-studio-staging db-studio-prod

# Default target
help:
	@echo "🚀 Dead Man's Switch - Local Development Infrastructure"
	@echo ""
	@echo "Available commands:"
	@echo ""
	@echo "Local Development:"
	@echo "  make install          - Complete local environment setup"
	@echo "  make dev              - Start full local development stack"
	@echo "  make stop             - Stop all local services"
	@echo "  make clean            - Clean up containers and volumes"
	@echo "  make test             - Run infrastructure tests"
	@echo "  make migrate          - Run database migrations (local)"
	@echo "  make seed             - Seed database with development data"
	@echo "  make reset-db         - Reset database (migrate + seed)"
	@echo "  make clean-db         - Remove database volumes and start fresh"
	@echo "  make status           - Show status of all services"
	@echo ""
	@echo "Remote Database Access (via bastion host):"
	@echo "  make db-tunnel-staging  - SSH tunnel to staging DB (run in Terminal 1)"
	@echo "  make db-tunnel-prod     - SSH tunnel to production DB (run in Terminal 1)"
	@echo "  make db-studio-staging  - Open Drizzle Studio for staging (run in Terminal 2)"
	@echo "  make db-studio-prod     - Open Drizzle Studio for production (run in Terminal 2)"
	@echo "  make db-migrate-staging - Run migrations against staging"
	@echo "  make db-migrate-prod    - Run migrations against production"
	@echo ""
	@echo "Deployment:"
	@echo "  make deploy-staging   - Deploy to staging environment"
	@echo "  make deploy-prod      - Deploy to production environment"
	@echo "  make sync-doppler-dev - Sync Doppler secrets to dev terraform.tfvars"
	@echo "  make sync-doppler-prod - Sync Doppler secrets to prod terraform.tfvars"
	@echo ""

# Complete local environment setup
install:
	@echo "🔧 Installing local development environment..."
	@echo ""
	@echo "Step 1: Checking Docker installation..."
	@command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed. Please install Docker Desktop."; exit 1; }
	@command -v docker-compose >/dev/null 2>&1 || { echo "❌ Docker Compose is required. Please install Docker Desktop or docker-compose."; exit 1; }
	@echo "✅ Docker and Docker Compose found"
	@echo ""
	@echo "Step 2: Setting up environment files..."
	@$(MAKE) setup-env-files
	@echo ""
	@echo "Step 3: Creating necessary directories..."
	@mkdir -p database/migrations database/seeds logs
	@mkdir -p scripts deploy
	@echo "✅ Directories created"
	@echo ""
	@echo "Step 4: Installing dependencies..."
	@npm install
	@echo "ℹ️  Frontend dependencies already installed (skipping npm install)"
	@echo "✅ Dependencies ready"
	@echo ""
	@echo "Step 5: Building Docker containers..."
	@docker-compose build
	@echo "✅ Docker containers built"
	@echo ""
	@echo "Step 6: Setting up database..."
	@$(MAKE) setup-database
	@echo ""
	@echo "🎉 Local development environment installation complete!"
	@echo ""
	@echo "Next steps:"
	@echo "  1. Copy .env.local.example to .env.local and configure your settings"
	@echo "  2. Run 'make dev' to start the development environment"
	@echo ""

# Start full local development stack
dev:
	@echo "🚀 Starting local development stack..."
	@echo ""
	@echo "Step 1: Starting database services..."
	@docker-compose up -d postgres
	@echo "⏳ Waiting for database to be ready..."
	@$(MAKE) wait-for-healthy SERVICE=postgres
	@echo "⏳ Verifying database connection..."
	@$(MAKE) ensure-database
	@echo "  Testing connection to keyfate_dev database..."
	@for i in {1..15}; do \
		docker-compose exec -T postgres pg_isready -U postgres -d keyfate_dev >/dev/null 2>&1 && break || \
		{ echo "  Attempt $$i/15: Waiting for database..."; sleep 2; }; \
	done; \
	docker-compose exec -T postgres pg_isready -U postgres -d keyfate_dev >/dev/null 2>&1 || \
	{ echo "❌ Database connection failed after 30 seconds"; echo "📋 Recent PostgreSQL logs:"; docker-compose logs --tail=10 postgres; echo "🔍 Container status:"; docker-compose ps postgres; exit 1; }
	@echo "✅ Database is ready"
	@echo ""
	@echo "Step 2: Running migrations..."
	@$(MAKE) migrate
	@echo ""
	@echo "Step 3: Starting frontend development server..."
	@echo "🌐 Frontend will be available at: http://localhost:3000"
	@echo "🗄️  Database will be available at: localhost:5432"
	@echo ""
	@cd frontend && npm run dev

# Stop all local services
stop:
	@echo "🛑 Stopping all local services..."
	@docker-compose down
	@echo "✅ All services stopped"

# Clean up containers and volumes
clean:
	@echo "🧹 Cleaning up containers and volumes..."
	@docker-compose down -v --remove-orphans
	@docker system prune -f
	@echo "✅ Cleanup complete"

# Run infrastructure tests
test:
	@echo "🧪 Running infrastructure tests..."
	@node test-infrastructure.js

# Run database migrations
migrate:
	@echo "📊 Running database migrations..."
	@cd frontend && npm run db:migrate
	@echo "✅ Migrations complete"

# Seed database with development data
seed:
	@echo "🌱 Seeding database with development data..."
	@node scripts/seed-local-db.js
	@echo "✅ Database seeded"

# Reset database (migrate + seed)
reset-db:
	@echo "🔄 Resetting database..."
	@$(MAKE) migrate
	@$(MAKE) seed
	@echo "✅ Database reset complete"

# Show status of all services
status:
	@echo "📊 Service Status:"
	@docker-compose ps
	@echo ""
	@echo "🔍 Database Quick Check:"
	@if docker-compose ps postgres | grep -q "healthy"; then \
		echo "✅ PostgreSQL container is healthy"; \
		docker-compose exec -T postgres psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'keyfate_dev'" | grep -q 1 && echo "✅ keyfate_dev database exists" || echo "⚠️  keyfate_dev database missing"; \
		docker-compose exec -T postgres pg_isready -U postgres -d keyfate_dev > /dev/null 2>&1 && echo "✅ Database connection works" || echo "⚠️  Database connection failed"; \
	elif docker-compose ps postgres | grep -q "Up"; then \
		echo "⚠️  PostgreSQL container running but not healthy"; \
	else \
		echo "❌ PostgreSQL container not running"; \
	fi

# Debug database connectivity issues
debug-db:
	@echo "🔧 Database Debug Information:"
	@echo ""
	@echo "📊 Container Status:"
	@docker-compose ps postgres
	@echo ""
	@echo "📋 Recent Container Logs (last 20 lines):"
	@docker-compose logs --tail=20 postgres
	@echo ""
	@echo "🔍 Connection Tests:"
	@echo "1. Health check status:"
	@docker-compose ps postgres | awk 'NR==2 {print "   " $$6}'
	@echo "2. PostgreSQL ready check (keyfate_dev):"
	@docker-compose exec -T postgres pg_isready -U postgres -d keyfate_dev || echo "   Connection to keyfate_dev failed"
	@echo "3. PostgreSQL ready check (postgres default):"
	@docker-compose exec -T postgres pg_isready -U postgres -d postgres || echo "   Connection to postgres failed"
	@echo "4. Database list check:"
	@docker-compose exec -T postgres psql -U postgres -l || echo "   Database query failed"
	@echo "5. Specific database existence check:"
	@docker-compose exec -T postgres psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'keyfate_dev'" | grep -q 1 && echo "   ✅ keyfate_dev database exists" || echo "   ❌ keyfate_dev database missing"
	@echo "6. Environment variables in container:"
	@docker-compose exec -T postgres env | grep POSTGRES || echo "   Failed to get environment variables"

# Quick database connection test
test-db-connection:
	@echo "🔍 Quick Database Connection Test:"
	@echo ""
	@if ! docker-compose ps postgres | grep -q "Up"; then \
		echo "❌ PostgreSQL container is not running"; \
		echo "   Run 'docker-compose up -d postgres' to start it"; \
		exit 1; \
	fi
	@echo "✅ PostgreSQL container is running"
	@echo "⏳ Testing database connections..."
	@printf "  keyfate_dev database: "; docker-compose exec -T postgres pg_isready -U postgres -d keyfate_dev >/dev/null 2>&1 && echo "✅ Connected" || echo "❌ Failed"
	@printf "  postgres database: "; docker-compose exec -T postgres pg_isready -U postgres -d postgres >/dev/null 2>&1 && echo "✅ Connected" || echo "❌ Failed"
	@echo ""
	@echo "🔍 If connections failed, run 'make debug-db' for detailed information"

# Deploy to staging environment
deploy-staging:
	@echo "🚀 Deploying to staging environment..."
	@./scripts/deploy-staging.sh

# Deploy to production environment
deploy-prod:
	@echo "🚀 Deploying to production environment..."
	@./scripts/deploy-prod.sh

# Internal targets
wait-for-healthy:
	@echo "⏳ Waiting for $(SERVICE) to be healthy..."
	@timeout 90 bash -c 'until docker-compose ps $(SERVICE) | grep -q "healthy"; do echo "  $(SERVICE) health status: $$(docker-compose ps $(SERVICE) | awk '\''NR==2 {print $$6}'\'')"; sleep 3; done' || { echo "❌ $(SERVICE) failed health check within 90 seconds"; echo "📋 Recent logs:"; docker-compose logs --tail=20 $(SERVICE); exit 1; }
	@echo "✅ $(SERVICE) is healthy"

check-database-ready:
	@echo "🔍 Checking database readiness..."
	@docker-compose exec -T postgres pg_isready -U postgres -d keyfate_dev > /dev/null 2>&1 && echo "✅ Database connection verified" || { echo "❌ Database not ready"; exit 1; }

setup-env-files:
	@echo "Setting up environment files..."
	@if [ ! -f .env.local ]; then cp .env.local.example .env.local 2>/dev/null || echo "# Local environment variables" > .env.local; fi
	@if [ ! -f frontend/.env.local ]; then cp frontend/.env.local.example frontend/.env.local 2>/dev/null || cp frontend/.env.development frontend/.env.local; fi
	@echo "✅ Environment files ready"

setup-database:
	@echo "Setting up database..."
	@docker-compose up -d postgres
	@echo "⏳ Waiting for database container to be healthy..."
	@$(MAKE) wait-for-healthy SERVICE=postgres
	@echo "⏳ Verifying database connection..."
	@$(MAKE) ensure-database
	@echo "  Testing connection to keyfate_dev database..."
	@for i in {1..15}; do \
		docker-compose exec -T postgres pg_isready -U postgres -d keyfate_dev >/dev/null 2>&1 && break || \
		{ echo "  Attempt $$i/15: Waiting for database..."; sleep 2; }; \
	done; \
	docker-compose exec -T postgres pg_isready -U postgres -d keyfate_dev >/dev/null 2>&1 || \
	{ echo "❌ Database connection failed after 30 seconds"; echo "📋 Recent PostgreSQL logs:"; docker-compose logs --tail=10 postgres; echo "🔍 Container status:"; docker-compose ps postgres; exit 1; }
	@echo "✅ Database setup complete"

# Clean database volumes and start fresh
clean-db:
	@echo "🧹 Cleaning database volumes..."
	@echo "⚠️  This will remove all database data!"
	@read -p "Are you sure you want to continue? (y/N): " confirm && [ "$$confirm" = "y" ]
	@docker-compose down -v postgres
	@docker volume rm dead-mans-switch_postgres_data 2>/dev/null || true
	@echo "✅ Database volumes cleaned"
	@echo "💡 Run 'make dev' to start with a fresh database"

# Ensure keyfate_dev database exists
ensure-database:
	@echo "🔍 Ensuring keyfate_dev database exists..."
	@if ! docker-compose exec -T postgres psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'keyfate_dev'" | grep -q 1; then \
		echo "  Creating keyfate_dev database..."; \
		docker-compose exec -T postgres psql -U postgres -c "CREATE DATABASE keyfate_dev;"; \
		echo "✅ keyfate_dev database created"; \
	else \
		echo "✅ keyfate_dev database already exists"; \
	fi

# Create database if it doesn't exist (internal helper)
create-database:
	@docker-compose exec -T postgres psql -U postgres -c "CREATE DATABASE keyfate_dev;" 2>/dev/null || echo "Database already exists or creation failed"

# SSH tunnel to staging database via bastion host
# Run this in Terminal 1, then use db-studio-staging or db-migrate-staging in Terminal 2
db-tunnel-staging:
	@echo "🔌 Opening SSH tunnel to staging database via bastion host..."
	@echo "📡 Project: keyfate-dev"
	@echo "🌐 Database will be available at: localhost:54321"
	@echo ""
	@echo "💡 Keep this terminal open, then run in another terminal:"
	@echo "   make db-studio-staging   # To open Drizzle Studio"
	@echo "   make db-migrate-staging  # To run migrations"
	@echo ""
	gcloud compute ssh bastion-host --zone=us-central1-a --project=keyfate-dev \
		--tunnel-through-iap \
		--ssh-flag='-L' --ssh-flag='54321:127.0.0.1:5432'

# SSH tunnel to production database via bastion host
# Run this in Terminal 1, then use db-studio-prod or db-migrate-prod in Terminal 2
db-tunnel-prod:
	@echo "🔌 Opening SSH tunnel to production database via bastion host..."
	@echo "📡 Project: keyfate-prod"
	@echo "🌐 Database will be available at: localhost:54321"
	@echo "⚠️  WARNING: This connects to the PRODUCTION database!"
	@echo ""
	@echo "💡 Keep this terminal open, then run in another terminal:"
	@echo "   make db-studio-prod   # To open Drizzle Studio"
	@echo "   make db-migrate-prod  # To run migrations"
	@echo ""
	gcloud compute ssh bastion-host --zone=us-central1-a --project=keyfate-prod \
		--tunnel-through-iap \
		--ssh-flag='-L' --ssh-flag='54321:127.0.0.1:5432'

# Run migrations against staging database
# Requires db-tunnel-staging to be running in another terminal
db-migrate-staging:
	@echo "📊 Running migrations against staging database..."
	@echo "⚠️  Ensure 'make db-tunnel-staging' is running in another terminal"
	@echo ""
	@cd frontend && npm run db:migrate -- --config=drizzle-staging.config.ts
	@echo "✅ Staging migrations complete"

# Run migrations against production database
# Requires db-tunnel-prod to be running in another terminal
db-migrate-prod:
	@echo "📊 Running migrations against production database..."
	@echo "⚠️  Ensure 'make db-tunnel-prod' is running in another terminal"
	@echo "⚠️  WARNING: This will modify the production database!"
	@read -p "Are you sure you want to continue? (yes/N): " confirm && [ "$$confirm" = "yes" ]
	@echo ""
	@cd frontend && npm run db:migrate -- --config=drizzle-production.config.ts
	@echo "✅ Production migrations complete"

# Open Drizzle Studio for staging database
# Requires db-tunnel-staging to be running in another terminal
db-studio-staging:
	@echo "🎨 Opening Drizzle Studio for staging database..."
	@echo "⚠️  Ensure 'make db-tunnel-staging' is running in another terminal"
	@echo "🌐 Studio will be available at: https://local.drizzle.studio"
	@echo ""
	@cd frontend && npm run db:studio -- --config=drizzle-staging.config.ts

# Open Drizzle Studio for production database
# Requires db-tunnel-prod to be running in another terminal
db-studio-prod:
	@echo "🎨 Opening Drizzle Studio for production database..."
	@echo "⚠️  Ensure 'make db-tunnel-prod' is running in another terminal"
	@echo "⚠️  WARNING: This provides full access to the production database!"
	@read -p "Are you sure you want to continue? (yes/N): " confirm && [ "$$confirm" = "yes" ]
	@echo "🌐 Studio will be available at: https://local.drizzle.studio"
	@echo ""
	@cd frontend && npm run db:studio -- --config=drizzle-production.config.ts

# Sync Doppler secrets to terraform.tfvars
sync-doppler-dev:
	@echo "⬇️  Downloading Doppler secrets for dev environment..."
	@cd infrastructure/terragrunt/dev && doppler secrets download -p keyfate -c stg --format json --no-file | jq -r 'to_entries | map(select(.key | startswith("DOPPLER_") | not)) | map(.value as $$val | (try ($$val | fromjson) catch $$val) as $$parsed | if ($$parsed | type) == "object" then "\(.key | ascii_downcase) = {\n" + ($$parsed | to_entries | map("  \"\(.key)\" = \"\(.value)\"") | join("\n")) + "\n}" else "\(.key | ascii_downcase) = \($$val | tojson)" end) | .[]' > terraform.tfvars
	@echo "✅ Secrets downloaded to infrastructure/terragrunt/dev/terraform.tfvars"
	@echo "💡 Note: Environment-specific overrides (cpu_boost, max_instances, deletion_protection, custom_domain) should be set in Doppler"

sync-doppler-prod:
	@echo "⬇️  Downloading Doppler secrets for production environment..."
	@cd infrastructure/terragrunt/prod && doppler secrets download -p keyfate -c prd --format json --no-file | jq -r 'to_entries | map(select(.key | startswith("DOPPLER_") | not)) | map(.value as $$val | (try ($$val | fromjson) catch $$val) as $$parsed | if ($$parsed | type) == "object" then "\(.key | ascii_downcase) = {\n" + ($$parsed | to_entries | map("  \"\(.key)\" = \"\(.value)\"") | join("\n")) + "\n}" else "\(.key | ascii_downcase) = \($$val | tojson)" end) | .[]' > terraform.tfvars
	@echo "✅ Secrets downloaded to infrastructure/terragrunt/prod/terraform.tfvars"
	@echo "💡 Note: Environment-specific overrides (cpu_boost, max_instances, deletion_protection, custom_domain) should be set in Doppler"
