#!/bin/bash

# 🔍 GitHub Actions Status Checker
# This script helps verify that the GitHub Actions workflows are now working correctly

echo "🚀 GitHub Actions Fix Verification"
echo "=================================="
echo ""

# Check current git status
echo "📋 Current Repository Status:"
echo "Branch: $(git branch --show-current)"
echo "Latest commit: $(git log --oneline -1)"
echo ""

# Check if files exist
echo "📁 Checking CI/CD Files:"
if [ -f ".github/workflows/test.yml" ]; then
    echo "✅ test.yml exists"
else
    echo "❌ test.yml missing"
fi

if [ -f ".github/workflows/ci-cd.yml" ]; then
    echo "✅ ci-cd.yml exists"
else
    echo "❌ ci-cd.yml missing"
fi

if [ -f ".github/workflows/pr-checks.yml" ]; then
    echo "✅ pr-checks.yml exists"
else
    echo "❌ pr-checks.yml missing"
fi

echo ""

# Run local tests to verify they pass
echo "🧪 Running Local Tests:"
cd Flask-Backend || exit 1

echo "Running linting check..."
if flake8 server.py tests/ --max-line-length=100 --ignore=E203,W503,F841; then
    echo "✅ Linting: PASS"
else
    echo "❌ Linting: FAIL"
fi

echo ""
echo "Running test suite..."
if python -m pytest tests/ -q --tb=no; then
    echo "✅ Tests: PASS"
    
    # Check coverage
    python -m pytest tests/ --cov=server --cov-report=term-missing --tb=no -q | grep "TOTAL"
    
    python -c "
import xml.etree.ElementTree as ET
try:
    tree = ET.parse('coverage.xml')
    coverage = float(tree.getroot().attrib['line-rate']) * 100
    print(f'✅ Coverage: {coverage:.1f}% (threshold: 90%)')
    if coverage < 90:
        print('❌ Coverage below threshold')
    else:
        print('✅ Coverage meets threshold')
except:
    print('⚠️  Could not read coverage file')
" 2>/dev/null
else
    echo "❌ Tests: FAIL"
fi

cd ..

echo ""
echo "🌐 Next Steps:"
echo "1. Check GitHub Actions at: https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/actions"
echo "2. Look for the latest workflow run triggered by commit: $(git log --oneline -1 | cut -d' ' -f1)"
echo "3. All workflows should now show green ✅ status"
echo ""
echo "🎉 If you see green checkmarks in GitHub Actions, the fixes were successful!"
