#!/usr/bin/env python3
"""
Test script to verify backend dependencies are installed correctly.
Run this script to check if all required packages are available.
"""

import sys

def check_import(module_name, package_name=None):
    """Try to import a module and report status."""
    if package_name is None:
        package_name = module_name
    
    try:
        __import__(module_name)
        print(f"✓ {package_name} is installed")
        return True
    except ImportError:
        print(f"✗ {package_name} is NOT installed")
        return False

def check_python_version():
    """Check if Python version is 3.8 or higher."""
    version = sys.version_info
    print(f"\nPython version: {version.major}.{version.minor}.{version.micro}")
    
    if version.major >= 3 and version.minor >= 8:
        print("✓ Python version is compatible (3.8+)")
        return True
    else:
        print("✗ Python version is too old. Requires Python 3.8 or higher")
        return False

def main():
    print("=" * 60)
    print("ShopOS Video Scene Detector - Backend Setup Test")
    print("=" * 60)
    
    all_ok = True
    
    # Check Python version
    all_ok &= check_python_version()
    
    print("\nChecking dependencies:")
    print("-" * 60)
    
    # Check required packages
    all_ok &= check_import("flask", "Flask")
    all_ok &= check_import("flask_cors", "Flask-CORS")
    all_ok &= check_import("werkzeug", "Werkzeug")
    all_ok &= check_import("scenedetect", "Scene Detector")
    all_ok &= check_import("cv2", "OpenCV (cv2)")
    all_ok &= check_import("numpy", "NumPy")
    
    print("-" * 60)
    
    if all_ok:
        print("\n✓ All dependencies are installed correctly!")
        print("You can now run the backend server with:")
        print("  python3 server.py")
        print("\nOr from the project root:")
        print("  npm run backend")
        return 0
    else:
        print("\n✗ Some dependencies are missing.")
        print("Please install them with:")
        print("  pip3 install -r requirements.txt")
        print("\nOr from the project root:")
        print("  npm run backend:setup")
        return 1

if __name__ == "__main__":
    sys.exit(main())


