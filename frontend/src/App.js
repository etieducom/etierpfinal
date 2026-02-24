import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import '@/App.css';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import LeadsPage from '@/pages/LeadsPage';
import AnalyticsPage from '@/pages/AnalyticsPage';
import PendingFollowups from '@/pages/PendingFollowups';
import AdminPanel from '@/pages/AdminPanel';
import ReportsPage from '@/pages/ReportsPage';
import ExpensesPage from '@/pages/ExpensesPage';
import EnrollmentsPage from '@/pages/EnrollmentsPage';
import ResourcesPage from '@/pages/ResourcesPage';
import AllPaymentsPage from '@/pages/AllPaymentsPage';
import PendingPaymentsPage from '@/pages/PendingPaymentsPage';
import DeletedLeadsPage from '@/pages/DeletedLeadsPage';
import StudentsPage from '@/pages/StudentsPage';
import InternationalExamsPage from '@/pages/InternationalExamsPage';
import ManageExamsPage from '@/pages/ManageExamsPage';
import TasksPage from '@/pages/TasksPage';
import QuizExamsPage from '@/pages/QuizExamsPage';
import PublicExamPage from '@/pages/PublicExamPage';
import CertificateRequestPage from '@/pages/CertificateRequestPage';
import CertificateManagementPage from '@/pages/CertificateManagementPage';
import CertificateVerifyPage from '@/pages/CertificateVerifyPage';
import OrganizationsPage from '@/pages/OrganizationsPage';
import BatchManagementPage from '@/pages/BatchManagementPage';
import Layout from '@/components/Layout';
import ActivityTracker from '@/components/ActivityTracker';
import { Toaster } from '@/components/ui/sonner';

const PrivateRoute = ({ children, adminOnly = false, fdaOnly = false, branchAdminAllowed = false, certManagerAllowed = false, adminPanelAccess = false }) => {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  if (!token) return <Navigate to="/login" />;
  
  // Admin-only routes (Super Admin only)
  if (adminOnly && user.role !== 'Admin') return <Navigate to="/" />;
  
  // Admin Panel access - Super Admin and Branch Admin
  if (adminPanelAccess) {
    const allowedRoles = ['Admin', 'Branch Admin'];
    if (!allowedRoles.includes(user.role)) return <Navigate to="/" />;
  }
  
  // FDA routes - also allow Branch Admin
  if (fdaOnly) {
    const allowedRoles = ['Front Desk Executive', 'Admin', 'Branch Admin'];
    if (!allowedRoles.includes(user.role)) return <Navigate to="/" />;
  }
  
  // Certificate Manager routes
  if (certManagerAllowed) {
    const allowedRoles = ['Certificate Manager', 'Admin'];
    if (!allowedRoles.includes(user.role)) return <Navigate to="/" />;
  }
  
  return children;
};

// Home redirect based on role
const HomeRedirect = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  // Certificate Manager goes directly to certificates page
  if (user.role === 'Certificate Manager') {
    return <Navigate to="/certificates" replace />;
  }
  
  // Everyone else goes to Dashboard
  return <Layout><Dashboard /></Layout>;
};

function App() {
  return (
    <BrowserRouter>
      <div className="App noise-texture">
        <Toaster position="top-right" />
        <ActivityTracker />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <HomeRedirect />
              </PrivateRoute>
            }
          />
          <Route
            path="/leads"
            element={
              <PrivateRoute>
                <Layout><LeadsPage /></Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <PrivateRoute>
                <Layout><AnalyticsPage /></Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/followups"
            element={
              <PrivateRoute>
                <Layout><PendingFollowups /></Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/tasks"
            element={
              <PrivateRoute>
                <Layout><TasksPage /></Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <PrivateRoute>
                <Layout><ReportsPage /></Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/expenses"
            element={
              <PrivateRoute fdaOnly>
                <Layout><ExpensesPage /></Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/enrollments"
            element={
              <PrivateRoute fdaOnly>
                <Layout><EnrollmentsPage /></Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/students"
            element={
              <PrivateRoute fdaOnly>
                <Layout><StudentsPage /></Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/international-exams"
            element={
              <PrivateRoute>
                <Layout><InternationalExamsPage /></Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/manage-exams"
            element={
              <PrivateRoute>
                <Layout><ManageExamsPage /></Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <PrivateRoute adminOnly>
                <Layout><AdminPanel /></Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/resources"
            element={
              <PrivateRoute>
                <Layout><ResourcesPage /></Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/all-payments"
            element={
              <PrivateRoute fdaOnly>
                <Layout><AllPaymentsPage /></Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/pending-payments"
            element={
              <PrivateRoute fdaOnly>
                <Layout><PendingPaymentsPage /></Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/deleted-leads"
            element={
              <PrivateRoute fdaOnly>
                <Layout><DeletedLeadsPage /></Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/quiz-exams"
            element={
              <PrivateRoute>
                <Layout><QuizExamsPage /></Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/certificates"
            element={
              <PrivateRoute certManagerAllowed>
                <CertificateManagementPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/organizations"
            element={
              <PrivateRoute>
                <Layout><OrganizationsPage /></Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/batches"
            element={
              <PrivateRoute>
                <Layout><BatchManagementPage /></Layout>
              </PrivateRoute>
            }
          />
          {/* Public routes - no auth required */}
          <Route path="/exam/:examId" element={<PublicExamPage />} />
          <Route path="/certificate-request" element={<CertificateRequestPage />} />
          <Route path="/verify/:verificationId" element={<CertificateVerifyPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
