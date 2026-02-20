import React, { useState, useEffect } from 'react';
import { analyticsAPI, leadsAPI, followupAPI } from '@/api/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, TrendingUp, CheckCircle, XCircle, Bell, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react';
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
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    fetchData();
  }, [selectedYear]);

  const fetchData = async () => {
    try {
      const promises = [
        analyticsAPI.getOverview(),
        leadsAPI.getAll({}),
      ];
      
      if (user.role === 'Admin') {
        promises.push(analyticsAPI.getBranchWise());
        promises.push(analyticsAPI.getMonthlyFinancial(selectedYear));
        promises.push(analyticsAPI.getBranchWiseFinancial());
      } else if (user.role === 'Front Desk Executive') {
        promises.push(analyticsAPI.getMonthlyFinancial(selectedYear));
        promises.push(null); // placeholder
      } else {
        promises.push(followupAPI.getPendingCount());
      }
      
      const results = await Promise.all(promises);
      setAnalytics(results[0].data);
      setRecentLeads(results[1].data.slice(0, 5));
      
      if (user.role === 'Admin') {
        setBranchAnalytics(results[2].data);
        setFinancialData(results[3].data);
        setBranchFinancials(results[4].data);
      } else if (user.role === 'Front Desk Executive') {
        setFinancialData(results[2].data);
      } else if (results[2]) {
        setPendingCount(results[2].data.count);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
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
    ? Object.entries(analytics.status_breakdown).map(([name, value]) => ({
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
        <p className="text-slate-600">Welcome back! Here's your overview</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {user.role !== 'Admin' && pendingCount > 0 && (
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
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Status Distribution */}
        <Card className="col-span-1 lg:col-span-5 border-slate-200 shadow-soft">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => entry.name}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Source Performance */}
        <Card className="col-span-1 lg:col-span-7 border-slate-200 shadow-soft">
          <CardHeader>
            <CardTitle className="text-xl font-semibold">Lead Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics?.source_performance || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="source" stroke="#64748B" />
                <YAxis stroke="#64748B" />
                <Tooltip />
                <Bar dataKey="count" fill="#0F172A" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Income & Expense Chart - Admin and FDE */}
      {(user.role === 'Admin' || user.role === 'Front Desk Executive') && financialData && (
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

      {/* Recent Leads */}
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
    </div>
  );
};

export default Dashboard;
