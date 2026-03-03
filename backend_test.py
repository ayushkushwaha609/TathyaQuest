#!/usr/bin/env python3
"""
Backend API Test for SachCheck Health Claim Fact-Checking App
Testing the enhanced response structure with new fields:
- verdict_text_english
- verdict_text_regional  
- why_misleading
- Non-round confidence scores
"""

import requests
import json
import time
import sys
from typing import Dict, Any

class BackendTester:
    def __init__(self):
        self.base_url = "https://reel-link-handler.preview.emergentagent.com/api"
        self.test_results = []
        
    def log_result(self, test_name: str, success: bool, message: str, details: Dict = None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details or {}
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL" 
        print(f"{status}: {test_name} - {message}")
        if details:
            for key, value in details.items():
                print(f"    {key}: {value}")
        print()
        
    def test_health_endpoint(self):
        """Test basic health endpoint"""
        try:
            response = requests.get(f"{self.base_url}/health", timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "ok":
                    self.log_result("Health Endpoint", True, "Health endpoint returning correct status")
                else:
                    self.log_result("Health Endpoint", False, f"Unexpected response: {data}")
            else:
                self.log_result("Health Endpoint", False, f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("Health Endpoint", False, f"Exception: {str(e)}")
    
    def test_enhanced_response_structure(self, url: str = "https://www.youtube.com/shorts/dQw4w9WgXcQ", language_code: str = "hi-IN"):
        """Test the enhanced response structure with specific URL and language"""
        try:
            print(f"Testing enhanced response structure with URL: {url}")
            print(f"Language: {language_code}")
            
            # Make the API call
            payload = {
                "url": url,
                "language_code": language_code
            }
            
            start_time = time.time()
            response = requests.post(
                f"{self.base_url}/check", 
                json=payload,
                timeout=120  # Longer timeout for video processing
            )
            response_time = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if all required fields exist
                required_fields = [
                    "claim", "verdict", "confidence", "reason", "verdict_text",
                    "verdict_text_english", "verdict_text_regional", "audio_base64",
                    "category", "key_points", "fact_details", "what_to_know", 
                    "sources_note", "why_misleading"
                ]
                
                missing_fields = []
                for field in required_fields:
                    if field not in data:
                        missing_fields.append(field)
                
                if missing_fields:
                    self.log_result(
                        "Enhanced Response Structure", 
                        False, 
                        f"Missing required fields: {missing_fields}",
                        {"response_time": f"{response_time:.2f}s"}
                    )
                    return False
                
                # Verify specific new fields have content
                verdict_text_english = data.get("verdict_text_english", "")
                verdict_text_regional = data.get("verdict_text_regional", "")
                why_misleading = data.get("why_misleading", "")
                confidence = data.get("confidence", 0)
                
                # Test results tracking
                test_details = {
                    "response_time": f"{response_time:.2f}s",
                    "verdict": data.get("verdict"),
                    "confidence": confidence,
                    "verdict_text_english_length": len(verdict_text_english),
                    "verdict_text_regional_length": len(verdict_text_regional),
                    "why_misleading_length": len(why_misleading),
                    "category": data.get("category"),
                    "key_points_count": len(data.get("key_points", [])),
                }
                
                # Check if verdict_text_english has content
                if not verdict_text_english or len(verdict_text_english.strip()) < 10:
                    self.log_result(
                        "verdict_text_english Field", 
                        False, 
                        "verdict_text_english field is empty or too short",
                        test_details
                    )
                else:
                    self.log_result(
                        "verdict_text_english Field", 
                        True, 
                        f"verdict_text_english contains {len(verdict_text_english)} characters",
                        {"preview": verdict_text_english[:100] + "..."}
                    )
                
                # Check if verdict_text_regional has content  
                if not verdict_text_regional or len(verdict_text_regional.strip()) < 10:
                    self.log_result(
                        "verdict_text_regional Field", 
                        False, 
                        "verdict_text_regional field is empty or too short",
                        test_details
                    )
                else:
                    self.log_result(
                        "verdict_text_regional Field", 
                        True, 
                        f"verdict_text_regional contains {len(verdict_text_regional)} characters",
                        {"preview": verdict_text_regional[:100] + "..."}
                    )
                
                # Check confidence score - should NOT be a round number (multiple of 10)
                if confidence % 10 == 0:
                    self.log_result(
                        "Non-Round Confidence Score", 
                        False, 
                        f"Confidence score {confidence} is a round number (multiple of 10)",
                        test_details
                    )
                else:
                    self.log_result(
                        "Non-Round Confidence Score", 
                        True, 
                        f"Confidence score {confidence} is appropriately non-round",
                        test_details
                    )
                
                # Check why_misleading field - should be populated if verdict is MISLEADING or PARTIALLY_TRUE
                verdict = data.get("verdict", "")
                if verdict in ["MISLEADING", "PARTIALLY_TRUE"]:
                    if not why_misleading or len(why_misleading.strip()) < 20:
                        self.log_result(
                            "why_misleading Field Population", 
                            False, 
                            f"why_misleading should be populated when verdict is {verdict}",
                            test_details
                        )
                    else:
                        self.log_result(
                            "why_misleading Field Population", 
                            True, 
                            f"why_misleading properly populated for {verdict} verdict",
                            {"why_misleading_preview": why_misleading[:100] + "..."}
                        )
                else:
                    self.log_result(
                        "why_misleading Field Logic", 
                        True, 
                        f"why_misleading correctly empty/minimal for {verdict} verdict",
                        {"verdict": verdict, "why_misleading_length": len(why_misleading)}
                    )
                
                # Test overall response structure completeness
                all_tests_passed = all([
                    len(verdict_text_english.strip()) >= 10,
                    len(verdict_text_regional.strip()) >= 10,
                    confidence % 10 != 0,
                    (verdict not in ["MISLEADING", "PARTIALLY_TRUE"] or len(why_misleading.strip()) >= 20)
                ])
                
                self.log_result(
                    "Enhanced Response Structure Complete", 
                    all_tests_passed, 
                    "All enhanced response fields validated" if all_tests_passed else "Some enhanced fields failed validation",
                    test_details
                )
                
                # Print full response for debugging
                print("=== FULL RESPONSE SAMPLE ===")
                sample_response = {
                    "claim": data.get("claim", "")[:100] + "..." if len(data.get("claim", "")) > 100 else data.get("claim", ""),
                    "verdict": data.get("verdict"),
                    "confidence": data.get("confidence"),
                    "verdict_text_english": verdict_text_english[:200] + "..." if len(verdict_text_english) > 200 else verdict_text_english,
                    "verdict_text_regional": verdict_text_regional[:200] + "..." if len(verdict_text_regional) > 200 else verdict_text_regional,
                    "why_misleading": why_misleading[:200] + "..." if len(why_misleading) > 200 else why_misleading,
                    "category": data.get("category"),
                    "key_points_count": len(data.get("key_points", [])),
                    "has_audio": bool(data.get("audio_base64"))
                }
                print(json.dumps(sample_response, indent=2, ensure_ascii=False))
                print("=== END SAMPLE ===\n")
                
                return all_tests_passed
                
            else:
                self.log_result(
                    "Enhanced Response Structure", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}",
                    {"response_time": f"{response_time:.2f}s"}
                )
                return False
                
        except Exception as e:
            self.log_result(
                "Enhanced Response Structure", 
                False, 
                f"Exception during test: {str(e)}"
            )
            return False
    
    def test_url_validation(self):
        """Test URL validation"""
        try:
            # Test invalid URL
            payload = {"url": "https://invalid-site.com/video", "language_code": "hi-IN"}
            response = requests.post(f"{self.base_url}/check", json=payload, timeout=10)
            
            if response.status_code == 422:
                self.log_result("URL Validation", True, "Invalid URL correctly rejected with 422")
            else:
                self.log_result("URL Validation", False, f"Expected 422, got {response.status_code}")
        except Exception as e:
            self.log_result("URL Validation", False, f"Exception: {str(e)}")
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting Backend API Tests for SachCheck Enhanced Response Structure")
        print("=" * 80)
        
        # Test 1: Health endpoint
        self.test_health_endpoint()
        
        # Test 2: Enhanced response structure with specific test URL
        test_url = "https://www.youtube.com/shorts/dQw4w9WgXcQ"
        language_code = "hi-IN"
        self.test_enhanced_response_structure(test_url, language_code)
        
        # Test 3: URL validation
        self.test_url_validation()
        
        # Summary
        print("=" * 80)
        print("📊 TEST SUMMARY")
        print("=" * 80)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        print("\n🔍 DETAILED RESULTS:")
        for result in self.test_results:
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test']}: {result['message']}")
        
        if passed == total:
            print("\n🎉 ALL TESTS PASSED! Enhanced response structure is working correctly.")
            return True
        else:
            print(f"\n⚠️  {total - passed} test(s) failed. Review the detailed results above.")
            return False

if __name__ == "__main__":
    tester = BackendTester()
    success = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)