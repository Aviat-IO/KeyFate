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
	npx supabase gen types typescript --local > database.types.ts
