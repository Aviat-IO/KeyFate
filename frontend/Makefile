.PHONY: install dev build test deploy-dev

install:
	pnpm install

dev:
	pnpm dev

build: install
	pnpm build

test:
	pnpm test

# deploy-dev:
# 	cd .. && \
# 	SUBSTITUTIONS=$$(cat frontend/.env.development frontend/.env.development.local 2>/dev/null | grep -E '^[A-Z_][A-Z0-9_]*=' | sed 's/^/_/' | sed 's/=/=/' | tr '\n' ',' | sed 's/,$$//') && \
# 	gcloud builds submit --config cloudbuild.yaml --project dead-mans-switch-dev --substitutions="$$SUBSTITUTIONS"

# deploy-prod:
# 	cd .. && \
# 	SUBSTITUTIONS=$$(cat frontend/.env.production frontend/.env.production.local 2>/dev/null | grep -E '^[A-Z_][A-Z0-9_]*=' | sed 's/^/_/' | sed 's/=/=/' | tr '\n' ',' | sed 's/,$$//') && \
# 	gcloud builds submit --config cloudbuild.yaml --project dead-mans-switch-prod --substitutions="$$SUBSTITUTIONS"

deploy-dev:
	ENV_VARS=$$(cat .env.development .env.development.local 2>/dev/null | grep -E '^[A-Z_][A-Z0-9_]*=' | tr '\n' ',' | sed 's/,$$//') && \
	gcloud run deploy keyfate \
		--source . \
		--platform managed \
		--region us-central1 \
		--allow-unauthenticated \
		--min-instances 0 \
		--cpu-boost \
		--project keyfate-dev \
		$$([ -n "$$ENV_VARS" ] && echo "--set-env-vars=$$ENV_VARS" || echo "")

deploy-prod:
	ENV_VARS=$$(cat .env.production .env.production.local 2>/dev/null | grep -E '^[A-Z_][A-Z0-9_]*=' | tr '\n' ',' | sed 's/,$$//') && \
	gcloud run deploy keyfate \
		--source . \
		--platform managed \
		--region us-central1 \
		--allow-unauthenticated \
		--min-instances 0 \
		--cpu-boost \
		--project keyfate-prod \
		$$([ -n "$$ENV_VARS" ] && echo "--set-env-vars=$$ENV_VARS" || echo "")
