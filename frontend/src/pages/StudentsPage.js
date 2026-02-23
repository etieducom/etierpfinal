import React, { useState, useEffect } from 'react';
import { studentsAPI, paymentAPI, enrollmentAPI } from '@/api/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Search, GraduationCap, User, Phone, Mail, CreditCard, Printer, XCircle, Eye, Wallet } from 'lucide-react';
import { format } from 'date-fns';

const PAYMENT_MODES = ['Cash', 'Card', 'UPI', 'Net Banking', 'Cheque'];

const StudentsPage = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [detailsDialog, setDetailsDialog] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentDetails, setStudentDetails] = useState(null);
  const [cancelDialog, setCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  
  // Payment dialog state
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [paymentPlan, setPaymentPlan] = useState(null);
  const [installments, setInstallments] = useState([]);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    payment_mode: 'Cash',
    payment_date: new Date().toISOString().split('T')[0],
    installment_number: '',
    remarks: ''
  });
  const [savingPayment, setSavingPayment] = useState(false);
  
  // Receipt dialog
  const [receiptDialog, setReceiptDialog] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isBranchAdmin = user.role === 'Branch Admin';
  const isFDE = user.role === 'Front Desk Executive';
  const canCancel = isBranchAdmin;
  const canPay = isBranchAdmin || isFDE || user.role === 'Admin';

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

  const openPaymentDialog = async (student) => {
    setSelectedStudent(student);
    try {
      // Fetch payment plan and installments
      const planRes = await enrollmentAPI.getPaymentPlan(student.id);
      setPaymentPlan(planRes.data);
      
      if (planRes.data?.installments) {
        // Get paid installments
        const paymentsRes = await enrollmentAPI.getEnrollmentPayments(student.id);
        const paidInstallments = paymentsRes.data
          .filter(p => p.installment_number)
          .map(p => p.installment_number);
        
        // Mark which installments are paid
        const installmentsWithStatus = planRes.data.installments.map(inst => ({
          ...inst,
          is_paid: paidInstallments.includes(inst.installment_number)
        }));
        setInstallments(installmentsWithStatus);
        
        // Auto-select first unpaid installment
        const firstUnpaid = installmentsWithStatus.find(i => !i.is_paid);
        if (firstUnpaid) {
          setPaymentForm(prev => ({
            ...prev,
            installment_number: firstUnpaid.installment_number.toString(),
            amount: firstUnpaid.amount.toString()
          }));
        }
      } else {
        setInstallments([]);
        // For one-time payment, set remaining amount
        const remaining = (student.final_fee || 0) - (student.total_paid || 0);
        setPaymentForm(prev => ({
          ...prev,
          amount: remaining > 0 ? remaining.toString() : '',
          installment_number: ''
        }));
      }
      
      setPaymentForm(prev => ({
        ...prev,
        payment_mode: 'Cash',
        payment_date: new Date().toISOString().split('T')[0],
        remarks: ''
      }));
      
      setPaymentDialog(true);
    } catch (error) {
      // No payment plan exists - need to create one first
      toast.error('Please create a payment plan first from Enrollments page');
    }
  };

  const handleInstallmentSelect = (installmentNum) => {
    const inst = installments.find(i => i.installment_number === parseInt(installmentNum));
    if (inst) {
      setPaymentForm(prev => ({
        ...prev,
        installment_number: installmentNum,
        amount: inst.amount.toString()
      }));
    }
  };

  const handleRecordPayment = async () => {
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    const totalFee = selectedStudent?.final_fee || 0;
    const totalPaid = selectedStudent?.total_paid || 0;
    const remainingAmount = totalFee - totalPaid;
    const paymentAmount = parseFloat(paymentForm.amount);
    
    if (paymentAmount > remainingAmount) {
      toast.error(`Payment amount (₹${paymentAmount.toLocaleString()}) cannot exceed pending fee (₹${remainingAmount.toLocaleString()})`);
      return;
    }
    
    setSavingPayment(true);
    try {
      const paymentRes = await paymentAPI.createPayment({
        enrollment_id: selectedStudent.id,
        payment_plan_id: paymentPlan?.id,
        amount: paymentAmount,
        payment_mode: paymentForm.payment_mode,
        payment_date: paymentForm.payment_date,
        installment_number: paymentForm.installment_number ? parseInt(paymentForm.installment_number) : null,
        remarks: paymentForm.remarks
      });
      
      toast.success('Payment recorded successfully!');
      setPaymentDialog(false);
      
      // Show receipt
      try {
        const receiptRes = await paymentAPI.generateReceipt(paymentRes.data.id);
        setReceiptData(receiptRes.data);
        setReceiptDialog(true);
      } catch {
        // Receipt generation failed, but payment was successful
      }
      
      fetchStudents();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to record payment');
    } finally {
      setSavingPayment(false);
    }
  };

  const handlePrintReceipt = () => {
    const printWindow = window.open('', '', 'height=1000,width=800');
    const logoUrl = 'https://etieducom.com/wp-content/uploads/2024/03/eti-educom-logo.png';
    
    const nextDueDate = new Date();
    nextDueDate.setMonth(nextDueDate.getMonth() + 1);
    nextDueDate.setDate(10);
    const dueDateStr = nextDueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    
    const pendingAmount = (receiptData?.total_fee || 0) - (receiptData?.total_paid || 0);
    const paymentDateStr = receiptData?.payment_date ? new Date(receiptData.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
    
    const termsAndConditions = [
      'Fee once paid is non-refundable and non-transferable.',
      'This receipt is valid only if accompanied by official payment confirmation.',
      'Students must maintain 75% attendance to be eligible for certification.',
      'Course duration and schedule are subject to change with prior notice.',
      'ETI Educom reserves the right to modify course content as per industry requirements.',
      'In case of cheque bounce, a penalty of ₹500 will be applicable.',
      'For any queries, please contact our support team within 7 days of payment.'
    ];
    
    const cssStyles = `
      @page { size: A4; margin: 15mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Segoe UI', 'Arial', sans-serif; font-size: 12px; line-height: 1.6; color: #1a202c; background: white; }
      .receipt { max-width: 100%; margin: 0 auto; padding: 30px; border: 3px solid #1a365d; min-height: calc(100vh - 30mm); display: flex; flex-direction: column; }
      
      .header { display: flex; align-items: center; border-bottom: 3px solid #1a365d; padding-bottom: 20px; margin-bottom: 20px; }
      .logo-section { width: 100px; margin-right: 20px; }
      .logo { width: 90px; height: auto; }
      .institute-info { flex: 1; }
      .institute-info h1 { font-size: 32px; color: #1a365d; letter-spacing: 4px; margin-bottom: 5px; }
      .institute-info .tagline { font-size: 14px; color: #4a5568; font-style: italic; }
      .institute-info .address { font-size: 12px; color: #718096; margin-top: 5px; }
      
      .receipt-title { text-align: center; background: linear-gradient(135deg, #1a365d 0%, #2c5282 100%); color: white; padding: 15px 30px; margin-bottom: 25px; border-radius: 8px; }
      .receipt-title h2 { font-size: 24px; letter-spacing: 4px; font-weight: 600; margin: 0; }
      
      .receipt-meta { display: flex; justify-content: space-between; background: #f7fafc; padding: 15px 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e2e8f0; }
      .receipt-meta p { font-size: 13px; margin: 4px 0; }
      
      .section { margin-bottom: 20px; }
      .section h3 { font-size: 14px; color: #1a365d; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 2px; }
      
      .info-table { width: 100%; border-collapse: collapse; }
      .info-table td { padding: 12px 15px; border: 1px solid #e2e8f0; }
      .info-table .label { background: #f7fafc; color: #4a5568; font-size: 12px; width: 25%; font-weight: 600; }
      .info-table .value { font-weight: 600; color: #1a202c; font-size: 14px; }
      
      .fee-section { border: 3px solid #1a365d; border-radius: 8px; overflow: hidden; margin-bottom: 20px; }
      .fee-section h3 { background: #1a365d; color: white; padding: 12px 20px; margin: 0; border: none; font-size: 16px; }
      .fee-table { width: 100%; border-collapse: collapse; }
      .fee-table td { padding: 14px 20px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
      .fee-table .label { color: #4a5568; width: 60%; }
      .fee-table .amount { text-align: right; font-weight: 700; font-size: 16px; }
      .fee-table .highlight-row { background: #c6f6d5; }
      .fee-table .highlight-row .amount { color: #22543d; font-size: 20px; }
      .fee-table .pending-row { background: #fed7d7; }
      .fee-table .pending-row td { color: #c53030; font-weight: bold; }
      .fee-table .paid-row { background: #c6f6d5; }
      .fee-table .paid-row td { color: #22543d; font-weight: bold; }
      
      .payment-info { background: #f7fafc; padding: 15px 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid #e2e8f0; }
      .payment-info p { margin: 5px 0; font-size: 13px; }
      
      .terms-section { margin: 20px 0; padding: 15px 20px; background: #fffaf0; border: 2px solid #fbd38d; border-radius: 8px; }
      .terms-section h4 { font-size: 12px; color: #744210; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 2px; border-bottom: 1px solid #fbd38d; padding-bottom: 8px; }
      .terms-section ol { margin: 0; padding-left: 20px; }
      .terms-section li { font-size: 11px; color: #744210; margin-bottom: 6px; line-height: 1.5; }
      
      .signatures { display: flex; justify-content: space-between; margin-top: auto; padding-top: 40px; }
      .signature { text-align: center; width: 40%; }
      .sign-line { border-top: 2px solid #2d3748; margin-bottom: 10px; width: 100%; }
      .signature p { font-size: 12px; color: #4a5568; margin: 0; }
      .signature small { font-size: 10px; color: #718096; }
      
      .footer { text-align: center; margin-top: 30px; padding-top: 15px; border-top: 2px dashed #cbd5e0; }
      .footer p { font-size: 12px; color: #4a5568; margin: 3px 0; }
      .footer .small { font-size: 10px; color: #a0aec0; }
      
      @media print { 
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .receipt { border-color: #000; }
      }
    `;
    
    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Fee Receipt - ETI Educom</title>
        <meta charset="UTF-8">
        <style>${cssStyles}</style>
      </head>
      <body>
        <div class="receipt">
          <!-- Header -->
          <div class="header">
            <div class="logo-section">
              <img src="${logoUrl}" alt="ETI Educom" class="logo" onerror="this.style.display='none'"/>
            </div>
            <div class="institute-info">
              <h1>ETI EDUCOM</h1>
              <p class="tagline">Professional Training & Skill Development</p>
              <p class="address">${receiptData?.branch_name || 'ETI Educom'}</p>
            </div>
          </div>
          
          <!-- Receipt Title -->
          <div class="receipt-title">
            <h2>FEE RECEIPT</h2>
          </div>
          
          <!-- Receipt Meta -->
          <div class="receipt-meta">
            <div>
              <p><strong>Receipt No:</strong> ${receiptData?.receipt_number || 'N/A'}</p>
              <p><strong>Enrollment ID:</strong> ${receiptData?.enrollment_id || 'N/A'}</p>
            </div>
            <div style="text-align: right;">
              <p><strong>Date:</strong> ${paymentDateStr}</p>
            </div>
          </div>
          
          <!-- Student Details -->
          <div class="section">
            <h3>Student Information</h3>
            <table class="info-table">
              <tr>
                <td class="label">Student Name</td>
                <td class="value" colspan="3">${receiptData?.student_name || ''}</td>
              </tr>
              <tr>
                <td class="label">Phone</td>
                <td class="value">${receiptData?.phone || ''}</td>
                <td class="label">Email</td>
                <td class="value">${receiptData?.student_email || ''}</td>
              </tr>
              <tr>
                <td class="label">Course</td>
                <td class="value" colspan="3">${receiptData?.program_name || ''}</td>
              </tr>
            </table>
          </div>
          
          <!-- Fee Details -->
          <div class="fee-section">
            <h3>Fee Details</h3>
            <table class="fee-table">
              <tr>
                <td class="label">Total Course Fee</td>
                <td class="amount">₹${(receiptData?.total_fee || 0).toLocaleString('en-IN')}/-</td>
              </tr>
              <tr class="highlight-row">
                <td class="label">Amount Paid (This Receipt)</td>
                <td class="amount">₹${(receiptData?.amount || 0).toLocaleString('en-IN')}/-</td>
              </tr>
              <tr>
                <td class="label">Total Amount Paid (Till Date)</td>
                <td class="amount">₹${(receiptData?.total_paid || 0).toLocaleString('en-IN')}/-</td>
              </tr>
              <tr class="${pendingAmount > 0 ? 'pending-row' : 'paid-row'}">
                <td class="label">Balance Amount</td>
                <td class="amount">${pendingAmount > 0 ? '₹' + pendingAmount.toLocaleString('en-IN') + '/-' : 'NIL'}</td>
              </tr>
              ${pendingAmount > 0 ? `
              <tr>
                <td class="label">Next Due Date</td>
                <td class="amount">${dueDateStr}</td>
              </tr>
              ` : ''}
            </table>
          </div>
          
          <!-- Payment Info -->
          <div class="payment-info">
            <p><strong>Payment Mode:</strong> ${receiptData?.payment_mode || ''}</p>
            ${receiptData?.remarks ? `<p><strong>Remarks:</strong> ${receiptData.remarks}</p>` : ''}
          </div>
          
          <!-- Terms & Conditions -->
          <div class="terms-section">
            <h4>Terms & Conditions</h4>
            <ol>
              ${termsAndConditions.map(term => `<li>${term}</li>`).join('')}
            </ol>
          </div>
          
          <!-- Signatures -->
          <div class="signatures">
            <div class="signature">
              <div class="sign-line"></div>
              <p>Student Signature</p>
            </div>
            <div class="signature">
              <div class="sign-line"></div>
              <p>Authorized Signatory</p>
              <small>ETI Educom</small>
            </div>
          </div>
          
          <!-- Footer -->
          <div class="footer">
            <p>Thank you for choosing ETI Educom!</p>
            <p class="small">This is a computer generated receipt.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    printWindow.document.write(receiptHTML);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
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
          <p className="text-slate-600">View enrolled students and manage fee payments</p>
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
                      <div className="flex items-center gap-1">
                        {/* Pay Fee Button */}
                        {canPay && (student.total_paid || 0) < (student.final_fee || 0) && (
                          <Button
                            variant="default"
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => openPaymentDialog(student)}
                            data-testid={`pay-fee-${student.id}`}
                          >
                            <Wallet className="w-4 h-4 mr-1" />
                            Pay Fee
                          </Button>
                        )}
                        {/* View Details Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => viewDetails(student)}
                          data-testid={`view-student-${student.id}`}
                        >
                          <Eye className="w-4 h-4 text-blue-500" />
                        </Button>
                      </div>
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

      {/* Payment Dialog */}
      <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-green-600" />
              Record Fee Payment
            </DialogTitle>
          </DialogHeader>
          
          {selectedStudent && (
            <div className="space-y-4">
              {/* Student Info */}
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="font-medium">{selectedStudent.student_name}</p>
                <p className="text-sm text-slate-500">{selectedStudent.enrollment_id}</p>
                <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-200">
                  <div>
                    <p className="text-xs text-slate-500">Total Fee</p>
                    <p className="font-bold text-slate-800">₹{(selectedStudent.final_fee || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Paid</p>
                    <p className="font-bold text-green-600">₹{(selectedStudent.total_paid || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Pending</p>
                    <p className="font-bold text-amber-600">₹{((selectedStudent.final_fee || 0) - (selectedStudent.total_paid || 0)).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Installment Selection (if installment plan) */}
              {installments.length > 0 && (
                <div className="space-y-2">
                  <Label>Select Installment</Label>
                  <Select 
                    value={paymentForm.installment_number} 
                    onValueChange={handleInstallmentSelect}
                  >
                    <SelectTrigger data-testid="installment-select">
                      <SelectValue placeholder="Choose installment" />
                    </SelectTrigger>
                    <SelectContent>
                      {installments.map((inst) => (
                        <SelectItem 
                          key={inst.installment_number} 
                          value={inst.installment_number.toString()}
                          disabled={inst.is_paid}
                        >
                          <div className="flex items-center justify-between w-full gap-4">
                            <span>Installment {inst.installment_number}</span>
                            <span className="font-semibold">₹{inst.amount.toLocaleString()}</span>
                            {inst.is_paid && <Badge className="bg-green-100 text-green-700 ml-2">Paid</Badge>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Amount */}
              <div className="space-y-2">
                <Label>Amount (₹) *</Label>
                <Input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  placeholder="Enter amount"
                  data-testid="payment-amount"
                />
                <p className="text-xs text-slate-500">
                  Max: ₹{((selectedStudent.final_fee || 0) - (selectedStudent.total_paid || 0)).toLocaleString()}
                </p>
              </div>

              {/* Payment Mode */}
              <div className="space-y-2">
                <Label>Payment Mode *</Label>
                <Select 
                  value={paymentForm.payment_mode} 
                  onValueChange={(v) => setPaymentForm({ ...paymentForm, payment_mode: v })}
                >
                  <SelectTrigger data-testid="payment-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map((mode) => (
                      <SelectItem key={mode} value={mode}>{mode}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Payment Date */}
              <div className="space-y-2">
                <Label>Payment Date *</Label>
                <Input
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                  data-testid="payment-date"
                />
              </div>

              {/* Remarks */}
              <div className="space-y-2">
                <Label>Remarks (Optional)</Label>
                <Input
                  value={paymentForm.remarks}
                  onChange={(e) => setPaymentForm({ ...paymentForm, remarks: e.target.value })}
                  placeholder="Any additional notes..."
                  data-testid="payment-remarks"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setPaymentDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleRecordPayment}
                  disabled={savingPayment}
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="save-payment-btn"
                >
                  {savingPayment ? 'Saving...' : 'Save Payment'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={receiptDialog} onOpenChange={setReceiptDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Payment Successful!</span>
              <Button onClick={handlePrintReceipt} className="bg-slate-900 hover:bg-slate-800" data-testid="print-receipt-btn">
                <Printer className="w-4 h-4 mr-2" /> Print Receipt
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          {receiptData && (
            <div className="space-y-4">
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <p className="text-sm text-green-600">Amount Received</p>
                <p className="text-3xl font-bold text-green-700">₹{receiptData.amount?.toLocaleString()}</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Receipt No:</span>
                  <span className="font-mono font-medium">{receiptData.receipt_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Student:</span>
                  <span className="font-medium">{receiptData.student_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Mode:</span>
                  <span>{receiptData.payment_mode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Paid:</span>
                  <span className="font-medium text-green-600">₹{receiptData.total_paid?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Pending:</span>
                  <span className="font-medium text-amber-600">
                    ₹{((receiptData.total_fee || 0) - (receiptData.total_paid || 0)).toLocaleString()}
                  </span>
                </div>
              </div>
              <Button 
                variant="outline" 
                className="w-full" 
                onClick={() => setReceiptDialog(false)}
              >
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
