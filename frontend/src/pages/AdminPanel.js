import React, { useState, useEffect } from 'react';
import { adminAPI } from '@/api/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Building, Users, BookOpen } from 'lucide-react';

const AdminPanel = () => {
  const [branches, setBranches] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [users, setUsers] = useState([]);
  const [branchDialog, setBranchDialog] = useState(false);
  const [programDialog, setProgramDialog] = useState(false);
  const [userDialog, setUserDialog] = useState(false);
  
  const [branchForm, setBranchForm] = useState({ name: '', location: '' });
  const [programForm, setProgramForm] = useState({ name: '', duration: '', fee: '', max_discount_percent: '' });
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'Counsellor', branch_id: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [branchRes, programRes, userRes] = await Promise.all([
        adminAPI.getBranches(),
        adminAPI.getPrograms(),
        adminAPI.getUsers(),
      ]);
      setBranches(branchRes.data);
      setPrograms(programRes.data);
      setUsers(userRes.data);
    } catch (error) {
      toast.error('Failed to fetch data');
    }
  };

  const handleCreateBranch = async (e) => {
    e.preventDefault();
    try {
      await adminAPI.createBranch(branchForm);
      toast.success('Branch created successfully');
      setBranchDialog(false);
      setBranchForm({ name: '', location: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create branch');
    }
  };

  const handleCreateProgram = async (e) => {
    e.preventDefault();
    try {
      await adminAPI.createProgram({
        ...programForm,
        fee: parseFloat(programForm.fee),
        max_discount_percent: parseFloat(programForm.max_discount_percent),
      });
      toast.success('Program created successfully');
      setProgramDialog(false);
      setProgramForm({ name: '', duration: '', fee: '', max_discount_percent: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create program');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await adminAPI.createUser(userForm);
      toast.success('User created successfully');
      setUserDialog(false);
      setUserForm({ name: '', email: '', password: '', role: 'Counsellor', branch_id: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create user');
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-panel">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-2">Admin Panel</h1>
        <p className="text-slate-600">Manage branches, programs, and users</p>
      </div>

      <Tabs defaultValue="branches" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="branches">Branches</TabsTrigger>
          <TabsTrigger value="programs">Programs</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="branches" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Branches</h2>
            <Button onClick={() => setBranchDialog(true)} className="bg-slate-900 hover:bg-slate-800">
              <Plus className="w-4 h-4 mr-2" /> Add Branch
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {branches.map((branch) => (
              <Card key={branch.id} className="border-slate-200 shadow-soft">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Building className="w-5 h-5 text-slate-600" />
                    <CardTitle className="text-lg">{branch.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600">{branch.location}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="programs" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Programs</h2>
            <Button onClick={() => setProgramDialog(true)} className="bg-slate-900 hover:bg-slate-800">
              <Plus className="w-4 h-4 mr-2" /> Add Program
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {programs.map((program) => (
              <Card key={program.id} className="border-slate-200 shadow-soft">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-slate-600" />
                    <CardTitle className="text-lg">{program.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Duration:</span>
                    <span className="font-semibold">{program.duration}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Fee:</span>
                    <span className="font-semibold">₹{program.fee.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Max Discount:</span>
                    <span className="font-semibold">{program.max_discount_percent}%</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Users</h2>
            <Button onClick={() => setUserDialog(true)} className="bg-slate-900 hover:bg-slate-800">
              <Plus className="w-4 h-4 mr-2" /> Add User
            </Button>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-xl shadow-soft overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Branch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm font-medium">{user.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{user.email}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800">
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {branches.find(b => b.id === user.branch_id)?.name || 'All'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Branch Dialog */}
      <Dialog open={branchDialog} onOpenChange={setBranchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Branch</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateBranch} className="space-y-4">
            <div className="space-y-2">
              <Label>Branch Name *</Label>
              <Input
                value={branchForm.name}
                onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                placeholder="Mumbai Branch"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Location *</Label>
              <Input
                value={branchForm.location}
                onChange={(e) => setBranchForm({ ...branchForm, location: e.target.value })}
                placeholder="Andheri, Mumbai"
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setBranchDialog(false)}>Cancel</Button>
              <Button type="submit" className="bg-slate-900 hover:bg-slate-800">Create Branch</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Program Dialog */}
      <Dialog open={programDialog} onOpenChange={setProgramDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Program</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProgram} className="space-y-4">
            <div className="space-y-2">
              <Label>Program Name *</Label>
              <Input
                value={programForm.name}
                onChange={(e) => setProgramForm({ ...programForm, name: e.target.value })}
                placeholder="Data Science"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Duration *</Label>
              <Input
                value={programForm.duration}
                onChange={(e) => setProgramForm({ ...programForm, duration: e.target.value })}
                placeholder="6 months"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Fee (₹) *</Label>
              <Input
                type="number"
                value={programForm.fee}
                onChange={(e) => setProgramForm({ ...programForm, fee: e.target.value })}
                placeholder="50000"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Max Discount (%) *</Label>
              <Input
                type="number"
                value={programForm.max_discount_percent}
                onChange={(e) => setProgramForm({ ...programForm, max_discount_percent: e.target.value })}
                placeholder="20"
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setProgramDialog(false)}>Cancel</Button>
              <Button type="submit" className="bg-slate-900 hover:bg-slate-800">Create Program</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* User Dialog */}
      <Dialog open={userDialog} onOpenChange={setUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={userForm.name}
                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                placeholder="John Doe"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                placeholder="[email protected]"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Password *</Label>
              <Input
                type="password"
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                placeholder="••••••••"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={userForm.role} onValueChange={(value) => setUserForm({ ...userForm, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Counsellor">Counsellor</SelectItem>
                  <SelectItem value="Front Desk Executive">Front Desk Executive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Branch</Label>
              <Select value={userForm.branch_id} onValueChange={(value) => setUserForm({ ...userForm, branch_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setUserDialog(false)}>Cancel</Button>
              <Button type="submit" className="bg-slate-900 hover:bg-slate-800">Create User</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPanel;
