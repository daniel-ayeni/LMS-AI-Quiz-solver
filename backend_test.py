#!/usr/bin/env python3

import requests
import sys
import time
import json
from datetime import datetime

class LMSAPITester:
    def __init__(self, base_url="https://video-tutor-4.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.session_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.credentials = {
            "email": "danielayeni199@gmail.com",
            "password": "firzuN-biqfa9-mogwec"
        }

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}: PASSED {details}")
        else:
            print(f"❌ {name}: FAILED {details}")
        
        return success

    def test_root_endpoint(self):
        """Test root API endpoint"""
        try:
            response = requests.get(f"{self.base_url}/", timeout=10)
            success = response.status_code == 200
            
            if success:
                data = response.json()
                return self.log_test("Root Endpoint", True, f"- Message: {data.get('message')}")
            else:
                return self.log_test("Root Endpoint", False, f"- Status: {response.status_code}")
        
        except Exception as e:
            return self.log_test("Root Endpoint", False, f"- Error: {str(e)}")

    def test_fetch_courses(self):
        """Test fetching courses with credentials"""
        try:
            print(f"\n🔍 Testing course fetch with credentials...")
            
            response = requests.post(
                f"{self.base_url}/lms/courses",
                json=self.credentials,
                headers={'Content-Type': 'application/json'},
                timeout=30  # Longer timeout for LMS interaction
            )
            
            success = response.status_code == 200
            
            if success:
                data = response.json()
                courses = data.get("courses", [])
                return self.log_test("Fetch Courses", True, 
                    f"- Found {len(courses)} courses")
            else:
                error_detail = ""
                try:
                    error_data = response.json()
                    error_detail = f"- Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    error_detail = f"- Status: {response.status_code}, Response: {response.text[:200]}"
                
                return self.log_test("Fetch Courses", False, error_detail)
        
        except requests.exceptions.Timeout:
            return self.log_test("Fetch Courses", False, "- Timeout: LMS interaction took too long")
        except Exception as e:
            return self.log_test("Fetch Courses", False, f"- Error: {str(e)}")

    def test_start_automation(self):
        """Test starting automation"""
        try:
            print(f"\n🔍 Testing automation start...")
            
            start_data = {
                "email": self.credentials["email"],
                "password": self.credentials["password"],
                "course_title": None  # Let it pick the next available course
            }
            
            response = requests.post(
                f"{self.base_url}/lms/start",
                json=start_data,
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            
            success = response.status_code == 200
            
            if success:
                data = response.json()
                if data.get("success") and data.get("session_id"):
                    self.session_id = data["session_id"]
                    return self.log_test("Start Automation", True, 
                        f"- Session ID: {self.session_id[:8]}...")
                else:
                    return self.log_test("Start Automation", False, 
                        f"- Invalid response: {data}")
            else:
                error_detail = ""
                try:
                    error_data = response.json()
                    error_detail = f"- Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    error_detail = f"- Status: {response.status_code}"
                
                return self.log_test("Start Automation", False, error_detail)
        
        except Exception as e:
            return self.log_test("Start Automation", False, f"- Error: {str(e)}")

    def test_get_status(self):
        """Test getting automation status"""
        if not self.session_id:
            return self.log_test("Get Status", False, "- No session ID available")
        
        try:
            response = requests.get(
                f"{self.base_url}/lms/status/{self.session_id}",
                timeout=10
            )
            
            success = response.status_code == 200
            
            if success:
                data = response.json()
                status = data.get("status", "unknown")
                return self.log_test("Get Status", True, f"- Status: {status}")
            else:
                return self.log_test("Get Status", False, f"- Status: {response.status_code}")
        
        except Exception as e:
            return self.log_test("Get Status", False, f"- Error: {str(e)}")

    def test_get_logs(self):
        """Test getting automation logs"""
        if not self.session_id:
            return self.log_test("Get Logs", False, "- No session ID available")
        
        try:
            response = requests.get(
                f"{self.base_url}/lms/logs/{self.session_id}",
                timeout=10
            )
            
            success = response.status_code == 200
            
            if success:
                data = response.json()
                logs = data.get("logs", [])
                return self.log_test("Get Logs", True, f"- Found {len(logs)} log entries")
            else:
                return self.log_test("Get Logs", False, f"- Status: {response.status_code}")
        
        except Exception as e:
            return self.log_test("Get Logs", False, f"- Error: {str(e)}")

    def test_stop_automation(self):
        """Test stopping automation"""
        if not self.session_id:
            return self.log_test("Stop Automation", False, "- No session ID available")
        
        try:
            response = requests.post(
                f"{self.base_url}/lms/stop/{self.session_id}",
                timeout=10
            )
            
            success = response.status_code == 200
            
            if success:
                data = response.json()
                if data.get("success"):
                    return self.log_test("Stop Automation", True, "- Successfully stopped")
                else:
                    return self.log_test("Stop Automation", False, f"- Response: {data}")
            else:
                return self.log_test("Stop Automation", False, f"- Status: {response.status_code}")
        
        except Exception as e:
            return self.log_test("Stop Automation", False, f"- Error: {str(e)}")

    def test_polling_workflow(self):
        """Test the complete polling workflow for a short time"""
        try:
            print(f"\n🔍 Testing real automation workflow...")
            
            # Start automation again for workflow test
            start_data = {
                "email": self.credentials["email"],
                "password": self.credentials["password"],
                "course_title": None
            }
            
            response = requests.post(
                f"{self.base_url}/lms/start",
                json=start_data,
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            
            if response.status_code != 200:
                return self.log_test("Polling Workflow", False, "- Failed to start automation")
            
            data = response.json()
            if not data.get("success"):
                return self.log_test("Polling Workflow", False, "- Start automation returned false")
            
            session_id = data["session_id"]
            print(f"   Started workflow session: {session_id[:8]}...")
            
            # Poll for status and logs for a brief period
            max_polls = 10  # About 20 seconds
            poll_count = 0
            has_logs = False
            
            while poll_count < max_polls:
                # Check status
                status_response = requests.get(f"{self.base_url}/lms/status/{session_id}")
                if status_response.status_code == 200:
                    status_data = status_response.json()
                    print(f"   Poll {poll_count + 1}: Status = {status_data.get('status')}")
                    
                    if status_data.get('status') in ['completed', 'failed', 'stopped']:
                        print(f"   Automation completed with status: {status_data.get('status')}")
                        break
                
                # Check logs
                logs_response = requests.get(f"{self.base_url}/lms/logs/{session_id}")
                if logs_response.status_code == 200:
                    logs_data = logs_response.json()
                    log_count = len(logs_data.get('logs', []))
                    if log_count > 0:
                        has_logs = True
                        latest_log = logs_data['logs'][-1]
                        print(f"   Latest log: {latest_log.get('message', 'No message')[:50]}...")
                
                poll_count += 1
                time.sleep(2)
            
            # Stop the automation to clean up
            stop_response = requests.post(f"{self.base_url}/lms/stop/{session_id}")
            
            # Evaluate success
            if has_logs and poll_count > 0:
                return self.log_test("Polling Workflow", True, 
                    f"- Completed {poll_count} polls, found logs")
            else:
                return self.log_test("Polling Workflow", False, 
                    f"- No logs found in {poll_count} polls")
        
        except Exception as e:
            return self.log_test("Polling Workflow", False, f"- Error: {str(e)}")

    def run_all_tests(self):
        """Run all tests"""
        print("=" * 60)
        print("🧪 LMS AUTOMATION API TESTING")
        print("=" * 60)
        print(f"Backend URL: {self.base_url}")
        print(f"Test Credentials: {self.credentials['email']}")
        print("=" * 60)

        # Test individual endpoints
        self.test_root_endpoint()
        self.test_fetch_courses()
        
        # Test automation lifecycle
        self.test_start_automation()
        
        # Wait a moment for automation to start
        if self.session_id:
            print("\n⏳ Waiting 3 seconds for automation to initialize...")
            time.sleep(3)
            
            self.test_get_status()
            self.test_get_logs() 
            self.test_stop_automation()
        
        # Test complete workflow
        self.test_polling_workflow()
        
        # Print results
        print("\n" + "=" * 60)
        print("📊 TEST RESULTS")
        print("=" * 60)
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed / self.tests_run * 100):.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 ALL TESTS PASSED!")
            return 0
        else:
            print("⚠️  SOME TESTS FAILED!")
            return 1

def main():
    tester = LMSAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())