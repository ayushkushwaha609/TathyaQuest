#!/usr/bin/env python3
"""
Backend test suite for SachCheck API
Tests all endpoints according to the review request requirements
"""

import requests
import json
import time
import sys
import os

# Get backend URL from frontend env file
BACKEND_BASE_URL = "https://mobile-project-draft.preview.emergentagent.com/api"

# Test data
TEST_YOUTUBE_URL = "https://www.youtube.com/shorts/8kbFtUmgGuQ"
INVALID_URL = "https://example.com/not-a-video"
SUPPORTED_LANGUAGES = ["hi-IN", "ta-IN", "te-IN", "kn-IN", "ml-IN", "mr-IN"]

def log_test(test_name, status, message=""):
    """Log test results with formatting"""
    status_emoji = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"{status_emoji} {test_name}: {status}")
    if message:
        print(f"   {message}")
    print()

def test_health_endpoint():
    """Test 1: GET /api/health endpoint"""
    print("🔍 Testing Health Endpoint...")
    try:
        response = requests.get(f"{BACKEND_BASE_URL}/health", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "ok":
                log_test("Health Endpoint", "PASS", "Returns {'status': 'ok'} as expected")
                return True
            else:
                log_test("Health Endpoint", "FAIL", f"Unexpected response: {data}")
                return False
        else:
            log_test("Health Endpoint", "FAIL", f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        log_test("Health Endpoint", "FAIL", f"Exception: {str(e)}")
        return False

def test_check_endpoint_valid_url():
    """Test 2: POST /api/check with valid YouTube URL"""
    print("🔍 Testing Valid YouTube URL...")
    try:
        payload = {
            "url": TEST_YOUTUBE_URL,
            "language_code": "hi-IN"
        }
        
        print(f"   Sending request to: {BACKEND_BASE_URL}/check")
        print(f"   Payload: {json.dumps(payload, indent=2)}")
        print("   This may take 15-45 seconds...")
        
        response = requests.post(
            f"{BACKEND_BASE_URL}/check", 
            json=payload, 
            timeout=60  # Extended timeout for processing
        )
        
        print(f"   Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Validate response structure
            required_fields = ["claim", "verdict", "confidence", "reason", "verdict_text"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                log_test("Valid YouTube URL", "FAIL", f"Missing fields: {missing_fields}")
                return False
            
            # Validate field types and values
            if not isinstance(data["claim"], str) or len(data["claim"]) < 5:
                log_test("Valid YouTube URL", "FAIL", "Claim field invalid or too short")
                return False
                
            if data["verdict"] not in ["TRUE", "FALSE", "MISLEADING", "PARTIALLY_TRUE"]:
                log_test("Valid YouTube URL", "FAIL", f"Invalid verdict: {data['verdict']}")
                return False
                
            if not isinstance(data["confidence"], int) or not (0 <= data["confidence"] <= 100):
                log_test("Valid YouTube URL", "FAIL", f"Invalid confidence: {data['confidence']}")
                return False
            
            # Log success with key details
            message = f"""Response structure valid:
   Claim: {data['claim'][:100]}...
   Verdict: {data['verdict']} (Confidence: {data['confidence']}%)
   Audio: {'Present' if data.get('audio_base64') else 'None'}"""
            
            log_test("Valid YouTube URL", "PASS", message)
            return data  # Return data for cache testing
            
        else:
            log_test("Valid YouTube URL", "FAIL", f"HTTP {response.status_code}: {response.text}")
            return False
            
    except requests.Timeout:
        log_test("Valid YouTube URL", "FAIL", "Request timeout (60s) - Processing took too long")
        return False
    except Exception as e:
        log_test("Valid YouTube URL", "FAIL", f"Exception: {str(e)}")
        return False

def test_check_endpoint_invalid_url():
    """Test 3: POST /api/check with invalid URL"""
    print("🔍 Testing Invalid URL...")
    try:
        payload = {
            "url": INVALID_URL,
            "language_code": "hi-IN"
        }
        
        response = requests.post(
            f"{BACKEND_BASE_URL}/check", 
            json=payload, 
            timeout=10
        )
        
        if response.status_code == 422:
            data = response.json()
            if "invalid_url" in str(data) or "Instagram" in str(data) or "YouTube" in str(data):
                log_test("Invalid URL Validation", "PASS", "Correctly rejects non-YouTube/Instagram URLs")
                return True
            else:
                log_test("Invalid URL Validation", "FAIL", f"Wrong error message: {data}")
                return False
        else:
            log_test("Invalid URL Validation", "FAIL", f"Expected 422, got {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        log_test("Invalid URL Validation", "FAIL", f"Exception: {str(e)}")
        return False

def test_cache_functionality(original_data):
    """Test 4: Cache functionality with same request"""
    print("🔍 Testing Cache Functionality...")
    try:
        if not original_data:
            log_test("Cache Test", "SKIP", "No valid data from previous test")
            return False
            
        payload = {
            "url": TEST_YOUTUBE_URL,
            "language_code": "hi-IN"
        }
        
        print("   Sending same request again to test cache...")
        start_time = time.time()
        
        response = requests.post(
            f"{BACKEND_BASE_URL}/check", 
            json=payload, 
            timeout=30
        )
        
        end_time = time.time()
        response_time = end_time - start_time
        
        if response.status_code == 200:
            data = response.json()
            
            # Compare key fields
            if (data["claim"] == original_data["claim"] and 
                data["verdict"] == original_data["verdict"] and
                data["confidence"] == original_data["confidence"]):
                
                message = f"""Cache working correctly:
   Response time: {response_time:.2f}s (should be faster)
   Data matches previous response"""
                log_test("Cache Test", "PASS", message)
                return True
            else:
                log_test("Cache Test", "FAIL", "Cached data doesn't match original")
                return False
        else:
            log_test("Cache Test", "FAIL", f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        log_test("Cache Test", "FAIL", f"Exception: {str(e)}")
        return False

def test_language_support():
    """Test 5: Different language codes (quick validation)"""
    print("🔍 Testing Language Support...")
    try:
        # Test with a different language code
        payload = {
            "url": TEST_YOUTUBE_URL,
            "language_code": "ta-IN"  # Tamil
        }
        
        response = requests.post(
            f"{BACKEND_BASE_URL}/check", 
            json=payload, 
            timeout=60
        )
        
        if response.status_code == 200:
            data = response.json()
            log_test("Language Support", "PASS", f"Tamil language accepted, verdict: {data.get('verdict', 'N/A')}")
            return True
        else:
            log_test("Language Support", "FAIL", f"HTTP {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        log_test("Language Support", "FAIL", f"Exception: {str(e)}")
        return False

def run_all_tests():
    """Run all backend tests in sequence"""
    print("=" * 60)
    print("🚀 SachCheck Backend API Test Suite")
    print("=" * 60)
    print(f"Backend URL: {BACKEND_BASE_URL}")
    print()
    
    results = {}
    
    # Test 1: Health check
    results["health"] = test_health_endpoint()
    
    # Test 2: Valid URL (main functionality)
    original_data = test_check_endpoint_valid_url()
    results["valid_url"] = bool(original_data)
    
    # Test 3: Invalid URL validation
    results["invalid_url"] = test_check_endpoint_invalid_url()
    
    # Test 4: Cache functionality (if previous test succeeded)
    results["cache"] = test_cache_functionality(original_data)
    
    # Test 5: Language support
    results["language"] = test_language_support()
    
    # Summary
    print("=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    total_tests = len(results)
    passed_tests = sum(1 for result in results.values() if result)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name.replace('_', ' ').title()}: {status}")
    
    print()
    print(f"Total: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 All tests passed!")
        return True
    else:
        print("⚠️ Some tests failed. Check details above.")
        return False

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)