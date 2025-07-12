.PHONY: install dev build test deploy-dev copy-types

install:
	pnpm install

dev:
	pnpm dev

copy-types:
	cd ../supabase && supabase gen types typescript --local > ../frontend/src/types/database.types.ts

build: install copy-types
	pnpm build

test:
	pnpm test
