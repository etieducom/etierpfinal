import React, { useState, useEffect } from 'react';
import { reportsAPI, adminAPI } from '@/api/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Download, Filter, FileText, DollarSign, Users, CreditCard, Clock } from 'lucide-react';

const STATUSES = ['All', 'New', 'Contacted', 'Demo Booked', 'Follow-up', 'Converted', 'Lost'];
const SOURCES = ['All', 'Website', 'Social Media', 'Referral', 'Walk-in', 'Phone Call', 'Google'];

const ReportsPage = () => {
  const [programs, setPrograms] = useState([]);
  const [branches, setBranches] = useState([]);
  const [reportType, setReportType] = useState('leads');
  const [filters, setFilters] = useState({
    status: 'All',
    source: 'All',
    program_id: 'All',
    branch_id: 'All',
    start_date: '',
    end_date: '',
  });
  const [generating, setGenerating] = useState(false);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isSuperAdmin = user.role === 'Admin';
  const isBranchAdmin = user.role === 'Branch Admin';
  const isCounsellor = user.role === 'Counsellor';
  const isFDE = user.role === 'Front Desk Executive';

  // Define all report types
  const allReportTypes = [
    { id: 'leads', label: 'Leads Report', icon: Users, description: 'All leads with status and details', roles: ['Admin', 'Branch Admin', 'Counsellor', 'Front Desk Executive'] },
    { id: 'enrollments', label: 'Enrollments Report', icon: FileText, description: 'Student enrollments and program details', roles: ['Admin', 'Branch Admin', 'Front Desk Executive'] },
    { id: 'income', label: 'Income Report', icon: DollarSign, description: 'Payment records and revenue', roles: ['Admin', 'Branch Admin', 'Front Desk Executive'] },
    { id: 'expenses', label: 'Expenses Report', icon: CreditCard, description: 'Expense records by category', roles: ['Admin', 'Branch Admin'] },
    { id: 'pending_payments', label: 'Pending Payments', icon: Clock, description: 'Outstanding installments', roles: ['Admin', 'Branch Admin', 'Front Desk Executive'] },
  ];

  // Filter report types based on user role
  const reportTypes = allReportTypes.filter(type => type.roles.includes(user.role));

  useEffect(() => {
    fetchOptions();
  }, []);

  const fetchOptions = async () => {
    try {
      const [programRes, branchRes] = await Promise.all([
        adminAPI.getPrograms(),
        adminAPI.getBranches(),
      ]);
      setPrograms(programRes.data);
      setBranches(branchRes.data);
    } catch (error) {
      console.error('Error fetching options:', error);
    }
  };

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      const cleanFilters = { report_type: reportType };
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'All') {
          cleanFilters[key] = value;
        }
      });

      const response = await reportsAPI.generateReport(cleanFilters);
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${reportType}_report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Report generated successfully!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const resetFilters = () => {
    setFilters({
      status: 'All',
      source: 'All',
      program_id: 'All',
      branch_id: 'All',
      start_date: '',
      end_date: '',
    });
  };

  const reportTypes = [
    { id: 'leads', label: 'Leads Report', icon: Users, description: 'All leads with status and details' },
    { id: 'enrollments', label: 'Enrollments Report', icon: FileText, description: 'Student enrollments and program details' },
    { id: 'income', label: 'Income Report', icon: DollarSign, description: 'Payment records and revenue' },
    { id: 'expenses', label: 'Expenses Report', icon: CreditCard, description: 'Expense records by category' },
    { id: 'pending_payments', label: 'Pending Payments', icon: Clock, description: 'Outstanding installments' },
  ];

  return (
    <div className="space-y-6" data-testid="reports-page">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-2">Reports</h1>
        <p className="text-slate-600">Generate custom reports with filters</p>
      </div>

      {/* Report Type Selection */}
      <Card className="border-slate-200 shadow-soft">
        <CardHeader>
          <CardTitle>Select Report Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {reportTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setReportType(type.id)}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  reportType === type.id
                    ? 'border-slate-900 bg-slate-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
                data-testid={`report-type-${type.id}`}
              >
                <type.icon className={`w-6 h-6 mb-2 ${reportType === type.id ? 'text-slate-900' : 'text-slate-500'}`} />
                <p className="font-medium text-sm">{type.label}</p>
                <p className="text-xs text-slate-500 mt-1">{type.description}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="border-slate-200 shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Report Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Branch Filter - Super Admin only */}
            {isSuperAdmin && (
              <div className="space-y-2">
                <Label>Branch</Label>
                <Select
                  value={filters.branch_id}
                  onValueChange={(value) => setFilters({ ...filters, branch_id: value })}
                >
                  <SelectTrigger data-testid="branch-filter">
                    <SelectValue placeholder="All Branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Branches</SelectItem>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Date Filters */}
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                data-testid="start-date-input"
              />
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                data-testid="end-date-input"
              />
            </div>

            {/* Lead-specific Filters */}
            {reportType === 'leads' && (
              <>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={filters.status}
                    onValueChange={(value) => setFilters({ ...filters, status: value })}
                  >
                    <SelectTrigger data-testid="status-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Lead Source</Label>
                  <Select
                    value={filters.source}
                    onValueChange={(value) => setFilters({ ...filters, source: value })}
                  >
                    <SelectTrigger data-testid="source-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCES.map((source) => (
                        <SelectItem key={source} value={source}>
                          {source}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Program</Label>
                  <Select
                    value={filters.program_id}
                    onValueChange={(value) => setFilters({ ...filters, program_id: value })}
                  >
                    <SelectTrigger data-testid="program-filter">
                      <SelectValue placeholder="All Programs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Programs</SelectItem>
                      {programs.map((program) => (
                        <SelectItem key={program.id} value={program.id}>
                          {program.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={resetFilters}>
              Reset Filters
            </Button>
            <Button
              onClick={handleGenerateReport}
              disabled={generating}
              className="bg-slate-900 hover:bg-slate-800"
              data-testid="generate-report-button"
            >
              <Download className="w-4 h-4 mr-2" />
              {generating ? 'Generating...' : 'Download Report'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Info */}
      <Card className="border-slate-200 shadow-soft">
        <CardHeader>
          <CardTitle>Report Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
            <p className="text-sm text-slate-600">
              Reports are generated in CSV format and can be opened in Excel or Google Sheets
            </p>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
            <p className="text-sm text-slate-600">
              {isBranchAdmin 
                ? 'Reports are automatically filtered to your branch data only'
                : 'Super Admin can generate reports for all branches or filter by specific branch'
              }
            </p>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
            <p className="text-sm text-slate-600">
              Use date filters to generate reports for specific time periods
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsPage;
