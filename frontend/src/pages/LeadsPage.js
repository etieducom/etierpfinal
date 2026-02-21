import React, { useState, useEffect } from 'react';
import { leadsAPI, leadSourceAPI, adminAPI } from '@/api/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Search, Edit, Trash2, MessageSquare, Badge } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const STATUS_COLORS = {
  'New': '#3B82F6',
  'Contacted': '#8B5CF6',
  'Demo Booked': '#F59E0B',
  'Follow-up': '#06B6D4',
  'Converted': '#10B981',
  'Lost': '#EF4444',
};

const STATUSES = ['New', 'Contacted', 'Demo Booked', 'Follow-up', 'Converted', 'Lost'];

const leadSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  number: z.string().min(10, 'Valid phone number required'),
  alternate_number: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  email: z.string().email('Valid email required'),
  fee_quoted: z.string().optional(),
  discount_percent: z.string().optional(),
  payment_plan: z.string().optional(),
  lead_source: z.string().min(1, 'Lead source is required'),
});

const LeadsPage = () => {
  const [leads, setLeads] = useState([]);
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [leadSources, setLeadSources] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [followupDialog, setFollowupDialog] = useState(false);
  const [followupLeadId, setFollowupLeadId] = useState(null);
  const [followupNote, setFollowupNote] = useState('');
  const [followupDate, setFollowupDate] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('');
  
  // Demo Booked dialog state
  const [demoDialog, setDemoDialog] = useState(false);
  const [demoLeadId, setDemoLeadId] = useState(null);
  const [demoForm, setDemoForm] = useState({
    demo_date: '',
    demo_time: '',
    trainer_name: ''
  });

  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(leadSchema),
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterLeads();
  }, [leads, searchTerm, statusFilter]);

  const fetchData = async () => {
    try {
      const [leadsRes, programsRes, sourcesRes] = await Promise.all([
        leadsAPI.getAll({}),
        adminAPI.getPrograms(),
        leadSourceAPI.getAll()
      ]);
      setLeads(leadsRes.data);
      setPrograms(programsRes.data);
      setLeadSources(sourcesRes.data);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const fetchLeads = async () => {
    try {
      const response = await leadsAPI.getAll({});
      setLeads(response.data);
    } catch (error) {
      toast.error('Failed to fetch leads');
    }
  };

  const filterLeads = () => {
    let filtered = leads;

    if (searchTerm) {
      filtered = filtered.filter(
        (lead) =>
          lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.number.includes(searchTerm)
      );
    }

    if (statusFilter !== 'All') {
      filtered = filtered.filter((lead) => lead.status === statusFilter);
    }

    setFilteredLeads(filtered);
  };

  const onSubmit = async (data) => {
    try {
      if (!selectedProgram && !editingLead) {
        toast.error('Please select a program');
        return;
      }

      const formattedData = {
        ...data,
        program_id: selectedProgram || data.program_id,
        fee_quoted: data.fee_quoted ? parseFloat(data.fee_quoted) : null,
        discount_percent: data.discount_percent ? parseFloat(data.discount_percent) : null,
      };

      if (editingLead) {
        await leadsAPI.update(editingLead.id, formattedData);
        toast.success('Lead updated successfully');
      } else {
        await leadsAPI.create(formattedData);
        toast.success('Lead created successfully! WhatsApp welcome message sent.');
      }

      setDialogOpen(false);
      setEditingLead(null);
      setSelectedProgram('');
      reset();
      fetchLeads();
    } catch (error) {
      console.error('Error saving lead:', error);
      toast.error(error.response?.data?.detail || 'Failed to save lead');
    }
  };

  const handleEdit = (lead) => {
    setEditingLead(lead);
    setSelectedProgram(lead.program_id);
    reset({
      ...lead,
      fee_quoted: lead.fee_quoted?.toString() || '',
      discount_percent: lead.discount_percent?.toString() || '',
    });
    setValue('lead_source', lead.lead_source);
    setDialogOpen(true);
  };

  const handleDelete = async (id, lead) => {
    // Only Super Admin or Branch Admin can delete leads
    // Counsellors and FDEs cannot delete leads
    const canDelete = user.role === 'Admin' || user.role === 'Branch Admin';
    
    if (!canDelete) {
      toast.error('Only Branch Admin can delete leads');
      return;
    }
    
    // Branch Admin can only delete leads from their branch
    if (user.role === 'Branch Admin' && lead.branch_id !== user.branch_id) {
      toast.error('You can only delete leads from your branch');
      return;
    }
    
    const reason = window.prompt('Please enter a reason for deleting this lead:');
    if (reason === null) return; // User cancelled

    try {
      await leadsAPI.delete(id, { reason });
      toast.success('Lead deleted successfully');
      fetchLeads();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete lead');
    }
  };

  const handleStatusChange = async (leadId, newStatus) => {
    // If changing to Demo Booked, show popup to collect demo details
    if (newStatus === 'Demo Booked') {
      setDemoLeadId(leadId);
      setDemoForm({ demo_date: '', demo_time: '', trainer_name: '' });
      setDemoDialog(true);
      return;
    }
    
    try {
      await leadsAPI.update(leadId, { status: newStatus });
      toast.success('Status updated! WhatsApp message sent.');
      fetchLeads();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleDemoBooking = async () => {
    if (!demoForm.demo_date || !demoForm.demo_time || !demoForm.trainer_name) {
      toast.error('Please fill all demo details');
      return;
    }
    
    try {
      await leadsAPI.update(demoLeadId, { 
        status: 'Demo Booked',
        demo_date: demoForm.demo_date,
        demo_time: demoForm.demo_time,
        trainer_name: demoForm.trainer_name
      });
      toast.success('Demo booked successfully! WhatsApp notification sent.');
      setDemoDialog(false);
      setDemoForm({ demo_date: '', demo_time: '', trainer_name: '' });
      fetchLeads();
    } catch (error) {
      toast.error('Failed to book demo');
    }
  };

  const handleAddFollowup = async () => {
    if (!followupNote.trim()) {
      toast.error('Please enter a followup note');
      return;
    }
    if (!followupDate) {
      toast.error('Please select a followup date');
      return;
    }

    try {
      const { followupAPI } = await import('@/api/api');
      await followupAPI.create({
        lead_id: followupLeadId,
        note: followupNote,
        followup_date: new Date(followupDate).toISOString(),
      });
      toast.success('Follow-up scheduled successfully');
      setFollowupDialog(false);
      setFollowupNote('');
      setFollowupDate('');
      fetchLeads();
    } catch (error) {
      console.error('Error adding followup:', error);
      toast.error('Failed to add follow-up');
    }
  };

  return (
    <div className="space-y-6" data-testid="leads-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Lead Management</h1>
          <p className="text-slate-600">Manage and track all your leads</p>
        </div>
        <Button
          onClick={() => {
            setEditingLead(null);
            reset({});
            setDialogOpen(true);
          }}
          className="bg-slate-900 hover:bg-slate-800"
          data-testid="add-lead-button"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Lead
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="search-input"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48" data-testid="status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All Statuses</SelectItem>
            {STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Leads Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Program
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Source
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredLeads.map((lead) => (
                <tr
                  key={lead.id}
                  className="hover:bg-slate-50 transition-colors"
                  data-testid={`lead-row-${lead.id}`}
                >
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-semibold text-slate-900">{lead.name}</p>
                      <p className="text-sm text-slate-500">{lead.city || 'N/A'}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm text-slate-900">{lead.number}</p>
                      <p className="text-sm text-slate-500">{lead.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-slate-900">{lead.program_name || programs.find(p => p.id === lead.program_id)?.name || 'N/A'}</p>
                    {lead.fee_quoted && (
                      <p className="text-sm text-slate-500">₹{lead.fee_quoted}</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-slate-900">{lead.lead_source}</p>
                  </td>
                  <td className="px-6 py-4">
                    <Select
                      value={lead.status}
                      onValueChange={(value) => handleStatusChange(lead.id, value)}
                    >
                      <SelectTrigger
                        className="w-36 h-8 text-xs font-semibold border-0"
                        style={{
                          backgroundColor: `${STATUS_COLORS[lead.status]}15`,
                          color: STATUS_COLORS[lead.status],
                        }}
                        data-testid={`status-select-${lead.id}`}
                      >
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
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFollowupLeadId(lead.id);
                          setFollowupDialog(true);
                        }}
                        data-testid={`followup-button-${lead.id}`}
                      >
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(lead)}
                        data-testid={`edit-button-${lead.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      {/* Only Super Admin or Branch Admin can see delete button */}
                      {(user.role === 'Admin' || user.role === 'Branch Admin') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(lead.id, lead)}
                          data-testid={`delete-button-${lead.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredLeads.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              {loading ? 'Loading leads...' : 'No leads found'}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Lead Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLead ? 'Edit Lead' : 'Add New Lead'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" data-testid="lead-form">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input {...register('name')} data-testid="lead-name-input" />
                {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" {...register('email')} data-testid="lead-email-input" />
                {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Phone Number *</Label>
                <Input {...register('number')} data-testid="lead-number-input" />
                {errors.number && <p className="text-xs text-red-500">{errors.number.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Alternate Number</Label>
                <Input {...register('alternate_number')} />
              </div>
              <div className="space-y-2">
                <Label>Program *</Label>
                <Select 
                  value={selectedProgram} 
                  onValueChange={setSelectedProgram}
                >
                  <SelectTrigger data-testid="lead-program-select">
                    <SelectValue placeholder="Select program" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((program) => (
                      <SelectItem key={program.id} value={program.id}>
                        {program.name} - ₹{program.fee.toLocaleString()} ({program.duration})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!selectedProgram && !editingLead && (
                  <p className="text-xs text-red-500">Program is required</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Lead Source *</Label>
                <Select onValueChange={(value) => setValue('lead_source', value)}>
                  <SelectTrigger data-testid="lead-source-select">
                    <SelectValue placeholder="Select lead source" />
                  </SelectTrigger>
                  <SelectContent>
                    {leadSources.map((source) => (
                      <SelectItem key={source.id} value={source.name}>
                        {source.name}
                      </SelectItem>
                    ))}
                    {leadSources.length === 0 && (
                      <SelectItem value="other" disabled>No sources configured</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {errors.lead_source && <p className="text-xs text-red-500">{errors.lead_source.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Fee Quoted (₹)</Label>
                <Input type="number" {...register('fee_quoted')} placeholder={programs.find(p => p.id === selectedProgram)?.fee || ''} />
              </div>
              <div className="space-y-2">
                <Label>Discount (%)</Label>
                <Input 
                  type="number" 
                  {...register('discount_percent')} 
                  placeholder={`Max: ${programs.find(p => p.id === selectedProgram)?.max_discount_percent || 0}%`}
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Plan</Label>
                <Input {...register('payment_plan')} />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input {...register('city')} />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input {...register('state')} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Address</Label>
                <Input {...register('address')} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setEditingLead(null);
                  reset();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-slate-900 hover:bg-slate-800" data-testid="save-lead-button">
                {editingLead ? 'Update' : 'Create'} Lead
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Followup Dialog */}
      <Dialog open={followupDialog} onOpenChange={setFollowupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Follow-up Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Note *</Label>
              <textarea
                className="w-full min-h-24 px-3 py-2 border border-slate-200 rounded-md"
                value={followupNote}
                onChange={(e) => setFollowupNote(e.target.value)}
                placeholder="Enter followup details..."
                data-testid="followup-note-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Follow-up Date & Time *</Label>
              <input
                type="datetime-local"
                value={followupDate}
                onChange={(e) => setFollowupDate(e.target.value)}
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                data-testid="followup-date-input"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setFollowupDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddFollowup}
                className="bg-slate-900 hover:bg-slate-800"
                data-testid="save-followup-button"
              >
                Add Follow-up
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Demo Booked Dialog */}
      <Dialog open={demoDialog} onOpenChange={setDemoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Book Demo Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Demo Date *</Label>
              <Input
                type="date"
                value={demoForm.demo_date}
                onChange={(e) => setDemoForm({...demoForm, demo_date: e.target.value})}
                data-testid="demo-date-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Demo Time *</Label>
              <Input
                type="time"
                value={demoForm.demo_time}
                onChange={(e) => setDemoForm({...demoForm, demo_time: e.target.value})}
                data-testid="demo-time-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Trainer Name *</Label>
              <Input
                value={demoForm.trainer_name}
                onChange={(e) => setDemoForm({...demoForm, trainer_name: e.target.value})}
                placeholder="Enter trainer name"
                data-testid="demo-trainer-input"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDemoDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleDemoBooking}
                className="bg-amber-600 hover:bg-amber-700"
                data-testid="confirm-demo-button"
              >
                Book Demo
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeadsPage;
