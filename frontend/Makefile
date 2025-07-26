.PHONY: install dev build test deploy-dev copy-types

install:
	pnpm install

dev:
	pnpm dev

copy-types:
	@if [ -d ../supabase ]; then \
		cd ../supabase && supabase gen types typescript --local > ../frontend/src/types/database.types.ts; \
	elif [ -f ../database.types.ts ]; then \
		echo "Using existing database types from root directory"; \
		cp ../database.types.ts src/types/database.types.ts; \
	else \
		echo "No database types available, creating empty file"; \
		touch src/types/database.types.ts; \
	fi

build: install copy-types
	pnpm build

test:
	pnpm test
