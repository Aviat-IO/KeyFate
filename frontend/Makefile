.PHONY: install dev build test deploy-dev

install:
	pnpm install

dev:
	pnpm dev

build: install
	pnpm build

test:
	pnpm test

deploy-dev:
	cd .. && \
	SUBSTITUTIONS=$$(cat frontend/.env.development frontend/.env.development.local 2>/dev/null | grep -E '^[A-Z_][A-Z0-9_]*=' | sed 's/^/_/' | sed 's/=/=/' | tr '\n' ',' | sed 's/,$$//') && \
	gcloud builds submit --config cloudbuild.yaml --project dead-mans-switch-dev --substitutions="$$SUBSTITUTIONS"

deploy-prod:
	cd .. && \
	SUBSTITUTIONS=$$(cat frontend/.env.production frontend/.env.production.local 2>/dev/null | grep -E '^[A-Z_][A-Z0-9_]*=' | sed 's/^/_/' | sed 's/=/=/' | tr '\n' ',' | sed 's/,$$//') && \
	gcloud builds submit --config cloudbuild.yaml --project dead-mans-switch-prod --substitutions="$$SUBSTITUTIONS"
