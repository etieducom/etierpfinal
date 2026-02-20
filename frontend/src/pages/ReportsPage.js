import React, { useState, useEffect } from 'react';
import { reportsAPI, adminAPI } from '@/api/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Download, Filter } from 'lucide-react';

const STATUSES = ['All', 'New', 'Contacted', 'Demo Booked', 'Follow-up', 'Converted', 'Lost'];
const SOURCES = ['All', 'Website', 'Social Media', 'Referral', 'Walk-in', 'Phone Call'];

const ReportsPage = () => {
  const [programs, setPrograms] = useState([]);
  const [branches, setBranches] = useState([]);
  const [filters, setFilters] = useState({
    status: 'All',
    source: 'All',
    program_id: 'All',
    branch_id: 'All',
    start_date: '',
    end_date: '',
  });
  const [generating, setGenerating] = useState(false);

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
      const cleanFilters = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'All') {
          cleanFilters[key] = value;
        }
      });

      const response = await reportsAPI.generateLeadsReport(cleanFilters);
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `leads_report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Report generated successfully!');
    } catch (error) {
      toast.error('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="reports-page">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-2">Reports</h1>
        <p className="text-slate-600">Generate custom lead reports with filters</p>
      </div>

      <Card className="border-slate-200 shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Report Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

            <div className="space-y-2">
              <Label>Start Date</Label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                data-testid="start-date-input"
              />
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                data-testid="end-date-input"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() =>
                setFilters({
                  status: 'All',
                  source: 'All',
                  program_id: 'All',
                  branch_id: 'All',
                  start_date: '',
                  end_date: '',
                })
              }
            >
              Reset Filters
            </Button>
            <Button
              onClick={handleGenerateReport}
              disabled={generating}
              className="bg-slate-900 hover:bg-slate-800"
              data-testid="generate-report-button"
            >
              <Download className="w-4 h-4 mr-2" />
              {generating ? 'Generating...' : 'Generate Report'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-soft">
        <CardHeader>
          <CardTitle>Report Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
            <p className="text-sm text-slate-600">
              Reports are generated in CSV format and include all lead details based on selected filters
            </p>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
            <p className="text-sm text-slate-600">
              You can open CSV files in Excel, Google Sheets, or any spreadsheet application
            </p>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
            <p className="text-sm text-slate-600">
              Apply multiple filters to generate specific reports for better analysis
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsPage;
