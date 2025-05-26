#!/usr/bin/env python3
"""
Test runner script for the Flask backend
Provides convenient commands for running different types of tests
"""

import sys
import subprocess
import argparse
from pathlib import Path


def run_command(cmd, description):
    """Run a command and handle errors"""
    print(f"\n🧪 {description}")
    print(f"Running: {' '.join(cmd)}")
    print("-" * 50)
    
    try:
        result = subprocess.run(cmd, check=True, cwd=Path(__file__).parent)
        print(f"✅ {description} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed with exit code {e.returncode}")
        return False
    except FileNotFoundError:
        print(f"❌ Command not found: {cmd[0]}")
        print("Make sure pytest is installed: pip install -r requirements-test.txt")
        return False


def install_dependencies():
    """Install test dependencies"""
    return run_command(
        ["pip", "install", "-r", "requirements-test.txt"],
        "Installing test dependencies"
    )


def run_unit_tests():
    """Run unit tests only"""
    return run_command(
        ["python", "-m", "pytest", "tests/test_user_api.py", "tests/test_meeting_api.py", "-v"],
        "Running unit tests"
    )


def run_socket_tests():
    """Run Socket.IO tests only"""
    return run_command(
        ["python", "-m", "pytest", "tests/test_socket_events.py", "-v"],
        "Running Socket.IO tests"
    )


def run_integration_tests():
    """Run integration tests only"""
    return run_command(
        ["python", "-m", "pytest", "tests/test_integration.py", "-v"],
        "Running integration tests"
    )


def run_all_tests():
    """Run all tests with coverage"""
    return run_command(
        ["python", "-m", "pytest", "tests/", "--cov=server", "--cov-report=html", "--cov-report=term-missing"],
        "Running all tests with coverage"
    )


def run_quick_tests():
    """Run tests without coverage for quick feedback"""
    return run_command(
        ["python", "-m", "pytest", "tests/", "-v", "--tb=short"],
        "Running quick tests"
    )


def run_specific_test(test_path):
    """Run a specific test file or test function"""
    return run_command(
        ["python", "-m", "pytest", test_path, "-v"],
        f"Running specific test: {test_path}"
    )


def main():
    parser = argparse.ArgumentParser(description="Flask Backend Test Runner")
    parser.add_argument(
        "command",
        choices=["install", "unit", "socket", "integration", "all", "quick", "specific"],
        help="Test command to run"
    )
    parser.add_argument(
        "--test",
        help="Specific test file or function to run (use with 'specific' command)"
    )
    
    args = parser.parse_args()
    
    print("🚀 Flask Backend Test Runner")
    print("=" * 50)
    
    success = True
    
    if args.command == "install":
        success = install_dependencies()
    elif args.command == "unit":
        success = run_unit_tests()
    elif args.command == "socket":
        success = run_socket_tests()
    elif args.command == "integration":
        success = run_integration_tests()
    elif args.command == "all":
        success = run_all_tests()
    elif args.command == "quick":
        success = run_quick_tests()
    elif args.command == "specific":
        if not args.test:
            print("❌ Please specify a test file or function with --test")
            sys.exit(1)
        success = run_specific_test(args.test)
    
    if success:
        print("\n🎉 All tests completed successfully!")
        print("\n📊 Coverage report available at: htmlcov/index.html")
    else:
        print("\n💥 Some tests failed. Check the output above for details.")
        sys.exit(1)


if __name__ == "__main__":
    main()
