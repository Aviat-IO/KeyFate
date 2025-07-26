.PHONY: install dev build test deploy-dev copy-types

install:
	pnpm install

dev:
	pnpm dev

copy-types:
	@if [ -d ../supabase ]; then \
		cd ../supabase && supabase gen types typescript --local > ../frontend/src/types/types.ts; \
	elif [ -f ../types.ts ]; then \
		echo "Using existing database types from root directory"; \
		cp ../types.ts src/types/types.ts; \
	else \
		echo "No database types available, creating empty file"; \
		touch src/types/types.ts; \
	fi

build: install copy-types
	pnpm build

test:
	pnpm test
