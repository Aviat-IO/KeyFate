.PHONY: install dev stop clean test migrate seed reset-db help status debug-db test-db-connection clean-db ensure-database create-database

help:
	@echo "KeyFate - Local Development"
	@echo ""
	@echo "Available commands:"
	@echo ""
	@echo "Local Development:"
	@echo "  make install          - Complete local environment setup"
	@echo "  make dev              - Start full local development stack"
	@echo "  make stop             - Stop all local services"
	@echo "  make clean            - Clean up containers and volumes"
	@echo "  make test             - Run test suite"
	@echo "  make build            - Build for production"
	@echo "  make migrate          - Run database migrations (local)"
	@echo "  make seed             - Seed database with development data"
	@echo "  make reset-db         - Reset database (migrate + seed)"
	@echo "  make clean-db         - Remove database volumes and start fresh"
	@echo "  make status           - Show status of all services"
	@echo ""

install:
	@echo "Installing local development environment..."
	@echo ""
	@echo "Step 1: Checking Docker installation..."
	@command -v docker >/dev/null 2>&1 || { echo "Docker is required but not installed."; exit 1; }
	@command -v docker-compose >/dev/null 2>&1 || { echo "Docker Compose is required."; exit 1; }
	@echo "Docker and Docker Compose found"
	@echo ""
	@echo "Step 2: Setting up environment files..."
	@$(MAKE) setup-env-files
	@echo ""
	@echo "Step 3: Creating necessary directories..."
	@mkdir -p database/migrations database/seeds logs
	@echo "Directories created"
	@echo ""
	@echo "Step 4: Installing dependencies..."
	@cd frontend-svelte && bun install
	@echo "Dependencies ready"
	@echo ""
	@echo "Step 5: Building Docker containers..."
	@docker-compose build
	@echo "Docker containers built"
	@echo ""
	@echo "Step 6: Setting up database..."
	@$(MAKE) setup-database
	@echo ""
	@echo "Local development environment installation complete!"
	@echo ""
	@echo "Next steps:"
	@echo "  1. Copy frontend-svelte/.env.example to frontend-svelte/.env.local and configure"
	@echo "  2. Run 'make dev' to start the development environment"
	@echo ""

dev:
	@echo "Starting local development stack..."
	@echo ""
	@echo "Step 1: Starting database services..."
	@docker-compose up -d postgres
	@echo "Waiting for database to be ready..."
	@$(MAKE) wait-for-healthy SERVICE=postgres
	@echo "Verifying database connection..."
	@$(MAKE) ensure-database
	@echo "  Testing connection to keyfate_dev database..."
	@for i in {1..15}; do \
		docker-compose exec -T postgres pg_isready -U postgres -d keyfate_dev >/dev/null 2>&1 && break || \
		{ echo "  Attempt $$i/15: Waiting for database..."; sleep 2; }; \
	done; \
	docker-compose exec -T postgres pg_isready -U postgres -d keyfate_dev >/dev/null 2>&1 || \
	{ echo "Database connection failed after 30 seconds"; docker-compose logs --tail=10 postgres; docker-compose ps postgres; exit 1; }
	@echo "Database is ready"
	@echo ""
	@echo "Step 2: Running migrations..."
	@$(MAKE) migrate
	@echo ""
	@echo "Step 3: Starting frontend development server..."
	@echo "Frontend: http://localhost:5173"
	@echo "Database: localhost:5432"
	@echo ""
	@cd frontend-svelte && bun run dev

stop:
	@echo "Stopping all local services..."
	@docker-compose down
	@echo "All services stopped"

clean:
	@echo "Cleaning up containers and volumes..."
	@docker-compose down -v --remove-orphans
	@docker system prune -f
	@echo "Cleanup complete"

test:
	@echo "Running tests..."
	@cd frontend-svelte && bun run test

build:
	@echo "Building for production..."
	@cd frontend-svelte && bun run build

migrate:
	@echo "Running database migrations..."
	@cd frontend-svelte && bunx drizzle-kit migrate
	@echo "Migrations complete"

seed:
	@echo "Seeding database with development data..."
	@node scripts/seed-local-db.js
	@echo "Database seeded"

reset-db:
	@echo "Resetting database..."
	@$(MAKE) migrate
	@$(MAKE) seed
	@echo "Database reset complete"

status:
	@echo "Service Status:"
	@docker-compose ps
	@echo ""
	@echo "Database Check:"
	@if docker-compose ps postgres | grep -q "healthy"; then \
		echo "PostgreSQL container is healthy"; \
		docker-compose exec -T postgres psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'keyfate_dev'" | grep -q 1 && echo "keyfate_dev database exists" || echo "keyfate_dev database missing"; \
		docker-compose exec -T postgres pg_isready -U postgres -d keyfate_dev > /dev/null 2>&1 && echo "Database connection works" || echo "Database connection failed"; \
	elif docker-compose ps postgres | grep -q "Up"; then \
		echo "PostgreSQL container running but not healthy"; \
	else \
		echo "PostgreSQL container not running"; \
	fi

