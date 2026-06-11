SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c

.PHONY: ci
ci: install lint test build

.PHONY: install
install:
	npm ci

.PHONY: lint
lint:
	npm run lint

.PHONY: test
test:
	npm run test

.PHONY: build
build:
	npm run build

.PHONY: dev
dev:
	npm run dev

# Pull the latest official AWS icon package and regenerate
# public/icons/** + public/catalog.json (no-op when nothing changed).
.PHONY: refresh
refresh:
	npm run refresh

.PHONY: clean
clean:
	rm -rf dist
