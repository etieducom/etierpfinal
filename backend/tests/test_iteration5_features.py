"""
Iteration 5 Feature Tests:
- Reports Page: report type selector, branch filter, CSV generation
- All Payments Page: Branch Admin edit/delete buttons
- Expenses Page: Branch Admin delete button
- Backend APIs: /api/reports/generate, DELETE/PUT /api/payments, DELETE /api/expenses
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://institute-dashboard-1.preview.emergentagent.com')

# Test credentials
SUPER_ADMIN = {"email": "admin@eti.com", "password": "admin123"}
BRANCH_ADMIN = {"email": "test_branch_admin_iter5@eti.com", "password": "test123"}

class TestReportsAPI:
    """Test /api/reports/generate endpoint with different report types"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get Super Admin token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            data={"username": SUPER_ADMIN["email"], "password": SUPER_ADMIN["password"]},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_reports_leads_type(self):
        """Test GET /api/reports/generate?report_type=leads"""
        response = requests.get(
            f"{BASE_URL}/api/reports/generate?report_type=leads",
            headers=self.headers
        )
        assert response.status_code == 200, f"Report generation failed: {response.text}"
        assert "text/csv" in response.headers.get("content-type", "")
        # Verify CSV has header row
        content = response.text
        assert "Name" in content and "Email" in content
        print(f"Leads report generated successfully, size: {len(content)} bytes")
    
    def test_reports_enrollments_type(self):
        """Test GET /api/reports/generate?report_type=enrollments"""
        response = requests.get(
            f"{BASE_URL}/api/reports/generate?report_type=enrollments",
            headers=self.headers
        )
        assert response.status_code == 200, f"Report generation failed: {response.text}"
        assert "text/csv" in response.headers.get("content-type", "")
        content = response.text
        assert "Student Name" in content
        print(f"Enrollments report generated successfully, size: {len(content)} bytes")
    
    def test_reports_income_type(self):
        """Test GET /api/reports/generate?report_type=income"""
        response = requests.get(
            f"{BASE_URL}/api/reports/generate?report_type=income",
            headers=self.headers
        )
        assert response.status_code == 200, f"Report generation failed: {response.text}"
        assert "text/csv" in response.headers.get("content-type", "")
        content = response.text
        assert "Receipt" in content
        print(f"Income report generated successfully, size: {len(content)} bytes")
    
    def test_reports_expenses_type(self):
        """Test GET /api/reports/generate?report_type=expenses"""
        response = requests.get(
            f"{BASE_URL}/api/reports/generate?report_type=expenses",
            headers=self.headers
        )
        assert response.status_code == 200, f"Report generation failed: {response.text}"
        assert "text/csv" in response.headers.get("content-type", "")
        content = response.text
        assert "Category" in content
        print(f"Expenses report generated successfully, size: {len(content)} bytes")
    
    def test_reports_pending_payments_type(self):
        """Test GET /api/reports/generate?report_type=pending_payments"""
        response = requests.get(
            f"{BASE_URL}/api/reports/generate?report_type=pending_payments",
            headers=self.headers
        )
        assert response.status_code == 200, f"Report generation failed: {response.text}"
        assert "text/csv" in response.headers.get("content-type", "")
        content = response.text
        assert "Student Name" in content
        print(f"Pending Payments report generated successfully, size: {len(content)} bytes")
    
    def test_reports_with_branch_filter(self):
        """Test reports with branch_id filter"""
        # First get a branch ID
        branches_resp = requests.get(f"{BASE_URL}/api/admin/branches", headers=self.headers)
        assert branches_resp.status_code == 200
        branches = branches_resp.json()
        
        if branches:
            branch_id = branches[0]["id"]
            response = requests.get(
                f"{BASE_URL}/api/reports/generate?report_type=leads&branch_id={branch_id}",
                headers=self.headers
            )
            assert response.status_code == 200
            print(f"Report with branch filter generated successfully")
        else:
            pytest.skip("No branches available for filter test")
    
    def test_reports_invalid_type(self):
        """Test reports with invalid report_type"""
        response = requests.get(
            f"{BASE_URL}/api/reports/generate?report_type=invalid_type",
            headers=self.headers
        )
        assert response.status_code == 400, f"Expected 400 for invalid type, got {response.status_code}"


