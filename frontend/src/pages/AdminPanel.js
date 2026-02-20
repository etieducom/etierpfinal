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
  
  const [branchForm, setBranchForm] = useState({ 
    name: '', 
    location: '', 
    address: '', 
    city: '', 
    state: '', 
    pincode: '',
    owner_name: '',
    owner_email: '',
    owner_phone: '',
    owner_designation: '',
    branch_phone: '',
    branch_email: ''
  });
  const [programForm, setProgramForm] = useState({ name: '', duration: '', fee: '', max_discount_percent: '' });
  const [userForm, setUserForm] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    role: 'Counsellor', 
    branch_id: '',
    phone: '',
    alternate_phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    date_of_birth: '',
    designation: '',
    photo_url: ''
  });
  const [editingBranch, setEditingBranch] = useState(null);
  const [editingProgram, setEditingProgram] = useState(null);

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
      if (editingBranch) {
        await adminAPI.updateBranch(editingBranch.id, branchForm);
        toast.success('Branch updated successfully');
      } else {
        await adminAPI.createBranch(branchForm);
        toast.success('Branch created successfully');
      }
      setBranchDialog(false);
      setBranchForm({ 
        name: '', location: '', address: '', city: '', state: '', pincode: '',
        owner_name: '', owner_email: '', owner_phone: '', owner_designation: '',
        branch_phone: '', branch_email: ''
      });
      setEditingBranch(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save branch');
    }
  };

  const handleDeleteBranch = async (id) => {
    if (!window.confirm('Are you sure you want to delete this branch?')) return;
    try {
      await adminAPI.deleteBranch(id);
      toast.success('Branch deleted successfully');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete branch');
    }
  };

  const handleCreateProgram = async (e) => {
    e.preventDefault();
    try {
      const programData = {
        ...programForm,
        fee: parseFloat(programForm.fee),
        max_discount_percent: parseFloat(programForm.max_discount_percent),
      };
      
      if (editingProgram) {
        await adminAPI.updateProgram(editingProgram.id, programData);
        toast.success('Program updated successfully');
      } else {
        await adminAPI.createProgram(programData);
        toast.success('Program created successfully');
      }
      setProgramDialog(false);
      setProgramForm({ name: '', duration: '', fee: '', max_discount_percent: '' });
      setEditingProgram(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save program');
    }
  };

  const handleDeleteProgram = async (id) => {
    if (!window.confirm('Are you sure you want to delete this program?')) return;
    try {
      await adminAPI.deleteProgram(id);
      toast.success('Program deleted successfully');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete program');
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await adminAPI.deleteUser(id);
      toast.success('User deleted successfully');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete user');
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building className="w-5 h-5 text-slate-600" />
                      <CardTitle className="text-lg">{branch.name}</CardTitle>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingBranch(branch);
                          setBranchForm({
                            name: branch.name,
                            location: branch.location,
                            address: branch.address || '',
                            city: branch.city || '',
                            state: branch.state || '',
                            pincode: branch.pincode || '',
                            owner_name: branch.owner_name || '',
                            owner_email: branch.owner_email || '',
                            owner_phone: branch.owner_phone || '',
                            owner_designation: branch.owner_designation || '',
                            branch_phone: branch.branch_phone || '',
                            branch_email: branch.branch_email || ''
                          });
                          setBranchDialog(true);
                        }}
                        className="h-8 w-8 p-0"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteBranch(branch.id)}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </Button>
                    </div>
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-slate-600" />
                      <CardTitle className="text-lg">{program.name}</CardTitle>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingProgram(program);
                          setProgramForm({
                            name: program.name,
                            duration: program.duration,
                            fee: program.fee.toString(),
                            max_discount_percent: program.max_discount_percent.toString()
                          });
                          setProgramDialog(true);
                        }}
                        className="h-8 w-8 p-0"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteProgram(program.id)}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </Button>
                    </div>
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
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Actions</th>
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
                    <td className="px-6 py-4 text-sm">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </Button>
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
            <DialogTitle>{editingBranch ? 'Edit Branch' : 'Add New Branch'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateBranch} className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="text-sm font-semibold text-slate-700 mb-2">Branch Information</div>
            <div className="grid grid-cols-2 gap-4">
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
                  placeholder="Andheri West"
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Address *</Label>
              <Input
                value={branchForm.address}
                onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                placeholder="Building Name, Street"
                required
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>City *</Label>
                <Input
                  value={branchForm.city}
                  onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })}
                  placeholder="Mumbai"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>State *</Label>
                <Input
                  value={branchForm.state}
                  onChange={(e) => setBranchForm({ ...branchForm, state: e.target.value })}
                  placeholder="Maharashtra"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Pincode *</Label>
                <Input
                  value={branchForm.pincode}
                  onChange={(e) => setBranchForm({ ...branchForm, pincode: e.target.value })}
                  placeholder="400058"
                  required
                />
              </div>
            </div>

            <div className="text-sm font-semibold text-slate-700 mt-4 mb-2">Branch Contact</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Branch Phone *</Label>
                <Input
                  value={branchForm.branch_phone}
                  onChange={(e) => setBranchForm({ ...branchForm, branch_phone: e.target.value })}
                  placeholder="+91 9876543210"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Branch Email *</Label>
                <Input
                  type="email"
                  value={branchForm.branch_email}
                  onChange={(e) => setBranchForm({ ...branchForm, branch_email: e.target.value })}
                  placeholder="[email protected]"
                  required
                />
              </div>
            </div>

            <div className="text-sm font-semibold text-slate-700 mt-4 mb-2">Branch Owner Details</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Owner Name *</Label>
                <Input
                  value={branchForm.owner_name}
                  onChange={(e) => setBranchForm({ ...branchForm, owner_name: e.target.value })}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Owner Designation *</Label>
                <Input
                  value={branchForm.owner_designation}
                  onChange={(e) => setBranchForm({ ...branchForm, owner_designation: e.target.value })}
                  placeholder="Branch Manager"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Owner Email *</Label>
                <Input
                  type="email"
                  value={branchForm.owner_email}
                  onChange={(e) => setBranchForm({ ...branchForm, owner_email: e.target.value })}
                  placeholder="[email protected]"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Owner Phone *</Label>
                <Input
                  value={branchForm.owner_phone}
                  onChange={(e) => setBranchForm({ ...branchForm, owner_phone: e.target.value })}
                  placeholder="+91 9876543210"
                  required
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => {
                setBranchDialog(false);
                setEditingBranch(null);
                setBranchForm({ 
                  name: '', location: '', address: '', city: '', state: '', pincode: '',
                  owner_name: '', owner_email: '', owner_phone: '', owner_designation: '',
                  branch_phone: '', branch_email: ''
                });
              }}>Cancel</Button>
              <Button type="submit" className="bg-slate-900 hover:bg-slate-800">
                {editingBranch ? 'Update' : 'Create'} Branch
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Program Dialog */}
      <Dialog open={programDialog} onOpenChange={setProgramDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProgram ? 'Edit Program' : 'Add New Program'}</DialogTitle>
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
              <Button type="button" variant="outline" onClick={() => {
                setProgramDialog(false);
                setEditingProgram(null);
                setProgramForm({ name: '', duration: '', fee: '', max_discount_percent: '' });
              }}>Cancel</Button>
              <Button type="submit" className="bg-slate-900 hover:bg-slate-800">
                {editingProgram ? 'Update' : 'Create'} Program
              </Button>
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
