import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { FileText, Download, CheckCircle, XCircle, Eye, Edit, Clock, Award, QrCode } from 'lucide-react';
import { certificateAPI } from '@/api/api';
import QRCode from 'qrcode';
import Layout from '@/components/Layout';

// Use local assets to avoid CORS issues
const CERTIFICATE_BG_URL = '/assets/etibackground.png';
const ETI_LOGO_URL = '/assets/eti-logo.png';

const CertificateManagementPage = () => {
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get('status') || 'all';
  
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(initialStatus);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [editDialog, setEditDialog] = useState(false);
  const [viewDialog, setViewDialog] = useState(false);
  const [rejectDialog, setRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [editFormData, setEditFormData] = useState({});
  const canvasRef = useRef(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? { status: filter } : {};
      const response = await certificateAPI.getAll(params);
      setRequests(response.data);
    } catch (error) {
      toast.error('Failed to fetch certificate requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [filter]);

  const handleApprove = async (id) => {
    try {
      await certificateAPI.approve(id);
      toast.success('Certificate request approved');
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve');
    }
  };

  const handleReject = async () => {
    try {
      await certificateAPI.reject(selectedRequest.id, rejectReason);
      toast.success('Certificate request rejected');
      setRejectDialog(false);
      setRejectReason('');
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject');
    }
  };

  const handleUpdate = async () => {
    try {
      await certificateAPI.update(selectedRequest.id, editFormData);
      toast.success('Certificate request updated');
      setEditDialog(false);
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update');
    }
  };

  const handleDownload = async (request) => {
    try {
      const response = await certificateAPI.download(request.id);
      const certData = response.data;
      
      // Generate certificate PDF
      await generateCertificatePDF(certData);
      
      toast.success('Certificate downloaded and WhatsApp notification sent!');
      fetchRequests();
    } catch (error) {
      console.error('Download error:', error);
      toast.error(error.response?.data?.detail || 'Failed to download certificate');
    }
  };

  const generateCertificatePDF = async (certData) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      toast.error('Canvas not available');
      return;
    }
    
    const ctx = canvas.getContext('2d');
    
    // Set canvas size to match certificate dimensions (A4 landscape ratio)
    canvas.width = 2480;  // Higher resolution for print quality
    canvas.height = 1754;
    
    // Load background image
    const bgImage = new Image();
    await new Promise((resolve) => {
      bgImage.onload = resolve;
      bgImage.onerror = () => {
        console.warn('Background image failed to load');
        resolve();
      };
      bgImage.src = CERTIFICATE_BG_URL;
    });
    
    // Draw background
    if (bgImage.complete && bgImage.naturalWidth > 0) {
      ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
    } else {
      // Fallback - white background with blue accents
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Load ETI Logo
    const logoImage = new Image();
    await new Promise((resolve) => {
      logoImage.onload = resolve;
      logoImage.onerror = resolve;
      logoImage.src = ETI_LOGO_URL;
    });
    
    // Draw Logo centered at top
    if (logoImage.complete && logoImage.naturalWidth > 0) {
      const logoWidth = 200;
      const logoHeight = 80;
      ctx.drawImage(logoImage, (canvas.width - logoWidth) / 2, 100, logoWidth, logoHeight);
    }
    
    // ========== TITLE ==========
    ctx.textAlign = 'center';
    ctx.font = 'italic bold 72px "Times New Roman", Georgia, serif';
    ctx.fillStyle = '#1a365d';
    ctx.fillText('CERTIFICATE OF COMPLETION', canvas.width / 2, 280);
    
    // Decorative line under title
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2 - 400, 310);
    ctx.lineTo(canvas.width / 2 + 400, 310);
    ctx.stroke();
    
    // ========== BODY TEXT ==========
    // "This is to certify that"
    ctx.font = 'italic 32px "Times New Roman", Georgia, serif';
    ctx.fillStyle = '#333333';
    ctx.fillText('This is to certify that', canvas.width / 2, 400);
    
    // Student Name (bold, larger, golden color)
    ctx.font = 'bold 56px "Times New Roman", Georgia, serif';
    ctx.fillStyle = '#1a365d';
    ctx.fillText(certData.student_name.toUpperCase(), canvas.width / 2, 490);
    
    // Underline for student name
    const nameWidth = ctx.measureText(certData.student_name.toUpperCase()).width;
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo((canvas.width - nameWidth) / 2 - 20, 510);
    ctx.lineTo((canvas.width + nameWidth) / 2 + 20, 510);
    ctx.stroke();
    
    // "has successfully completed the professional training program"
    ctx.font = 'italic 28px "Times New Roman", Georgia, serif';
    ctx.fillStyle = '#333333';
    ctx.fillText('has successfully completed the professional training program', canvas.width / 2, 580);
    
    // Program Name (bold, blue)
    ctx.font = 'bold 42px "Times New Roman", Georgia, serif';
    ctx.fillStyle = '#1a365d';
    const programText = `ETI CERTIFIED – ${certData.program_name.toUpperCase()}`;
    ctx.fillText(programText, canvas.width / 2, 660);
    
    // Duration details
    ctx.font = '26px "Times New Roman", Georgia, serif';
    ctx.fillStyle = '#333333';
    // Extract branch city from branch_name
    const branchCity = certData.branch_name.includes('-') 
      ? certData.branch_name.split('-')[1].trim() 
      : certData.branch_name;
    const durationLine1 = `conducted by ETI Educom, ${branchCity}, Punjab, India, for a duration of ${certData.program_duration}`;
    ctx.fillText(durationLine1, canvas.width / 2, 730);
    
    const hoursText = `(${certData.training_hours || 120} Hours) in ${certData.training_mode} Mode.`;
    ctx.fillText(hoursText, canvas.width / 2, 770);
    
    // Participation text
    ctx.font = 'italic 24px "Times New Roman", Georgia, serif';
    ctx.fillStyle = '#444444';
    ctx.fillText('During the training, the candidate actively participated in all sessions, demonstrations,', canvas.width / 2, 840);
    ctx.fillText('and practical exercises. Their consistent efforts and enthusiasm throughout the program were commendable.', canvas.width / 2, 875);
    
    // Award text
    ctx.fillText('This certificate is awarded in recognition of their dedication, skill development, and successful', canvas.width / 2, 930);
    ctx.fillText('completion of the program requirements.', canvas.width / 2, 965);
    
    // ========== BOTTOM LEFT - Registration Details ==========
    ctx.textAlign = 'left';
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.fillStyle = '#1a365d';
    ctx.fillText(`Registration No.: ${certData.registration_number}`, 120, 1150);
    ctx.fillText(`Certificate ID: ${certData.certificate_id}`, 120, 1185);
    ctx.fillText(`Date of Issue: ${certData.issued_date}`, 120, 1220);
    
    // Verification ID with small QR label
    ctx.font = '18px Arial, sans-serif';
    ctx.fillStyle = '#666666';
    ctx.fillText('Verification ID (QR):', 120, 1260);
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.fillStyle = '#1a365d';
    ctx.fillText(certData.verification_id.substring(0, 16), 120, 1290);
    
    // Small QR code on bottom left
    try {
      const verifyUrl = `${window.location.origin}/verify/${certData.verification_id}`;
      const smallQrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 100, margin: 1 });
      
      const smallQrImage = new Image();
      await new Promise((resolve) => {
        smallQrImage.onload = resolve;
        smallQrImage.onerror = resolve;
        smallQrImage.src = smallQrDataUrl;
      });
      
      if (smallQrImage.complete && smallQrImage.naturalWidth > 0) {
        ctx.drawImage(smallQrImage, 320, 1230, 80, 80);
      }
    } catch (e) {
      console.warn('Small QR failed:', e);
    }
    
    // ========== BOTTOM CENTER - Decorative Element ==========
    // Red crosshair/target symbol
    ctx.strokeStyle = '#cc0000';
    ctx.lineWidth = 2;
    const centerX = canvas.width / 2;
    const centerY = 1250;
    // Circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, 25, 0, 2 * Math.PI);
    ctx.stroke();
    // Cross lines
    ctx.beginPath();
    ctx.moveTo(centerX - 35, centerY);
    ctx.lineTo(centerX + 35, centerY);
    ctx.moveTo(centerX, centerY - 35);
    ctx.lineTo(centerX, centerY + 35);
    ctx.stroke();
    
    // ========== BOTTOM RIGHT - Signature Section ==========
    ctx.textAlign = 'right';
    
    // Signature line
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(canvas.width - 350, 1180);
    ctx.lineTo(canvas.width - 120, 1180);
    ctx.stroke();
    
    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.fillStyle = '#1a365d';
    ctx.fillText('Authorized Signatory', canvas.width - 120, 1210);
    
    ctx.font = '20px Arial, sans-serif';
    ctx.fillStyle = '#333333';
    ctx.fillText('Academic Head', canvas.width - 120, 1240);
    ctx.fillText('ETI Educom', canvas.width - 120, 1270);
    
    // Large QR code on bottom right
    try {
      const verifyUrl = `${window.location.origin}/verify/${certData.verification_id}`;
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 150, margin: 1, color: { dark: '#1a365d' } });
      
      const qrImage = new Image();
      await new Promise((resolve) => {
        qrImage.onload = resolve;
        qrImage.onerror = resolve;
        qrImage.src = qrDataUrl;
      });
      
      if (qrImage.complete && qrImage.naturalWidth > 0) {
        ctx.drawImage(qrImage, canvas.width - 320, 1100, 130, 130);
      }
    } catch (qrError) {
      console.warn('QR code generation failed:', qrError);
    }
    
    // ========== FOOTER ==========
    ctx.textAlign = 'center';
    ctx.font = 'italic 18px "Times New Roman", Georgia, serif';
    ctx.fillStyle = '#555555';
    ctx.fillText("Issued in accordance with ETI Educom's documented Quality Management System (QMS) compliant with ISO 9001:2015.", canvas.width / 2, 1380);
    
    ctx.font = '14px Arial, sans-serif';
    ctx.fillStyle = '#777777';
    ctx.fillText('This certificate can be verified at www.etieducom.com/verify or by scanning the QR code. The authenticity of this document is', canvas.width / 2, 1420);
    ctx.fillText('guaranteed by ETI Educom. Any alteration or unauthorized reproduction of this certificate is strictly prohibited.', canvas.width / 2, 1445);
    
    // ========== DOWNLOAD ==========
    const link = document.createElement('a');
    link.download = `Certificate_${certData.certificate_id}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      Pending: { color: 'bg-amber-100 text-amber-700', icon: Clock },
      Approved: { color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
      Rejected: { color: 'bg-red-100 text-red-700', icon: XCircle },
      Ready: { color: 'bg-green-100 text-green-700', icon: Award }
    };
    const config = statusConfig[status] || statusConfig.Pending;
    const Icon = config.icon;
    
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {status}
      </Badge>
    );
  };

  const pendingCount = requests.filter(r => r.status === 'Pending').length;
  const approvedCount = requests.filter(r => r.status === 'Approved').length;
  const readyCount = requests.filter(r => r.status === 'Ready').length;

  return (
    <Layout>
      <div className="space-y-6" data-testid="certificate-management-page">
        {/* Hidden canvas for certificate generation */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Certificate Management</h1>
            <p className="text-slate-600">Review and manage student certificate requests</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-600 text-sm font-medium">Pending</p>
                  <p className="text-2xl font-bold text-amber-700">{pendingCount}</p>
                </div>
                <Clock className="w-8 h-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-600 text-sm font-medium">Approved</p>
                  <p className="text-2xl font-bold text-blue-700">{approvedCount}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-600 text-sm font-medium">Issued</p>
                  <p className="text-2xl font-bold text-green-700">{readyCount}</p>
                </div>
                <Award className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-sm font-medium">Total</p>
                  <p className="text-2xl font-bold text-slate-700">{requests.length}</p>
                </div>
                <FileText className="w-8 h-8 text-slate-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter Tabs */}
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            <TabsTrigger value="all">All Requests</TabsTrigger>
            <TabsTrigger value="Pending">Pending</TabsTrigger>
            <TabsTrigger value="Approved">Approved</TabsTrigger>
            <TabsTrigger value="Ready">Issued</TabsTrigger>
            <TabsTrigger value="Rejected">Rejected</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Requests Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left p-4 font-medium text-slate-600">Certificate ID</th>
                    <th className="text-left p-4 font-medium text-slate-600">Student Name</th>
                    <th className="text-left p-4 font-medium text-slate-600">Program</th>
                    <th className="text-left p-4 font-medium text-slate-600">Branch</th>
                    <th className="text-left p-4 font-medium text-slate-600">Status</th>
                    <th className="text-left p-4 font-medium text-slate-600">Requested On</th>
                    <th className="text-left p-4 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="text-center p-8 text-slate-500">
                        Loading...
                      </td>
                    </tr>
                  ) : requests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center p-8 text-slate-500">
                        No certificate requests found
                      </td>
                    </tr>
                  ) : (
                    requests.map((request) => (
                      <tr key={request.id} className="border-b hover:bg-slate-50">
                        <td className="p-4 font-mono text-sm">{request.certificate_id}</td>
                        <td className="p-4 font-medium">{request.student_name}</td>
                        <td className="p-4 text-sm">{request.program_name}</td>
                        <td className="p-4 text-sm">{request.branch_name}</td>
                        <td className="p-4">{getStatusBadge(request.status)}</td>
                        <td className="p-4 text-sm text-slate-500">
                          {new Date(request.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedRequest(request);
                                setViewDialog(true);
                              }}
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            
                            {request.status === 'Pending' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedRequest(request);
                                    setEditFormData({
                                      email: request.email,
                                      phone: request.phone,
                                      program_start_date: request.program_start_date,
                                      program_end_date: request.program_end_date,
                                      training_mode: request.training_mode,
                                      training_hours: request.training_hours,
                                      registration_number: request.registration_number
                                    });
                                    setEditDialog(true);
                                  }}
                                  title="Edit"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() => handleApprove(request.id)}
                                  title="Approve"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => {
                                    setSelectedRequest(request);
                                    setRejectDialog(true);
                                  }}
                                  title="Reject"
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            
                            {(request.status === 'Approved' || request.status === 'Ready') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => handleDownload(request)}
                                title="Download Certificate"
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* View Dialog */}
        <Dialog open={viewDialog} onOpenChange={setViewDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Certificate Request Details</DialogTitle>
            </DialogHeader>
            {selectedRequest && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-500 text-sm">Certificate ID</Label>
                    <p className="font-mono">{selectedRequest.certificate_id}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">Status</Label>
                    <p>{getStatusBadge(selectedRequest.status)}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">Student Name</Label>
                    <p className="font-medium">{selectedRequest.student_name}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">Enrollment</Label>
                    <p>{selectedRequest.enrollment_number}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">Program</Label>
                    <p>{selectedRequest.program_name}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">Duration</Label>
                    <p>{selectedRequest.program_duration}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">Branch</Label>
                    <p>{selectedRequest.branch_name}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">Training Mode</Label>
                    <p>{selectedRequest.training_mode}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">Email</Label>
                    <p>{selectedRequest.email}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">Phone</Label>
                    <p>{selectedRequest.phone}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">Start Date</Label>
                    <p>{selectedRequest.program_start_date}</p>
                  </div>
                  <div>
                    <Label className="text-slate-500 text-sm">End Date</Label>
                    <p>{selectedRequest.program_end_date}</p>
                  </div>
                </div>
                {selectedRequest.rejection_reason && (
                  <div className="bg-red-50 p-3 rounded">
                    <Label className="text-red-600 text-sm">Rejection Reason</Label>
                    <p className="text-red-700">{selectedRequest.rejection_reason}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={editDialog} onOpenChange={setEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Certificate Request</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    value={editFormData.email || ''}
                    onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={editFormData.phone || ''}
                    onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={editFormData.program_start_date || ''}
                    onChange={(e) => setEditFormData({...editFormData, program_start_date: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={editFormData.program_end_date || ''}
                    onChange={(e) => setEditFormData({...editFormData, program_end_date: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Training Mode</Label>
                  <Select
                    value={editFormData.training_mode}
                    onValueChange={(value) => setEditFormData({...editFormData, training_mode: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Offline">Offline</SelectItem>
                      <SelectItem value="Online">Online</SelectItem>
                      <SelectItem value="Hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Training Hours</Label>
                  <Input
                    type="number"
                    value={editFormData.training_hours || ''}
                    onChange={(e) => setEditFormData({...editFormData, training_hours: parseInt(e.target.value)})}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialog(false)}>Cancel</Button>
              <Button onClick={handleUpdate}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={rejectDialog} onOpenChange={setRejectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Certificate Request</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Reason for Rejection</Label>
                <Input
                  placeholder="Enter reason for rejection"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialog(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleReject}>Reject Request</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default CertificateManagementPage;