class TestBranchAdminPaymentOperations:
    """Test payment edit/delete for Branch Admin role"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get Super Admin and Branch Admin tokens"""
        # Super Admin login
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            data={"username": SUPER_ADMIN["email"], "password": SUPER_ADMIN["password"]},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        assert response.status_code == 200
        self.super_admin_token = response.json()["access_token"]
        self.super_admin_headers = {"Authorization": f"Bearer {self.super_admin_token}"}
        
        # Try to get or create Branch Admin
        self._ensure_branch_admin_exists()
    
    def _ensure_branch_admin_exists(self):
        """Ensure a Branch Admin user exists for testing"""
        # Try to login as Branch Admin
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            data={"username": BRANCH_ADMIN["email"], "password": BRANCH_ADMIN["password"]},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        if response.status_code == 200:
            self.branch_admin_token = response.json()["access_token"]
            self.branch_admin_headers = {"Authorization": f"Bearer {self.branch_admin_token}"}
            self.branch_admin_user = response.json()["user"]
            print(f"Using existing Branch Admin: {BRANCH_ADMIN['email']}")
            return
        
        # Create Branch Admin if not exists
        # First get a branch
        branches = requests.get(f"{BASE_URL}/api/admin/branches", headers=self.super_admin_headers).json()
        branch_id = branches[0]["id"] if branches else None
        
        if not branch_id:
            # Create a test branch
            branch_data = {
                "name": "TEST_Branch_Iter5",
                "location": "Test Location",
                "address": "123 Test St",
                "city": "Test City",
                "state": "Test State",
                "pincode": "123456",
                "owner_name": "Test Owner",
                "owner_email": "test_owner@eti.com",
                "owner_phone": "9876543210",
                "owner_designation": "Owner",
                "branch_phone": "9876543211",
                "branch_email": "test_branch@eti.com"
            }
            branch_resp = requests.post(f"{BASE_URL}/api/admin/branches", json=branch_data, headers=self.super_admin_headers)
            if branch_resp.status_code == 200:
                branch_id = branch_resp.json()["id"]
        
        # Create Branch Admin user
        user_data = {
            "email": BRANCH_ADMIN["email"],
            "password": BRANCH_ADMIN["password"],
            "name": "TEST_Branch_Admin_Iter5",
            "role": "Branch Admin",
            "branch_id": branch_id
        }
        create_resp = requests.post(f"{BASE_URL}/api/admin/users", json=user_data, headers=self.super_admin_headers)
        
        if create_resp.status_code in [200, 400]:  # 400 might mean already exists
            # Login again
            response = requests.post(
                f"{BASE_URL}/api/auth/login",
                data={"username": BRANCH_ADMIN["email"], "password": BRANCH_ADMIN["password"]},
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            if response.status_code == 200:
                self.branch_admin_token = response.json()["access_token"]
                self.branch_admin_headers = {"Authorization": f"Bearer {self.branch_admin_token}"}
                self.branch_admin_user = response.json()["user"]
                print(f"Branch Admin created and logged in: {BRANCH_ADMIN['email']}")
            else:
                pytest.skip(f"Could not login as Branch Admin: {response.text}")
        else:
            pytest.skip(f"Could not create Branch Admin: {create_resp.text}")
    
    def test_get_all_payments(self):
        """Test GET /api/payments/all endpoint"""
        response = requests.get(f"{BASE_URL}/api/payments/all", headers=self.branch_admin_headers)
        assert response.status_code == 200
        payments = response.json()
        print(f"All payments retrieved: {len(payments)} payments found")
    
    def test_delete_payment_permission_denied_for_counsellor(self):
        """Test that non-Branch Admin cannot delete payments"""
        # Create a counsellor user
        counsellor_data = {
            "email": "test_counsellor_iter5@eti.com",
            "password": "test123",
            "name": "TEST_Counsellor_Iter5",
            "role": "Counsellor",
            "branch_id": self.branch_admin_user.get("branch_id")
        }
        requests.post(f"{BASE_URL}/api/admin/users", json=counsellor_data, headers=self.super_admin_headers)
        
        # Login as counsellor
        counsellor_login = requests.post(
            f"{BASE_URL}/api/auth/login",
            data={"username": counsellor_data["email"], "password": counsellor_data["password"]},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        if counsellor_login.status_code == 200:
            counsellor_headers = {"Authorization": f"Bearer {counsellor_login.json()['access_token']}"}
            # Try to delete a payment (should fail)
            response = requests.delete(f"{BASE_URL}/api/payments/fake_id", headers=counsellor_headers)
            assert response.status_code == 403, f"Expected 403 for counsellor, got {response.status_code}"
            print("Counsellor correctly denied payment deletion")
        else:
            print("Skipping counsellor permission test - could not create counsellor")
    
    def test_update_payment_permission_denied_for_counsellor(self):
        """Test that non-Branch Admin cannot update payments"""
        # Login as counsellor (from previous test setup)
        counsellor_login = requests.post(
            f"{BASE_URL}/api/auth/login",
            data={"username": "test_counsellor_iter5@eti.com", "password": "test123"},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        if counsellor_login.status_code == 200:
            counsellor_headers = {"Authorization": f"Bearer {counsellor_login.json()['access_token']}"}
            # Try to update a payment (should fail)
            response = requests.put(
                f"{BASE_URL}/api/payments/fake_id",
                json={"amount": 1000},
                headers=counsellor_headers
            )
            assert response.status_code == 403, f"Expected 403 for counsellor, got {response.status_code}"
            print("Counsellor correctly denied payment update")


class TestBranchAdminExpenseOperations:
    """Test expense delete for Branch Admin role"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get tokens"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            data={"username": SUPER_ADMIN["email"], "password": SUPER_ADMIN["password"]},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        assert response.status_code == 200
        self.super_admin_token = response.json()["access_token"]
        self.super_admin_headers = {"Authorization": f"Bearer {self.super_admin_token}"}
        
        # Get Branch Admin token
        branch_admin_login = requests.post(
            f"{BASE_URL}/api/auth/login",
            data={"username": BRANCH_ADMIN["email"], "password": BRANCH_ADMIN["password"]},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        if branch_admin_login.status_code == 200:
            self.branch_admin_token = branch_admin_login.json()["access_token"]
            self.branch_admin_headers = {"Authorization": f"Bearer {self.branch_admin_token}"}
        else:
            pytest.skip("Branch Admin not available")
    
    def test_get_expenses(self):
        """Test GET /api/expenses endpoint"""
        response = requests.get(f"{BASE_URL}/api/expenses", headers=self.branch_admin_headers)
        assert response.status_code == 200
        expenses = response.json()
        print(f"Expenses retrieved: {len(expenses)} expenses found")
    
    def test_delete_expense_permission_denied_for_counsellor(self):
        """Test that non-Branch Admin cannot delete expenses"""
        # Login as counsellor
        counsellor_login = requests.post(
            f"{BASE_URL}/api/auth/login",
            data={"username": "test_counsellor_iter5@eti.com", "password": "test123"},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        if counsellor_login.status_code == 200:
            counsellor_headers = {"Authorization": f"Bearer {counsellor_login.json()['access_token']}"}
            # Try to delete an expense (should fail)
            response = requests.delete(f"{BASE_URL}/api/expenses/fake_id", headers=counsellor_headers)
            assert response.status_code == 403, f"Expected 403 for counsellor, got {response.status_code}"
            print("Counsellor correctly denied expense deletion")
        else:
            print("Skipping - counsellor not available")


class TestAPIEndpointIntegration:
    """Integration tests for all new endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get Super Admin token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            data={"username": SUPER_ADMIN["email"], "password": SUPER_ADMIN["password"]},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_reports_endpoint_exists(self):
        """Verify /api/reports/generate endpoint exists and responds"""
        response = requests.get(
            f"{BASE_URL}/api/reports/generate?report_type=leads",
            headers=self.headers
        )
        assert response.status_code != 404, "Reports endpoint not found"
        print("Reports endpoint exists and responds")
    
    def test_payments_delete_endpoint_exists(self):
        """Verify DELETE /api/payments/{id} endpoint exists"""
        response = requests.delete(
            f"{BASE_URL}/api/payments/nonexistent_id",
            headers=self.headers
        )
        # Should return 404 (not found) not 405 (method not allowed)
        assert response.status_code in [403, 404], f"Unexpected status: {response.status_code}"
        print("Payment delete endpoint exists")
    
    def test_payments_update_endpoint_exists(self):
        """Verify PUT /api/payments/{id} endpoint exists"""
        response = requests.put(
            f"{BASE_URL}/api/payments/nonexistent_id",
            json={"amount": 1000},
            headers=self.headers
        )
        # Should return 404 (not found) not 405 (method not allowed)
        assert response.status_code in [403, 404], f"Unexpected status: {response.status_code}"
        print("Payment update endpoint exists")
    
    def test_expenses_delete_endpoint_exists(self):
        """Verify DELETE /api/expenses/{id} endpoint exists"""
        response = requests.delete(
            f"{BASE_URL}/api/expenses/nonexistent_id",
            headers=self.headers
        )
        # Should return 403 (only branch admin) or 404 (not found) not 405
        assert response.status_code in [403, 404], f"Unexpected status: {response.status_code}"
        print("Expense delete endpoint exists")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
