import React, { useState, useEffect } from 'react';
import { analyticsAPI, leadsAPI, followupAPI, financialStatsAPI, incentivesAPI, royaltyAPI } from '@/api/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, TrendingUp, CheckCircle, XCircle, Bell, DollarSign, ArrowUpRight, ArrowDownRight, Building, Award, AlertTriangle, Trash2, Wallet, CreditCard, Receipt, GraduationCap, Gift, Clock, Ban, Calendar, IndianRupee, Banknote, ClipboardList, Phone } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useNavigate } from 'react-router-dom';

const STATUS_COLORS = {
  'New': '#3B82F6',
  'Contacted': '#8B5CF6',
  'Demo Booked': '#F59E0B',
  'Follow-up': '#06B6D4',
  'Converted': '#10B981',
  'Lost': '#EF4444',
};

const Dashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [branchAnalytics, setBranchAnalytics] = useState([]);
  const [recentLeads, setRecentLeads] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [financialData, setFinancialData] = useState(null);
  const [branchFinancials, setBranchFinancials] = useState([]);
  const [superAdminData, setSuperAdminData] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [aiInsights, setAIInsights] = useState(null);
  const [branchFinancialStats, setBranchFinancialStats] = useState(null);
  const [counsellorIncentives, setCounsellorIncentives] = useState(null);
  const [branchIncentiveStats, setBranchIncentiveStats] = useState(null);
  const [royaltyData, setRoyaltyData] = useState(null);
  const [admissionData, setAdmissionData] = useState(null);
  const [fdeDashboard, setFdeDashboard] = useState(null);
  const [counsellorDashboard, setCounsellorDashboard] = useState(null);
  const [sessionComparison, setSessionComparison] = useState(null);
  const fetchingRef = React.useRef(false); // Prevent concurrent calls
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const currentSession = localStorage.getItem('session') || '';
  
  const isSuperAdmin = user.role === 'Admin';
  const isBranchAdmin = user.role === 'Branch Admin';
  const isCounsellor = user.role === 'Counsellor';
  const isFDE = user.role === 'Front Desk Executive';
  const showAIInsights = isBranchAdmin || isCounsellor;
  
  // Helper to safely get numeric values for display (avoids NaN)
  const safeNum = (val) => (Number.isFinite(val) ? val : 0);
  const safeAbs = (val) => Math.abs(safeNum(val));

  useEffect(() => {
    fetchData();
  }, [selectedYear]);

  const fetchData = async () => {
    // Prevent concurrent calls (fixes race condition with React StrictMode)
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    
    try {
      const promises = [
        analyticsAPI.getOverview(),
        leadsAPI.getAll({}),
      ];
      
      if (isSuperAdmin) {
        promises.push(analyticsAPI.getSuperAdminDashboard());
        promises.push(analyticsAPI.getBranchWise());
        promises.push(analyticsAPI.getMonthlyFinancial(selectedYear));
      } else if (isBranchAdmin || user.role === 'Front Desk Executive') {
        promises.push(analyticsAPI.getMonthlyFinancial(selectedYear));
        promises.push(Promise.resolve({ data: null })); // Placeholder for branch admin
      } else {
        promises.push(followupAPI.getPendingCount());
      }
      
      const results = await Promise.all(promises);
      setAnalytics(results[0]?.data || null);
      const leadsData = results[1]?.data;
      setRecentLeads(Array.isArray(leadsData) ? leadsData.slice(0, 5) : []);
      
      if (isSuperAdmin) {
        setSuperAdminData(results[2].data);
        setBranchAnalytics(results[3].data);
        setFinancialData(results[4].data);
      } else if (isBranchAdmin || user.role === 'Front Desk Executive') {
        setFinancialData(results[2].data);
      } else if (results[2]) {
        setPendingCount(results[2].data.count);
      }
      
      // Fetch AI insights for counsellors and branch admins
      if (showAIInsights) {
        try {
          const insightsRes = await analyticsAPI.getAILeadsInsights();
          setAIInsights(insightsRes.data);
        } catch (e) {
          console.error('Error fetching AI insights:', e);
        }
      }
      
      // Fetch Branch Admin specific financial stats
      if (isBranchAdmin) {
        try {
          const branchStatsRes = await financialStatsAPI.get();
          setBranchFinancialStats(branchStatsRes.data);
          
          // Also fetch branch incentive stats for Branch Admin
          const branchIncentiveRes = await incentivesAPI.getBranchIncentiveStats();
          setBranchIncentiveStats(branchIncentiveRes.data);
          
          // Fetch royalty for last month
          const royaltyRes = await royaltyAPI.getBranchRoyalty(user.branch_id);
          setRoyaltyData(royaltyRes.data);
          
          // Fetch monthly admission stats
          const admissionRes = await analyticsAPI.getMonthlyAdmissions(selectedYear);
          setAdmissionData(admissionRes.data);
        } catch (e) {
          console.error('Error fetching branch stats:', e);
        }
      }
      
      // Fetch Counsellor incentives
      if (isCounsellor) {
        try {
          const incentivesRes = await incentivesAPI.getCounsellorIncentives();
          setCounsellorIncentives(incentivesRes.data);
          
          // Fetch counsellor dashboard data
          const counsellorDashRes = await analyticsAPI.getCounsellorDashboard();
          setCounsellorDashboard(counsellorDashRes.data);
        } catch (e) {
          console.error('Error fetching counsellor data:', e);
        }
      }
      
      // Fetch FDE dashboard data
      if (isFDE) {
        try {
          const fdeDashRes = await analyticsAPI.getFDEDashboard();
          setFdeDashboard(fdeDashRes.data);
        } catch (e) {
          console.error('Error fetching FDE dashboard:', e);
        }
      }
      
      // Fetch session comparison ONLY for Super Admin and Branch Admin
      if (isSuperAdmin || isBranchAdmin) {
        try {
          const sessionCompRes = await analyticsAPI.getSessionComparison();
          setSessionComparison(sessionCompRes.data);
        } catch (e) {
          console.error('Error fetching session comparison:', e);
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      fetchingRef.current = false; // Reset the flag
    }
  };

  const getPerformanceBadge = (performance) => {
    switch (performance) {
      case 'outperforming':
        return <Badge className="bg-green-100 text-green-700"><Award className="w-3 h-3 mr-1" /> Outperforming</Badge>;
      case 'underperforming':
        return <Badge className="bg-red-100 text-red-700"><AlertTriangle className="w-3 h-3 mr-1" /> Needs Attention</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-700">Average</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg text-slate-600">Loading dashboard...</div>
      </div>
    );
  }

  const statusData = analytics?.status_breakdown
    ? Object.entries(analytics.status_breakdown)
        .filter(([name]) => name !== 'Deleted') // Exclude deleted from pie chart
        .map(([name, value]) => ({
          name,
          value,
          color: STATUS_COLORS[name] || '#94A3B8',
        }))
    : [];

  const conversionRate = analytics
    ? ((analytics.status_breakdown?.['Converted'] || 0) / (analytics.total_leads || 1) * 100).toFixed(1)
    : 0;

  return (
    <div className="space-y-6 animate-fadeIn" data-testid="dashboard">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-2">Dashboard</h1>
        <p className="text-slate-600">
          {isSuperAdmin ? 'Super Admin Overview - All Branches' : `Welcome back! Here's your ${isBranchAdmin ? 'branch ' : ''}overview`}
        </p>
      </div>

      {/* Session Summary Card - Shows ONLY for Super Admin and Branch Admin */}
      {(isSuperAdmin || isBranchAdmin) && sessionComparison && (
        <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-purple-50 shadow-lg" data-testid="session-summary-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                <CardTitle className="text-lg font-semibold text-indigo-900">Session Summary</CardTitle>
              </div>
              <Badge className="bg-indigo-100 text-indigo-700 text-xs">
                {sessionComparison.current_session?.label} vs {sessionComparison.previous_session?.label}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-1">{sessionComparison.current_session?.period}</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {/* Leads */}
              <div className="text-center p-3 bg-white/60 rounded-lg border border-slate-100">
                <p className="text-xs text-slate-500 mb-1">Leads</p>
                <p className="text-xl font-bold text-slate-800">{safeNum(sessionComparison.current_session?.leads)}</p>
                <div className={`flex items-center justify-center gap-1 text-xs mt-1 ${safeNum(sessionComparison.changes?.leads) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {safeNum(sessionComparison.changes?.leads) >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  <span>{safeAbs(sessionComparison.changes?.leads)}%</span>
                </div>
              </div>
              
              {/* Converted */}
              <div className="text-center p-3 bg-white/60 rounded-lg border border-slate-100">
                <p className="text-xs text-slate-500 mb-1">Converted</p>
                <p className="text-xl font-bold text-green-600">{safeNum(sessionComparison.current_session?.converted)}</p>
                <div className={`flex items-center justify-center gap-1 text-xs mt-1 ${safeNum(sessionComparison.changes?.converted) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {safeNum(sessionComparison.changes?.converted) >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  <span>{safeAbs(sessionComparison.changes?.converted)}%</span>
                </div>
              </div>
              
              {/* Conversion Rate */}
              <div className="text-center p-3 bg-white/60 rounded-lg border border-slate-100">
                <p className="text-xs text-slate-500 mb-1">Conversion Rate</p>
                <p className="text-xl font-bold text-purple-600">{safeNum(sessionComparison.current_session?.conversion_rate)}%</p>
                <div className={`flex items-center justify-center gap-1 text-xs mt-1 ${safeNum(sessionComparison.changes?.conversion_rate) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {safeNum(sessionComparison.changes?.conversion_rate) >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  <span>{safeAbs(sessionComparison.changes?.conversion_rate)} pts</span>
                </div>
              </div>
              
              {/* Enrollments */}
              <div className="text-center p-3 bg-white/60 rounded-lg border border-slate-100">
                <p className="text-xs text-slate-500 mb-1">Enrollments</p>
                <p className="text-xl font-bold text-blue-600">{safeNum(sessionComparison.current_session?.enrollments)}</p>
                <div className={`flex items-center justify-center gap-1 text-xs mt-1 ${safeNum(sessionComparison.changes?.enrollments) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {safeNum(sessionComparison.changes?.enrollments) >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  <span>{safeAbs(sessionComparison.changes?.enrollments)}%</span>
                </div>
              </div>
              
              {/* Income */}
              <div className="text-center p-3 bg-white/60 rounded-lg border border-slate-100">
                <p className="text-xs text-slate-500 mb-1">Income</p>
                <p className="text-xl font-bold text-amber-600">₹{(safeNum(sessionComparison.current_session?.income) / 1000).toFixed(0)}K</p>
                <div className={`flex items-center justify-center gap-1 text-xs mt-1 ${safeNum(sessionComparison.changes?.income) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {safeNum(sessionComparison.changes?.income) >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  <span>{safeAbs(sessionComparison.changes?.income)}%</span>
                </div>
              </div>
            </div>
            
            {/* Previous Session Reference */}
            <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>Previous ({sessionComparison.previous_session?.label}): {safeNum(sessionComparison.previous_session?.leads)} leads, {safeNum(sessionComparison.previous_session?.enrollments)} enrollments, ₹{(safeNum(sessionComparison.previous_session?.income) / 1000).toFixed(0)}K income</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* FDE Dashboard Cards */}
      {isFDE && fdeDashboard && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="fde-dashboard">
          {/* Fee Due This Month */}
          <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 shadow-soft hover:shadow-lifted transition-shadow cursor-pointer" onClick={() => navigate('/students')}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-orange-800">Fee Due ({fdeDashboard.fee_due?.month})</CardTitle>
              <IndianRupee className="w-4 h-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">₹{(fdeDashboard.fee_due?.amount || 0).toLocaleString()}</div>
              <p className="text-xs text-orange-600 mt-1">{fdeDashboard.fee_due?.count || 0} installments pending</p>
            </CardContent>
          </Card>

          {/* Students Without Batch */}
          <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50 shadow-soft hover:shadow-lifted transition-shadow cursor-pointer" onClick={() => navigate('/students')}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-purple-800">Unassigned Students</CardTitle>
              <Users className="w-4 h-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{fdeDashboard.students_without_batch || 0}</div>
              <p className="text-xs text-purple-600 mt-1">Not assigned to any batch</p>
            </CardContent>
          </Card>

          {/* Cash Handling Status */}
          <Card 
            className={`shadow-soft hover:shadow-lifted transition-shadow cursor-pointer ${
              fdeDashboard.cash_handling?.updated_today 
                ? 'border-green-200 bg-gradient-to-br from-green-50 to-emerald-50' 
                : 'border-red-200 bg-gradient-to-br from-red-50 to-rose-50'
            }`}
            onClick={() => navigate('/finances')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className={`text-sm font-medium ${fdeDashboard.cash_handling?.updated_today ? 'text-green-800' : 'text-red-800'}`}>
                Cash Handling
              </CardTitle>
              <Banknote className={`w-4 h-4 ${fdeDashboard.cash_handling?.updated_today ? 'text-green-600' : 'text-red-600'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${fdeDashboard.cash_handling?.updated_today ? 'text-green-600' : 'text-red-600'}`}>
                {fdeDashboard.cash_handling?.updated_today ? 'Updated' : 'Pending'}
              </div>
              <p className={`text-xs mt-1 ${fdeDashboard.cash_handling?.updated_today ? 'text-green-600' : 'text-red-600'}`}>
                Today's cash: ₹{(fdeDashboard.cash_handling?.today_cash_total || 0).toLocaleString()}
              </p>
            </CardContent>
          </Card>

          {/* Pending Tasks */}
          <Card 
            className={`shadow-soft hover:shadow-lifted transition-shadow cursor-pointer ${
              fdeDashboard.tasks?.overdue > 0 
                ? 'border-red-200 bg-gradient-to-br from-red-50 to-rose-50' 
                : 'border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50'
            }`}
            onClick={() => navigate('/tasks')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className={`text-sm font-medium ${fdeDashboard.tasks?.overdue > 0 ? 'text-red-800' : 'text-blue-800'}`}>
                Pending Tasks
              </CardTitle>
              <ClipboardList className={`w-4 h-4 ${fdeDashboard.tasks?.overdue > 0 ? 'text-red-600' : 'text-blue-600'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${fdeDashboard.tasks?.overdue > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                {fdeDashboard.tasks?.pending || 0}
              </div>
              <p className={`text-xs mt-1 ${fdeDashboard.tasks?.overdue > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                {fdeDashboard.tasks?.overdue > 0 ? `${fdeDashboard.tasks.overdue} overdue!` : 'No overdue tasks'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Counsellor Dashboard Cards */}
      {isCounsellor && counsellorDashboard && (
        <Card className="border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 shadow-soft" data-testid="counsellor-dashboard">
          <CardHeader>
            <CardTitle className="text-xl font-semibold flex items-center gap-2 text-indigo-800">
              <Phone className="w-5 h-5" /> Follow-up Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-white p-4 rounded-lg border border-indigo-200 text-center">
                <p className="text-sm text-indigo-600">Today's Follow-ups</p>
                <p className="text-3xl font-bold text-indigo-700">{counsellorDashboard.today_count || 0}</p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-orange-200 text-center">
                <p className="text-sm text-orange-600">Total Pending</p>
                <p className="text-3xl font-bold text-orange-700">{counsellorDashboard.total_pending || 0}</p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-red-200 text-center">
                <p className="text-sm text-red-600">Overdue</p>
                <p className="text-3xl font-bold text-red-700">{counsellorDashboard.overdue_count || 0}</p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-green-200 text-center">
                <p className="text-sm text-green-600">This Week</p>
                <p className="text-3xl font-bold text-green-700">{counsellorDashboard.this_week_count || 0}</p>
              </div>
            </div>

            {/* Today's Follow-ups List */}
            {counsellorDashboard.today_followups?.length > 0 && (
              <div className="mt-4">
                <p className="font-medium text-indigo-800 mb-2">Today's Scheduled Calls:</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {counsellorDashboard.today_followups.map((fu, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-lg border border-indigo-100 hover:shadow-sm transition-shadow">
                      <div>
                        <p className="font-medium text-slate-800">{fu.lead_name}</p>
                        <p className="text-sm text-slate-500">{fu.lead_number}</p>
                      </div>
                      <div className="text-right">
                        <Badge className={`${
                          fu.lead_status === 'Hot' ? 'bg-red-100 text-red-700' :
                          fu.lead_status === 'Warm' ? 'bg-orange-100 text-orange-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>{fu.lead_status}</Badge>
                        <p className="text-xs text-slate-500 mt-1">{fu.note?.slice(0, 30)}...</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Button 
                  variant="outline" 
                  className="w-full mt-3 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                  onClick={() => navigate('/followups')}
                >
                  View All Follow-ups
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Super Admin Branch Performance Overview */}
      {isSuperAdmin && superAdminData && (
        <Card className="border-slate-200 shadow-soft" data-testid="super-admin-overview">
          <CardHeader>
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <Building className="w-5 h-5" /> Branch Performance Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Totals Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    <span className="text-sm text-blue-700">Total Leads</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-700 mt-1">{superAdminData.totals?.total_leads || 0}</p>
                </CardContent>
              </Card>
              <Card className="bg-purple-50 border-purple-200">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-purple-600" />
                    <span className="text-sm text-purple-700">Total Enrollments</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-700 mt-1">{superAdminData.totals?.total_enrollments || 0}</p>
                </CardContent>
              </Card>
              <Card className="bg-green-50 border-green-200">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    <span className="text-sm text-green-700">Total Income</span>
                  </div>
                  <p className="text-2xl font-bold text-green-700 mt-1">₹{superAdminData.totals?.total_income?.toLocaleString() || 0}</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-50 border-slate-200">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Building className="w-5 h-5 text-slate-600" />
                    <span className="text-sm text-slate-700">Avg Income/Branch</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-700 mt-1">₹{superAdminData.totals?.average_income_per_branch?.toLocaleString() || 0}</p>
                </CardContent>
              </Card>
            </div>

            {/* Branch-wise Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Branch</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Leads</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Enrollments</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Total Income</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Conversion %</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Performance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {superAdminData.branches?.map((branch) => (
                    <tr key={branch.branch_id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-semibold">{branch.branch_name}</p>
                        <p className="text-xs text-slate-500">{branch.branch_location}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-12 h-8 rounded-md bg-blue-50 text-blue-700 font-semibold">
                          {branch.leads_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-12 h-8 rounded-md bg-purple-50 text-purple-700 font-semibold">
                          {branch.enrollments_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center px-3 h-8 rounded-md bg-green-50 text-green-700 font-semibold">
                          ₹{branch.total_income?.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-semibold">{branch.conversion_rate}%</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getPerformanceBadge(branch.performance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards - For non-Super Admin (except FDE) */}
      {!isSuperAdmin && !isFDE && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {pendingCount > 0 && (
            <Card 
              className="border-orange-200 bg-orange-50 shadow-soft hover:shadow-lifted transition-shadow cursor-pointer"
              onClick={() => navigate('/followups')}
              data-testid="pending-followups-card"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-orange-800">Pending Follow-ups</CardTitle>
                <Bell className="w-4 h-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">{pendingCount}</div>
                <p className="text-xs text-orange-600 mt-1">Click to view</p>
              </CardContent>
            </Card>
          )}

          <Card className="border-slate-200 shadow-soft hover:shadow-lifted transition-shadow" data-testid="total-leads-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total Leads</CardTitle>
              <Users className="w-4 h-4 text-slate-400" />
            </CardHeader>
            <CardContent>
            <div className="text-3xl font-bold">{analytics?.total_leads || 0}</div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-soft hover:shadow-lifted transition-shadow" data-testid="conversion-rate-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Conversion Rate</CardTitle>
            <TrendingUp className="w-4 h-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{conversionRate}%</div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-soft hover:shadow-lifted transition-shadow" data-testid="converted-leads-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Converted</CardTitle>
            <CheckCircle className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {analytics?.status_breakdown?.['Converted'] || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-soft hover:shadow-lifted transition-shadow" data-testid="lost-leads-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Lost</CardTitle>
            <XCircle className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {analytics?.status_breakdown?.['Lost'] || 0}
            </div>
          </CardContent>
        </Card>

        {/* Deleted Leads Card */}
        {(analytics?.deleted_leads > 0 || analytics?.status_breakdown?.['Deleted'] > 0) && (
          <Card className="border-slate-300 bg-slate-50 shadow-soft hover:shadow-lifted transition-shadow" data-testid="deleted-leads-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Deleted</CardTitle>
              <Trash2 className="w-4 h-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-500">
                {analytics?.deleted_leads || analytics?.status_breakdown?.['Deleted'] || 0}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      )}

      {/* Branch Admin Financial Stats - Compact Design */}
      {isBranchAdmin && branchFinancialStats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="branch-financial-stats">
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <CreditCard className="w-4 h-4 text-green-600" />
                <span className="text-xs text-green-700 font-medium">Total Collection</span>
              </div>
              <p className="text-xl font-bold text-green-700">
                ₹{((branchFinancialStats.total_collections || 0) / 1000).toFixed(0)}K
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <Receipt className="w-4 h-4 text-orange-600" />
                <span className="text-xs text-orange-700 font-medium">Pending</span>
              </div>
              <p className="text-xl font-bold text-orange-700">
                ₹{((branchFinancialStats.pending_amounts || 0) / 1000).toFixed(0)}K
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-blue-50 to-sky-50 border-blue-200">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span className="text-xs text-blue-700 font-medium">This Month</span>
              </div>
              <p className="text-xl font-bold text-blue-700">
                ₹{((branchFinancialStats.monthly_revenue || 0) / 1000).toFixed(0)}K
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <GraduationCap className="w-4 h-4 text-purple-600" />
                <span className="text-xs text-purple-700 font-medium">Exam Revenue</span>
              </div>
              <p className="text-xl font-bold text-purple-700">
                ₹{((branchFinancialStats.exam_revenue || 0) / 1000).toFixed(0)}K
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <ArrowDownRight className="w-4 h-4 text-red-600" />
                <span className="text-xs text-red-700 font-medium">Expenses</span>
              </div>
              <p className="text-xl font-bold text-red-700">
                ₹{((branchFinancialStats.total_expenses || 0) / 1000).toFixed(0)}K
              </p>
            </CardContent>
          </Card>
          
          <Card className={`bg-gradient-to-br ${(branchFinancialStats.net_revenue || 0) >= 0 ? 'from-emerald-50 to-green-50 border-emerald-200' : 'from-red-50 to-rose-50 border-red-200'}`}>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className={`w-4 h-4 ${(branchFinancialStats.net_revenue || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
                <span className={`text-xs font-medium ${(branchFinancialStats.net_revenue || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>Net Revenue</span>
              </div>
              <p className={`text-xl font-bold ${(branchFinancialStats.net_revenue || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                ₹{((branchFinancialStats.net_revenue || 0) / 1000).toFixed(0)}K
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Branch Admin - Trainer & Royalty Row */}
      {isBranchAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Trainer Stats - Compact */}
          {branchFinancialStats?.trainer_stats?.length > 0 && (
            <Card className="border-slate-200">
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" /> Trainer-wise Students
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {branchFinancialStats.trainer_stats.map((trainer) => (
                    <div key={trainer.trainer_id} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full border text-sm">
                      <span className="text-slate-700">{trainer.trainer_name}</span>
                      <Badge variant="secondary" className="h-5">{trainer.unique_student_count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Royalty Widget - Compact */}
          {royaltyData && royaltyData.royalty_percentage > 0 && (
            <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-800">
                  <DollarSign className="w-4 h-4" /> Royalty - {royaltyData.month_name}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-amber-900">₹{royaltyData.royalty_amount?.toLocaleString()}</p>
                    <p className="text-xs text-amber-600">{royaltyData.royalty_percentage}% of ₹{royaltyData.total_collection?.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-amber-700 mb-1">Due: {royaltyData.due_date_display}</p>
                    {royaltyData.is_paid ? (
                      <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" /> Paid</Badge>
                    ) : (
                      <Badge className="bg-orange-100 text-orange-700"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Branch Admin - Charts Row */}
      {isBranchAdmin && admissionData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Monthly Admissions Chart - Compact */}
          <Card className="border-slate-200">
            <CardHeader className="py-3">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-purple-600" /> Monthly Admissions ({admissionData.total_admissions})
                </CardTitle>
                <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                  <SelectTrigger className="w-20 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026].map((year) => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={admissionData.monthly_data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="month_name" stroke="#64748B" tick={{fontSize: 10}} />
                  <YAxis stroke="#64748B" allowDecimals={false} tick={{fontSize: 10}} />
                  <Tooltip />
                  <Bar dataKey="admissions" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          
          {/* Program Distribution - Compact */}
          {admissionData.program_breakdown && Object.keys(admissionData.program_breakdown).length > 0 && (
            <Card className="border-slate-200">
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Award className="w-4 h-4 text-purple-600" /> Program Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(admissionData.program_breakdown)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 6)
                    .map(([program, count]) => (
                      <div key={program} className="flex items-center justify-between p-2 bg-purple-50 rounded-lg border border-purple-100">
                        <span className="text-xs font-medium text-slate-700 truncate mr-2">{program}</span>
                        <Badge className="bg-purple-100 text-purple-700 text-xs">{count}</Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Branch Admin Incentive Overview - Compact */}
      {isBranchAdmin && branchIncentiveStats && (
        <Card className="border-slate-200">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Gift className="w-4 h-4 text-purple-600" /> Counsellor Incentives
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div className="text-center p-2 bg-green-50 rounded-lg border border-green-200">
                <p className="text-xs text-green-600">Earned</p>
                <p className="text-lg font-bold text-green-700">₹{(branchIncentiveStats.branch_summary.total_earned_incentives || 0).toLocaleString()}</p>
              </div>
              <div className="text-center p-2 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-xs text-yellow-600">Pending</p>
                <p className="text-lg font-bold text-yellow-700">₹{(branchIncentiveStats.branch_summary.total_pending_incentives || 0).toLocaleString()}</p>
              </div>
              <div className="text-center p-2 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-600">Exams Done</p>
                <p className="text-lg font-bold text-blue-700">{branchIncentiveStats.branch_summary.completed_exams || 0}</p>
              </div>
              <div className="text-center p-2 bg-red-50 rounded-lg border border-red-200">
                <p className="text-xs text-red-600">Refunds</p>
                <p className="text-lg font-bold text-red-700">₹{(branchIncentiveStats.branch_summary.total_refunds_pending || 0).toLocaleString()}</p>
              </div>
            </div>
            {branchIncentiveStats.counsellor_stats?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {branchIncentiveStats.counsellor_stats.map((counsellor) => (
                  <div key={counsellor.counsellor_id} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full border text-xs">
                    <span className="text-slate-700">{counsellor.counsellor_name}</span>
                    <span className="text-green-600 font-medium">₹{counsellor.earned_incentive}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Counsellor Incentives Section */}
      {isCounsellor && counsellorIncentives && (
        <Card className="border-slate-200 shadow-soft" data-testid="counsellor-incentives">
          <CardHeader>
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <Gift className="w-5 h-5 text-purple-600" /> My Incentives (International Exams)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card className="bg-green-50 border-green-200">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-sm text-green-700">Earned Incentive</span>
                  </div>
                  <p className="text-2xl font-bold text-green-700 mt-1">
                    ₹{counsellorIncentives.summary.total_earned?.toLocaleString() || 0}
                  </p>
                  <p className="text-xs text-green-600 mt-1">{counsellorIncentives.summary.completed_count} completed exams</p>
                </CardContent>
              </Card>
              
              <Card className="bg-yellow-50 border-yellow-200">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-yellow-600" />
                    <span className="text-sm text-yellow-700">Pending Incentive</span>
                  </div>
                  <p className="text-2xl font-bold text-yellow-700 mt-1">
                    ₹{counsellorIncentives.summary.total_pending?.toLocaleString() || 0}
                  </p>
                  <p className="text-xs text-yellow-600 mt-1">{counsellorIncentives.summary.pending_count} pending exams</p>
                </CardContent>
              </Card>
              
              <Card className="bg-red-50 border-red-200">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Ban className="w-5 h-5 text-red-600" />
                    <span className="text-sm text-red-700">Cancelled (Refunds)</span>
                  </div>
                  <p className="text-2xl font-bold text-red-700 mt-1">
                    ₹{counsellorIncentives.summary.total_cancelled_refunds?.toLocaleString() || 0}
                  </p>
                  <p className="text-xs text-red-600 mt-1">{counsellorIncentives.summary.cancelled_count} cancelled exams</p>
                </CardContent>
              </Card>
            </div>
            
            {/* Recent Earned Incentives */}
            {counsellorIncentives.earned_bookings?.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" /> Recently Earned
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {counsellorIncentives.earned_bookings.slice(0, 5).map((booking) => (
                    <div key={booking.id} className="flex items-center justify-between p-2 bg-green-50 rounded-lg border border-green-100">
                      <div>
                        <p className="text-sm font-medium">{booking.student_name}</p>
                        <p className="text-xs text-slate-500">{booking.exam_name}</p>
                      </div>
                      <Badge className="bg-green-100 text-green-700">+₹{booking.counsellor_incentive}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Pending Exams */}
            {counsellorIncentives.pending_bookings?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-yellow-600" /> Pending (10% on completion)
                </h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {counsellorIncentives.pending_bookings.slice(0, 5).map((booking) => (
                    <div key={booking.id} className="flex items-center justify-between p-2 bg-yellow-50 rounded-lg border border-yellow-100">
                      <div>
                        <p className="text-sm font-medium">{booking.student_name}</p>
                        <p className="text-xs text-slate-500">{booking.exam_name} • ₹{booking.exam_price}</p>
                      </div>
                      <Badge className="bg-yellow-100 text-yellow-700">₹{Math.round(booking.exam_price * 0.10)} potential</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* AI-Powered Lead Insights - For Counsellors and Branch Admins */}
      {showAIInsights && aiInsights && (
        <div className="space-y-4" data-testid="ai-insights-section">
          {/* Health Score Banner */}
          <Card className={`border-2 ${
            aiInsights.health_score >= 70 ? 'border-green-300 bg-green-50' :
            aiInsights.health_score >= 40 ? 'border-yellow-300 bg-yellow-50' :
            'border-red-300 bg-red-50'
          }`}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Lead Management Health Score</h3>
                  <p className="text-sm text-slate-600">Based on conversion, follow-ups, and lead engagement</p>
                </div>
                <div className={`text-5xl font-bold ${
                  aiInsights.health_score >= 70 ? 'text-green-600' :
                  aiInsights.health_score >= 40 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {Math.round(aiInsights.health_score)}%
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-blue-600">{aiInsights.summary.total_leads}</p>
                <p className="text-sm text-blue-700">Total Leads</p>
              </CardContent>
            </Card>
            <Card className="bg-green-50 border-green-200">
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-green-600">{aiInsights.summary.conversion_rate}%</p>
                <p className="text-sm text-green-700">Conversion Rate</p>
              </CardContent>
            </Card>
            <Card className="bg-orange-50 border-orange-200">
              <CardContent className="pt-4 text-center">
                <p className="text-3xl font-bold text-orange-600">{aiInsights.summary.pending_followups}</p>
                <p className="text-sm text-orange-700">Pending Follow-ups</p>
              </CardContent>
            </Card>
            <Card className={aiInsights.summary.overdue_followups > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}>
              <CardContent className="pt-4 text-center">
                <p className={`text-3xl font-bold ${aiInsights.summary.overdue_followups > 0 ? 'text-red-600' : 'text-slate-600'}`}>
                  {aiInsights.summary.overdue_followups}
                </p>
                <p className={`text-sm ${aiInsights.summary.overdue_followups > 0 ? 'text-red-700' : 'text-slate-700'}`}>Overdue Follow-ups</p>
              </CardContent>
            </Card>
          </div>

          {/* AI Insights */}
          {aiInsights.insights && aiInsights.insights.length > 0 && (
            <Card className="border-slate-200 shadow-soft">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  AI Insights
                  {aiInsights.ai_powered && (
                    <Badge className="bg-purple-100 text-purple-700 ml-2">
                      GPT-4o Powered
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {aiInsights.insights.map((insight, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border-l-4 ${
                        insight.type === 'alert' ? 'bg-red-50 border-red-500' :
                        insight.type === 'warning' ? 'bg-yellow-50 border-yellow-500' :
                        insight.type === 'success' ? 'bg-green-50 border-green-500' :
                        'bg-blue-50 border-blue-500'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold">{insight.title}</h4>
                          <p className="text-sm text-slate-600">{insight.message}</p>
                        </div>
                        <Badge className={
                          insight.priority === 'high' ? 'bg-red-100 text-red-800' :
                          insight.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-slate-100 text-slate-800'
                        }>
                          {insight.priority}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {aiInsights.recommendations && aiInsights.recommendations.length > 0 && (
            <Card className="border-slate-200 shadow-soft bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Award className="w-5 h-5 text-indigo-600" />
                  Recommendations to Improve
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {aiInsights.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                      <span className="text-slate-700">{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Source & Program Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-slate-200 shadow-soft">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Lead Sources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(aiInsights.source_breakdown || {}).map(([source, count]) => (
                    <div key={source} className="flex items-center justify-between">
                      <span className="text-sm">{source}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-slate-200 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${(count / aiInsights.summary.total_leads * 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-soft">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Status Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(aiInsights.status_breakdown || {}).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <span className="text-sm">{status}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-slate-200 rounded-full h-2">
                          <div
                            className="h-2 rounded-full"
                            style={{ 
                              width: `${(count / aiInsights.summary.total_leads * 100)}%`,
                              backgroundColor: STATUS_COLORS[status] || '#94A3B8'
                            }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Income & Expense Chart - Admin and Branch Admin only (NOT FDE) */}
      {(user.role === 'Admin' || user.role === 'Branch Admin') && financialData && (
        <Card className="border-slate-200 shadow-soft" data-testid="financial-chart">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-xl font-semibold">Monthly Income & Expenses</CardTitle>
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026].map((year) => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card className="bg-green-50 border-green-200">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <ArrowUpRight className="w-5 h-5 text-green-600" />
                    <span className="text-sm text-green-700">Total Income</span>
                  </div>
                  <p className="text-2xl font-bold text-green-700 mt-1">
                    ₹{financialData.total_income?.toLocaleString() || 0}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-red-50 border-red-200">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <ArrowDownRight className="w-5 h-5 text-red-600" />
                    <span className="text-sm text-red-700">Total Expenses</span>
                  </div>
                  <p className="text-2xl font-bold text-red-700 mt-1">
                    ₹{financialData.total_expenses?.toLocaleString() || 0}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-blue-600" />
                    <span className="text-sm text-blue-700">Net Profit</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-700 mt-1">
                    ₹{((financialData.total_income || 0) - (financialData.total_expenses || 0)).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={financialData.monthly_data || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="month_name" stroke="#64748B" />
                <YAxis stroke="#64748B" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
                <Legend />
                <Bar dataKey="income" name="Income" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Branch-wise Financial - Admin Only */}
      {user.role === 'Admin' && branchFinancials.length > 0 && (
        <Card className="border-slate-200 shadow-soft" data-testid="branch-financials">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Branch-wise Financial Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Branch</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Enrollments</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Total Income</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Total Expenses</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Net Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {branchFinancials.map((branch) => (
                    <tr key={branch.branch_id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-sm">{branch.branch_name}</p>
                          <p className="text-xs text-slate-500">{branch.branch_location}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-12 h-8 rounded-md bg-slate-100 font-semibold text-sm">
                          {branch.enrollments_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center px-3 h-8 rounded-md bg-green-50 text-green-700 font-semibold text-sm">
                          ₹{branch.total_income?.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center px-3 h-8 rounded-md bg-red-50 text-red-700 font-semibold text-sm">
                          ₹{branch.total_expenses?.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center justify-center px-3 h-8 rounded-md font-semibold text-sm ${
                          branch.net_profit >= 0 ? 'bg-blue-50 text-blue-700' : 'bg-red-100 text-red-700'
                        }`}>
                          ₹{branch.net_profit?.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Branch-wise Analytics - Admin Only */}
      {user.role === 'Admin' && branchAnalytics.length > 0 && (
        <Card className="border-slate-200 shadow-soft">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Branch-wise Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Branch</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Total Leads</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">New</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Contacted</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Demo</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Follow-up</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Converted</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Lost</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Conversion %</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Counsellors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {branchAnalytics.map((branch) => (
                    <tr key={branch.branch_id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-sm">{branch.branch_name}</p>
                          <p className="text-xs text-slate-500">{branch.branch_location}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-12 h-8 rounded-md bg-slate-100 font-semibold text-sm">
                          {branch.total_leads}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-10 h-8 rounded-md bg-blue-50 text-blue-700 font-medium text-sm">
                          {branch.new_leads}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-10 h-8 rounded-md bg-purple-50 text-purple-700 font-medium text-sm">
                          {branch.contacted}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-10 h-8 rounded-md bg-orange-50 text-orange-700 font-medium text-sm">
                          {branch.demo_booked}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-10 h-8 rounded-md bg-cyan-50 text-cyan-700 font-medium text-sm">
                          {branch.followup}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-10 h-8 rounded-md bg-green-50 text-green-700 font-semibold text-sm">
                          {branch.converted}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-10 h-8 rounded-md bg-red-50 text-red-700 font-medium text-sm">
                          {branch.lost}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center justify-center px-3 h-8 rounded-md font-semibold text-sm ${
                          branch.conversion_rate >= 50 ? 'bg-green-100 text-green-800' :
                          branch.conversion_rate >= 25 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {branch.conversion_rate}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-10 h-8 rounded-md bg-slate-100 font-medium text-sm">
                          {branch.active_counsellors}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Leads - Hidden for FDE */}
      {!isFDE && (
        <Card className="border-slate-200 shadow-soft">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Recent Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                  data-testid={`recent-lead-${lead.id}`}
                >
                  <div>
                    <p className="font-semibold">{lead.name}</p>
                    <p className="text-sm text-slate-600">{lead.program}</p>
                  </div>
                  <div className="text-right">
                    <span
                      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
                      style={{
                        backgroundColor: `${STATUS_COLORS[lead.status]}15`,
                        color: STATUS_COLORS[lead.status],
                      }}
                    >
                      {lead.status}
                    </span>
                    <p className="text-xs text-slate-500 mt-1">{lead.lead_source}</p>
                  </div>
                </div>
              ))}
              {recentLeads.length === 0 && (
                <p className="text-center text-slate-500 py-8">No leads yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
