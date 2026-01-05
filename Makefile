# PetReunite - Digital Ocean App Platform Management
# ================================================
# Prerequisites: doctl CLI installed and authenticated
# Install: brew install doctl && doctl auth init

# App Configuration
APP_NAME := petreunite
REGION := fra
APP_SPEC := .do/app.yaml

# Colors for output
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

.PHONY: help
help: ## Show this help message
	@echo "$(GREEN)PetReunite - Digital Ocean App Management$(NC)"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "$(YELLOW)Deployment:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -E '(deploy|create|update)' | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Monitoring:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -E '(status|logs|info|list)' | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Database:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -E '(db-)' | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Development:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -E '(dev|test|build|install)' | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Secrets:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | grep -E '(secret)' | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}'

# ============================================
# Deployment Commands
# ============================================

.PHONY: deploy
deploy: ## Deploy app (create or update)
	@echo "$(GREEN)Deploying $(APP_NAME)...$(NC)"
	@if doctl apps list --format ID,Spec.Name --no-header | grep -q $(APP_NAME); then \
		$(MAKE) update; \
	else \
		$(MAKE) create; \
	fi

.PHONY: create
create: ## Create new app from spec
	@echo "$(GREEN)Creating app $(APP_NAME)...$(NC)"
	doctl apps create --spec $(APP_SPEC) --wait

.PHONY: update
update: ## Update existing app with current spec
	@echo "$(GREEN)Updating app $(APP_NAME)...$(NC)"
	$(eval APP_ID := $(shell doctl apps list --format ID,Spec.Name --no-header | grep $(APP_NAME) | awk '{print $$1}'))
	doctl apps update $(APP_ID) --spec $(APP_SPEC) --wait

.PHONY: redeploy
redeploy: ## Force redeploy all components
	@echo "$(GREEN)Forcing redeploy of $(APP_NAME)...$(NC)"
	$(eval APP_ID := $(shell doctl apps list --format ID,Spec.Name --no-header | grep $(APP_NAME) | awk '{print $$1}'))
	doctl apps create-deployment $(APP_ID) --wait

.PHONY: redeploy-api
redeploy-api: ## Force redeploy API component only
	@echo "$(GREEN)Forcing redeploy of API...$(NC)"
	$(eval APP_ID := $(shell doctl apps list --format ID,Spec.Name --no-header | grep $(APP_NAME) | awk '{print $$1}'))
	doctl apps create-deployment $(APP_ID) --wait

.PHONY: delete
delete: ## Delete the app (DANGEROUS!)
	@echo "$(RED)WARNING: This will delete $(APP_NAME) and all its data!$(NC)"
	@read -p "Are you sure? Type 'yes' to confirm: " confirm && [ "$$confirm" = "yes" ]
	$(eval APP_ID := $(shell doctl apps list --format ID,Spec.Name --no-header | grep $(APP_NAME) | awk '{print $$1}'))
	doctl apps delete $(APP_ID) --force

# ============================================
# Monitoring Commands
# ============================================

.PHONY: status
status: ## Show app deployment status
	@echo "$(GREEN)App Status:$(NC)"
	$(eval APP_ID := $(shell doctl apps list --format ID,Spec.Name --no-header | grep $(APP_NAME) | awk '{print $$1}'))
	@doctl apps get $(APP_ID)

.PHONY: info
info: ## Show detailed app information
	$(eval APP_ID := $(shell doctl apps list --format ID,Spec.Name --no-header | grep $(APP_NAME) | awk '{print $$1}'))
	doctl apps get $(APP_ID)

.PHONY: list
list: ## List all DO apps
	doctl apps list

.PHONY: list-deployments
list-deployments: ## List recent deployments
	$(eval APP_ID := $(shell doctl apps list --format ID,Spec.Name --no-header | grep $(APP_NAME) | awk '{print $$1}'))
	doctl apps list-deployments $(APP_ID)

