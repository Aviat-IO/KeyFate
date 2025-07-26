.PHONY: dev stop help status test gen-types

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

gen-types:
	@echo "Generating database types..."
	npx supabase gen types typescript --local > types.ts
	@echo "Copying types to functions shared directory..."
	cp types.ts functions/_shared/types.ts
	@echo "Copying types to root directory..."
	cp types.ts ../types.ts
	@echo "Database types generated and copied successfully!"

functions-serve:
	supabase functions serve --env-file functions/.env.development.local
