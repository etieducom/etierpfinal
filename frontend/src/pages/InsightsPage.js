import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { aiAnalyticsAPI, attendanceAPI, metaAPI } from '@/api/api';
import { format } from 'date-fns';
import { 
  Brain, TrendingUp, TrendingDown, Users, IndianRupee, 
  GraduationCap, Target, AlertTriangle, CheckCircle, 
  RefreshCw, BarChart3, Sparkles, Building2, Zap,
  Phone, Calendar, Star, Lightbulb, Award, UserCheck,
  Clock, ClipboardList, XCircle, Facebook, DollarSign,
  Eye, MousePointer, Play, Pause, Archive, ArrowUpRight
} from 'lucide-react';

const InsightsPage = () => {
  const [activeTab, setActiveTab] = useState('branch');
  
  // Branch Analytics State
  const [branchLoading, setBranchLoading] = useState(true);
  const [branchAnalytics, setBranchAnalytics] = useState(null);
  const [branchRefreshing, setBranchRefreshing] = useState(false);
  
  // User Efficiency State
  const [efficiencyLoading, setEfficiencyLoading] = useState(true);
  const [efficiencyData, setEfficiencyData] = useState(null);
  const [efficiencyRefreshing, setEfficiencyRefreshing] = useState(false);
  const [efficiencyTab, setEfficiencyTab] = useState('overview');
  
  // Attendance State
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [attendanceData, setAttendanceData] = useState(null);
  
  // Meta Analytics State
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaAnalytics, setMetaAnalytics] = useState(null);
  const [metaLeads, setMetaLeads] = useState([]);
  const [metaCampaigns, setMetaCampaigns] = useState([]);
  const [metaSyncing, setMetaSyncing] = useState(false);
  const [metaDays, setMetaDays] = useState('30');
  const [metaTab, setMetaTab] = useState('overview');
  
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const branchId = user.branch_id;

  useEffect(() => {
    // Fetch data based on active tab
    if (activeTab === 'branch') {
      fetchBranchAnalytics();
    } else if (activeTab === 'efficiency') {
      fetchEfficiencyData();
    } else if (activeTab === 'attendance') {
      fetchAttendanceData();
    } else if (activeTab === 'meta') {
      fetchMetaData();
    }
  }, [activeTab]);

  // Branch Analytics Functions
  const fetchBranchAnalytics = async () => {
    try {
      const response = await aiAnalyticsAPI.getBranchInsights();
      setBranchAnalytics(response.data);
    } catch (error) {
      toast.error('Failed to load branch analytics');
    } finally {
      setBranchLoading(false);
      setBranchRefreshing(false);
    }
  };

  const handleBranchRefresh = () => {
    setBranchRefreshing(true);
    fetchBranchAnalytics();
  };

  // User Efficiency Functions
  const fetchEfficiencyData = async () => {
    try {
      const response = await aiAnalyticsAPI.getUserEfficiency();
      setEfficiencyData(response.data);
    } catch (error) {
      toast.error('Failed to load efficiency data');
    } finally {
      setEfficiencyLoading(false);
      setEfficiencyRefreshing(false);
    }
  };

  const handleEfficiencyRefresh = () => {
    setEfficiencyRefreshing(true);
    fetchEfficiencyData();
  };

  // Attendance Functions
  const fetchAttendanceData = async () => {
    try {
      const response = await attendanceAPI.getMissedInsights();
      setAttendanceData(response.data);
    } catch (error) {
      toast.error('Failed to load attendance insights');
    } finally {
      setAttendanceLoading(false);
    }
  };

  // Meta Analytics Functions
  const fetchMetaData = async () => {
    setMetaLoading(true);
    try {
      const [analyticsRes, leadsRes] = await Promise.all([
        metaAPI.getAnalytics(branchId, parseInt(metaDays)),
        metaAPI.getLeads({ branch_id: branchId })
      ]);
      setMetaAnalytics(analyticsRes.data);
      setMetaLeads(leadsRes.data);
    } catch (error) {
      if (error.response?.status === 404) {
        toast.error('Meta not configured for your branch. Contact Super Admin.');
      }
    } finally {
      setMetaLoading(false);
    }
  };

  const handleMetaSync = async () => {
    setMetaSyncing(true);
    try {
      await metaAPI.sync(branchId);
      toast.success('Meta data synced successfully');
      fetchMetaData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to sync Meta data');
    } finally {
      setMetaSyncing(false);
    }
  };

  // Helper Functions
  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-blue-600 bg-blue-50';
    if (score >= 40) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  const getScoreBadge = (score) => {
    if (score >= 80) return { label: 'Excellent', color: 'bg-green-500' };
    if (score >= 60) return { label: 'Good', color: 'bg-blue-500' };
    if (score >= 40) return { label: 'Average', color: 'bg-amber-500' };
    return { label: 'Needs Attention', color: 'bg-red-500' };
  };

  const getComplianceColor = (rate) => {
    if (rate >= 90) return 'text-green-600 bg-green-50';
    if (rate >= 70) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  // Branch Analytics Tab Content
  const renderBranchAnalytics = () => {
    if (branchLoading) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Brain className="w-16 h-16 text-indigo-500 mx-auto animate-pulse" />
            <p className="mt-4 text-slate-500">Analyzing branch data with AI...</p>
          </div>
        </div>
      );
    }

    const aiAnalysis = branchAnalytics?.ai_analysis;
    const overallHealth = aiAnalysis?.overall_health;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">
              Last updated: {branchAnalytics?.generated_at ? format(new Date(branchAnalytics.generated_at), 'dd MMM yyyy, h:mm a') : 'N/A'}
            </p>
          </div>
          <Button onClick={handleBranchRefresh} disabled={branchRefreshing} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${branchRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Health Score */}
        {overallHealth && (
          <Card className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-indigo-100 text-sm">Branch Health Score</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-5xl font-bold">{overallHealth.score}</span>
                    <span className="text-2xl text-indigo-200">/100</span>
                  </div>
                  <p className="text-indigo-100 mt-2">{overallHealth.assessment}</p>
                </div>
                <div className="text-right">
                  <Badge className="bg-white/20 text-white text-lg px-4 py-1">
                    {overallHealth.grade}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Key Metrics */}
        {branchAnalytics?.metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-slate-500 text-sm">
                  <Users className="w-4 h-4" /> Total Leads
                </div>
                <p className="text-2xl font-bold mt-1">{branchAnalytics.metrics.total_leads}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-slate-500 text-sm">
                  <Target className="w-4 h-4" /> Conversion Rate
                </div>
                <p className="text-2xl font-bold mt-1">{branchAnalytics.metrics.conversion_rate}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-slate-500 text-sm">
                  <GraduationCap className="w-4 h-4" /> Enrollments
                </div>
                <p className="text-2xl font-bold mt-1">{branchAnalytics.metrics.total_enrollments}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-slate-500 text-sm">
                  <IndianRupee className="w-4 h-4" /> Revenue
                </div>
                <p className="text-2xl font-bold mt-1">₹{branchAnalytics.metrics.total_revenue?.toLocaleString()}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* AI Recommendations */}
        {aiAnalysis?.recommendations && aiAnalysis.recommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-500" /> AI Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {aiAnalysis.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">{rec}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  // User Efficiency Tab Content
  const renderUserEfficiency = () => {
    if (efficiencyLoading) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Brain className="w-16 h-16 text-purple-500 mx-auto animate-pulse" />
            <p className="mt-4 text-slate-500">Analyzing user efficiency with AI...</p>
          </div>
        </div>
      );
    }

    const aiAnalysis = efficiencyData?.ai_analysis;
    const overallEfficiency = aiAnalysis?.overall_efficiency;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Last updated: {efficiencyData?.generated_at ? format(new Date(efficiencyData.generated_at), 'dd MMM yyyy, h:mm a') : 'N/A'}
          </p>
          <Button onClick={handleEfficiencyRefresh} disabled={efficiencyRefreshing} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${efficiencyRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Overall Efficiency Score */}
        {overallEfficiency && (
          <Card className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm">Team Efficiency Score</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-5xl font-bold">{overallEfficiency.score}</span>
                    <span className="text-2xl text-purple-200">/100</span>
                  </div>
                  <p className="text-purple-100 mt-2">{overallEfficiency.assessment}</p>
                </div>
                <Badge className="bg-white/20 text-white text-lg px-4 py-1">
                  {getScoreBadge(overallEfficiency.score).label}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* User Cards */}
        {efficiencyData?.users && efficiencyData.users.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {efficiencyData.users.map((user) => (
              <Card key={user.user_id} className="hover:shadow-lg transition-shadow">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                        <UserCheck className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-semibold">{user.user_name}</p>
                        <p className="text-xs text-slate-500">{user.role}</p>
                      </div>
                    </div>
                    <div className={`text-2xl font-bold ${getScoreColor(user.efficiency_score)}`}>
                      {user.efficiency_score}%
                    </div>
                  </div>
                  <Progress value={user.efficiency_score} className="h-2" />
                  <div className="grid grid-cols-3 gap-2 mt-3 text-center text-xs">
                    <div className="p-2 bg-slate-50 rounded">
                      <p className="font-semibold">{user.leads_handled}</p>
                      <p className="text-slate-500">Leads</p>
                    </div>
                    <div className="p-2 bg-slate-50 rounded">
                      <p className="font-semibold">{user.conversions}</p>
                      <p className="text-slate-500">Converted</p>
                    </div>
                    <div className="p-2 bg-slate-50 rounded">
                      <p className="font-semibold">{user.conversion_rate}%</p>
                      <p className="text-slate-500">Rate</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Attendance Tab Content
  const renderAttendance = () => {
    if (attendanceLoading) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <ClipboardList className="w-16 h-16 text-blue-500 mx-auto animate-pulse" />
            <p className="mt-4 text-slate-500">Loading attendance insights...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <Users className="w-4 h-4" /> Total Trainers
              </div>
              <p className="text-2xl font-bold mt-1">{attendanceData?.summary?.total_trainers || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500" /> Compliance Rate
              </div>
              <p className={`text-2xl font-bold mt-1 ${getComplianceColor(attendanceData?.summary?.compliance_rate || 0)}`}>
                {attendanceData?.summary?.compliance_rate || 0}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Missed Days
              </div>
              <p className="text-2xl font-bold mt-1">{attendanceData?.summary?.total_missed || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <Calendar className="w-4 h-4" /> Period
              </div>
              <p className="text-lg font-bold mt-1">{attendanceData?.period || 'Last 30 days'}</p>
            </CardContent>
          </Card>
        </div>

        {/* Trainer Details */}
        {attendanceData?.trainers && attendanceData.trainers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Trainer Attendance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {attendanceData.trainers.map((trainer) => (
                  <div key={trainer.trainer_id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Users className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold">{trainer.trainer_name}</p>
                        <p className="text-xs text-slate-500">{trainer.batch_count} batches</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${getComplianceColor(trainer.compliance_rate)}`}>
                        {trainer.compliance_rate}%
                      </p>
                      <p className="text-xs text-slate-500">{trainer.missed_days} missed days</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  // Meta Analytics Tab Content
  const renderMetaAnalytics = () => {
    if (metaLoading) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Facebook className="w-16 h-16 text-blue-600 mx-auto animate-pulse" />
            <p className="mt-4 text-slate-500">Loading Meta analytics...</p>
          </div>
        </div>
      );
    }

    if (!metaAnalytics) {
      return (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h3 className="font-semibold text-lg">Meta Not Configured</h3>
            <p className="text-slate-600 mt-2">
              Please contact your Super Admin to configure Meta integration for your branch.
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Select value={metaDays} onValueChange={setMetaDays}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleMetaSync} disabled={metaSyncing} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${metaSyncing ? 'animate-spin' : ''}`} />
            Sync Data
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <Users className="w-4 h-4" /> Total Leads
              </div>
              <p className="text-2xl font-bold mt-1">{metaAnalytics?.total_leads || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <Eye className="w-4 h-4" /> Impressions
              </div>
              <p className="text-2xl font-bold mt-1">{metaAnalytics?.impressions?.toLocaleString() || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <MousePointer className="w-4 h-4" /> Clicks
              </div>
              <p className="text-2xl font-bold mt-1">{metaAnalytics?.clicks?.toLocaleString() || 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <DollarSign className="w-4 h-4" /> Spend
              </div>
              <p className="text-2xl font-bold mt-1">₹{metaAnalytics?.spend?.toLocaleString() || 0}</p>
            </CardContent>
          </Card>
        </div>

        {/* AI Insights */}
        {metaAnalytics?.ai_insights && (
          <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-600" /> AI Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 whitespace-pre-line">{metaAnalytics.ai_insights}</p>
            </CardContent>
          </Card>
        )}

        {/* Recent Leads */}
        {metaLeads && metaLeads.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Meta Leads</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {metaLeads.slice(0, 5).map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-medium">{lead.name}</p>
                      <p className="text-sm text-slate-500">{lead.number}</p>
                    </div>
                    <Badge variant="outline">{lead.campaign_name || 'Direct'}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6" data-testid="insights-page">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-indigo-500" />
          Insights & Analytics
        </h1>
        <p className="text-slate-500 mt-1">AI-powered analytics and insights for your branch</p>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-slate-100">
          <TabsTrigger value="branch" className="flex items-center gap-2" data-testid="branch-analytics-tab">
            <Brain className="w-4 h-4" />
            <span className="hidden sm:inline">Branch Analytics</span>
            <span className="sm:hidden">Branch</span>
          </TabsTrigger>
          <TabsTrigger value="efficiency" className="flex items-center gap-2" data-testid="efficiency-tab">
            <Zap className="w-4 h-4" />
            <span className="hidden sm:inline">User Efficiency</span>
            <span className="sm:hidden">Team</span>
          </TabsTrigger>
          <TabsTrigger value="attendance" className="flex items-center gap-2" data-testid="attendance-tab">
            <ClipboardList className="w-4 h-4" />
            <span className="hidden sm:inline">Attendance</span>
            <span className="sm:hidden">Attend</span>
          </TabsTrigger>
          <TabsTrigger value="meta" className="flex items-center gap-2" data-testid="meta-analytics-tab">
            <Facebook className="w-4 h-4" />
            <span className="hidden sm:inline">Meta Ads</span>
            <span className="sm:hidden">Meta</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branch" className="mt-6">
          {renderBranchAnalytics()}
        </TabsContent>

        <TabsContent value="efficiency" className="mt-6">
          {renderUserEfficiency()}
        </TabsContent>

        <TabsContent value="attendance" className="mt-6">
          {renderAttendance()}
        </TabsContent>

        <TabsContent value="meta" className="mt-6">
          {renderMetaAnalytics()}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InsightsPage;
