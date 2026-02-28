import React, { useState, useEffect } from 'react';
import { quizAPI } from '@/api/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Clock, FileText, Users, Copy, Trash2, CheckCircle, XCircle, Eye, QrCode, Download } from 'lucide-react';
import { format } from 'date-fns';

const QuizExamsPage = () => {
  const [quizzes, setQuizzes] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialog, setCreateDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [viewAttemptsDialog, setViewAttemptsDialog] = useState(false);
  const [qrCodeDialog, setQrCodeDialog] = useState(false);
  const [qrCodeData, setQrCodeData] = useState(null);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [selectedAttempts, setSelectedAttempts] = useState([]);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    duration_minutes: 30,
    pass_percentage: 60,
    questions: []
  });
  
  const [currentQuestion, setCurrentQuestion] = useState({
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_answer: 'A'
  });

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'Admin';
  const isAcademicController = user.role === 'Academic Controller';
  const isFDE = user.role === 'Front Desk Executive';
  const canCreateQuiz = isAcademicController; // Only Academic Controller can create quizzes
  
  useEffect(() => {
    fetchQuizzes();
    fetchAttempts();
  }, []);

  const fetchQuizzes = async () => {
    try {
      const response = await quizAPI.getAll();
      setQuizzes(response.data);
    } catch (error) {
      toast.error('Failed to fetch quizzes');
    } finally {
      setLoading(false);
    }
  };

  const fetchAttempts = async () => {
    try {
      const response = await quizAPI.getAttempts();
      setAttempts(response.data);
    } catch (error) {
      console.error('Failed to fetch attempts');
    }
  };

  const addQuestion = () => {
    if (!currentQuestion.question_text.trim()) {
      toast.error('Please enter a question');
      return;
    }
    if (!currentQuestion.option_a || !currentQuestion.option_b || !currentQuestion.option_c || !currentQuestion.option_d) {
      toast.error('Please fill all 4 options');
      return;
    }
    
    setFormData({
      ...formData,
      questions: [...formData.questions, { ...currentQuestion }]
    });
    setCurrentQuestion({
      question_text: '',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_answer: 'A'
    });
    toast.success('Question added');
  };

  const removeQuestion = (index) => {
    setFormData({
      ...formData,
      questions: formData.questions.filter((_, i) => i !== index)
    });
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('Please enter exam name');
      return;
    }
    if (formData.questions.length === 0) {
      toast.error('Please add at least one question');
      return;
    }
    
    try {
      await quizAPI.create(formData);
      toast.success('Quiz exam created successfully');
      setCreateDialog(false);
      resetForm();
      fetchQuizzes();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create quiz');
    }
  };

  const handleUpdate = async () => {
    if (!formData.name.trim()) {
      toast.error('Please enter exam name');
      return;
    }
    
    try {
      await quizAPI.update(selectedQuiz.id, formData);
      toast.success('Quiz exam updated successfully');
      setEditDialog(false);
      resetForm();
      fetchQuizzes();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update quiz');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this quiz?')) return;
    
    try {
      await quizAPI.delete(id);
      toast.success('Quiz deleted successfully');
      fetchQuizzes();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete quiz');
    }
  };

  const copyExamLink = (examId) => {
    const link = `${window.location.origin}/exam/${examId}`;
    navigator.clipboard.writeText(link);
    toast.success('Exam link copied to clipboard!');
  };

  const openEdit = async (quiz) => {
    try {
      const response = await quizAPI.getDetails(quiz.id);
      setSelectedQuiz(quiz);
      setFormData({
        name: response.data.name,
        description: response.data.description || '',
        duration_minutes: response.data.duration_minutes,
        pass_percentage: response.data.pass_percentage,
        questions: response.data.questions || []
      });
      setEditDialog(true);
    } catch (error) {
      toast.error('Failed to load quiz details');
    }
  };

  const viewAttempts = (quiz) => {
    const quizAttempts = attempts.filter(a => a.exam_id === quiz.id);
    setSelectedQuiz(quiz);
    setSelectedAttempts(quizAttempts);
    setViewAttemptsDialog(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      duration_minutes: 30,
      pass_percentage: 60,
      questions: []
    });
    setCurrentQuestion({
      question_text: '',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_answer: 'A'
    });
    setSelectedQuiz(null);
  };

  const QuizCard = ({ quiz }) => (
    <Card className="border-slate-200 shadow-soft hover:shadow-md transition-shadow" data-testid={`quiz-${quiz.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{quiz.name}</CardTitle>
            <p className="text-sm text-slate-500 mt-1">{quiz.description || 'No description'}</p>
          </div>
          <Badge className="bg-green-100 text-green-700">Active</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3 mb-4 text-sm">
          <div className="flex items-center gap-1 text-slate-600">
            <Clock className="w-4 h-4" />
            <span>{quiz.duration_minutes} mins</span>
          </div>
          <div className="flex items-center gap-1 text-slate-600">
            <FileText className="w-4 h-4" />
            <span>{quiz.total_questions || 0} questions</span>
          </div>
          <div className="flex items-center gap-1 text-slate-600">
            <Users className="w-4 h-4" />
            <span>{quiz.total_attempts || 0} attempts</span>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => copyExamLink(quiz.id)}
            data-testid={`copy-link-${quiz.id}`}
          >
            <Copy className="w-4 h-4 mr-1" /> Copy Link
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => viewAttempts(quiz)}
          >
            <Eye className="w-4 h-4 mr-1" /> Attempts
          </Button>
          {canCreateQuiz && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openEdit(quiz)}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-500 hover:text-red-700"
                onClick={() => handleDelete(quiz.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6" data-testid="quiz-exams-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">Quiz Exams</h1>
          <p className="text-slate-600">Create and manage MCQ-based quiz exams</p>
        </div>
        {canCreateQuiz && (
          <Button
            onClick={() => { resetForm(); setCreateDialog(true); }}
            className="bg-slate-900 hover:bg-slate-800"
            data-testid="create-quiz-btn"
          >
            <Plus className="w-4 h-4 mr-2" /> Create Quiz
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-slate-200 shadow-soft">
          <CardContent className="pt-4">
            <p className="text-sm text-slate-600">Total Quizzes</p>
            <p className="text-2xl font-bold">{quizzes.length}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-soft">
          <CardContent className="pt-4">
            <p className="text-sm text-slate-600">Total Attempts</p>
            <p className="text-2xl font-bold text-blue-600">{attempts.length}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-soft">
          <CardContent className="pt-4">
            <p className="text-sm text-slate-600">Pass Rate</p>
            <p className="text-2xl font-bold text-green-600">
              {attempts.length > 0 
                ? `${Math.round(attempts.filter(a => a.passed).length / attempts.length * 100)}%`
                : '0%'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quizzes Grid */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading...</div>
      ) : quizzes.length === 0 ? (
        <Card className="border-slate-200">
          <CardContent className="py-12 text-center text-slate-500">
            No quiz exams created yet. {canCreateQuiz && 'Click "Create Quiz" to get started.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quizzes.map((quiz) => (
            <QuizCard key={quiz.id} quiz={quiz} />
          ))}
        </div>
      )}

      {/* Create/Edit Quiz Dialog */}
      <Dialog open={createDialog || editDialog} onOpenChange={(open) => { 
        if (!open) { setCreateDialog(false); setEditDialog(false); resetForm(); }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editDialog ? 'Edit Quiz Exam' : 'Create Quiz Exam'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Exam Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., English Proficiency Test"
                  data-testid="quiz-name-input"
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Description</Label>
                <textarea
                  className="w-full min-h-16 px-3 py-2 border border-slate-200 rounded-md text-sm"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of the exam..."
                />
              </div>
              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 30 })}
                  min="5"
                  max="180"
                />
              </div>
              <div className="space-y-2">
                <Label>Pass Percentage (%)</Label>
                <Input
                  type="number"
                  value={formData.pass_percentage}
                  onChange={(e) => setFormData({ ...formData, pass_percentage: parseInt(e.target.value) || 60 })}
                  min="1"
                  max="100"
                />
              </div>
            </div>

            {/* Questions Section */}
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-4">Questions ({formData.questions.length}/100)</h3>
              
              {/* Add New Question Form */}
              <Card className="border-slate-200 mb-4">
                <CardContent className="pt-4 space-y-3">
                  <div className="space-y-2">
                    <Label>Question Text</Label>
                    <textarea
                      className="w-full min-h-16 px-3 py-2 border border-slate-200 rounded-md text-sm"
                      value={currentQuestion.question_text}
                      onChange={(e) => setCurrentQuestion({ ...currentQuestion, question_text: e.target.value })}
                      placeholder="Enter your question..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Option A</Label>
                      <Input
                        value={currentQuestion.option_a}
                        onChange={(e) => setCurrentQuestion({ ...currentQuestion, option_a: e.target.value })}
                        placeholder="Option A"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Option B</Label>
                      <Input
                        value={currentQuestion.option_b}
                        onChange={(e) => setCurrentQuestion({ ...currentQuestion, option_b: e.target.value })}
                        placeholder="Option B"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Option C</Label>
                      <Input
                        value={currentQuestion.option_c}
                        onChange={(e) => setCurrentQuestion({ ...currentQuestion, option_c: e.target.value })}
                        placeholder="Option C"
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Option D</Label>
                      <Input
                        value={currentQuestion.option_d}
                        onChange={(e) => setCurrentQuestion({ ...currentQuestion, option_d: e.target.value })}
                        placeholder="Option D"
                        className="h-9"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs">Correct Answer</Label>
                      <select
                        className="h-9 px-3 border border-slate-200 rounded-md text-sm"
                        value={currentQuestion.correct_answer}
                        onChange={(e) => setCurrentQuestion({ ...currentQuestion, correct_answer: e.target.value })}
                      >
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                        <option value="D">D</option>
                      </select>
                    </div>
                    <Button
                      type="button"
                      onClick={addQuestion}
                      className="mt-5"
                      disabled={formData.questions.length >= 100}
                    >
                      <Plus className="w-4 h-4 mr-1" /> Add Question
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Questions List */}
              {formData.questions.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {formData.questions.map((q, index) => (
                    <div key={index} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-sm">Q{index + 1}: {q.question_text}</p>
                        <div className="text-xs text-slate-500 mt-1">
                          A: {q.option_a} | B: {q.option_b} | C: {q.option_c} | D: {q.option_d}
                        </div>
                        <Badge className="mt-1 bg-green-100 text-green-700 text-xs">
                          Correct: {q.correct_answer}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500"
                        onClick={() => removeQuestion(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => { setCreateDialog(false); setEditDialog(false); resetForm(); }}>
                Cancel
              </Button>
              <Button 
                onClick={editDialog ? handleUpdate : handleCreate}
                className="bg-slate-900 hover:bg-slate-800"
                data-testid="save-quiz-btn"
              >
                {editDialog ? 'Update Quiz' : 'Create Quiz'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Attempts Dialog */}
      <Dialog open={viewAttemptsDialog} onOpenChange={setViewAttemptsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Exam Attempts: {selectedQuiz?.name}</DialogTitle>
          </DialogHeader>
          
          {selectedAttempts.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No attempts yet for this exam.
            </div>
          ) : (
            <div className="space-y-2">
              {selectedAttempts.map((attempt) => (
                <div key={attempt.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium">{attempt.student_name || 'Unknown Student'}</p>
                    <p className="text-sm text-slate-500">Enrollment: {attempt.enrollment_number}</p>
                    <p className="text-xs text-slate-400">
                      {attempt.completed_at ? format(new Date(attempt.completed_at), 'dd MMM yyyy, HH:mm') : 'In progress'}
                    </p>
                  </div>
                  <div className="text-right">
                    {attempt.completed_at ? (
                      <>
                        <div className="flex items-center gap-2">
                          {attempt.passed ? (
                            <Badge className="bg-green-100 text-green-700">
                              <CheckCircle className="w-3 h-3 mr-1" /> PASS
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700">
                              <XCircle className="w-3 h-3 mr-1" /> FAIL
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-semibold mt-1">
                          {attempt.score}/{attempt.total_questions} ({attempt.percentage}%)
                        </p>
                      </>
                    ) : (
                      <Badge className="bg-yellow-100 text-yellow-700">In Progress</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuizExamsPage;
