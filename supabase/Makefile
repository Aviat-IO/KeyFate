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
	npx supabase gen types typescript --local > database.types.ts
	@echo "Copying types to functions shared directory..."
	cp database.types.ts functions/_shared/database.types.ts
	@echo "Copying types to root directory..."
	cp database.types.ts ../database.types.ts
	@echo "Database types generated and copied successfully!"

functions-serve:
	supabase functions serve --env-file functions/.env.development.local