debug-db:
	@echo "Database Debug Information:"
	@echo ""
	@echo "Container Status:"
	@docker-compose ps postgres
	@echo ""
	@echo "Recent Container Logs (last 20 lines):"
	@docker-compose logs --tail=20 postgres
	@echo ""
	@echo "Connection Tests:"
	@echo "1. Health check status:"
	@docker-compose ps postgres | awk 'NR==2 {print "   " $$6}'
	@echo "2. PostgreSQL ready check (keyfate_dev):"
	@docker-compose exec -T postgres pg_isready -U postgres -d keyfate_dev || echo "   Connection to keyfate_dev failed"
	@echo "3. PostgreSQL ready check (postgres default):"
	@docker-compose exec -T postgres pg_isready -U postgres -d postgres || echo "   Connection to postgres failed"
	@echo "4. Database list check:"
	@docker-compose exec -T postgres psql -U postgres -l || echo "   Database query failed"
	@echo "5. Database existence check:"
	@docker-compose exec -T postgres psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'keyfate_dev'" | grep -q 1 && echo "   keyfate_dev database exists" || echo "   keyfate_dev database missing"

test-db-connection:
	@echo "Quick Database Connection Test:"
	@echo ""
	@if ! docker-compose ps postgres | grep -q "Up"; then \
		echo "PostgreSQL container is not running"; \
		echo "   Run 'docker-compose up -d postgres' to start it"; \
		exit 1; \
	fi
	@echo "PostgreSQL container is running"
	@echo "Testing database connections..."
	@printf "  keyfate_dev database: "; docker-compose exec -T postgres pg_isready -U postgres -d keyfate_dev >/dev/null 2>&1 && echo "Connected" || echo "Failed"
	@printf "  postgres database: "; docker-compose exec -T postgres pg_isready -U postgres -d postgres >/dev/null 2>&1 && echo "Connected" || echo "Failed"
	@echo ""
	@echo "If connections failed, run 'make debug-db' for detailed information"

# Internal targets
wait-for-healthy:
	@echo "Waiting for $(SERVICE) to be healthy..."
	@timeout 90 bash -c 'until docker-compose ps $(SERVICE) | grep -q "healthy"; do echo "  $(SERVICE) health status: $$(docker-compose ps $(SERVICE) | awk '\''NR==2 {print $$6}'\'')"; sleep 3; done' || { echo "$(SERVICE) failed health check within 90 seconds"; docker-compose logs --tail=20 $(SERVICE); exit 1; }
	@echo "$(SERVICE) is healthy"

check-database-ready:
	@echo "Checking database readiness..."
	@docker-compose exec -T postgres pg_isready -U postgres -d keyfate_dev > /dev/null 2>&1 && echo "Database connection verified" || { echo "Database not ready"; exit 1; }

setup-env-files:
	@echo "Setting up environment files..."
	@if [ ! -f .env.local ]; then cp .env.local.example .env.local 2>/dev/null || echo "# Local environment variables" > .env.local; fi
	@if [ ! -f frontend-svelte/.env.local ]; then cp frontend-svelte/.env.example frontend-svelte/.env.local 2>/dev/null || echo "# Local environment variables" > frontend-svelte/.env.local; fi
	@echo "Environment files ready"

setup-database:
	@echo "Setting up database..."
	@docker-compose up -d postgres
	@echo "Waiting for database container to be healthy..."
	@$(MAKE) wait-for-healthy SERVICE=postgres
	@echo "Verifying database connection..."
	@$(MAKE) ensure-database
	@echo "  Testing connection to keyfate_dev database..."
	@for i in {1..15}; do \
		docker-compose exec -T postgres pg_isready -U postgres -d keyfate_dev >/dev/null 2>&1 && break || \
		{ echo "  Attempt $$i/15: Waiting for database..."; sleep 2; }; \
	done; \
	docker-compose exec -T postgres pg_isready -U postgres -d keyfate_dev >/dev/null 2>&1 || \
	{ echo "Database connection failed after 30 seconds"; docker-compose logs --tail=10 postgres; docker-compose ps postgres; exit 1; }
	@echo "Database setup complete"

clean-db:
	@echo "Cleaning database volumes..."
	@echo "This will remove all database data!"
	@read -p "Are you sure you want to continue? (y/N): " confirm && [ "$$confirm" = "y" ]
	@docker-compose down -v postgres
	@docker volume rm dead-mans-switch_postgres_data 2>/dev/null || true
	@echo "Database volumes cleaned"
	@echo "Run 'make dev' to start with a fresh database"

ensure-database:
	@echo "Ensuring keyfate_dev database exists..."
	@if ! docker-compose exec -T postgres psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'keyfate_dev'" | grep -q 1; then \
		echo "  Creating keyfate_dev database..."; \
		docker-compose exec -T postgres psql -U postgres -c "CREATE DATABASE keyfate_dev;"; \
		echo "keyfate_dev database created"; \
	else \
		echo "keyfate_dev database already exists"; \
	fi

create-database:
	@docker-compose exec -T postgres psql -U postgres -c "CREATE DATABASE keyfate_dev;" 2>/dev/null || echo "Database already exists or creation failed"
