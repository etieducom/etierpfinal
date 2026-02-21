import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, BarChart3, LogOut, Menu, X, Bell, FileText, Settings, Folder, CreditCard, Clock, Trash2, Wallet, FileSpreadsheet, GraduationCap, Globe, ClipboardList, CheckSquare, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { followupAPI } from '@/api/api';

const ETI_LOGO = 'https://customer-assets.emergentagent.com/job_4e0bdddc-c844-4374-a91a-dfbddecb14b1/artifacts/4ane8ulw_eti%20.png';

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // Role-based navigation flags
  const isSuperAdmin = user.role === 'Admin';
  const isBranchAdmin = user.role === 'Branch Admin';
  const isFDE = user.role === 'Front Desk Executive';
  const isCounsellor = user.role === 'Counsellor';

  useEffect(() => {
    // Only Counsellors and Branch Admins need pending followup count
    if (isCounsellor || isBranchAdmin) {
      fetchPendingCount();
      const interval = setInterval(fetchPendingCount, 60000);
      return () => clearInterval(interval);
    }
  }, []);

  const fetchPendingCount = async () => {
    try {
      const response = await followupAPI.getPendingCount();
      setPendingCount(response.data.count);
    } catch (error) {
      console.error('Failed to fetch pending count');
    }
  };

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/', show: true },
    { icon: Users, label: 'Leads', path: '/leads', show: true },
    // Tasks - For all non-Super Admin users
    { icon: CheckSquare, label: 'Tasks', path: '/tasks', show: isBranchAdmin || isCounsellor || isFDE },
    // Pending Follow-ups - For Counsellors and Branch Admins only
    { icon: Bell, label: 'Pending Follow-ups', path: '/followups', show: isCounsellor || isBranchAdmin, badge: pendingCount },
    { icon: BarChart3, label: 'Analytics', path: '/analytics', show: true },
    { icon: FileText, label: 'Reports', path: '/reports', show: true },
    // Students - For Branch Admin and FDE
    { icon: GraduationCap, label: 'Students', path: '/students', show: isBranchAdmin || isFDE },
    // Quiz Exams - For Super Admin and FDE
    { icon: BookOpen, label: 'Quiz Exams', path: '/quiz-exams', show: isSuperAdmin || isFDE },
    // International Exams - For Branch Admin, Counsellor and FDE
    { icon: Globe, label: 'International Exams', path: '/international-exams', show: isBranchAdmin || isCounsellor || isFDE },
    // Manage Exams - For Branch Admin, Counsellor and FDE
    { icon: ClipboardList, label: 'Manage Exams', path: '/manage-exams', show: isBranchAdmin || isCounsellor || isFDE },
    // Expenses - For Branch Admin and FDE
    { icon: Wallet, label: 'Expenses', path: '/expenses', show: isBranchAdmin || isFDE },
    // Enrollments - For Branch Admin and FDE
    { icon: FileSpreadsheet, label: 'Enrollments', path: '/enrollments', show: isBranchAdmin || isFDE },
    // All Payments - For Branch Admin and FDE
    { icon: CreditCard, label: 'All Payments', path: '/all-payments', show: isBranchAdmin || isFDE },
    // Pending Payments - For Branch Admin and FDE
    { icon: Clock, label: 'Pending Payments', path: '/pending-payments', show: isBranchAdmin || isFDE },
    { icon: Folder, label: 'Resources', path: '/resources', show: true },
    // Deleted Leads - For Super Admin and Branch Admin
    { icon: Trash2, label: 'Deleted Leads', path: '/deleted-leads', show: isSuperAdmin || isBranchAdmin },
    // Admin Panel - ONLY for Super Admin (Branch Admin should NOT see this)
    { icon: Settings, label: 'Admin Panel', path: '/admin', show: isSuperAdmin },
  ].filter(item => item.show);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    toast.success('Logged out successfully');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Bar */}
      <header className="glassmorphism sticky top-0 z-50 h-16 flex items-center justify-between px-6 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden"
            data-testid="menu-toggle"
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <h1 className="text-2xl font-bold tracking-tight">ETI Educom - Branch Management</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold">{user.name}</p>
            <p className="text-xs text-slate-600">{user.email}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            data-testid="logout-button"
            className="hover:bg-slate-100"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`fixed lg:sticky top-16 left-0 z-40 h-[calc(100vh-4rem)] w-64 bg-white border-r border-slate-200 transform transition-transform duration-300 lg:transform-none ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <nav className="p-4 space-y-2" data-testid="sidebar-nav">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                  onClick={() => {
                    navigate(item.path);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </div>
                  {item.badge > 0 && (
                    <Badge className="bg-red-500 text-white">{item.badge}</Badge>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default Layout;
