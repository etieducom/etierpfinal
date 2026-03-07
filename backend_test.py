import requests
import sys
from datetime import datetime
import json

class ETIEducomAPITester:
    def __init__(self, base_url="https://educom-exams.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.user_id = None
        self.lead_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                if 'auth/login' in endpoint:
                    # Login requires form-encoded data
                    headers['Content-Type'] = 'application/x-www-form-urlencoded'
                    response = requests.post(url, data=data, headers=headers)
                else:
                    response = requests.post(url, json=data, headers=headers, params=params)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"   ✅ Passed - Status: {response.status_code}")
                if response.status_code != 204:  # Don't try to parse JSON for 204 No Content
                    try:
                        return success, response.json()
                    except:
                        return success, response.text
                return success, {}
            else:
                print(f"   ❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Error: {response.text}")

            return False, {}

        except Exception as e:
            print(f"   ❌ Failed - Error: {str(e)}")
            return False, {}

    def test_user_registration(self):
        """Test user registration"""
        test_email = f"testuser_{datetime.now().strftime('%H%M%S')}@eticom.com"
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data={
                "email": test_email,
                "password": "test123",
                "name": "Test User"
            }
        )
        if success and 'id' in response:
            self.user_id = response['id']
            print(f"   User ID: {self.user_id}")
            return test_email
        return None

    def test_user_login(self, email, password="test123"):
        """Test user login and get token"""
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data={
                "username": email,
                "password": password
            }
        )
        if success and 'access_token' in response:
            self.token = response['access_token']
            print(f"   Token received (length: {len(self.token)})")
            return True
        return False

    def test_demo_user_login(self):
        """Test login with demo credentials"""
        return self.test_user_login("demo@eticom.com", "test123")

    def test_get_me(self):
        """Test get current user"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        return success

    def test_create_lead(self):
        """Test lead creation"""
        test_number = f"9876543{datetime.now().strftime('%H%M')}"
        success, response = self.run_test(
            "Create Lead",
            "POST",
            "leads",
            200,
            data={
                "name": "John Doe",
                "number": test_number,
                "alternate_number": "9876543211",
                "address": "123 Test Street",
                "city": "Test City",
                "state": "Test State",
                "email": f"john.doe.{datetime.now().strftime('%H%M%S')}@test.com",
                "program": "Data Science Course",
                "fee_quoted": 50000.0,
                "payment_plan": "EMI",
                "lead_source": "Website"
            }
        )
        if success and 'id' in response:
            self.lead_id = response['id']
            print(f"   Lead ID: {self.lead_id}")
            return True
        return False

    def test_get_all_leads(self):
        """Test get all leads"""
        success, response = self.run_test(
            "Get All Leads",
            "GET",
            "leads",
            200
        )
        if success and isinstance(response, list):
            print(f"   Found {len(response)} leads")
            return True
        return False

    def test_get_single_lead(self):
        """Test get single lead by ID"""
        if not self.lead_id:
            print("   ⚠️  Skipped - No lead ID available")
            return True
        
        success, response = self.run_test(
            "Get Single Lead",
            "GET",
            f"leads/{self.lead_id}",
            200
        )
        return success

    def test_update_lead_status(self):
        """Test update lead status"""
        if not self.lead_id:
            print("   ⚠️  Skipped - No lead ID available")
            return True

        success, response = self.run_test(
            "Update Lead Status",
            "PUT",
            f"leads/{self.lead_id}",
            200,
            data={"status": "Contacted"}
        )
        return success

    def test_add_followup(self):
        """Test add follow-up to lead"""
        if not self.lead_id:
            print("   ⚠️  Skipped - No lead ID available")
            return True

        success, response = self.run_test(
            "Add Follow-up",
            "POST",
            f"leads/{self.lead_id}/followups",
            200,
            params={
                "note": "Called the lead, very interested",
                "next_date": None
            }
        )
        return success

    def test_get_followups(self):
        """Test get follow-ups for lead"""
        if not self.lead_id:
            print("   ⚠️  Skipped - No lead ID available")
            return True

        success, response = self.run_test(
            "Get Follow-ups",
            "GET",
            f"leads/{self.lead_id}/followups",
            200
        )
        return success

    def test_analytics_overview(self):
        """Test analytics overview"""
        success, response = self.run_test(
            "Analytics Overview",
            "GET",
            "analytics/overview",
            200
        )
        if success:
            expected_keys = ['total_leads', 'status_breakdown', 'source_performance', 'program_performance']
            for key in expected_keys:
                if key not in response:
                    print(f"   ⚠️  Missing key: {key}")
                    return False
            print(f"   Total leads: {response.get('total_leads', 0)}")
            return True
        return False

    def test_analytics_trends(self):
        """Test analytics trends"""
        success, response = self.run_test(
            "Analytics Trends",
            "GET",
            "analytics/trends",
            200
        )
        if success and isinstance(response, list):
            print(f"   Found {len(response)} trend data points")
            return True
        return success

    def test_delete_lead(self):
        """Test delete lead"""
        if not self.lead_id:
            print("   ⚠️  Skipped - No lead ID available")
            return True

        success, response = self.run_test(
            "Delete Lead",
            "DELETE",
            f"leads/{self.lead_id}",
            200
        )
        return success

def main():
    print("🚀 Starting ETI Educom API Testing...")
    tester = ETIEducomAPITester()
    
    # Test sequence
    print("\n" + "="*50)
    print("TESTING AUTHENTICATION")
    print("="*50)
    
    # Test with demo credentials first
    if not tester.test_demo_user_login():
        print("❌ Demo login failed, trying registration flow")
        
        # Test registration flow
        test_email = tester.test_user_registration()
        if not test_email:
            print("❌ Registration failed, cannot proceed")
            return 1
        
        if not tester.test_user_login(test_email):
            print("❌ Login after registration failed, cannot proceed")
            return 1
    
    # Test get current user
    tester.test_get_me()

    print("\n" + "="*50)
    print("TESTING LEAD MANAGEMENT")
    print("="*50)
    
    # Test lead operations
    tester.test_create_lead()
    tester.test_get_all_leads()
    tester.test_get_single_lead()
    tester.test_update_lead_status()
    
    print("\n" + "="*50)
    print("TESTING FOLLOW-UPS")
    print("="*50)
    
    tester.test_add_followup()
    tester.test_get_followups()

    print("\n" + "="*50)
    print("TESTING ANALYTICS")
    print("="*50)
    
    tester.test_analytics_overview()
    tester.test_analytics_trends()

    print("\n" + "="*50)
    print("TESTING CLEANUP")
    print("="*50)
    
    tester.test_delete_lead()

    # Print final results
    print("\n" + "="*50)
    print("TEST RESULTS")
    print("="*50)
    print(f"📊 Tests passed: {tester.tests_passed}/{tester.tests_run}")
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"📈 Success rate: {success_rate:.1f}%")
    
    if success_rate >= 80:
        print("🎉 Backend API testing PASSED!")
        return 0
    else:
        print("❌ Backend API testing FAILED!")
        return 1

if __name__ == "__main__":
    sys.exit(main())