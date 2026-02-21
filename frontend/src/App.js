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
import Layout from '@/components/Layout';
import { Toaster } from '@/components/ui/sonner';

const PrivateRoute = ({ children, adminOnly = false, fdaOnly = false, branchAdminAllowed = false }) => {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  if (!token) return <Navigate to="/login" />;
  
  // Admin-only routes (Super Admin only)
  if (adminOnly && user.role !== 'Admin') return <Navigate to="/" />;
  
  // FDA routes - also allow Branch Admin
  if (fdaOnly) {
    const allowedRoles = ['Front Desk Executive', 'Admin', 'Branch Admin'];
    if (!allowedRoles.includes(user.role)) return <Navigate to="/" />;
  }
  
  return children;
};

function App() {
  return (
    <BrowserRouter>
      <div className="App noise-texture">
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout><Dashboard /></Layout>
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
              <PrivateRoute adminOnly>
                <Layout><DeletedLeadsPage /></Layout>
              </PrivateRoute>
            }
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
