import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Search, CheckCircle, FileText, ArrowLeft } from 'lucide-react';
import { certificateAPI } from '@/api/api';

const CertificateRequestPage = () => {
  const [step, setStep] = useState(1); // 1: Enter enrollment, 2: Fill details, 3: Success
  const [enrollmentNumber, setEnrollmentNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [studentData, setStudentData] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    program_start_date: '',
    program_end_date: '',
    training_mode: 'Offline',
    training_hours: ''
  });
  const [submittedId, setSubmittedId] = useState('');

  const handleFetchEnrollment = async () => {
    if (!enrollmentNumber.trim()) {
      toast.error('Please enter your enrollment number');
      return;
    }

    setLoading(true);
    try {
      const response = await certificateAPI.getEnrollmentInfo(enrollmentNumber);
      setStudentData(response.data);
      setStep(2);
      toast.success('Enrollment found! Please fill in the details.');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Enrollment not found');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.email || !formData.phone || !formData.program_start_date || !formData.program_end_date) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await certificateAPI.submitRequest({
        enrollment_number: enrollmentNumber,
        email: formData.email,
        phone: formData.phone,
        program_start_date: formData.program_start_date,
        program_end_date: formData.program_end_date,
        training_mode: formData.training_mode,
        training_hours: formData.training_hours ? parseInt(formData.training_hours) : null
      });
      
      setSubmittedId(response.data.certificate_id);
      setStep(3);
      toast.success('Certificate request submitted successfully!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <img 
            src="https://etieducom.com/wp-content/uploads/2024/03/eti-educom-logo.png" 
            alt="ETI Educom" 
            className="h-16 mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-white">Certificate Request Portal</h1>
          <p className="text-slate-400">ETI Educom - Request your course completion certificate</p>
        </div>

        {/* Step 1: Enter Enrollment Number */}
        {step === 1 && (
          <Card className="bg-white/95 backdrop-blur shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5 text-blue-600" />
                Find Your Enrollment
              </CardTitle>
              <CardDescription>
                Enter your enrollment ID to fetch your details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="enrollment">Enrollment Number *</Label>
                <Input
                  id="enrollment"
                  placeholder="e.g., PBPTKE0001"
                  value={enrollmentNumber}
                  onChange={(e) => setEnrollmentNumber(e.target.value.toUpperCase())}
                  className="text-lg"
                  data-testid="enrollment-number-input"
                />
                <p className="text-xs text-slate-500">
                  You can find this on your enrollment receipt or fee receipt
                </p>
              </div>
              <Button 
                onClick={handleFetchEnrollment} 
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={loading}
                data-testid="fetch-enrollment-btn"
              >
                {loading ? 'Searching...' : 'Find My Enrollment'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Fill Details Form */}
        {step === 2 && studentData && (
          <Card className="bg-white/95 backdrop-blur shadow-2xl">
            <CardHeader>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setStep(1)}
                className="w-fit -ml-2 mb-2"
              >
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Complete Your Request
              </CardTitle>
              <CardDescription>
                Verify your details and provide additional information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Auto-fetched Details (Read-only) */}
                <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                  <h3 className="font-medium text-blue-900 text-sm">Your Details (Auto-fetched)</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-slate-500">Name:</span>
                      <p className="font-medium">{studentData.student_name}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Enrollment:</span>
                      <p className="font-medium">{studentData.enrollment_number}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Program:</span>
                      <p className="font-medium">{studentData.program_name}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Duration:</span>
                      <p className="font-medium">{studentData.program_duration}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500">Branch:</span>
                      <p className="font-medium">{studentData.branch_name}</p>
                    </div>
                  </div>
                </div>

                {/* Editable Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      required
                      data-testid="email-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      placeholder="9876543210"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      required
                      data-testid="phone-input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_date">Program Start Date *</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={formData.program_start_date}
                      onChange={(e) => setFormData({...formData, program_start_date: e.target.value})}
                      required
                      data-testid="start-date-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_date">Program End Date *</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={formData.program_end_date}
                      onChange={(e) => setFormData({...formData, program_end_date: e.target.value})}
                      required
                      data-testid="end-date-input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="training_mode">Training Mode *</Label>
                    <Select
                      value={formData.training_mode}
                      onValueChange={(value) => setFormData({...formData, training_mode: value})}
                    >
                      <SelectTrigger data-testid="training-mode-select">
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
                    <Label htmlFor="training_hours">Training Hours</Label>
                    <Input
                      id="training_hours"
                      type="number"
                      placeholder="e.g., 120"
                      value={formData.training_hours}
                      onChange={(e) => setFormData({...formData, training_hours: e.target.value})}
                      data-testid="training-hours-input"
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-green-600 hover:bg-green-700"
                  disabled={loading}
                  data-testid="submit-request-btn"
                >
                  {loading ? 'Submitting...' : 'Submit Certificate Request'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <Card className="bg-white/95 backdrop-blur shadow-2xl text-center">
            <CardContent className="pt-8 pb-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Request Submitted!</h2>
              <p className="text-slate-600 mb-4">
                Your certificate request has been submitted successfully.
              </p>
              <div className="bg-slate-100 rounded-lg p-4 mb-6">
                <p className="text-sm text-slate-500">Your Certificate Request ID</p>
                <p className="text-xl font-mono font-bold text-blue-600">{submittedId}</p>
              </div>
              <p className="text-sm text-slate-500 mb-4">
                Our team will review your request and you will receive a WhatsApp notification 
                once your certificate is ready for download.
              </p>
              <Button 
                onClick={() => {
                  setStep(1);
                  setEnrollmentNumber('');
                  setStudentData(null);
                  setFormData({
                    email: '',
                    phone: '',
                    program_start_date: '',
                    program_end_date: '',
                    training_mode: 'Offline',
                    training_hours: ''
                  });
                }}
                variant="outline"
                className="w-full"
              >
                Submit Another Request
              </Button>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-slate-500 text-sm mt-6">
          &copy; {new Date().getFullYear()} ETI Educom. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default CertificateRequestPage;
