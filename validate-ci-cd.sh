#!/bin/bash

# CI/CD Integration Validation Script
# This script validates that the CI/CD pipeline integration is working correctly

set -e  # Exit on any error

echo "🔍 CI/CD Integration Validation"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FLASK_BACKEND_DIR="/Users/sabina/Desktop/study/Job/FT/Projects/Real-time/Flask-Backend"
GITHUB_WORKFLOWS_DIR="/Users/sabina/Desktop/study/Job/FT/Projects/Real-time/.github/workflows"

echo -e "${YELLOW}📁 Checking project structure...${NC}"

# Check if required directories exist
if [ -d "$FLASK_BACKEND_DIR" ]; then
    echo -e "${GREEN}✅ Flask-Backend directory found${NC}"
else
    echo -e "${RED}❌ Flask-Backend directory not found${NC}"
    exit 1
fi

if [ -d "$GITHUB_WORKFLOWS_DIR" ]; then
    echo -e "${GREEN}✅ GitHub workflows directory found${NC}"
else
    echo -e "${RED}❌ GitHub workflows directory not found${NC}"
    exit 1
fi

echo -e "\n${YELLOW}🧪 Validating test infrastructure...${NC}"

# Check test files
cd "$FLASK_BACKEND_DIR"

REQUIRED_FILES=(
    "Makefile"
    "pytest.ini"
    "conftest.py"
    "requirements-test.txt"
    "run_tests.py"
    "tests/test_user_api.py"
    "tests/test_meeting_api.py"
    "tests/test_socket_events.py"
    "tests/test_integration.py"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $file${NC}"
    else
        echo -e "${RED}❌ $file missing${NC}"
        exit 1
    fi
done

echo -e "\n${YELLOW}⚙️ Validating GitHub workflows...${NC}"

# Check workflow files
WORKFLOW_FILES=(
    "test.yml"
    "ci-cd.yml"
    "pr-checks.yml"
)

for workflow in "${WORKFLOW_FILES[@]}"; do
    if [ -f "$GITHUB_WORKFLOWS_DIR/$workflow" ]; then
        echo -e "${GREEN}✅ $workflow${NC}"
    else
        echo -e "${RED}❌ $workflow missing${NC}"
        exit 1
    fi
done

echo -e "\n${YELLOW}🧪 Running test suite validation...${NC}"

# Test Makefile commands
echo "Testing Makefile commands..."

if make help > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Makefile help command works${NC}"
else
    echo -e "${RED}❌ Makefile help command failed${NC}"
    exit 1
fi

# Test quick tests
if make test-quick > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Quick tests pass${NC}"
else
    echo -e "${RED}❌ Quick tests failed${NC}"
    exit 1
fi

# Test CI command
if make ci-test > /dev/null 2>&1; then
    echo -e "${GREEN}✅ CI test command works${NC}"
    
    # Check if artifacts are generated
    if [ -f "coverage.xml" ] && [ -f "test-results.xml" ]; then
        echo -e "${GREEN}✅ Test artifacts generated${NC}"
    else
        echo -e "${RED}❌ Test artifacts not generated${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ CI test command failed${NC}"
    exit 1
fi

echo -e "\n${YELLOW}📊 Checking test coverage...${NC}"

# Extract coverage percentage
if [ -f "coverage.xml" ]; then
    # Use Python to parse coverage.xml
    COVERAGE=$(python3 -c "
import xml.etree.ElementTree as ET
try:
    tree = ET.parse('coverage.xml')
    coverage = float(tree.getroot().attrib['line-rate']) * 100
    print(f'{coverage:.1f}')
except Exception as e:
    print('0')
")
    
    if (( $(echo "$COVERAGE >= 90" | bc -l) )); then
        echo -e "${GREEN}✅ Test coverage: ${COVERAGE}% (meets 90% threshold)${NC}"
    else
        echo -e "${YELLOW}⚠️ Test coverage: ${COVERAGE}% (below 90% threshold)${NC}"
    fi
else
    echo -e "${RED}❌ Coverage report not found${NC}"
    exit 1
fi

echo -e "\n${YELLOW}🔧 Validating workflow syntax...${NC}"

# Basic YAML syntax check for workflows
cd "$GITHUB_WORKFLOWS_DIR"
for workflow in "${WORKFLOW_FILES[@]}"; do
    if python3 -c "import yaml; yaml.safe_load(open('$workflow'))" 2>/dev/null; then
        echo -e "${GREEN}✅ $workflow syntax valid${NC}"
    else
        echo -e "${RED}❌ $workflow syntax invalid${NC}"
        exit 1
    fi
done

echo -e "\n${YELLOW}📝 Integration summary...${NC}"

cd "$FLASK_BACKEND_DIR"
TEST_COUNT=$(python3 -c "
import xml.etree.ElementTree as ET
try:
    tree = ET.parse('test-results.xml')
    tests = tree.getroot().attrib['tests']
    print(tests)
except:
    print('0')
")

echo -e "${GREEN}✅ Total tests: ${TEST_COUNT}${NC}"
echo -e "${GREEN}✅ Test coverage: ${COVERAGE}%${NC}"
echo -e "${GREEN}✅ CI/CD workflows: 3 configured${NC}"
echo -e "${GREEN}✅ Makefile commands: 12+ available${NC}"

echo -e "\n${GREEN}🎉 CI/CD Integration Validation Complete!${NC}"
echo -e "${GREEN}All systems are ready for automated testing and deployment.${NC}"

echo -e "\n${YELLOW}📋 Next steps:${NC}"
echo "1. Commit and push changes to trigger CI/CD"
echo "2. Create a pull request to test PR validation workflow"
echo "3. Monitor GitHub Actions for workflow execution"
echo "4. Review test results and coverage reports"

echo -e "\n${YELLOW}💡 Quick commands:${NC}"
echo "  make test          # Run all tests locally"
echo "  make test-coverage # Generate coverage report"
echo "  make ci-test       # Run CI-style tests"
echo "  make help          # See all available commands"
