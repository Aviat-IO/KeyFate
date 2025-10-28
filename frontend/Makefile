.PHONY: install dev build test deploy-dev

install:
	doppler run -p keyfate -c dev -- pnpm install

dev:
	doppler run -p keyfate -c dev -- pnpm dev

build: install
	doppler run -p keyfate -c dev -- pnpm build:local

test:
	doppler run -p keyfate -c dev -- pnpm test
