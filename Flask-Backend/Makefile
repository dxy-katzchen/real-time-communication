# Flask Backend Test Makefile
# Convenient commands for running tests

.PHONY: help install test test-unit test-socket test-integration test-quick test-coverage clean

help:  ## Show this help message
	@echo "Flask Backend Test Commands:"
	@echo "============================"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install:  ## Install test dependencies
	pip install -r requirements-test.txt

test:  ## Run all tests with coverage
	python run_tests.py all

test-unit:  ## Run unit tests only
	python run_tests.py unit

test-socket:  ## Run Socket.IO tests only
	python run_tests.py socket

test-integration:  ## Run integration tests only
	python run_tests.py integration

test-quick:  ## Run tests quickly without coverage
	python run_tests.py quick

test-coverage:  ## Generate coverage report
	python -m pytest tests/ --cov=server --cov-report=html --cov-report=term-missing

test-watch:  ## Run tests in watch mode (requires pytest-watch)
	ptw tests/ -- --tb=short

lint:  ## Run code linting
	flake8 server.py tests/

format:  ## Format code with black
	black server.py tests/

clean:  ## Clean test artifacts
	rm -rf htmlcov/
	rm -rf .coverage
	rm -rf .pytest_cache/
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete

# Database commands
test-db-setup:  ## Setup test database
	@echo "Setting up test database (MongoDB)..."
	@echo "Make sure MongoDB is running locally"

# CI/CD commands
ci-test:  ## Run tests for CI/CD
	python -m pytest tests/ --cov=server --cov-report=xml --junit-xml=test-results.xml

# Development commands
dev-install:  ## Install development dependencies
	pip install -r requirements.txt
	pip install -r requirements-test.txt
	pip install black flake8 pytest-watch

server:  ## Run development server
	python server.py

# Example usage
example:  ## Show example test commands
	@echo "Example test commands:"
	@echo "====================="
	@echo "make install          # Install dependencies"
	@echo "make test            # Run all tests"
	@echo "make test-unit       # Run only unit tests"
	@echo "make test-quick      # Quick test run"
	@echo "python run_tests.py specific --test tests/test_user_api.py::TestUserAPI::test_create_user_success"
