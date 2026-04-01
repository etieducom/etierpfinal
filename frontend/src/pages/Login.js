import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '@/api/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Calendar, Users, IndianRupee, GraduationCap, TrendingUp } from 'lucide-react';

const ETI_LOGO = 'https://customer-assets.emergentagent.com/job_4e0bdddc-c844-4374-a91a-dfbddecb14b1/artifacts/4ane8ulw_eti%20.png';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    session: '',
  });
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState('');
  const [sessionStats, setSessionStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const navigate = useNavigate();

  // Fetch available sessions on mount
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const response = await authAPI.getSessions();
        setSessions(response.data.sessions);
        setCurrentSession(response.data.current_session);
        setFormData(prev => ({ ...prev, session: response.data.current_session }));
      } catch (error) {
        console.error('Failed to fetch sessions:', error);
        // Fallback: generate sessions client-side
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        const currentSessionYear = currentMonth >= 4 ? currentYear : currentYear - 1;
        const fallbackSessions = [];
        for (let year = 2016; year <= currentSessionYear; year++) {
          fallbackSessions.push({
            value: String(year),
            label: `${year}-${String(year + 1).slice(2)}`
          });
        }
        setSessions(fallbackSessions);
        setCurrentSession(String(currentSessionYear));
        setFormData(prev => ({ ...prev, session: String(currentSessionYear) }));
      }
    };
    fetchSessions();
  }, []);

  // Fetch session stats when session changes
  useEffect(() => {
    const fetchSessionStats = async () => {
      if (!formData.session) return;
      setStatsLoading(true);
      try {
        const response = await authAPI.getSessionStats(formData.session);
        setSessionStats(response.data);
      } catch (error) {
        console.error('Failed to fetch session stats:', error);
        setSessionStats(null);
      } finally {
        setStatsLoading(false);
      }
    };
    fetchSessionStats();
  }, [formData.session]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await authAPI.login({
        username: formData.email,
        password: formData.password,
        session: formData.session,
      });
      localStorage.setItem('token', response.data.access_token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      localStorage.setItem('session', response.data.session);
      toast.success(`Welcome back! Session: ${formData.session}-${String(parseInt(formData.session) + 1).slice(2)}`);
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const getSessionLabel = (value) => {
    const session = sessions.find(s => s.value === value);
    return session ? session.label : value;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-4xl flex flex-col md:flex-row gap-6">
        {/* Session Stats Card */}
        <Card className="w-full md:w-1/2 shadow-2xl border-0 bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Session {formData.session ? `${formData.session}-${String(parseInt(formData.session) + 1).slice(2)}` : ''}
            </CardTitle>
            <CardDescription className="text-blue-100">
              April {formData.session} - March {parseInt(formData.session) + 1}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {statsLoading ? (
              <div className="text-center py-8 text-blue-100">Loading stats...</div>
            ) : sessionStats ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/10 rounded-xl p-4 backdrop-blur">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-blue-200" />
                    <span className="text-sm text-blue-200">Enquiries</span>
                  </div>
                  <p className="text-3xl font-bold">{sessionStats.total_enquiries || 0}</p>
                </div>
                <div className="bg-white/10 rounded-xl p-4 backdrop-blur">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-green-300" />
                    <span className="text-sm text-blue-200">Converted</span>
                  </div>
                  <p className="text-3xl font-bold">{sessionStats.converted || 0}</p>
                </div>
                <div className="bg-white/10 rounded-xl p-4 backdrop-blur">
                  <div className="flex items-center gap-2 mb-2">
                    <GraduationCap className="w-5 h-5 text-yellow-300" />
                    <span className="text-sm text-blue-200">Enrollments</span>
                  </div>
                  <p className="text-3xl font-bold">{sessionStats.total_enrollments || 0}</p>
                </div>
                <div className="bg-white/10 rounded-xl p-4 backdrop-blur">
                  <div className="flex items-center gap-2 mb-2">
                    <IndianRupee className="w-5 h-5 text-emerald-300" />
                    <span className="text-sm text-blue-200">Collections</span>
                  </div>
                  <p className="text-2xl font-bold">₹{((sessionStats.total_collections || 0) / 100000).toFixed(1)}L</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-blue-100">Select a session to view stats</div>
            )}
          </CardContent>
        </Card>

        {/* Login Card */}
        <Card className="w-full md:w-1/2 shadow-2xl border-0 bg-white/95 backdrop-blur">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              <img src={ETI_LOGO} alt="ETI Educom" className="h-20 object-contain" />
            </div>
            <CardTitle className="text-xl font-bold text-slate-900">Branch Management System</CardTitle>
            <CardDescription>Sign in to your account</CardDescription>
          </CardHeader>
          <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="auth-form">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                data-testid="email-input"
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                data-testid="password-input"
                type="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="session" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Academic Session
              </Label>
              <Select
                value={formData.session}
                onValueChange={(value) => setFormData({ ...formData, session: value })}
              >
                <SelectTrigger data-testid="session-select" className="w-full">
                  <SelectValue placeholder="Select session" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((session) => (
                    <SelectItem key={session.value} value={session.value}>
                      {session.label}
                      {session.value === currentSession && (
                        <span className="ml-2 text-xs text-green-600 font-medium">(Current)</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Session {getSessionLabel(formData.session)}: April {formData.session} - March {parseInt(formData.session) + 1}
              </p>
            </div>

            <Button
              type="submit"
              data-testid="submit-button"
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default Login;
