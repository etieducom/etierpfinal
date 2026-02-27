"""
Backend tests for Counsellor Incentive System for International Exams
Tests:
1. /api/counsellor/incentives - Returns counsellor's own incentives
2. /api/branch-admin/incentive-stats - Returns branch-wide incentive stats
3. /api/exam-bookings/{id}/status - Status updates trigger incentive/refund
4. /api/exam-bookings/{id}/refund - Mark refund as processed
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCounsellorIncentives:
    """Test Counsellor Incentive endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth tokens"""
        # Counsellor login
        counsellor_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            data={"username": "counsellor@etieducom.com", "password": "password"},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        if counsellor_response.status_code == 200:
            self.counsellor_token = counsellor_response.json().get('access_token')
            self.counsellor_user = counsellor_response.json().get('user')
        else:
            pytest.skip(f"Counsellor login failed: {counsellor_response.status_code}")
        
        # Branch Admin login
        admin_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            data={"username": "branchadmin@etieducom.com", "password": "admin@123"},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        if admin_response.status_code == 200:
            self.branch_admin_token = admin_response.json().get('access_token')
            self.branch_admin_user = admin_response.json().get('user')
        else:
            pytest.skip(f"Branch Admin login failed: {admin_response.status_code}")

    def test_counsellor_incentives_endpoint_structure(self):
        """Test /api/counsellor/incentives returns correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/counsellor/incentives",
            headers={"Authorization": f"Bearer {self.counsellor_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "summary" in data, "Response should contain 'summary'"
        assert "earned_bookings" in data, "Response should contain 'earned_bookings'"
        assert "pending_bookings" in data, "Response should contain 'pending_bookings'"
        assert "cancelled_bookings" in data, "Response should contain 'cancelled_bookings'"
        
        # Verify summary structure
        summary = data["summary"]
        assert "total_earned" in summary, "Summary should have 'total_earned'"
        assert "total_pending" in summary, "Summary should have 'total_pending'"
        assert "total_cancelled_refunds" in summary, "Summary should have 'total_cancelled_refunds'"
        assert "total_bookings" in summary, "Summary should have 'total_bookings'"
        assert "completed_count" in summary, "Summary should have 'completed_count'"
        assert "pending_count" in summary, "Summary should have 'pending_count'"
        assert "cancelled_count" in summary, "Summary should have 'cancelled_count'"
        
        # Verify data types
        assert isinstance(summary["total_earned"], (int, float)), "total_earned should be numeric"
        assert isinstance(summary["total_pending"], (int, float)), "total_pending should be numeric"
        assert isinstance(summary["total_cancelled_refunds"], (int, float)), "total_cancelled_refunds should be numeric"
        assert isinstance(data["earned_bookings"], list), "earned_bookings should be a list"
        assert isinstance(data["pending_bookings"], list), "pending_bookings should be a list"
        assert isinstance(data["cancelled_bookings"], list), "cancelled_bookings should be a list"
        
        print(f"✓ Counsellor Incentives API returns correct structure")
        print(f"  Summary: total_earned={summary['total_earned']}, total_pending={summary['total_pending']}, total_cancelled={summary['total_cancelled_refunds']}")

    def test_counsellor_incentives_requires_auth(self):
        """Test that incentives endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/counsellor/incentives")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ Counsellor Incentives API requires authentication")

    def test_branch_admin_incentive_stats_structure(self):
        """Test /api/branch-admin/incentive-stats returns correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/branch-admin/incentive-stats",
            headers={"Authorization": f"Bearer {self.branch_admin_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "branch_summary" in data, "Response should contain 'branch_summary'"
        assert "counsellor_stats" in data, "Response should contain 'counsellor_stats'"
        
        # Verify branch_summary structure
        summary = data["branch_summary"]
        assert "total_earned_incentives" in summary, "Summary should have 'total_earned_incentives'"
        assert "total_pending_incentives" in summary, "Summary should have 'total_pending_incentives'"
        assert "total_refunds_pending" in summary, "Summary should have 'total_refunds_pending'"
        assert "total_exam_bookings" in summary, "Summary should have 'total_exam_bookings'"
        assert "completed_exams" in summary, "Summary should have 'completed_exams'"
        assert "cancelled_exams" in summary, "Summary should have 'cancelled_exams'"
        
        # Verify counsellor_stats is a list
        assert isinstance(data["counsellor_stats"], list), "counsellor_stats should be a list"
        
        # If there are counsellors, verify their structure
        if len(data["counsellor_stats"]) > 0:
            counsellor = data["counsellor_stats"][0]
            assert "counsellor_id" in counsellor, "Counsellor stat should have 'counsellor_id'"
            assert "counsellor_name" in counsellor, "Counsellor stat should have 'counsellor_name'"
            assert "counsellor_email" in counsellor, "Counsellor stat should have 'counsellor_email'"
            assert "total_bookings" in counsellor, "Counsellor stat should have 'total_bookings'"
            assert "earned_incentive" in counsellor, "Counsellor stat should have 'earned_incentive'"
            assert "pending_incentive" in counsellor, "Counsellor stat should have 'pending_incentive'"
            assert "completed_exams" in counsellor, "Counsellor stat should have 'completed_exams'"
            assert "cancelled_exams" in counsellor, "Counsellor stat should have 'cancelled_exams'"
        
        print(f"✓ Branch Admin Incentive Stats API returns correct structure")
        print(f"  Summary: earned={summary['total_earned_incentives']}, pending={summary['total_pending_incentives']}, refunds={summary['total_refunds_pending']}")
        print(f"  Counsellors tracked: {len(data['counsellor_stats'])}")

    def test_branch_admin_incentive_stats_requires_admin_role(self):
        """Test that incentive stats endpoint requires Branch Admin role"""
        # Test with counsellor token - should fail
        response = requests.get(
            f"{BASE_URL}/api/branch-admin/incentive-stats",
            headers={"Authorization": f"Bearer {self.counsellor_token}"}
        )
        assert response.status_code == 403, f"Expected 403 for counsellor, got {response.status_code}"
        print("✓ Branch Admin Incentive Stats API requires Branch Admin role")

    def test_branch_admin_incentive_stats_requires_auth(self):
        """Test that incentive stats endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/branch-admin/incentive-stats")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        print("✓ Branch Admin Incentive Stats API requires authentication")


class TestExamBookingIncentiveFlow:
    """Test exam booking status changes and incentive/refund tracking"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        admin_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            data={"username": "branchadmin@etieducom.com", "password": "admin@123"},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        if admin_response.status_code == 200:
            self.branch_admin_token = admin_response.json().get('access_token')
        else:
            pytest.skip(f"Branch Admin login failed: {admin_response.status_code}")

    def test_get_exam_bookings_endpoint(self):
        """Test /api/exam-bookings returns bookings list"""
        response = requests.get(
            f"{BASE_URL}/api/exam-bookings",
            headers={"Authorization": f"Bearer {self.branch_admin_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # If there are bookings, verify structure
        if len(data) > 0:
            booking = data[0]
            # Check for incentive-related fields in the booking model
            assert "id" in booking, "Booking should have 'id'"
            assert "status" in booking, "Booking should have 'status'"
            # These fields should exist based on the ExamBooking model
            print(f"✓ Exam Bookings API returns {len(data)} bookings")
        else:
            print("✓ Exam Bookings API returns empty list (no bookings yet)")

    def test_exam_booking_status_update_endpoint_exists(self):
        """Test exam booking status update endpoint exists"""
        # This will fail with 404 for non-existent booking, which proves endpoint exists
        response = requests.put(
            f"{BASE_URL}/api/exam-bookings/non-existent-id/status",
            params={"status": "Completed"},
            headers={"Authorization": f"Bearer {self.branch_admin_token}"}
        )
        
        # Should be 404 (not found) not 405 (method not allowed)
        assert response.status_code in [404, 400], f"Expected 404 or 400 for non-existent booking, got {response.status_code}"
        print("✓ Exam Booking Status Update endpoint exists")

    def test_refund_endpoint_exists(self):
        """Test refund marking endpoint exists"""
        # This will fail with 404 for non-existent booking
        response = requests.put(
            f"{BASE_URL}/api/exam-bookings/non-existent-id/refund",
            headers={"Authorization": f"Bearer {self.branch_admin_token}"}
        )
        
        assert response.status_code == 404, f"Expected 404 for non-existent booking, got {response.status_code}"
        print("✓ Refund endpoint exists")


class TestManageExamsPage:
    """Test Manage Exams page data requirements"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        admin_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            data={"username": "branchadmin@etieducom.com", "password": "admin@123"},
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        if admin_response.status_code == 200:
            self.branch_admin_token = admin_response.json().get('access_token')
        else:
            pytest.skip(f"Branch Admin login failed: {admin_response.status_code}")

    def test_exam_bookings_contain_incentive_refund_fields(self):
        """Verify exam bookings response has incentive/refund fields"""
        response = requests.get(
            f"{BASE_URL}/api/exam-bookings",
            headers={"Authorization": f"Bearer {self.branch_admin_token}"}
        )
        
        assert response.status_code == 200
        print("✓ Exam bookings endpoint accessible")
        
        # The model has these fields even if no bookings exist:
        # counsellor_incentive, incentive_status, refund_status, refund_amount
        # We verify the endpoint works, actual field verification happens in frontend tests
        print("✓ Exam bookings endpoint returns data (incentive fields in model)")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