.PHONY: logs
logs: ## Show API logs (last 100 lines)
	$(eval APP_ID := $(shell doctl apps list --format ID,Spec.Name --no-header | grep $(APP_NAME) | awk '{print $$1}'))
	doctl apps logs $(APP_ID) --component api --tail 100

.PHONY: logs-follow
logs-follow: ## Follow API logs in real-time
	$(eval APP_ID := $(shell doctl apps list --format ID,Spec.Name --no-header | grep $(APP_NAME) | awk '{print $$1}'))
	doctl apps logs $(APP_ID) --component api --follow

.PHONY: logs-build
logs-build: ## Show build logs
	$(eval APP_ID := $(shell doctl apps list --format ID,Spec.Name --no-header | grep $(APP_NAME) | awk '{print $$1}'))
	doctl apps logs $(APP_ID) --component api --type build --tail 200

.PHONY: logs-web
logs-web: ## Show web component build logs
	$(eval APP_ID := $(shell doctl apps list --format ID,Spec.Name --no-header | grep $(APP_NAME) | awk '{print $$1}'))
	doctl apps logs $(APP_ID) --component web --type build --tail 100

.PHONY: url
url: ## Show app URL
	$(eval APP_ID := $(shell doctl apps list --format ID,Spec.Name --no-header | grep $(APP_NAME) | awk '{print $$1}'))
	@doctl apps get $(APP_ID) --format DefaultIngress --no-header

.PHONY: open
open: ## Open app in browser
	$(eval APP_ID := $(shell doctl apps list --format ID,Spec.Name --no-header | grep $(APP_NAME) | awk '{print $$1}'))
	$(eval URL := $(shell doctl apps get $(APP_ID) --format DefaultIngress --no-header))
	open https://$(URL)

# ============================================
# Database Commands
# ============================================

.PHONY: db-info
db-info: ## Show database connection info
	@echo "$(GREEN)Database Info:$(NC)"
	$(eval APP_ID := $(shell doctl apps list --format ID,Spec.Name --no-header | grep $(APP_NAME) | awk '{print $$1}'))
	@doctl databases list --format ID,Name,Engine,Region,Status

.PHONY: db-connect
db-connect: ## Connect to database via psql (requires DATABASE_URL)
	@echo "$(GREEN)Connecting to database...$(NC)"
	@echo "$(YELLOW)Note: Get DATABASE_URL from DO dashboard or use 'make db-url'$(NC)"
	@if [ -z "$(DATABASE_URL)" ]; then \
		echo "$(RED)Error: DATABASE_URL not set$(NC)"; \
		echo "Usage: DATABASE_URL=postgres://... make db-connect"; \
		exit 1; \
	fi
	psql "$(DATABASE_URL)"

.PHONY: db-url
db-url: ## Show how to get database URL
	@echo "$(YELLOW)To get the DATABASE_URL:$(NC)"
	@echo "1. Go to https://cloud.digitalocean.com/apps"
	@echo "2. Click on $(APP_NAME)"
	@echo "3. Go to Settings -> Components -> petreunite-db"
	@echo "4. Copy the Connection String"
	@echo ""
	@echo "Or use: doctl databases connection <db-id> --format URI"

.PHONY: db-migrate
db-migrate: ## Run database migrations locally
	@echo "$(GREEN)Running migrations...$(NC)"
	cd server && npm run db:migrate

.PHONY: db-pool
db-pool: ## Show database pool info
	doctl databases pool list $$(doctl databases list --format ID --no-header | head -1) 2>/dev/null || echo "No connection pools configured"

# ============================================
# Secrets Management
# ============================================

.PHONY: secrets-list
secrets-list: ## List app environment variables
	$(eval APP_ID := $(shell doctl apps list --format ID,Spec.Name --no-header | grep $(APP_NAME) | awk '{print $$1}'))
	@echo "$(GREEN)Environment Variables:$(NC)"
	@doctl apps get $(APP_ID) --format Spec.Services[0].Envs

