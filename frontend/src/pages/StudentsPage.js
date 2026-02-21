import React, { useState, useEffect } from 'react';
import { studentsAPI } from '@/api/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Search, GraduationCap, User, Phone, Mail, CreditCard, Printer, XCircle, Eye } from 'lucide-react';
import { format } from 'date-fns';

const StudentsPage = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [detailsDialog, setDetailsDialog] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentDetails, setStudentDetails] = useState(null);
  const [cancelDialog, setCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isBranchAdmin = user.role === 'Branch Admin';
  const canCancel = isBranchAdmin;

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const response = await studentsAPI.getAll();
      setStudents(response.data);
    } catch (error) {
      toast.error('Failed to fetch students');
    } finally {
      setLoading(false);
    }
  };

  const viewDetails = async (student) => {
    setSelectedStudent(student);
    try {
      const response = await studentsAPI.getDetails(student.id);
      setStudentDetails(response.data);
      setDetailsDialog(true);
    } catch (error) {
      toast.error('Failed to fetch student details');
    }
  };

  const handleCancelEnrollment = async () => {
    if (!selectedStudent) return;
    
    try {
      await studentsAPI.cancelEnrollment(selectedStudent.id, cancelReason);
      toast.success('Enrollment cancelled successfully');
      setCancelDialog(false);
      setCancelReason('');
      setDetailsDialog(false);
      fetchStudents();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel enrollment');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredStudents = students.filter(s => 
    s.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.enrollment_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.phone?.includes(searchTerm) ||
    s.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Active': return <Badge className="bg-green-100 text-green-700">Active</Badge>;
      case 'Completed': return <Badge className="bg-blue-100 text-blue-700">Completed</Badge>;
      case 'Cancelled': return <Badge className="bg-red-100 text-red-700">Cancelled</Badge>;
      case 'Dropped': return <Badge className="bg-orange-100 text-orange-700">Dropped</Badge>;
      default: return <Badge>{status || 'Active'}</Badge>;
    }
  };

  const getPaymentStatus = (paid, total) => {
    if (paid >= total) return <Badge className="bg-green-100 text-green-700">Paid</Badge>;
    if (paid > 0) return <Badge className="bg-yellow-100 text-yellow-700">Partial</Badge>;
    return <Badge className="bg-red-100 text-red-700">Pending</Badge>;
  };

  return (
    <div className="space-y-6" data-testid="students-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Students</h1>
          <p className="text-slate-600">View enrolled students and their details</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-soft">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-blue-600" />
              <span className="text-sm text-slate-600">Total Students</span>
            </div>
            <p className="text-2xl font-bold mt-1">{students.length}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-soft">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-green-600" />
              <span className="text-sm text-slate-600">Total Revenue</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              ₹{students.reduce((sum, s) => sum + (s.total_paid || 0), 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-soft">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-orange-600" />
              <span className="text-sm text-slate-600">Pending Amount</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              ₹{students.reduce((sum, s) => sum + (s.pending_amount || 0), 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-soft">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-purple-600" />
              <span className="text-sm text-slate-600">Active Students</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {students.filter(s => s.status === 'Active' || !s.status).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search by name, ID, phone, or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
          data-testid="search-students"
        />
      </div>

      {/* Students Table */}
      <Card className="border-slate-200 shadow-soft">
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Enrollment ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Student</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Program</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Paid / Total</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50" data-testid={`student-row-${student.id}`}>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-medium text-blue-600">
                        {student.enrollment_id || student.id?.slice(0, 8).toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{student.student_name}</p>
                      <p className="text-xs text-slate-500">{student.email}</p>
                    </td>
                    <td className="px-4 py-3 text-sm">{student.phone}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{student.program_name}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-green-600">₹{(student.total_paid || 0).toLocaleString()}</span>
                        <span className="text-xs text-slate-500">of ₹{(student.final_fee || 0).toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {getStatusBadge(student.status)}
                        {getPaymentStatus(student.total_paid || 0, student.final_fee || 0)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => viewDetails(student)}
                        data-testid={`view-student-${student.id}`}
                      >
                        <Eye className="w-4 h-4 text-blue-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredStudents.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                {loading ? 'Loading...' : 'No students found'}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Student Details Dialog */}
      <Dialog open={detailsDialog} onOpenChange={setDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto print:max-w-full print:max-h-full">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Student Details</span>
              <div className="flex gap-2 print:hidden">
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="w-4 h-4 mr-2" /> Print
                </Button>
                {canCancel && studentDetails?.enrollment?.status !== 'Cancelled' && (
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => setCancelDialog(true)}
                    data-testid="cancel-enrollment-btn"
                  >
                    <XCircle className="w-4 h-4 mr-2" /> Cancel Enrollment
                  </Button>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          
          {studentDetails && (
            <div className="space-y-6 print:space-y-4">
              {/* Header */}
              <div className="text-center border-b pb-4">
                <h2 className="text-2xl font-bold">ETI Educom</h2>
                <p className="text-slate-600">Student Enrollment Certificate</p>
              </div>

              {/* Enrollment ID */}
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <p className="text-sm text-blue-600">Enrollment ID</p>
                <p className="text-2xl font-bold font-mono">
                  {studentDetails.enrollment?.enrollment_id || studentDetails.enrollment?.id?.slice(0, 8).toUpperCase()}
                </p>
              </div>

              {/* Personal Details */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="w-5 h-5" /> Personal Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-slate-500">Name</p>
                      <p className="font-medium">{studentDetails.enrollment?.student_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Email</p>
                      <p className="font-medium">{studentDetails.enrollment?.email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Phone</p>
                      <p className="font-medium">{studentDetails.enrollment?.phone}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Date of Birth</p>
                      <p className="font-medium">{studentDetails.enrollment?.date_of_birth || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Gender</p>
                      <p className="font-medium">{studentDetails.enrollment?.gender || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Address</p>
                      <p className="font-medium">{studentDetails.enrollment?.address || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">City</p>
                      <p className="font-medium">{studentDetails.enrollment?.city || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">State</p>
                      <p className="font-medium">{studentDetails.enrollment?.state || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Pincode</p>
                      <p className="font-medium">{studentDetails.enrollment?.pincode || '-'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Program Details */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <GraduationCap className="w-5 h-5" /> Program Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-slate-500">Program</p>
                      <p className="font-medium">{studentDetails.enrollment?.program_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Enrollment Date</p>
                      <p className="font-medium">
                        {studentDetails.enrollment?.enrollment_date 
                          ? format(new Date(studentDetails.enrollment.enrollment_date), 'dd MMM yyyy')
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Branch</p>
                      <p className="font-medium">{studentDetails.branch?.name || '-'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Summary */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CreditCard className="w-5 h-5" /> Payment Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-sm text-slate-500">Fee Quoted</p>
                      <p className="text-xl font-bold">₹{(studentDetails.enrollment?.fee_quoted || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-sm text-slate-500">Discount</p>
                      <p className="text-xl font-bold">{studentDetails.enrollment?.discount_percent || 0}%</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg">
                      <p className="text-sm text-green-600">Total Paid</p>
                      <p className="text-xl font-bold text-green-600">₹{(studentDetails.total_paid || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-lg">
                      <p className="text-sm text-orange-600">Pending</p>
                      <p className="text-xl font-bold text-orange-600">₹{(studentDetails.pending_amount || 0).toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Payment History */}
                  {studentDetails.payments && studentDetails.payments.length > 0 && (
                    <div>
                      <p className="font-medium mb-2">Payment History</p>
                      <table className="w-full text-sm">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="px-3 py-2 text-left">Receipt #</th>
                            <th className="px-3 py-2 text-left">Date</th>
                            <th className="px-3 py-2 text-left">Amount</th>
                            <th className="px-3 py-2 text-left">Mode</th>
                          </tr>
                        </thead>
                        <tbody>
                          {studentDetails.payments.map((p, idx) => (
                            <tr key={idx} className="border-b">
                              <td className="px-3 py-2 font-mono">{p.receipt_number}</td>
                              <td className="px-3 py-2">
                                {p.payment_date ? format(new Date(p.payment_date), 'dd MMM yyyy') : '-'}
                              </td>
                              <td className="px-3 py-2 font-semibold text-green-600">₹{(p.amount || 0).toLocaleString()}</td>
                              <td className="px-3 py-2">{p.payment_mode}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Enrollment Dialog */}
      <Dialog open={cancelDialog} onOpenChange={setCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Enrollment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Are you sure you want to cancel this enrollment? This action cannot be undone.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason for cancellation</label>
              <textarea
                className="w-full min-h-20 px-3 py-2 border border-slate-200 rounded-md"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Enter reason for cancellation..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCancelDialog(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleCancelEnrollment}>
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentsPage;