.PHONY: secrets-update
secrets-update: ## Update a secret (usage: make secrets-update KEY=value)
	@if [ -z "$(KEY)" ]; then \
		echo "$(RED)Error: KEY not specified$(NC)"; \
		echo "Usage: make secrets-update KEY=JWT_SECRET VALUE=mysecret"; \
		exit 1; \
	fi
	@echo "$(YELLOW)Note: Update secrets via DO Dashboard or update app.yaml$(NC)"
	@echo "Dashboard: https://cloud.digitalocean.com/apps -> $(APP_NAME) -> Settings"

# ============================================
# Local Development
# ============================================

.PHONY: install
install: ## Install all dependencies
	@echo "$(GREEN)Installing frontend dependencies...$(NC)"
	npm install
	@echo "$(GREEN)Installing backend dependencies...$(NC)"
	cd server && npm install

.PHONY: dev
dev: ## Start local development (frontend + backend)
	@echo "$(GREEN)Starting development servers...$(NC)"
	@echo "$(YELLOW)Frontend: http://localhost:5173$(NC)"
	@echo "$(YELLOW)Backend: http://localhost:3001$(NC)"
	@$(MAKE) -j2 dev-frontend dev-backend

.PHONY: dev-frontend
dev-frontend: ## Start frontend dev server
	npm run dev

.PHONY: dev-backend
dev-backend: ## Start backend dev server
	cd server && npm run dev

.PHONY: build
build: ## Build for production
	@echo "$(GREEN)Building frontend...$(NC)"
	npm run build
	@echo "$(GREEN)Building backend...$(NC)"
	cd server && npm run build

.PHONY: build-frontend
build-frontend: ## Build frontend only
	npm run build

.PHONY: build-backend
build-backend: ## Build backend only
	cd server && npm run build

# ============================================
# Testing
# ============================================

.PHONY: test
test: ## Run all tests
	@echo "$(GREEN)Running frontend tests...$(NC)"
	npm test
	@echo "$(GREEN)Running backend tests...$(NC)"
	cd server && npm test

.PHONY: test-frontend
test-frontend: ## Run frontend tests
	npm test

.PHONY: test-backend
test-backend: ## Run backend tests
	cd server && npm test

.PHONY: test-coverage
test-coverage: ## Run tests with coverage
	@echo "$(GREEN)Frontend coverage:$(NC)"
	npm run test:coverage || true
	@echo ""
	@echo "$(GREEN)Backend coverage:$(NC)"
	cd server && npm test -- --coverage

.PHONY: test-watch
test-watch: ## Run tests in watch mode
	npm run test:watch

# ============================================
# Utilities
# ============================================

.PHONY: clean
clean: ## Clean build artifacts
	rm -rf dist
	rm -rf server/dist
	rm -rf coverage
	rm -rf server/coverage

.PHONY: lint
lint: ## Run linters
	@echo "$(GREEN)Linting frontend...$(NC)"
	npm run lint 2>/dev/null || echo "No frontend lint script"
	@echo "$(GREEN)Linting backend...$(NC)"
	cd server && npm run lint 2>/dev/null || echo "No backend lint script"

.PHONY: check
check: lint test build ## Run all checks (lint, test, build)
	@echo "$(GREEN)All checks passed!$(NC)"

.PHONY: doctl-check
doctl-check: ## Verify doctl is installed and authenticated
	@which doctl > /dev/null || (echo "$(RED)Error: doctl not installed. Run: brew install doctl$(NC)" && exit 1)
	@doctl account get > /dev/null 2>&1 || (echo "$(RED)Error: doctl not authenticated. Run: doctl auth init$(NC)" && exit 1)
	@echo "$(GREEN)doctl is installed and authenticated$(NC)"

.PHONY: health
health: ## Check app health endpoint
	@echo "$(GREEN)Checking health...$(NC)"
	@URL=$$(doctl apps list --format DefaultIngress,Spec.Name --no-header | grep $(APP_NAME) | awk '{print $$1}') && \
		curl -s $$URL/api/health | jq . 2>/dev/null || curl -s $$URL/api/health

# Default target
.DEFAULT_GOAL := help
