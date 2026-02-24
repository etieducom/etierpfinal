from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta, date
from passlib.context import CryptContext
from jose import JWTError, jwt
import httpx
from enum import Enum
import io
import csv
import base64
import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440
MSG91_AUTH_KEY = os.environ.get('MSG91_AUTH_KEY', '')

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

class UserRole(str, Enum):
    ADMIN = "Admin"  # Super Admin - full access to all branches
    BRANCH_ADMIN = "Branch Admin"  # Branch Admin - full access to their branch only
    COUNSELLOR = "Counsellor"
    FRONT_DESK = "Front Desk Executive"
    CERTIFICATE_MANAGER = "Certificate Manager"  # Manages certificate requests
    TRAINER = "Trainer"  # Trainer for batch management

class LeadStatus(str, Enum):
    NEW = "New"
    CONTACTED = "Contacted"
    DEMO_BOOKED = "Demo Booked"
    FOLLOW_UP = "Follow-up"
    CONVERTED = "Converted"
    LOST = "Lost"

class FollowUpStatus(str, Enum):
    PENDING = "Pending"
    COMPLETED = "Completed"
    CANCELLED = "Cancelled"

class PaymentMode(str, Enum):
    CASH = "Cash"
    CARD = "Card"
    UPI = "UPI"
    NET_BANKING = "Net Banking"
    CHEQUE = "Cheque"

class PaymentPlanType(str, Enum):
    ONE_TIME = "One-time"
    INSTALLMENTS = "Installments"

# Models
class Branch(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    location: str
    address: str
    city: str
    state: str
    pincode: str
    state_code: Optional[str] = None  # Auto-generated: first 2 chars of state
    city_code: Optional[str] = None   # Auto-generated: first 3 chars of city
    owner_name: str
    owner_email: EmailStr
    owner_phone: str
    owner_designation: str
    branch_phone: str
    branch_email: EmailStr
    lead_counter: int = 0      # For custom ID generation
    enrollment_counter: int = 0
    receipt_counter: int = 0
    webhook_key: Optional[str] = None  # Unique key for external lead capture (Google Ads, Meta)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BranchCreate(BaseModel):
    name: str
    location: str
    address: str
    city: str
    state: str
    pincode: str
    owner_name: str
    owner_email: EmailStr
    owner_phone: str
    owner_designation: str
    branch_phone: str
    branch_email: EmailStr

class Program(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    duration: str
    fee: float
    max_discount_percent: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ProgramCreate(BaseModel):
    name: str
    duration: str
    fee: float
    max_discount_percent: float

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: Optional[UserRole] = UserRole.COUNSELLOR
    branch_id: Optional[str] = None
    phone: Optional[str] = None
    alternate_phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    date_of_birth: Optional[str] = None
    designation: Optional[str] = None
    photo_url: Optional[str] = None

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    role: UserRole
    branch_id: Optional[str] = None
    hashed_password: str
    phone: Optional[str] = None
    alternate_phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    date_of_birth: Optional[str] = None
    designation: Optional[str] = None
    photo_url: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: UserRole
    branch_id: Optional[str] = None
    phone: Optional[str] = None
    alternate_phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    date_of_birth: Optional[str] = None
    designation: Optional[str] = None
    photo_url: Optional[str] = None
    is_active: Optional[bool] = True

class PasswordChange(BaseModel):
    current_password: Optional[str] = None  # Required for self-change
    new_password: str

class UserStatusUpdate(BaseModel):
    is_active: bool

# Task Management
class TaskStatus(str, Enum):
    PENDING = "Pending"
    IN_PROGRESS = "In Progress"
    COMPLETED = "Completed"

class Task(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: Optional[str] = None
    assigned_by: str
    assigned_by_name: str
    assigned_to: str
    assigned_to_name: str
    branch_id: str
    status: TaskStatus = TaskStatus.PENDING
    priority: str = "Normal"  # Low, Normal, High, Urgent
    due_date: Optional[str] = None
    completed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    assigned_to: str
    priority: str = "Normal"
    due_date: Optional[str] = None

# International Exams
class InternationalExam(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    price: float
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ExamBooking(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    booking_id: Optional[str] = None  # Custom ID like PBPTKX0001
    student_name: str
    student_phone: str
    student_email: Optional[str] = None
    exam_id: str
    exam_name: str
    exam_price: float
    branch_id: str
    status: str = "Pending"  # Pending, Confirmed, Completed, Cancelled
    exam_date: Optional[str] = None
    notes: Optional[str] = None
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Quiz-Based Exams
class QuizQuestion(BaseModel):
    question_number: int
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_answer: str  # A, B, C, or D

class QuizExam(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    duration_minutes: int = 30  # Time limit in minutes
    pass_percentage: int = 60  # Percentage needed to pass
    questions: List[QuizQuestion] = []  # Up to 100 questions
    is_active: bool = True
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class QuizExamCreate(BaseModel):
    name: str
    description: Optional[str] = None
    duration_minutes: int = 30
    pass_percentage: int = 60
    questions: List[dict] = []

class QuizAttempt(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    exam_id: str
    exam_name: str
    enrollment_number: str  # Student enters this to take the exam
    student_name: Optional[str] = None
    answers: dict = {}  # {question_number: "A" or "B" or "C" or "D"}
    score: int = 0  # Number of correct answers
    total_questions: int = 0
    percentage: float = 0.0
    passed: bool = False
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    time_taken_seconds: Optional[int] = None

class QuizAttemptCreate(BaseModel):
    exam_id: str
    enrollment_number: str

class QuizAttemptSubmit(BaseModel):
    answers: dict  # {question_number: "A" or "B" or "C" or "D"}

# Add-on Course for existing enrollments
class AddOnCourse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    enrollment_id: str
    program_id: str
    program_name: str
    fee_quoted: float
    discount_percent: Optional[float] = 0
    final_fee: float
    added_by: str
    added_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AddOnCourseCreate(BaseModel):
    enrollment_id: str
    program_id: str
    fee_quoted: float
    discount_percent: Optional[float] = 0

# Schools/Colleges Outreach Management
class OrganizationType(str, Enum):
    SCHOOL = "School"
    COLLEGE = "College"

class Organization(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    organization_type: OrganizationType
    name: str
    city: str
    address: Optional[str] = None
    contact_person_name: str
    contact_number: str
    email: Optional[str] = None
    alternate_number: Optional[str] = None
    alternate_email: Optional[str] = None
    notes: Optional[str] = None
    created_by: str
    branch_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = None

class OrganizationCreate(BaseModel):
    organization_type: str
    name: str
    city: str
    address: Optional[str] = None
    contact_person_name: str
    contact_number: str
    email: Optional[str] = None
    alternate_number: Optional[str] = None
    alternate_email: Optional[str] = None
    notes: Optional[str] = None

class OrganizationUpdate(BaseModel):
    organization_type: Optional[str] = None
    name: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    contact_person_name: Optional[str] = None
    contact_number: Optional[str] = None
    email: Optional[str] = None
    alternate_number: Optional[str] = None
    alternate_email: Optional[str] = None
    notes: Optional[str] = None

class OrganizationFollowUp(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    organization_id: str
    follow_up_date: str
    follow_up_time: Optional[str] = None
    notes: str
    outcome: Optional[str] = None  # Interested, Not Interested, Call Back, Meeting Scheduled
    created_by: str
    created_by_name: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OrganizationFollowUpCreate(BaseModel):
    organization_id: str
    follow_up_date: str
    follow_up_time: Optional[str] = None
    notes: str
    outcome: Optional[str] = None

# Batch Management Models
class Batch(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    program_id: str
    program_name: Optional[str] = None
    trainer_id: str
    trainer_name: Optional[str] = None
    branch_id: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    timing: Optional[str] = None  # e.g., "10:00 AM - 12:00 PM"
    max_students: Optional[int] = 30
    status: str = "Active"  # Active, Completed, Cancelled
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BatchCreate(BaseModel):
    name: str
    program_id: str
    trainer_id: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    timing: Optional[str] = None
    max_students: Optional[int] = 30

class BatchUpdate(BaseModel):
    name: Optional[str] = None
    trainer_id: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    timing: Optional[str] = None
    max_students: Optional[int] = None
    status: Optional[str] = None

class StudentBatchAssignment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    enrollment_id: str
    student_name: Optional[str] = None
    batch_id: str
    batch_name: Optional[str] = None
    trainer_id: str
    trainer_name: Optional[str] = None
    assigned_by: str
    assigned_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StudentBatchAssignmentCreate(BaseModel):
    enrollment_id: str
    batch_id: str

# Payment Plan Edit Model
class PaymentPlanEdit(BaseModel):
    plan_type: Optional[str] = None
    total_installments: Optional[int] = None
    installments: Optional[List[dict]] = None  # [{amount, due_date}]

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class LeadCreate(BaseModel):
    name: str
    number: str
    alternate_number: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    email: EmailStr
    program_id: str
    fee_quoted: Optional[float] = None
    discount_percent: Optional[float] = None
    payment_plan: Optional[str] = None
    lead_source: str

class LeadUpdate(BaseModel):
    name: Optional[str] = None
    number: Optional[str] = None
    alternate_number: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    email: Optional[EmailStr] = None
    program_id: Optional[str] = None
    fee_quoted: Optional[float] = None
    discount_percent: Optional[float] = None
    payment_plan: Optional[str] = None
    lead_source: Optional[str] = None
    status: Optional[LeadStatus] = None
    # Demo booking fields
    demo_date: Optional[str] = None
    demo_time: Optional[str] = None
    trainer_name: Optional[str] = None

class Lead(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_id: Optional[str] = None  # Custom ID: PBPTKL0001
    name: str
    number: str
    alternate_number: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    email: str
    program_id: str
    program_name: Optional[str] = None
    fee_quoted: Optional[float] = None
    discount_percent: Optional[float] = None
    payment_plan: Optional[str] = None
    lead_source: str
    status: LeadStatus = LeadStatus.NEW
    branch_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    counsellor_id: str
    # Demo booking fields
    demo_date: Optional[str] = None
    demo_time: Optional[str] = None
    trainer_name: Optional[str] = None
    # Soft delete fields
    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    deleted_by: Optional[str] = None
    deleted_by_name: Optional[str] = None
    deletion_reason: Optional[str] = None

class FollowUpCreate(BaseModel):
    lead_id: str
    note: str
    followup_date: datetime
    reminder_time: Optional[str] = None

class FollowUp(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    lead_id: str
    note: str
    followup_date: datetime
    reminder_time: Optional[str] = None
    status: FollowUpStatus = FollowUpStatus.PENDING
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str
    created_by_name: Optional[str] = None
    lead_name: Optional[str] = None
    lead_number: Optional[str] = None

# Expense Management
class ExpenseCategory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ExpenseCategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None

# Lead Source Management (Admin configurable)
class LeadSource(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LeadSourceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    name: str
    description: Optional[str] = None

class Expense(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    branch_id: str
    category_id: str
    category_name: Optional[str] = None
    name: str
    amount: float
    payment_mode: PaymentMode
    expense_date: date
    remarks: Optional[str] = None
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ExpenseCreate(BaseModel):
    category_id: str
    name: str
    amount: float
    payment_mode: PaymentMode
    expense_date: str
    remarks: Optional[str] = None

# WhatsApp Notification Settings
class WhatsAppTemplate(BaseModel):
    template_name: str
    template_namespace: str
    variables: List[str] = []  # List of variable names like ["name", "course", "amount"]

class WhatsAppEventConfig(BaseModel):
    enabled: bool = True
    template_name: str = ""
    namespace: str = ""
    variables: List[str] = []  # Variable names for this event

class WhatsAppSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    enabled: bool = True
    integrated_number: str = "918728054145"  # Your MSG91 registered WhatsApp number
    # Per-event template configuration with specific variables
    events: dict = Field(default_factory=lambda: {
        "enquiry_saved": {
            "enabled": True,
            "template_name": "",
            "namespace": "",
            "variables": ["name", "course"],
            "description": "When a new enquiry/lead is saved"
        },
        "demo_booked": {
            "enabled": True,
            "template_name": "",
            "namespace": "",
            "variables": ["name", "demo_date", "demo_time", "trainer"],
            "description": "When demo is scheduled for a lead"
        },
        "enrollment_confirmed": {
            "enabled": True,
            "template_name": "",
            "namespace": "",
            "variables": ["name", "enrollment_number", "course"],
            "description": "Thank you message when enrollment is confirmed"
        },
        "fee_reminder": {
            "enabled": True,
            "template_name": "",
            "namespace": "",
            "variables": ["name", "amount_due", "due_date"],
            "description": "Automatic pending fee reminders"
        },
        "birthday_wishes": {
            "enabled": True,
            "template_name": "",
            "namespace": "",
            "variables": ["name"],
            "description": "Birthday wishes sent on student's DOB"
        },
        "certificate_ready": {
            "enabled": True,
            "template_name": "",
            "namespace": "",
            "variables": ["name", "certificate_id", "course"],
            "description": "When certificate is ready for download"
        }
    })
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_by: Optional[str] = None

class WhatsAppSettingsUpdate(BaseModel):
    enabled: Optional[bool] = None
    integrated_number: Optional[str] = None
    events: Optional[dict] = None

# Push Notifications
class PushNotification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sender_id: str
    sender_name: str
    sender_role: str
    recipient_ids: List[str]  # List of user IDs
    recipient_role: Optional[str] = None  # Target role if sending to all of a role
    branch_id: Optional[str] = None
    title: str
    message: str
    notification_type: str = "general"  # general, task, reminder
    is_read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PushNotificationCreate(BaseModel):
    recipient_ids: Optional[List[str]] = None
    recipient_role: Optional[str] = None  # Send to all users of this role
    title: str
    message: str
    notification_type: str = "general"

# Browser Push Subscription for Web Push Notifications
class PushSubscription(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    endpoint: str
    keys: dict  # Contains p256dh and auth keys
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PushSubscriptionCreate(BaseModel):
    endpoint: str
    keys: dict

# Webhook Lead from external sources (Google Ads, Meta)
class WebhookLeadCreate(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    source: Optional[str] = None  # e.g., "Google Ads", "Meta", "Facebook"
    campaign: Optional[str] = None  # Campaign name
    ad_name: Optional[str] = None  # Ad name
    form_name: Optional[str] = None  # Form name
    program_name: Optional[str] = None  # Program interest if captured
    city: Optional[str] = None
    state: Optional[str] = None
    additional_data: Optional[dict] = None  # Any extra fields from the platform

# Certificate Management
class CertificateStatus(str, Enum):
    PENDING = "Pending"
    APPROVED = "Approved"
    REJECTED = "Rejected"
    READY = "Ready"  # Downloaded/Issued

class TrainingMode(str, Enum):
    OFFLINE = "Offline"
    ONLINE = "Online"
    HYBRID = "Hybrid"

class CertificateRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    certificate_id: Optional[str] = None  # Custom ID: ETI-2025-00001
    enrollment_id: str
    enrollment_number: str  # The visible enrollment number like PBPTKE0001
    
    # Student Info (auto-fetched from enrollment)
    student_name: str
    program_name: str
    program_duration: str
    branch_name: str
    branch_id: str
    
    # Student-provided info
    email: str
    phone: str
    program_start_date: str
    program_end_date: str
    training_mode: TrainingMode = TrainingMode.OFFLINE
    training_hours: Optional[int] = None
    
    # Certificate details
    registration_number: Optional[str] = None  # ETI-STU-XXXX
    verification_id: Optional[str] = None  # Unique QR verification code
    
    # Status and workflow
    status: CertificateStatus = CertificateStatus.PENDING
    rejection_reason: Optional[str] = None
    
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    approved_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    approved_by_name: Optional[str] = None
    issued_at: Optional[datetime] = None  # When certificate was downloaded
    issued_by: Optional[str] = None

class CertificateRequestCreate(BaseModel):
    enrollment_number: str  # Student enters this
    email: str
    phone: str
    program_start_date: str
    program_end_date: str
    training_mode: TrainingMode = TrainingMode.OFFLINE
    training_hours: Optional[int] = None

class CertificateRequestUpdate(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    program_start_date: Optional[str] = None
    program_end_date: Optional[str] = None
    training_mode: Optional[TrainingMode] = None
    training_hours: Optional[int] = None
    registration_number: Optional[str] = None

# Enrollment Management
class EnrollmentStatus(str, Enum):
    ACTIVE = "Active"
    COMPLETED = "Completed"
    CANCELLED = "Cancelled"
    DROPPED = "Dropped"

class Enrollment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    enrollment_id: Optional[str] = None  # Custom ID: PBPTKE0001
    lead_id: str
    branch_id: str
    student_name: str
    email: str
    phone: str
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    
    # Photo uploads
    student_photo_url: Optional[str] = None
    aadhar_photo_url: Optional[str] = None
    
    # Academic Info
    highest_qualification: Optional[str] = None
    institution_name: Optional[str] = None
    passing_year: Optional[str] = None
    percentage: Optional[float] = None
    
    # Program Info
    program_id: str
    program_name: str
    fee_quoted: float
    discount_percent: Optional[float] = None
    final_fee: float
    
    # Status
    status: EnrollmentStatus = EnrollmentStatus.ACTIVE
    payment_status: str = "Pending"  # Pending, Partial, Paid
    total_paid: float = 0
    
    enrollment_date: date
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    cancelled_at: Optional[datetime] = None
    cancelled_by: Optional[str] = None
    cancellation_reason: Optional[str] = None

class EnrollmentCreate(BaseModel):
    lead_id: str
    student_name: str
    email: EmailStr
    phone: str
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    highest_qualification: Optional[str] = None
    institution_name: Optional[str] = None
    passing_year: Optional[str] = None
    percentage: Optional[float] = None
    program_id: str
    fee_quoted: float
    discount_percent: Optional[float] = None
    enrollment_date: str
    student_photo_url: Optional[str] = None
    aadhar_photo_url: Optional[str] = None

# Payment Management
class PaymentPlan(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    enrollment_id: str
    plan_type: PaymentPlanType
    total_amount: float
    installments_count: Optional[int] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Payment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    enrollment_id: str
    payment_plan_id: Optional[str] = None
    branch_id: str
    amount: float
    payment_mode: PaymentMode
    payment_date: date
    installment_number: Optional[int] = None
    remarks: Optional[str] = None
    receipt_number: str = Field(default_factory=lambda: f"RCP-{str(uuid.uuid4())[:8].upper()}")
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Marketing Resources Model
class ResourceType(str, Enum):
    BROCHURE = "Brochure"
    CREATIVE = "Creative"
    VIDEO = "Video"
    DOCUMENT = "Document"

class MarketingResource(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: Optional[str] = None
    resource_type: ResourceType
    file_url: Optional[str] = None
    video_link: Optional[str] = None
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MarketingResourceCreate(BaseModel):
    title: str
    description: Optional[str] = None
    resource_type: ResourceType
    file_url: Optional[str] = None
    video_link: Optional[str] = None

class PaymentCreate(BaseModel):
    enrollment_id: str
    payment_plan_id: Optional[str] = None
    amount: float
    payment_mode: PaymentMode
    payment_date: str
    installment_number: Optional[int] = None
    remarks: Optional[str] = None

class PaymentPlanCreate(BaseModel):
    enrollment_id: str
    plan_type: PaymentPlanType
    total_amount: float
    installments_count: Optional[int] = None
    installments: Optional[List[dict]] = None

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if user is None:
        raise credentials_exception
    return User(**user)

def require_role(allowed_roles: List[UserRole]):
    async def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return role_checker

# Helper function to generate state/city codes
def generate_state_code(state: str) -> str:
    """Generate 2-letter state code"""
    state_map = {
        "punjab": "PB", "haryana": "HR", "delhi": "DL", "uttar pradesh": "UP",
        "maharashtra": "MH", "karnataka": "KA", "tamil nadu": "TN", "kerala": "KL",
        "west bengal": "WB", "gujarat": "GJ", "rajasthan": "RJ", "madhya pradesh": "MP",
        "andhra pradesh": "AP", "telangana": "TG", "bihar": "BR", "odisha": "OR",
        "jharkhand": "JH", "chhattisgarh": "CG", "assam": "AS", "himachal pradesh": "HP",
        "uttarakhand": "UK", "goa": "GA", "jammu and kashmir": "JK", "chandigarh": "CH"
    }
    state_lower = state.lower().strip()
    return state_map.get(state_lower, state[:2].upper())

def generate_city_code(city: str) -> str:
    """Generate 3-letter city code"""
    city_clean = city.strip().upper()
    # Remove spaces and get first 3 consonants or characters
    consonants = ''.join([c for c in city_clean if c not in 'AEIOU '])
    if len(consonants) >= 3:
        return consonants[:3]
    return city_clean[:3]

async def generate_custom_id(branch_id: str, id_type: str) -> str:
    """Generate custom ID based on branch state/city codes
    id_type: 'L' for Lead, 'E' for Enrollment, 'R' for Receipt
    Returns format: PBPTKL0001
    """
    branch = await db.branches.find_one({"id": branch_id}, {"_id": 0})
    if not branch:
        return None
    
    state_code = branch.get('state_code') or generate_state_code(branch.get('state', 'XX'))
    city_code = branch.get('city_code') or generate_city_code(branch.get('city', 'XXX'))
    
    # Get and increment counter
    counter_field = {
        'L': 'lead_counter',
        'E': 'enrollment_counter', 
        'R': 'receipt_counter'
    }.get(id_type, 'lead_counter')
    
    result = await db.branches.find_one_and_update(
        {"id": branch_id},
        {"$inc": {counter_field: 1}},
        return_document=True,
        projection={"_id": 0, counter_field: 1}
    )
    
    counter = result.get(counter_field, 1) if result else 1
    
    # Format: PBPTKL0001
    return f"{state_code}{city_code}{id_type}{counter:04d}"

async def get_whatsapp_settings():
    """Get WhatsApp notification settings"""
    settings = await db.whatsapp_settings.find_one({}, {"_id": 0})
    if not settings:
        # Create default settings
        default_settings = WhatsAppSettings().model_dump()
        default_settings['updated_at'] = default_settings['updated_at'].isoformat()
        await db.whatsapp_settings.insert_one(default_settings)
        return WhatsAppSettings()
    
    # Ensure the events structure exists and has all required events
    default_events = WhatsAppSettings().events
    existing_events = settings.get('events', {})
    
    # Merge existing events with defaults (keep user-configured values)
    merged_events = {}
    for event_key, default_config in default_events.items():
        if event_key in existing_events:
            merged_events[event_key] = {**default_config, **existing_events[event_key]}
        else:
            merged_events[event_key] = default_config
    
    settings['events'] = merged_events
    
    if isinstance(settings.get('updated_at'), str):
        settings['updated_at'] = datetime.fromisoformat(settings['updated_at'])
    
    return WhatsAppSettings(**settings)

async def send_whatsapp_notification(phone_number: str, event_type: str, template_data: dict):
    """Send WhatsApp notification via MSG91 template API with per-event configuration"""
    settings = await get_whatsapp_settings()
    
    if not settings.enabled:
        logging.info("WhatsApp notifications are disabled globally")
        return {"success": False, "reason": "Notifications disabled"}
    
    # Get event configuration
    event_config = settings.events.get(event_type, {})
    if not event_config:
        logging.info(f"No configuration found for event '{event_type}'")
        return {"success": False, "reason": f"Event '{event_type}' not configured"}
    
    # Check if this specific event is enabled
    if not event_config.get('enabled', False):
        logging.info(f"WhatsApp notification for event '{event_type}' is disabled")
        return {"success": False, "reason": f"Event '{event_type}' is disabled"}
    
    # Check if template is configured
    template_name = event_config.get('template_name', '')
    namespace = event_config.get('namespace', '')
    if not template_name or not namespace:
        logging.info(f"Template not configured for event '{event_type}'")
        return {"success": False, "reason": f"Template not configured for '{event_type}'"}
    
    # Build component variables based on event type
    variables = event_config.get('variables', [])
    components = {}
    for i, var_name in enumerate(variables, 1):
        var_value = template_data.get(var_name, '')
        if var_value:
            components[f"body_{i}"] = {"type": "text", "value": str(var_value)}
    
    # Send via MSG91 template API
    return await send_whatsapp_template_with_config(
        phone_number=phone_number,
        template_name=template_name,
        namespace=namespace,
        integrated_number=settings.integrated_number,
        components=components
    )

async def send_whatsapp_template_with_config(phone_number: str, template_name: str, namespace: str, 
                                              integrated_number: str, components: dict):
    """Send WhatsApp message via MSG91 Template API with full configuration"""
    MSG91_KEY = os.environ.get('MSG91_AUTH_KEY', '')
    
    if not MSG91_KEY:
        logging.warning("MSG91_AUTH_KEY not configured. Skipping WhatsApp message.")
        return {"success": False, "error": "MSG91_AUTH_KEY not configured"}
    
    try:
        url = "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/"
        
        headers = {
            "authkey": MSG91_KEY,
            "Content-Type": "application/json"
        }
        
        # Format phone number (ensure it has country code)
        formatted_phone = phone_number.strip()
        if not formatted_phone.startswith('+'):
            if not formatted_phone.startswith('91'):
                formatted_phone = '91' + formatted_phone
        formatted_phone = formatted_phone.replace('+', '')
        
        payload = {
            "integrated_number": integrated_number,
            "content_type": "template",
            "payload": {
                "messaging_product": "whatsapp",
                "type": "template",
                "template": {
                    "name": template_name,
                    "language": {
                        "code": "en",
                        "policy": "deterministic"
                    },
                    "namespace": namespace,
                    "to_and_components": [
                        {
                            "to": [formatted_phone],
                            "components": components
                        }
                    ]
                }
            }
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, timeout=30.0)
            logging.info(f"MSG91 WhatsApp API response: {response.status_code} - {response.text}")
            
            if response.status_code == 200:
                return {"success": True, "response": response.json()}
            else:
                return {"success": False, "error": response.text}
                
    except Exception as e:
        logging.error(f"Failed to send WhatsApp message: {str(e)}")
        return {"success": False, "error": str(e)}

async def send_whatsapp_template(phone_number: str, body_value: str, settings: WhatsAppSettings):
    """Legacy: Send WhatsApp message via MSG91 Template API (keeping for backwards compatibility)"""
    MSG91_KEY = os.environ.get('MSG91_AUTH_KEY', '')
    
    if not MSG91_KEY:
        logging.warning("MSG91_AUTH_KEY not configured. Skipping WhatsApp message.")
        return {"success": False, "error": "MSG91_AUTH_KEY not configured"}
    
    try:
        url = "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/"
        
        headers = {
            "authkey": MSG91_KEY,
            "Content-Type": "application/json"
        }
        
        # Format phone number (ensure it has country code)
        formatted_phone = phone_number.strip()
        if not formatted_phone.startswith('+'):
            if not formatted_phone.startswith('91'):
                formatted_phone = '91' + formatted_phone
        formatted_phone = formatted_phone.replace('+', '')
        
        # Use first event's template as default
        template_name = "crmwelcome"
        namespace = "73fda5e9_77e9_445f_82ac_9c2e532b32f4"
        
        payload = {
            "integrated_number": settings.integrated_number,
            "content_type": "template",
            "payload": {
                "messaging_product": "whatsapp",
                "type": "template",
                "template": {
                    "name": template_name,
                    "language": {
                        "code": "en",
                        "policy": "deterministic"
                    },
                    "namespace": namespace,
                    "to_and_components": [
                        {
                            "to": [formatted_phone],
                            "components": {
                                "body_1": {
                                    "type": "text",
                                    "value": body_value
                                }
                            }
                        }
                    ]
                }
            }
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, timeout=30.0)
            logging.info(f"MSG91 WhatsApp API response: {response.status_code} - {response.text}")
            
            if response.status_code == 200:
                return {"success": True, "response": response.json()}
            else:
                return {"success": False, "error": response.text}
                
    except Exception as e:
        logging.error(f"Failed to send WhatsApp message: {str(e)}")
        return {"success": False, "error": str(e)}

async def send_whatsapp_message(phone_number: str, message_text: str, lead_name: str):
    """Send WhatsApp message via MSG91 API (legacy text-based)"""
    MSG91_KEY = os.environ.get('MSG91_AUTH_KEY', '')
    
    if not MSG91_KEY:
        logging.warning("MSG91_AUTH_KEY not configured. Skipping WhatsApp message.")
        return {"success": False, "error": "MSG91_AUTH_KEY not configured"}
    
    try:
        url = "https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/"
        
        headers = {
            "authkey": MSG91_KEY,
            "Content-Type": "application/json"
        }
        
        # Format phone number (ensure it has country code)
        formatted_phone = phone_number.strip()
        if not formatted_phone.startswith('+'):
            if not formatted_phone.startswith('91'):
                formatted_phone = '91' + formatted_phone
        formatted_phone = formatted_phone.replace('+', '')
        
        payload = {
            "integrated_number": "919876543210",  # Replace with your MSG91 registered number
            "content_type": "text",
            "payload": {
                "messaging_product": "whatsapp",
                "type": "text",
                "text": {
                    "body": message_text
                }
            },
            "recipients": [
                {
                    "mobiles": formatted_phone,
                    "name": lead_name
                }
            ]
        }
        
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            response = await http_client.post(url, headers=headers, json=payload)
            
            if response.status_code == 200:
                logging.info(f"WhatsApp message sent successfully to {phone_number}")
                return {"success": True, "message": "Message sent successfully"}
            else:
                logging.error(f"MSG91 API error: {response.status_code} - {response.text}")
                return {"success": False, "error": f"API returned status {response.status_code}"}
                
    except Exception as e:
        logging.error(f"Error sending WhatsApp message: {str(e)}")
        return {"success": False, "error": str(e)}

# Authentication Endpoints
@api_router.post("/auth/register", response_model=UserResponse)
async def register(user: UserCreate):
    existing_user = await db.users.find_one({"email": user.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    new_user = User(
        email=user.email,
        name=user.name,
        role=user.role,
        branch_id=user.branch_id,
        phone=user.phone,
        alternate_phone=user.alternate_phone,
        address=user.address,
        city=user.city,
        state=user.state,
        pincode=user.pincode,
        date_of_birth=user.date_of_birth,
        designation=user.designation,
        photo_url=user.photo_url,
        hashed_password=get_password_hash(user.password)
    )
    
    user_dict = new_user.model_dump()
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    
    await db.users.insert_one(user_dict)
    return UserResponse(**{k: v for k, v in new_user.model_dump().items() if k != 'hashed_password'})

@api_router.post("/auth/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user_doc = await db.users.find_one({"email": form_data.username}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    user = User(**user_doc)
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    access_token = create_access_token(data={"sub": user.email})
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(**{k: v for k, v in user.model_dump().items() if k != 'hashed_password'})
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse(**{k: v for k, v in current_user.model_dump().items() if k != 'hashed_password'})

# Admin - Branch Management
@api_router.post("/admin/branches", response_model=Branch)
async def create_branch(branch: BranchCreate, current_user: User = Depends(require_role([UserRole.ADMIN]))):
    # Auto-generate state and city codes
    state_code = generate_state_code(branch.state)
    city_code = generate_city_code(branch.city)
    
    # Generate unique webhook key for external lead capture
    import secrets
    webhook_key = secrets.token_urlsafe(32)
    
    new_branch = Branch(
        **branch.model_dump(),
        state_code=state_code,
        city_code=city_code,
        lead_counter=0,
        enrollment_counter=0,
        receipt_counter=0,
        webhook_key=webhook_key
    )
    branch_dict = new_branch.model_dump()
    branch_dict['created_at'] = branch_dict['created_at'].isoformat()
    
    await db.branches.insert_one(branch_dict)
    return new_branch

@api_router.get("/admin/branches", response_model=List[Branch])
async def get_branches(current_user: User = Depends(get_current_user)):
    branches = await db.branches.find({}, {"_id": 0}).to_list(1000)
    for branch in branches:
        if isinstance(branch.get('created_at'), str):
            branch['created_at'] = datetime.fromisoformat(branch['created_at'])
    return [Branch(**b) for b in branches]

# Admin - Program Management
@api_router.post("/admin/programs", response_model=Program)
async def create_program(program: ProgramCreate, current_user: User = Depends(require_role([UserRole.ADMIN]))):
    new_program = Program(**program.model_dump())
    program_dict = new_program.model_dump()
    program_dict['created_at'] = program_dict['created_at'].isoformat()
    
    await db.programs.insert_one(program_dict)
    return new_program

@api_router.get("/programs", response_model=List[Program])
async def get_programs(current_user: User = Depends(get_current_user)):
    programs = await db.programs.find({}, {"_id": 0}).to_list(1000)
    for program in programs:
        if isinstance(program.get('created_at'), str):
            program['created_at'] = datetime.fromisoformat(program['created_at'])
    return [Program(**p) for p in programs]

@api_router.get("/admin/programs", response_model=List[Program])
async def get_programs_admin(current_user: User = Depends(require_role([UserRole.ADMIN]))):
    return await get_programs(current_user)

@api_router.put("/admin/programs/{program_id}", response_model=Program)
async def update_program(program_id: str, program_update: ProgramCreate, current_user: User = Depends(require_role([UserRole.ADMIN]))):
    result = await db.programs.update_one(
        {"id": program_id},
        {"$set": program_update.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Program not found")
    
    updated_program = await db.programs.find_one({"id": program_id}, {"_id": 0})
    if isinstance(updated_program.get('created_at'), str):
        updated_program['created_at'] = datetime.fromisoformat(updated_program['created_at'])
    return Program(**updated_program)

@api_router.delete("/admin/programs/{program_id}")
async def delete_program(program_id: str, current_user: User = Depends(require_role([UserRole.ADMIN]))):
    result = await db.programs.delete_one({"id": program_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Program not found")
    return {"message": "Program deleted successfully"}

@api_router.delete("/admin/branches/{branch_id}")
async def delete_branch(branch_id: str, current_user: User = Depends(require_role([UserRole.ADMIN]))):
    result = await db.branches.delete_one({"id": branch_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Branch not found")
    return {"message": "Branch deleted successfully"}

@api_router.put("/admin/branches/{branch_id}", response_model=Branch)
async def update_branch(branch_id: str, branch_update: BranchCreate, current_user: User = Depends(require_role([UserRole.ADMIN]))):
    result = await db.branches.update_one(
        {"id": branch_id},
        {"$set": branch_update.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Branch not found")
    
    updated_branch = await db.branches.find_one({"id": branch_id}, {"_id": 0})
    if isinstance(updated_branch.get('created_at'), str):
        updated_branch['created_at'] = datetime.fromisoformat(updated_branch['created_at'])
    return Branch(**updated_branch)

@api_router.get("/admin/branches/{branch_id}", response_model=Branch)
async def get_branch_details(branch_id: str, current_user: User = Depends(get_current_user)):
    branch = await db.branches.find_one({"id": branch_id}, {"_id": 0})
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    
    if isinstance(branch.get('created_at'), str):
        branch['created_at'] = datetime.fromisoformat(branch['created_at'])
    return Branch(**branch)

@api_router.post("/upload/photo", response_model=dict)
async def upload_photo(file: bytes = None, current_user: User = Depends(get_current_user)):
    """Simple base64 photo upload endpoint"""
    if not file:
        raise HTTPException(status_code=400, detail="No file provided")
    
    import base64
    # In production, upload to S3/cloud storage
    # For now, store as base64
    photo_data = base64.b64encode(file).decode('utf-8')
    photo_url = f"data:image/jpeg;base64,{photo_data[:100]}..."  # Truncated for demo
    
    return {"photo_url": photo_url, "message": "Photo uploaded successfully"}

@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(require_role([UserRole.ADMIN]))):
    """Delete a user - Super Admin only"""
    # Prevent deleting self
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted successfully"}

@api_router.put("/admin/users/{user_id}/password")
async def change_user_password(user_id: str, password_data: PasswordChange, current_user: User = Depends(require_role([UserRole.ADMIN]))):
    """Change any user's password - Super Admin only"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    hashed_password = pwd_context.hash(password_data.new_password)
    await db.users.update_one({"id": user_id}, {"$set": {"hashed_password": hashed_password}})
    return {"message": "Password changed successfully"}

@api_router.put("/admin/users/{user_id}/status")
async def update_user_status(user_id: str, status_data: UserStatusUpdate, current_user: User = Depends(require_role([UserRole.ADMIN]))):
    """Mark user as active/inactive - Super Admin only"""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one({"id": user_id}, {"$set": {"is_active": status_data.is_active}})
    return {"message": f"User {'activated' if status_data.is_active else 'deactivated'} successfully"}

@api_router.put("/auth/change-password")
async def change_own_password(password_data: PasswordChange, current_user: User = Depends(get_current_user)):
    """Change own password - requires current password"""
    if not password_data.current_password:
        raise HTTPException(status_code=400, detail="Current password is required")
    
    user = await db.users.find_one({"id": current_user.id}, {"_id": 0})
    if not pwd_context.verify(password_data.current_password, user['hashed_password']):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    hashed_password = pwd_context.hash(password_data.new_password)
    await db.users.update_one({"id": current_user.id}, {"$set": {"hashed_password": hashed_password}})
    return {"message": "Password changed successfully"}

# Admin - User Management
@api_router.post("/admin/users", response_model=UserResponse)
async def create_user(user: UserCreate, current_user: User = Depends(require_role([UserRole.ADMIN]))):
    return await register(user)

@api_router.get("/admin/users", response_model=List[UserResponse])
async def get_users(current_user: User = Depends(require_role([UserRole.ADMIN]))):
    users = await db.users.find({}, {"_id": 0, "hashed_password": 0}).to_list(1000)
    return [UserResponse(**u) for u in users]

@api_router.get("/branch/users", response_model=List[UserResponse])
async def get_branch_users(current_user: User = Depends(get_current_user)):
    """Get users in the current user's branch - For Branch Admin task assignment"""
    if current_user.role == UserRole.ADMIN:
        # Super Admin sees all users
        users = await db.users.find({}, {"_id": 0, "hashed_password": 0}).to_list(1000)
    elif current_user.role == UserRole.BRANCH_ADMIN:
        # Branch Admin sees users in their branch only
        users = await db.users.find(
            {"branch_id": current_user.branch_id}, 
            {"_id": 0, "hashed_password": 0}
        ).to_list(1000)
    else:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return [UserResponse(**u) for u in users]

# Lead Management
@api_router.post("/leads", response_model=Lead)
async def create_lead(lead: LeadCreate, current_user: User = Depends(get_current_user)):
    program = await db.programs.find_one({"id": lead.program_id}, {"_id": 0})
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    
    # Use user's branch_id, or require it if user doesn't have one
    branch_id = current_user.branch_id
    if not branch_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=400, detail="User must be assigned to a branch")
    
    # Generate custom lead ID
    custom_lead_id = await generate_custom_id(branch_id or "default", "L")
    
    new_lead = Lead(
        **lead.model_dump(),
        lead_id=custom_lead_id,
        branch_id=branch_id or "default",
        counsellor_id=current_user.id,
        program_name=program['name']
    )
    lead_dict = new_lead.model_dump()
    lead_dict['created_at'] = lead_dict['created_at'].isoformat()
    lead_dict['updated_at'] = lead_dict['updated_at'].isoformat()
    
    await db.leads.insert_one(lead_dict)
    
    # Send WhatsApp notification for new enquiry/lead
    await send_whatsapp_notification(
        new_lead.number, 
        "enquiry_saved",  # Updated event name 
        {"name": new_lead.name, "course": program['name']}
    )
    
    return new_lead

@api_router.get("/leads", response_model=List[Lead])
async def get_leads(
    status: Optional[str] = None,
    source: Optional[str] = None,
    program_id: Optional[str] = None,
    branch_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    query = {"is_deleted": {"$ne": True}}  # Exclude soft-deleted leads
    
    # Only filter by branch if user is not admin AND has a branch_id
    if current_user.role != UserRole.ADMIN and current_user.branch_id:
        query["branch_id"] = current_user.branch_id
    
    if status:
        query["status"] = status
    if source:
        query["lead_source"] = source
    if program_id:
        query["program_id"] = program_id
    if branch_id and current_user.role == UserRole.ADMIN:
        query["branch_id"] = branch_id
    if start_date:
        query["created_at"] = {"$gte": start_date}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = end_date
        else:
            query["created_at"] = {"$lte": end_date}
    
    leads = await db.leads.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for lead in leads:
        if isinstance(lead.get('created_at'), str):
            lead['created_at'] = datetime.fromisoformat(lead['created_at'])
        if isinstance(lead.get('updated_at'), str):
            lead['updated_at'] = datetime.fromisoformat(lead['updated_at'])
    return [Lead(**lead) for lead in leads]

# Converted Leads for Enrollment - must be before /leads/{lead_id}
@api_router.get("/leads/converted")
async def get_converted_leads(current_user: User = Depends(get_current_user)):
    """Get converted leads for enrollment - FDA sees only their branch"""
    query = {"status": LeadStatus.CONVERTED.value}
    
    if current_user.role != UserRole.ADMIN:
        query["branch_id"] = current_user.branch_id
    
    # Check if already enrolled
    enrolled_lead_ids = await db.enrollments.find({}, {"lead_id": 1, "_id": 0}).to_list(1000)
    enrolled_ids = [e["lead_id"] for e in enrolled_lead_ids]
    
    if enrolled_ids:
        query["id"] = {"$nin": enrolled_ids}
    
    leads = await db.leads.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for lead in leads:
        if isinstance(lead.get('created_at'), str):
            lead['created_at'] = datetime.fromisoformat(lead['created_at'])
        if isinstance(lead.get('updated_at'), str):
            lead['updated_at'] = datetime.fromisoformat(lead['updated_at'])
    return leads

# Deleted Leads - must be before /leads/{lead_id}
@api_router.get("/leads/deleted", response_model=List[Lead])
async def get_deleted_leads(current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.BRANCH_ADMIN]))):
    """Get soft-deleted leads - Super Admin sees all, Branch Admin sees only their branch"""
    query = {"is_deleted": True}
    
    # Branch Admin can only see deleted leads from their branch
    if current_user.role == UserRole.BRANCH_ADMIN:
        query["branch_id"] = current_user.branch_id
    
    leads = await db.leads.find(query, {"_id": 0}).sort("deleted_at", -1).to_list(1000)
    for lead in leads:
        if isinstance(lead.get('created_at'), str):
            lead['created_at'] = datetime.fromisoformat(lead['created_at'])
        if isinstance(lead.get('updated_at'), str):
            lead['updated_at'] = datetime.fromisoformat(lead['updated_at'])
        if isinstance(lead.get('deleted_at'), str):
            lead['deleted_at'] = datetime.fromisoformat(lead['deleted_at'])
    return [Lead(**lead) for lead in leads]

@api_router.get("/leads/{lead_id}", response_model=Lead)
async def get_lead(lead_id: str, current_user: User = Depends(get_current_user)):
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    if current_user.role != UserRole.ADMIN and lead.get('branch_id') != current_user.branch_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if isinstance(lead.get('created_at'), str):
        lead['created_at'] = datetime.fromisoformat(lead['created_at'])
    if isinstance(lead.get('updated_at'), str):
        lead['updated_at'] = datetime.fromisoformat(lead['updated_at'])
    
    return Lead(**lead)

@api_router.put("/leads/{lead_id}", response_model=Lead)
async def update_lead(lead_id: str, lead_update: LeadUpdate, current_user: User = Depends(get_current_user)):
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    if current_user.role not in [UserRole.ADMIN, UserRole.BRANCH_ADMIN] and lead.get('branch_id') != current_user.branch_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Check if lead is converted and enrolled - if so, block all updates
    if lead.get('status') == 'Converted':
        # Check if there's an enrollment for this lead
        enrollment = await db.enrollments.find_one({"lead_id": lead_id}, {"_id": 0})
        if enrollment:
            raise HTTPException(
                status_code=400, 
                detail="This lead has been converted and enrolled. No further changes are allowed."
            )
    
    old_status = lead.get('status')
    
    update_data = {k: v for k, v in lead_update.model_dump(exclude_unset=True).items() if v is not None}
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.leads.update_one({"id": lead_id}, {"$set": update_data})
    
    updated_lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if isinstance(updated_lead.get('created_at'), str):
        updated_lead['created_at'] = datetime.fromisoformat(updated_lead['created_at'])
    if isinstance(updated_lead.get('updated_at'), str):
        updated_lead['updated_at'] = datetime.fromisoformat(updated_lead['updated_at'])
    
    updated_lead_obj = Lead(**updated_lead)
    
    # Send WhatsApp notifications on status change
    if lead_update.status and lead_update.status != old_status:
        if lead_update.status == LeadStatus.DEMO_BOOKED:
            # Send demo booked notification with full details
            await send_whatsapp_notification(
                updated_lead_obj.number, 
                "demo_booked", 
                {
                    "name": updated_lead_obj.name,
                    "demo_date": updated_lead_obj.demo_date or "",
                    "demo_time": updated_lead_obj.demo_time or "",
                    "trainer": updated_lead_obj.trainer_name or ""
                }
            )
    
    return updated_lead_obj

class LeadDeleteRequest(BaseModel):
    reason: Optional[str] = None

@api_router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, delete_request: Optional[LeadDeleteRequest] = None, current_user: User = Depends(get_current_user)):
    """Soft delete a lead - only Branch Admin or Super Admin can delete"""
    # Only Branch Admin or Super Admin can delete leads
    if current_user.role not in [UserRole.ADMIN, UserRole.BRANCH_ADMIN]:
        raise HTTPException(status_code=403, detail="Only Branch Admin can delete leads")
    
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    if lead.get('is_deleted'):
        raise HTTPException(status_code=400, detail="Lead is already deleted")
    
    # Branch Admin can only delete leads from their branch
    if current_user.role == UserRole.BRANCH_ADMIN and lead.get('branch_id') != current_user.branch_id:
        raise HTTPException(status_code=403, detail="You can only delete leads from your branch")
    
    # Soft delete - mark as deleted instead of removing
    await db.leads.update_one(
        {"id": lead_id},
        {"$set": {
            "is_deleted": True,
            "deleted_at": datetime.now(timezone.utc).isoformat(),
            "deleted_by": current_user.id,
            "deleted_by_name": current_user.name,
            "deletion_reason": delete_request.reason if delete_request else None
        }}
    )
    return {"message": "Lead deleted successfully"}

# Follow-up Management
@api_router.post("/followups", response_model=FollowUp)
async def create_followup(followup: FollowUpCreate, current_user: User = Depends(get_current_user)):
    lead = await db.leads.find_one({"id": followup.lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    new_followup = FollowUp(
        **followup.model_dump(),
        created_by=current_user.id,
        created_by_name=current_user.name,
        lead_name=lead['name'],
        lead_number=lead['number']
    )
    
    followup_dict = new_followup.model_dump()
    followup_dict['created_at'] = followup_dict['created_at'].isoformat()
    followup_dict['followup_date'] = followup_dict['followup_date'].isoformat()
    
    await db.followups.insert_one(followup_dict)
    return new_followup

@api_router.get("/followups/pending")
async def get_pending_followups(current_user: User = Depends(get_current_user)):
    today = datetime.now(timezone.utc).date()
    today_start = datetime.combine(today, datetime.min.time()).isoformat()
    today_end = datetime.combine(today, datetime.max.time()).isoformat()
    
    query = {
        "status": FollowUpStatus.PENDING,
        "followup_date": {"$gte": today_start, "$lte": today_end}
    }
    
    if current_user.role != UserRole.ADMIN:
        query["created_by"] = current_user.id
    
    followups = await db.followups.find(query, {"_id": 0}).sort("followup_date", 1).to_list(1000)
    for fu in followups:
        if isinstance(fu.get('created_at'), str):
            fu['created_at'] = datetime.fromisoformat(fu['created_at'])
        if isinstance(fu.get('followup_date'), str):
            fu['followup_date'] = datetime.fromisoformat(fu['followup_date'])
    return followups

@api_router.get("/followups/pending/count")
async def get_pending_followups_count(current_user: User = Depends(get_current_user)):
    today = datetime.now(timezone.utc).date()
    today_start = datetime.combine(today, datetime.min.time()).isoformat()
    today_end = datetime.combine(today, datetime.max.time()).isoformat()
    
    query = {
        "status": FollowUpStatus.PENDING,
        "followup_date": {"$gte": today_start, "$lte": today_end}
    }
    
    if current_user.role != UserRole.ADMIN:
        query["created_by"] = current_user.id
    
    count = await db.followups.count_documents(query)
    return {"count": count}

@api_router.get("/leads/{lead_id}/followups")
async def get_lead_followups(lead_id: str, current_user: User = Depends(get_current_user)):
    followups = await db.followups.find({"lead_id": lead_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for fu in followups:
        if isinstance(fu.get('created_at'), str):
            fu['created_at'] = datetime.fromisoformat(fu['created_at'])
        if isinstance(fu.get('followup_date'), str):
            fu['followup_date'] = datetime.fromisoformat(fu['followup_date'])
    return followups

@api_router.put("/followups/{followup_id}/status")
async def update_followup_status(followup_id: str, status: FollowUpStatus, current_user: User = Depends(get_current_user)):
    result = await db.followups.update_one(
        {"id": followup_id},
        {"$set": {"status": status}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    return {"message": "Follow-up status updated"}

# Analytics
@api_router.get("/analytics/overview")
async def get_analytics_overview(current_user: User = Depends(get_current_user)):
    # Base query - EXCLUDE deleted leads
    base_query = {"is_deleted": {"$ne": True}}
    if current_user.role != UserRole.ADMIN:
        base_query["branch_id"] = current_user.branch_id
    
    # Count active (non-deleted) leads
    total_leads = await db.leads.count_documents(base_query)
    
    # Count deleted leads separately
    deleted_query = {"is_deleted": True}
    if current_user.role != UserRole.ADMIN:
        deleted_query["branch_id"] = current_user.branch_id
    deleted_count = await db.leads.count_documents(deleted_query)
    
    # Status counts - only for non-deleted leads
    status_counts = {}
    for lead_status in LeadStatus:
        count = await db.leads.count_documents({**base_query, "status": lead_status.value})
        status_counts[lead_status.value] = count
    
    # Add deleted count to status breakdown
    status_counts["Deleted"] = deleted_count
    
    pipeline = [
        {"$match": base_query},
        {"$group": {"_id": "$lead_source", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    source_stats = await db.leads.aggregate(pipeline).to_list(100)
    
    pipeline = [
        {"$match": base_query},
        {"$group": {"_id": "$program_name", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    program_stats = await db.leads.aggregate(pipeline).to_list(100)
    
    return {
        "total_leads": total_leads,
        "deleted_leads": deleted_count,
        "status_breakdown": status_counts,
        "source_performance": [{"source": s["_id"], "count": s["count"]} for s in source_stats],
        "program_performance": [{"program": p["_id"], "count": p["count"]} for p in program_stats]
    }

@api_router.get("/analytics/branch-wise")
async def get_branch_wise_analytics(current_user: User = Depends(require_role([UserRole.ADMIN]))):
    """Get analytics grouped by branch - Admin only"""
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    
    branch_analytics = []
    for branch in branches:
        branch_id = branch["id"]
        
        # Base query excludes deleted leads
        base_query = {"branch_id": branch_id, "is_deleted": {"$ne": True}}
        
        # Total leads (excluding deleted)
        total_leads = await db.leads.count_documents(base_query)
        
        # Deleted leads count
        deleted_count = await db.leads.count_documents({"branch_id": branch_id, "is_deleted": True})
        
        # Status counts (excluding deleted)
        new_count = await db.leads.count_documents({**base_query, "status": "New"})
        contacted_count = await db.leads.count_documents({**base_query, "status": "Contacted"})
        demo_count = await db.leads.count_documents({**base_query, "status": "Demo Booked"})
        followup_count = await db.leads.count_documents({**base_query, "status": "Follow-up"})
        converted_count = await db.leads.count_documents({**base_query, "status": "Converted"})
        lost_count = await db.leads.count_documents({**base_query, "status": "Lost"})
        
        # Conversion rate
        conversion_rate = (converted_count / total_leads * 100) if total_leads > 0 else 0
        
        # Active counsellors
        counsellors_count = await db.users.count_documents({"branch_id": branch_id, "role": "Counsellor"})
        
        branch_analytics.append({
            "branch_id": branch_id,
            "branch_name": branch["name"],
            "branch_location": branch["location"],
            "total_leads": total_leads,
            "deleted_leads": deleted_count,
            "new_leads": new_count,
            "contacted": contacted_count,
            "demo_booked": demo_count,
            "followup": followup_count,
            "converted": converted_count,
            "lost": lost_count,
            "conversion_rate": round(conversion_rate, 2),
            "active_counsellors": counsellors_count
        })
    
    # Sort by total leads (descending)
    branch_analytics.sort(key=lambda x: x["total_leads"], reverse=True)
    
    return branch_analytics

# Reports
@api_router.get("/reports/leads")
async def generate_leads_report(
    status: Optional[str] = None,
    source: Optional[str] = None,
    program_id: Optional[str] = None,
    branch_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    format: str = "csv",
    current_user: User = Depends(get_current_user)
):
    query = {}
    
    if current_user.role != UserRole.ADMIN:
        query["branch_id"] = current_user.branch_id
    
    if status:
        query["status"] = status
    if source:
        query["lead_source"] = source
    if program_id:
        query["program_id"] = program_id
    if branch_id and current_user.role == UserRole.ADMIN:
        query["branch_id"] = branch_id
    if start_date:
        query["created_at"] = {"$gte": start_date}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = end_date
        else:
            query["created_at"] = {"$lte": end_date}
    
    leads = await db.leads.find(query, {"_id": 0}).sort("created_at", -1).to_list(10000)
    
    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Name', 'Email', 'Phone', 'Program', 'Source', 'Status', 'City', 'Fee Quoted', 'Created At'])
        
        for lead in leads:
            writer.writerow([
                lead.get('name'),
                lead.get('email'),
                lead.get('number'),
                lead.get('program_name'),
                lead.get('lead_source'),
                lead.get('status'),
                lead.get('city', ''),
                lead.get('fee_quoted', ''),
                lead.get('created_at', '')
            ])
        
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=leads_report.csv"}
        )
    
    return leads

# Unified Reports Endpoint
@api_router.get("/reports/generate")
async def generate_report(
    report_type: str = "leads",
    branch_id: Optional[str] = None,
    status: Optional[str] = None,
    source: Optional[str] = None,
    program_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    format: str = "csv",
    current_user: User = Depends(get_current_user)
):
    """Generate various types of reports"""
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Determine branch filter
    branch_filter = {}
    if current_user.role not in [UserRole.ADMIN]:
        branch_filter["branch_id"] = current_user.branch_id
    elif branch_id and branch_id != "All":
        branch_filter["branch_id"] = branch_id
    
    # Date filter helper
    def get_date_query(date_field):
        date_query = {}
        if start_date:
            date_query["$gte"] = start_date
        if end_date:
            date_query["$lte"] = end_date
        return {date_field: date_query} if date_query else {}
    
    if report_type == "leads":
        query = {**branch_filter, "is_deleted": {"$ne": True}}
        if status and status != "All":
            query["status"] = status
        if source and source != "All":
            query["lead_source"] = source
        if program_id and program_id != "All":
            query["program_id"] = program_id
        if start_date or end_date:
            query.update(get_date_query("created_at"))
        
        leads = await db.leads.find(query, {"_id": 0}).sort("created_at", -1).to_list(10000)
        writer.writerow(['Name', 'Email', 'Phone', 'Program', 'Source', 'Status', 'City', 'Fee Quoted', 'Created At'])
        for lead in leads:
            writer.writerow([
                lead.get('name'), lead.get('email'), lead.get('number'),
                lead.get('program_name'), lead.get('lead_source'), lead.get('status'),
                lead.get('city', ''), lead.get('fee_quoted', ''), lead.get('created_at', '')
            ])
        filename = "leads_report.csv"
    
    elif report_type == "enrollments":
        query = {**branch_filter}
        if start_date or end_date:
            query.update(get_date_query("enrollment_date"))
        
        enrollments = await db.enrollments.find(query, {"_id": 0}).sort("enrollment_date", -1).to_list(10000)
        writer.writerow(['Student Name', 'Email', 'Phone', 'Program', 'Final Fee', 'Payment Status', 'Enrollment Date'])
        for e in enrollments:
            writer.writerow([
                e.get('student_name'), e.get('student_email'), e.get('student_phone'),
                e.get('program_name'), e.get('final_fee', ''), e.get('payment_status', ''),
                e.get('enrollment_date', '')
            ])
        filename = "enrollments_report.csv"
    
    elif report_type == "income":
        query = {**branch_filter}
        if start_date or end_date:
            query.update(get_date_query("payment_date"))
        
        payments = await db.payments.find(query, {"_id": 0}).sort("payment_date", -1).to_list(10000)
        writer.writerow(['Receipt #', 'Student Name', 'Program', 'Amount', 'Payment Mode', 'Payment Date', 'Installment #'])
        for p in payments:
            writer.writerow([
                p.get('receipt_number', ''), p.get('student_name', ''), p.get('program_name', ''),
                p.get('amount', ''), p.get('payment_mode', ''), p.get('payment_date', ''),
                p.get('installment_number', '')
            ])
        filename = "income_report.csv"
    
    elif report_type == "expenses":
        query = {**branch_filter}
        if start_date or end_date:
            query.update(get_date_query("expense_date"))
        
        expenses = await db.expenses.find(query, {"_id": 0}).sort("expense_date", -1).to_list(10000)
        writer.writerow(['Date', 'Category', 'Name', 'Amount', 'Payment Mode', 'Remarks'])
        for e in expenses:
            writer.writerow([
                e.get('expense_date', ''), e.get('category_name', ''), e.get('name', ''),
                e.get('amount', ''), e.get('payment_mode', ''), e.get('remarks', '')
            ])
        filename = "expenses_report.csv"
    
    elif report_type == "pending_payments":
        # Get payment plans with pending installments
        pipeline = [
            {"$match": {**branch_filter}},
            {"$lookup": {
                "from": "enrollments",
                "localField": "enrollment_id",
                "foreignField": "id",
                "as": "enrollment"
            }},
            {"$unwind": "$enrollment"},
            {"$addFields": {
                "total_amount_safe": {"$ifNull": ["$total_amount", 0]},
                "paid_amount_safe": {"$ifNull": ["$paid_amount", 0]}
            }},
            {"$project": {
                "_id": 0,
                "student_name": "$enrollment.student_name",
                "student_phone": {"$ifNull": ["$enrollment.phone", "$enrollment.student_phone"]},
                "program_name": "$enrollment.program_name",
                "total_amount": "$total_amount_safe",
                "paid_amount": "$paid_amount_safe",
                "remaining": {"$subtract": ["$total_amount_safe", "$paid_amount_safe"]},
                "payment_type": "$plan_type",
                "installment_count": "$installments_count"
            }}
        ]
        payment_plans = await db.payment_plans.aggregate(pipeline).to_list(10000)
        pending = [p for p in payment_plans if (p.get('remaining') or 0) > 0]
        
        writer.writerow(['Student Name', 'Phone', 'Program', 'Total Amount', 'Paid Amount', 'Remaining', 'Payment Type'])
        for p in pending:
            writer.writerow([
                p.get('student_name', ''), p.get('student_phone', ''), p.get('program_name', ''),
                p.get('total_amount', ''), p.get('paid_amount', ''), p.get('remaining', ''),
                p.get('payment_type', '')
            ])
        filename = "pending_payments_report.csv"
    
    else:
        raise HTTPException(status_code=400, detail="Invalid report type")
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# Expense Category Management (Admin)
@api_router.post("/admin/expense-categories", response_model=ExpenseCategory)
async def create_expense_category(category: ExpenseCategoryCreate, current_user: User = Depends(require_role([UserRole.ADMIN]))):
    new_category = ExpenseCategory(**category.model_dump())
    category_dict = new_category.model_dump()
    category_dict['created_at'] = category_dict['created_at'].isoformat()
    
    await db.expense_categories.insert_one(category_dict)
    return new_category

@api_router.delete("/admin/expense-categories/{category_id}")
async def delete_expense_category(category_id: str, current_user: User = Depends(require_role([UserRole.ADMIN]))):
    """Delete an expense category - Admin only"""
    # Check if category is used in any expense
    expense_using = await db.expenses.find_one({"category_id": category_id}, {"_id": 0})
    if expense_using:
        raise HTTPException(status_code=400, detail="Cannot delete category - it is being used in expenses")
    
    result = await db.expense_categories.delete_one({"id": category_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category deleted successfully"}

@api_router.get("/expense-categories", response_model=List[ExpenseCategory])
async def get_expense_categories(current_user: User = Depends(get_current_user)):
    categories = await db.expense_categories.find({}, {"_id": 0}).to_list(1000)
    for cat in categories:
        if isinstance(cat.get('created_at'), str):
            cat['created_at'] = datetime.fromisoformat(cat['created_at'])
    return [ExpenseCategory(**c) for c in categories]

# Lead Sources Management (Admin configurable)
@api_router.post("/admin/lead-sources", response_model=LeadSource)
async def create_lead_source(source: LeadSourceCreate, current_user: User = Depends(require_role([UserRole.ADMIN]))):
    """Create a new lead source - Admin only"""
    # Check if source already exists
    existing = await db.lead_sources.find_one({"name": source.name}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Lead source with this name already exists")
    
    new_source = LeadSource(**source.model_dump())
    source_dict = new_source.model_dump()
    source_dict['created_at'] = source_dict['created_at'].isoformat()
    
    await db.lead_sources.insert_one(source_dict)
    return new_source

@api_router.get("/lead-sources", response_model=List[LeadSource])
async def get_lead_sources(current_user: User = Depends(get_current_user)):
    """Get all active lead sources"""
    sources = await db.lead_sources.find({"is_active": True}, {"_id": 0}).to_list(100)
    for src in sources:
        if isinstance(src.get('created_at'), str):
            src['created_at'] = datetime.fromisoformat(src['created_at'])
    return [LeadSource(**s) for s in sources]

@api_router.delete("/admin/lead-sources/{source_id}")
async def delete_lead_source(source_id: str, current_user: User = Depends(require_role([UserRole.ADMIN]))):
    """Delete a lead source - Admin only (soft delete by setting inactive)"""
    result = await db.lead_sources.update_one(
        {"id": source_id},
        {"$set": {"is_active": False}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Lead source not found")
    return {"message": "Lead source deleted successfully"}

# Expense Management (FDA)
@api_router.post("/expenses", response_model=Expense)
async def create_expense(expense: ExpenseCreate, current_user: User = Depends(get_current_user)):
    if current_user.role not in [UserRole.ADMIN, UserRole.FRONT_DESK]:
        raise HTTPException(status_code=403, detail="Only Front Desk Executive can add expenses")
    
    if not current_user.branch_id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=400, detail="User must be assigned to a branch")
    
    category = await db.expense_categories.find_one({"id": expense.category_id}, {"_id": 0})
    if not category:
        raise HTTPException(status_code=404, detail="Expense category not found")
    
    expense_data = expense.model_dump()
    expense_data.pop('expense_date', None)  # Remove to avoid duplicate argument
    
    new_expense = Expense(
        **expense_data,
        branch_id=current_user.branch_id or "admin",
        category_name=category['name'],
        created_by=current_user.id,
        expense_date=datetime.fromisoformat(expense.expense_date).date()
    )
    expense_dict = new_expense.model_dump()
    expense_dict['created_at'] = expense_dict['created_at'].isoformat()
    expense_dict['expense_date'] = expense_dict['expense_date'].isoformat()
    
    await db.expenses.insert_one(expense_dict)
    return new_expense

@api_router.get("/expenses", response_model=List[Expense])
async def get_expenses(current_user: User = Depends(get_current_user)):
    query = {}
    if current_user.role not in [UserRole.ADMIN]:
        query["branch_id"] = current_user.branch_id
    
    expenses = await db.expenses.find(query, {"_id": 0}).sort("expense_date", -1).to_list(1000)
    for exp in expenses:
        if isinstance(exp.get('created_at'), str):
            exp['created_at'] = datetime.fromisoformat(exp['created_at'])
        if isinstance(exp.get('expense_date'), str):
            exp['expense_date'] = datetime.fromisoformat(exp['expense_date']).date()
    return [Expense(**e) for e in expenses]

@api_router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, current_user: User = Depends(get_current_user)):
    """Delete an expense - Branch Admin only for their branch"""
    if current_user.role != UserRole.BRANCH_ADMIN:
        raise HTTPException(status_code=403, detail="Only Branch Admin can delete expenses")
    
    expense = await db.expenses.find_one({"id": expense_id}, {"_id": 0})
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    # Branch Admin can only delete expenses from their branch
    if expense.get('branch_id') != current_user.branch_id:
        raise HTTPException(status_code=403, detail="You can only delete expenses from your branch")
    
    await db.expenses.delete_one({"id": expense_id})
    return {"message": "Expense deleted successfully"}

# File Upload for Student Photos
@api_router.post("/upload/image")
async def upload_image(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    """Upload student photo or document image and return base64 data URL"""
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="Only image files are allowed")
    
    # Read file content
    content = await file.read()
    
    # Check file size (max 5MB)
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size must be less than 5MB")
    
    # Convert to base64 data URL
    base64_data = base64.b64encode(content).decode('utf-8')
    data_url = f"data:{file.content_type};base64,{base64_data}"
    
    return {"url": data_url, "filename": file.filename}

# Enrollment Management (FDA)
@api_router.post("/enrollments", response_model=Enrollment)
async def create_enrollment(enrollment: EnrollmentCreate, current_user: User = Depends(get_current_user)):
    if current_user.role not in [UserRole.ADMIN, UserRole.FRONT_DESK, UserRole.BRANCH_ADMIN]:
        raise HTTPException(status_code=403, detail="Only Front Desk Executive or Branch Admin can create enrollments")
    
    # Verify lead exists and is converted
    lead = await db.leads.find_one({"id": enrollment.lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    if lead["status"] != LeadStatus.CONVERTED.value:
        raise HTTPException(status_code=400, detail="Only converted leads can be enrolled")
    
    # Check if already enrolled
    existing = await db.enrollments.find_one({"lead_id": enrollment.lead_id}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Lead already enrolled")
    
    # Get program details
    program = await db.programs.find_one({"id": enrollment.program_id}, {"_id": 0})
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    
    # Calculate final fee
    discount_amount = (enrollment.fee_quoted * (enrollment.discount_percent or 0)) / 100
    final_fee = enrollment.fee_quoted - discount_amount
    
    # Generate custom enrollment ID
    branch_id = current_user.branch_id or lead["branch_id"]
    custom_enrollment_id = await generate_custom_id(branch_id, "E")
    
    enrollment_data = enrollment.model_dump()
    enrollment_data.pop('enrollment_date', None)  # Remove to avoid duplicate argument
    
    new_enrollment = Enrollment(
        **enrollment_data,
        enrollment_id=custom_enrollment_id,
        branch_id=branch_id,
        program_name=program['name'],
        final_fee=final_fee,
        enrollment_date=datetime.fromisoformat(enrollment.enrollment_date).date(),
        created_by=current_user.id
    )
    
    enrollment_dict = new_enrollment.model_dump()
    enrollment_dict['created_at'] = enrollment_dict['created_at'].isoformat()
    enrollment_dict['enrollment_date'] = enrollment_dict['enrollment_date'].isoformat()
    
    await db.enrollments.insert_one(enrollment_dict)
    
    # Send WhatsApp notification for enrollment confirmation
    await send_whatsapp_notification(
        new_enrollment.phone,
        "enrollment_confirmed",
        {
            "name": new_enrollment.student_name, 
            "enrollment_number": custom_enrollment_id or new_enrollment.id,
            "course": new_enrollment.program_name
        }
    )
    
    return new_enrollment

@api_router.get("/enrollments", response_model=List[Enrollment])
async def get_enrollments(current_user: User = Depends(get_current_user)):
    query = {}
    if current_user.role != UserRole.ADMIN:
        query["branch_id"] = current_user.branch_id
    
    enrollments = await db.enrollments.find(query, {"_id": 0}).sort("enrollment_date", -1).to_list(1000)
    for enr in enrollments:
        if isinstance(enr.get('created_at'), str):
            enr['created_at'] = datetime.fromisoformat(enr['created_at'])
        if isinstance(enr.get('enrollment_date'), str):
            enr['enrollment_date'] = datetime.fromisoformat(enr['enrollment_date']).date()
    return [Enrollment(**e) for e in enrollments]

# Payment Plan Management
@api_router.post("/payment-plans", response_model=PaymentPlan)
async def create_payment_plan(plan: PaymentPlanCreate, current_user: User = Depends(get_current_user)):
    if current_user.role not in [UserRole.ADMIN, UserRole.FRONT_DESK]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Check if enrollment exists
    enrollment = await db.enrollments.find_one({"id": plan.enrollment_id}, {"_id": 0})
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    
    # Check if payment plan already exists
    existing_plan = await db.payment_plans.find_one({"enrollment_id": plan.enrollment_id}, {"_id": 0})
    if existing_plan:
        raise HTTPException(status_code=400, detail="Payment plan already exists for this enrollment")
    
    new_plan = PaymentPlan(
        enrollment_id=plan.enrollment_id,
        plan_type=plan.plan_type,
        total_amount=plan.total_amount,
        installments_count=plan.installments_count if plan.plan_type == PaymentPlanType.INSTALLMENTS else None
    )
    
    plan_dict = new_plan.model_dump()
    plan_dict['created_at'] = plan_dict['created_at'].isoformat()
    
    await db.payment_plans.insert_one(plan_dict)
    
    # If installments, create installment schedule
    if plan.plan_type == PaymentPlanType.INSTALLMENTS and plan.installments:
        for inst in plan.installments:
            await db.installment_schedule.insert_one({
                "id": str(uuid.uuid4()),
                "payment_plan_id": new_plan.id,
                "enrollment_id": plan.enrollment_id,
                "installment_number": inst["installment_number"],
                "amount": inst["amount"],
                "due_date": inst["due_date"],
                "status": "Pending"
            })
    
    return new_plan

# Payment Recording
@api_router.post("/payments", response_model=Payment)
async def create_payment(payment: PaymentCreate, current_user: User = Depends(get_current_user)):
    if current_user.role not in [UserRole.ADMIN, UserRole.FRONT_DESK, UserRole.BRANCH_ADMIN]:
        raise HTTPException(status_code=403, detail="Only Front Desk Executive or Branch Admin can record payments")
    
    # Get enrollment to get branch_id and validate payment amount
    enrollment = await db.enrollments.find_one({"id": payment.enrollment_id}, {"_id": 0})
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    
    # Calculate total paid so far
    existing_payments = await db.payments.find({"enrollment_id": payment.enrollment_id}, {"_id": 0, "amount": 1}).to_list(1000)
    total_paid = sum(p.get('amount', 0) for p in existing_payments)
    
    # Check if payment exceeds remaining fee
    final_fee = enrollment.get('final_fee', 0)
    remaining_fee = final_fee - total_paid
    
    if payment.amount > remaining_fee:
        raise HTTPException(
            status_code=400, 
            detail=f"Payment amount (₹{payment.amount}) exceeds remaining fee (₹{remaining_fee}). Total fee: ₹{final_fee}, Already paid: ₹{total_paid}"
        )
    
    # Validate installment payment - must pay exact or more than installment amount
    if payment.installment_number and payment.payment_plan_id:
        installment = await db.installment_schedule.find_one(
            {
                "payment_plan_id": payment.payment_plan_id,
                "installment_number": payment.installment_number
            },
            {"_id": 0}
        )
        if installment:
            installment_amount = installment.get('amount', 0)
            # Only Branch Admin can pay less than installment amount (critical cases)
            if payment.amount < installment_amount and current_user.role not in [UserRole.ADMIN, UserRole.BRANCH_ADMIN]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Payment amount (₹{payment.amount}) is less than installment amount (₹{installment_amount}). Please pay the full installment amount or contact Branch Admin for special cases."
                )
    
    # Generate custom receipt number
    branch_id = enrollment.get('branch_id', current_user.branch_id or 'default')
    custom_receipt_id = await generate_custom_id(branch_id, "R")
    
    payment_data = payment.model_dump()
    payment_data.pop('payment_date', None)  # Remove to avoid duplicate argument
    
    new_payment = Payment(
        **payment_data,
        receipt_number=custom_receipt_id or f"RCP-{str(uuid.uuid4())[:8].upper()}",
        branch_id=branch_id,
        payment_date=datetime.fromisoformat(payment.payment_date).date(),
        created_by=current_user.id
    )
    
    payment_dict = new_payment.model_dump()
    payment_dict['created_at'] = payment_dict['created_at'].isoformat()
    payment_dict['payment_date'] = payment_dict['payment_date'].isoformat()
    
    await db.payments.insert_one(payment_dict)
    
    # Update installment status if applicable
    if payment.installment_number:
        # Get the installment details
        installment = await db.installment_schedule.find_one(
            {
                "payment_plan_id": payment.payment_plan_id,
                "installment_number": payment.installment_number
            },
            {"_id": 0}
        )
        
        if installment:
            installment_amount = installment.get('amount', 0)
            
            # Check if this is a partial payment for this installment
            if payment.amount < installment_amount:
                shortfall = installment_amount - payment.amount
                
                # Get remaining unpaid installments (after the current one)
                remaining_installments = await db.installment_schedule.find(
                    {
                        "payment_plan_id": payment.payment_plan_id,
                        "installment_number": {"$gt": payment.installment_number},
                        "status": {"$ne": "Paid"}
                    },
                    {"_id": 0}
                ).to_list(100)
                
                # Distribute shortfall equally among remaining installments
                if remaining_installments:
                    shortfall_per_installment = round(shortfall / len(remaining_installments), 2)
                    
                    for remaining_inst in remaining_installments:
                        new_amount = remaining_inst.get('amount', 0) + shortfall_per_installment
                        await db.installment_schedule.update_one(
                            {
                                "payment_plan_id": payment.payment_plan_id,
                                "installment_number": remaining_inst.get('installment_number')
                            },
                            {"$set": {"amount": new_amount}}
                        )
                    
                    logger.info(f"Redistributed shortfall of ₹{shortfall} (₹{shortfall_per_installment} each) to {len(remaining_installments)} remaining installments")
                else:
                    # This is the LAST installment and partial payment - create a new installment
                    # Get total number of installments
                    all_installments = await db.installment_schedule.find(
                        {"payment_plan_id": payment.payment_plan_id},
                        {"_id": 0}
                    ).to_list(100)
                    new_installment_number = len(all_installments) + 1
                    
                    # Calculate due date (30 days from now)
                    new_due_date = (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%d")
                    
                    # Create new installment for remaining amount
                    new_installment = {
                        "id": str(uuid.uuid4()),
                        "payment_plan_id": payment.payment_plan_id,
                        "enrollment_id": payment.enrollment_id,
                        "installment_number": new_installment_number,
                        "amount": shortfall,
                        "due_date": new_due_date,
                        "status": "Pending"
                    }
                    await db.installment_schedule.insert_one(new_installment)
                    
                    # Update payment plan total installments
                    await db.payment_plans.update_one(
                        {"id": payment.payment_plan_id},
                        {"$set": {"total_installments": new_installment_number}}
                    )
                    
                    logger.info(f"Created new installment #{new_installment_number} for ₹{shortfall} due on {new_due_date}")
            
            # Mark current installment as Paid
            await db.installment_schedule.update_one(
                {
                    "payment_plan_id": payment.payment_plan_id,
                    "installment_number": payment.installment_number
                },
                {"$set": {"status": "Paid", "paid_date": payment.payment_date, "paid_amount": payment.amount}}
            )
    
    # Update total_paid and payment_status in enrollment
    new_total_paid = total_paid + payment.amount
    new_payment_status = "Paid" if new_total_paid >= final_fee else ("Partial" if new_total_paid > 0 else "Pending")
    await db.enrollments.update_one(
        {"id": payment.enrollment_id},
        {"$set": {
            "total_paid": new_total_paid,
            "payment_status": new_payment_status
        }}
    )
    
    # Send WhatsApp notification for payment received with full details
    pending_fee = final_fee - new_total_paid
    await send_whatsapp_notification(
        enrollment.get('phone', ''),
        "payment_received",
        {
            "name": enrollment.get('student_name', ''),
            "amount": str(payment.amount),
            "total_fee": str(final_fee),
            "paid_fee": str(new_total_paid),
            "pending_fee": str(pending_fee),
            "receipt_number": new_payment.receipt_number
        }
    )
    
    return new_payment

@api_router.get("/enrollments/{enrollment_id}/payments")
async def get_enrollment_payments(enrollment_id: str, current_user: User = Depends(get_current_user)):
    payments = await db.payments.find({"enrollment_id": enrollment_id}, {"_id": 0}).sort("payment_date", -1).to_list(1000)
    for pay in payments:
        if isinstance(pay.get('created_at'), str):
            pay['created_at'] = datetime.fromisoformat(pay['created_at'])
        if isinstance(pay.get('payment_date'), str):
            pay['payment_date'] = datetime.fromisoformat(pay['payment_date']).date()
    return payments

@api_router.get("/enrollments/{enrollment_id}/payment-plan")
async def get_enrollment_payment_plan(enrollment_id: str, current_user: User = Depends(get_current_user)):
    plan = await db.payment_plans.find_one({"enrollment_id": enrollment_id}, {"_id": 0})
    if not plan:
        return None
    
    if isinstance(plan.get('created_at'), str):
        plan['created_at'] = datetime.fromisoformat(plan['created_at'])
    
    # Get installment schedule if applicable
    if plan.get('plan_type') == PaymentPlanType.INSTALLMENTS:
        schedule = await db.installment_schedule.find({"payment_plan_id": plan['id']}, {"_id": 0}).to_list(1000)
        plan['installments'] = schedule
    
    return plan

@api_router.get("/payments/{payment_id}/receipt")
async def generate_receipt(payment_id: str, current_user: User = Depends(get_current_user)):
    """Generate payment receipt"""
    payment = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    enrollment = await db.enrollments.find_one({"id": payment['enrollment_id']}, {"_id": 0})
    branch = await db.branches.find_one({"id": enrollment.get('branch_id')}, {"_id": 0}) if enrollment else None
    
    # Calculate total paid for this enrollment
    all_payments = await db.payments.find({"enrollment_id": payment['enrollment_id']}, {"_id": 0, "amount": 1}).to_list(1000)
    total_paid = sum(p.get('amount', 0) for p in all_payments)
    
    receipt_data = {
        "receipt_number": payment.get('receipt_number', payment_id[:8].upper()),
        "payment_id": payment_id,
        "payment_date": payment['payment_date'],
        "student_name": enrollment['student_name'] if enrollment else 'N/A',
        "student_email": enrollment.get('email', ''),
        "phone": enrollment.get('phone', ''),
        "program_name": enrollment['program_name'] if enrollment else 'N/A',
        "enrollment_id": enrollment.get('enrollment_id', enrollment.get('id', '')[:8].upper()) if enrollment else 'N/A',
        "amount": payment['amount'],
        "payment_mode": payment['payment_mode'],
        "installment_number": payment.get('installment_number'),
        "remarks": payment.get('remarks', ''),
        "total_fee": enrollment.get('final_fee', 0) if enrollment else 0,
        "total_paid": total_paid,
        "branch_name": branch.get('name', 'ETI Educom') if branch else 'ETI Educom',
        "branch_address": branch.get('address', '') if branch else '',
        "branch_city": branch.get('city', '') if branch else '',
        "branch_phone": branch.get('branch_phone', '') if branch else '',
        "institute_name": "ETI Educom",
        "institute_tagline": "Empowering Education Counselors with Precision Tools"
    }
    
    return receipt_data

# All Payments Page with filters
@api_router.get("/payments/all")
async def get_all_payments(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    student_name: Optional[str] = None,
    contact_number: Optional[str] = None,
    payment_mode: Optional[str] = None,
    branch_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get all payments with filters"""
    query = {}
    
    # Branch filter based on role
    if current_user.role != UserRole.ADMIN:
        query["branch_id"] = current_user.branch_id
    elif branch_id:
        query["branch_id"] = branch_id
    
    if start_date:
        query["payment_date"] = {"$gte": start_date}
    if end_date:
        if "payment_date" in query:
            query["payment_date"]["$lte"] = end_date
        else:
            query["payment_date"] = {"$lte": end_date}
    if payment_mode:
        query["payment_mode"] = payment_mode
    
    payments = await db.payments.find(query, {"_id": 0}).sort("payment_date", -1).to_list(10000)
    
    # Enrich with enrollment data and filter by student name/contact if provided
    result = []
    for pay in payments:
        enrollment = await db.enrollments.find_one({"id": pay.get('enrollment_id')}, {"_id": 0})
        if enrollment:
            pay['student_name'] = enrollment.get('student_name', '')
            pay['student_email'] = enrollment.get('email', '')
            pay['student_phone'] = enrollment.get('phone', '')
            pay['program_name'] = enrollment.get('program_name', '')
            pay['final_fee'] = enrollment.get('final_fee', 0)
            
            # Filter by student name if provided
            if student_name and student_name.lower() not in pay['student_name'].lower():
                continue
            # Filter by contact number if provided
            if contact_number and contact_number not in pay.get('student_phone', ''):
                continue
        
        if isinstance(pay.get('created_at'), str):
            pay['created_at'] = datetime.fromisoformat(pay['created_at'])
        if isinstance(pay.get('payment_date'), str):
            pay['payment_date'] = datetime.fromisoformat(pay['payment_date']).date()
        
        result.append(pay)
    
    return result

# Pending Payments (Both One-time and Installments)
@api_router.get("/payments/pending")
async def get_pending_payments(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    student_name: Optional[str] = None,
    contact_number: Optional[str] = None,
    branch_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get all pending payments - both one-time and installments"""
    pending_payments = []
    today = datetime.now(timezone.utc).date().isoformat()
    
    # Determine branch filter
    branch_filter = {}
    if current_user.role != UserRole.ADMIN:
        branch_filter["branch_id"] = current_user.branch_id
    elif branch_id:
        branch_filter["branch_id"] = branch_id
    
    # Get all enrollments for the branch
    enrollments = await db.enrollments.find(branch_filter, {"_id": 0}).to_list(10000)
    
    for enrollment in enrollments:
        # Filter by student name
        if student_name and student_name.lower() not in enrollment.get('student_name', '').lower():
            continue
        
        # Filter by contact
        if contact_number and contact_number not in enrollment.get('phone', ''):
            continue
        
        final_fee = enrollment.get('final_fee', 0)
        enrollment_id = enrollment.get('id')
        
        # Get total paid for this enrollment
        payments = await db.payments.find({"enrollment_id": enrollment_id}, {"_id": 0, "amount": 1}).to_list(1000)
        total_paid = sum(p.get('amount', 0) for p in payments)
        pending_amount = final_fee - total_paid
        
        if pending_amount <= 0:
            continue  # Skip fully paid enrollments
        
        # Check if this enrollment has an installment plan
        payment_plan = await db.payment_plans.find_one({"enrollment_id": enrollment_id}, {"_id": 0})
        
        if payment_plan and payment_plan.get('plan_type') == PaymentPlanType.INSTALLMENTS.value:
            # Get unpaid installments from schedule
            schedule = await db.installment_schedule.find(
                {"payment_plan_id": payment_plan['id'], "status": {"$ne": "Paid"}},
                {"_id": 0}
            ).to_list(100)
            
            for inst in schedule:
                due_date = inst.get('due_date', '')
                
                # Date filters
                if start_date and due_date < start_date:
                    continue
                if end_date and due_date > end_date:
                    continue
                
                is_overdue = due_date < today
                
                pending_payments.append({
                    "type": "installment",
                    "enrollment_id": enrollment_id,
                    "student_name": enrollment.get('student_name', ''),
                    "student_phone": enrollment.get('phone', ''),
                    "student_email": enrollment.get('email', ''),
                    "program_name": enrollment.get('program_name', ''),
                    "installment_number": inst.get('installment_number'),
                    "amount": inst.get('amount'),
                    "due_date": due_date,
                    "is_overdue": is_overdue,
                    "payment_plan_id": payment_plan['id'],
                    "total_installments": payment_plan.get('installments_count', 0),
                    "total_fee": final_fee,
                    "total_paid": total_paid,
                    "pending_amount": pending_amount
                })
        else:
            # One-time payment - not fully paid yet
            # Use enrollment date as reference for due date
            enrollment_date = enrollment.get('enrollment_date', today)
            
            # Date filters for one-time (use enrollment date as reference)
            if start_date and enrollment_date < start_date:
                continue
            if end_date and enrollment_date > end_date:
                continue
            
            # Consider it overdue if enrollment was more than 30 days ago
            enrollment_date_obj = datetime.fromisoformat(enrollment_date).date() if isinstance(enrollment_date, str) else enrollment_date
            today_obj = datetime.fromisoformat(today).date() if isinstance(today, str) else today
            days_since_enrollment = (today_obj - enrollment_date_obj).days if hasattr(enrollment_date_obj, 'days') or isinstance(enrollment_date_obj, date) else 0
            is_overdue = days_since_enrollment > 30 and pending_amount > 0
            
            pending_payments.append({
                "type": "one_time",
                "enrollment_id": enrollment_id,
                "student_name": enrollment.get('student_name', ''),
                "student_phone": enrollment.get('phone', ''),
                "student_email": enrollment.get('email', ''),
                "program_name": enrollment.get('program_name', ''),
                "installment_number": None,
                "amount": pending_amount,
                "due_date": enrollment_date,
                "is_overdue": is_overdue,
                "payment_plan_id": None,
                "total_installments": 0,
                "total_fee": final_fee,
                "total_paid": total_paid,
                "pending_amount": pending_amount
            })
    
    # Sort by overdue first, then by due date
    pending_payments.sort(key=lambda x: (not x['is_overdue'], x['due_date']))
    
    return pending_payments

# Financial Analytics
@api_router.get("/analytics/financial/monthly")
async def get_monthly_financial_analytics(year: int = None, current_user: User = Depends(get_current_user)):
    """Get monthly income and expense data for charts"""
    if year is None:
        year = datetime.now().year
    
    # Build query based on user role
    branch_query = {}
    if current_user.role != UserRole.ADMIN:
        branch_query["branch_id"] = current_user.branch_id
    
    # Get all payments for the year
    start_date = f"{year}-01-01"
    end_date = f"{year}-12-31"
    
    # Get payments (income)
    payments = await db.payments.find({
        **branch_query,
        "payment_date": {"$gte": start_date, "$lte": end_date}
    }, {"_id": 0}).to_list(10000)
    
    # Get expenses
    expenses = await db.expenses.find({
        **branch_query,
        "expense_date": {"$gte": start_date, "$lte": end_date}
    }, {"_id": 0}).to_list(10000)
    
    # Aggregate by month
    monthly_data = {}
    for month in range(1, 13):
        month_str = f"{year}-{str(month).zfill(2)}"
        monthly_data[month_str] = {"month": month, "income": 0, "expenses": 0}
    
    for payment in payments:
        pay_date = payment.get('payment_date', '')
        if isinstance(pay_date, str):
            month_key = pay_date[:7]
        else:
            month_key = pay_date.strftime('%Y-%m')
        if month_key in monthly_data:
            monthly_data[month_key]["income"] += payment.get('amount', 0)
    
    for expense in expenses:
        exp_date = expense.get('expense_date', '')
        if isinstance(exp_date, str):
            month_key = exp_date[:7]
        else:
            month_key = exp_date.strftime('%Y-%m')
        if month_key in monthly_data:
            monthly_data[month_key]["expenses"] += expense.get('amount', 0)
    
    # Convert to list sorted by month
    result = sorted(monthly_data.values(), key=lambda x: x["month"])
    month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    for item in result:
        item["month_name"] = month_names[item["month"] - 1]
    
    return {
        "year": year,
        "monthly_data": result,
        "total_income": sum(p.get('amount', 0) for p in payments),
        "total_expenses": sum(e.get('amount', 0) for e in expenses)
    }

@api_router.get("/analytics/financial/branch-wise")
async def get_branch_wise_financial(current_user: User = Depends(require_role([UserRole.ADMIN]))):
    """Get income and expenses for all branches - Admin only"""
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    
    branch_financials = []
    for branch in branches:
        branch_id = branch["id"]
        
        # Get total income from payments
        payments = await db.payments.find({"branch_id": branch_id}, {"_id": 0, "amount": 1}).to_list(10000)
        total_income = sum(p.get('amount', 0) for p in payments)
        
        # Get total expenses
        expenses = await db.expenses.find({"branch_id": branch_id}, {"_id": 0, "amount": 1}).to_list(10000)
        total_expenses = sum(e.get('amount', 0) for e in expenses)
        
        # Get enrollments count
        enrollments_count = await db.enrollments.count_documents({"branch_id": branch_id})
        
        branch_financials.append({
            "branch_id": branch_id,
            "branch_name": branch["name"],
            "branch_location": branch.get("location", ""),
            "total_income": total_income,
            "total_expenses": total_expenses,
            "net_profit": total_income - total_expenses,
            "enrollments_count": enrollments_count
        })
    
    # Sort by income descending
    branch_financials.sort(key=lambda x: x["total_income"], reverse=True)
    
    return branch_financials

# Marketing Resources Management
@api_router.post("/admin/resources", response_model=MarketingResource)
async def create_resource(resource: MarketingResourceCreate, current_user: User = Depends(require_role([UserRole.ADMIN]))):
    """Create a marketing resource - Admin only"""
    new_resource = MarketingResource(
        **resource.model_dump(),
        created_by=current_user.id
    )
    resource_dict = new_resource.model_dump()
    resource_dict['created_at'] = resource_dict['created_at'].isoformat()
    
    await db.marketing_resources.insert_one(resource_dict)
    return new_resource

@api_router.get("/resources", response_model=List[MarketingResource])
async def get_resources(current_user: User = Depends(get_current_user)):
    """Get all marketing resources - accessible to all users"""
    resources = await db.marketing_resources.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for res in resources:
        if isinstance(res.get('created_at'), str):
            res['created_at'] = datetime.fromisoformat(res['created_at'])
    return [MarketingResource(**r) for r in resources]

@api_router.delete("/admin/resources/{resource_id}")
async def delete_resource(resource_id: str, current_user: User = Depends(require_role([UserRole.ADMIN]))):
    """Delete a marketing resource - Admin only"""
    result = await db.marketing_resources.delete_one({"id": resource_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Resource not found")
    return {"message": "Resource deleted successfully"}

# WhatsApp Settings Management
@api_router.get("/admin/whatsapp-settings")
async def get_whatsapp_settings_api(current_user: User = Depends(require_role([UserRole.ADMIN]))):
    """Get WhatsApp notification settings - Super Admin only"""
    settings = await get_whatsapp_settings()
    return settings

@api_router.put("/admin/whatsapp-settings")
async def update_whatsapp_settings(
    settings_update: WhatsAppSettingsUpdate, 
    current_user: User = Depends(require_role([UserRole.ADMIN]))
):
    """Update WhatsApp notification settings - Super Admin only"""
    existing = await db.whatsapp_settings.find_one({}, {"_id": 0})
    
    update_data = {k: v for k, v in settings_update.model_dump().items() if v is not None}
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    update_data['updated_by'] = current_user.id
    
    if existing:
        await db.whatsapp_settings.update_one({}, {"$set": update_data})
    else:
        new_settings = WhatsAppSettings(**update_data)
        settings_dict = new_settings.model_dump()
        settings_dict['updated_at'] = settings_dict['updated_at'].isoformat()
        await db.whatsapp_settings.insert_one(settings_dict)
    
    return {"message": "WhatsApp settings updated successfully"}

# Super Admin Dashboard Analytics
@api_router.get("/analytics/super-admin-dashboard")
async def get_super_admin_dashboard(current_user: User = Depends(require_role([UserRole.ADMIN]))):
    """Get comprehensive dashboard data for Super Admin"""
    branches = await db.branches.find({}, {"_id": 0}).to_list(100)
    
    branch_data = []
    for branch in branches:
        branch_id = branch["id"]
        
        # Leads count
        leads_count = await db.leads.count_documents({"branch_id": branch_id, "is_deleted": {"$ne": True}})
        
        # Enrollments count
        enrollments_count = await db.enrollments.count_documents({"branch_id": branch_id})
        
        # Total income
        payments = await db.payments.find({"branch_id": branch_id}, {"_id": 0, "amount": 1}).to_list(10000)
        total_income = sum(p.get('amount', 0) for p in payments)
        
        # Converted leads
        converted_count = await db.leads.count_documents({"branch_id": branch_id, "status": "Converted", "is_deleted": {"$ne": True}})
        
        # Conversion rate
        conversion_rate = (converted_count / leads_count * 100) if leads_count > 0 else 0
        
        branch_data.append({
            "branch_id": branch_id,
            "branch_name": branch["name"],
            "branch_location": branch.get("location", ""),
            "leads_count": leads_count,
            "enrollments_count": enrollments_count,
            "total_income": total_income,
            "converted_count": converted_count,
            "conversion_rate": round(conversion_rate, 1)
        })
    
    # Sort by income to determine performance
    branch_data.sort(key=lambda x: x["total_income"], reverse=True)
    
    # Calculate totals
    total_leads = sum(b["leads_count"] for b in branch_data)
    total_enrollments = sum(b["enrollments_count"] for b in branch_data)
    total_income = sum(b["total_income"] for b in branch_data)
    avg_income = total_income / len(branch_data) if branch_data else 0
    
    # Mark performance
    for branch in branch_data:
        if branch["total_income"] >= avg_income * 1.2:
            branch["performance"] = "outperforming"
        elif branch["total_income"] <= avg_income * 0.8:
            branch["performance"] = "underperforming"
        else:
            branch["performance"] = "average"
    
    return {
        "branches": branch_data,
        "totals": {
            "total_leads": total_leads,
            "total_enrollments": total_enrollments,
            "total_income": total_income,
            "average_income_per_branch": avg_income
        }
    }

# Branch Admin specific endpoints
@api_router.delete("/payments/{payment_id}")
async def delete_payment(payment_id: str, current_user: User = Depends(get_current_user)):
    """Delete a payment - Branch Admin only for their branch"""
    if current_user.role not in [UserRole.ADMIN, UserRole.BRANCH_ADMIN]:
        raise HTTPException(status_code=403, detail="Only Branch Admin can delete payments")
    
    payment = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    # Branch Admin can only delete payments from their branch
    if current_user.role == UserRole.BRANCH_ADMIN and payment.get('branch_id') != current_user.branch_id:
        raise HTTPException(status_code=403, detail="You can only delete payments from your branch")
    
    await db.payments.delete_one({"id": payment_id})
    return {"message": "Payment deleted successfully"}

@api_router.put("/payments/{payment_id}")
async def update_payment(payment_id: str, payment_update: dict, current_user: User = Depends(get_current_user)):
    """Update a payment - Branch Admin only for their branch"""
    if current_user.role not in [UserRole.ADMIN, UserRole.BRANCH_ADMIN]:
        raise HTTPException(status_code=403, detail="Only Branch Admin can update payments")
    
    payment = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    # Branch Admin can only update payments from their branch
    if current_user.role == UserRole.BRANCH_ADMIN and payment.get('branch_id') != current_user.branch_id:
        raise HTTPException(status_code=403, detail="You can only update payments from your branch")
    
    # Only allow certain fields to be updated
    allowed_fields = ['amount', 'payment_mode', 'payment_date', 'remarks']
    update_data = {k: v for k, v in payment_update.items() if k in allowed_fields}
    
    if update_data:
        await db.payments.update_one({"id": payment_id}, {"$set": update_data})
    
    return {"message": "Payment updated successfully"}

# Push Notifications Endpoints
@api_router.post("/notifications")
async def create_notification(notification: PushNotificationCreate, current_user: User = Depends(get_current_user)):
    """Create and send a push notification
    - Super Admin can send to all Branch Admins
    - Branch Admin can send to FDEs and Counsellors in their branch
    """
    recipient_ids = []
    
    if current_user.role == UserRole.ADMIN:
        # Super Admin can send to Branch Admins
        if notification.recipient_role:
            users = await db.users.find({"role": notification.recipient_role}, {"_id": 0, "id": 1}).to_list(1000)
            recipient_ids = [u['id'] for u in users]
        elif notification.recipient_ids:
            recipient_ids = notification.recipient_ids
    elif current_user.role == UserRole.BRANCH_ADMIN:
        # Branch Admin can only send to their branch's FDEs and Counsellors
        query = {
            "branch_id": current_user.branch_id,
            "role": {"$in": [UserRole.FRONT_DESK.value, UserRole.COUNSELLOR.value]}
        }
        if notification.recipient_ids:
            query["id"] = {"$in": notification.recipient_ids}
        users = await db.users.find(query, {"_id": 0, "id": 1}).to_list(1000)
        recipient_ids = [u['id'] for u in users]
    else:
        raise HTTPException(status_code=403, detail="Only Admin or Branch Admin can send notifications")
    
    if not recipient_ids:
        raise HTTPException(status_code=400, detail="No recipients found")
    
    new_notification = PushNotification(
        sender_id=current_user.id,
        sender_name=current_user.name,
        sender_role=current_user.role.value,
        recipient_ids=recipient_ids,
        recipient_role=notification.recipient_role,
        branch_id=current_user.branch_id,
        title=notification.title,
        message=notification.message,
        notification_type=notification.notification_type
    )
    
    notif_dict = new_notification.model_dump()
    notif_dict['created_at'] = notif_dict['created_at'].isoformat()
    
    await db.notifications.insert_one(notif_dict)
    return {"message": f"Notification sent to {len(recipient_ids)} recipients", "notification_id": new_notification.id}

@api_router.get("/notifications")
async def get_my_notifications(current_user: User = Depends(get_current_user)):
    """Get notifications for the current user"""
    notifications = await db.notifications.find(
        {"recipient_ids": current_user.id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    for n in notifications:
        if isinstance(n.get('created_at'), str):
            n['created_at'] = datetime.fromisoformat(n['created_at'])
    
    return notifications

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: User = Depends(get_current_user)):
    """Mark a notification as read"""
    await db.notifications.update_one(
        {"id": notification_id, "recipient_ids": current_user.id},
        {"$set": {"is_read": True}}
    )
    return {"message": "Notification marked as read"}

@api_router.put("/notifications/mark-all-read")
async def mark_all_notifications_read(current_user: User = Depends(get_current_user)):
    """Mark all notifications as read for current user"""
    await db.notifications.update_many(
        {"recipient_ids": current_user.id, "is_read": False},
        {"$set": {"is_read": True}}
    )
    return {"message": "All notifications marked as read"}

@api_router.get("/notifications/unread-count")
async def get_unread_count(current_user: User = Depends(get_current_user)):
    """Get count of unread notifications"""
    count = await db.notifications.count_documents({
        "recipient_ids": current_user.id,
        "is_read": False
    })
    return {"count": count}

# Students (Enrolled) Endpoints
@api_router.get("/students")
async def get_students(current_user: User = Depends(get_current_user)):
    """Get enrolled students with full details"""
    query = {}
    if current_user.role not in [UserRole.ADMIN]:
        query["branch_id"] = current_user.branch_id
    
    enrollments = await db.enrollments.find(query, {"_id": 0}).sort("enrollment_date", -1).to_list(1000)
    
    students = []
    for e in enrollments:
        # Get payment plan info
        payment_plan = await db.payment_plans.find_one({"enrollment_id": e['id']}, {"_id": 0})
        
        # Get payments made
        payments = await db.payments.find({"enrollment_id": e['id']}, {"_id": 0}).to_list(100)
        total_paid = sum(p.get('amount', 0) for p in payments)
        
        # Calculate pending
        final_fee = e.get('final_fee', 0)
        pending_amount = max(0, final_fee - total_paid)
        
        # Parse dates
        if isinstance(e.get('created_at'), str):
            e['created_at'] = datetime.fromisoformat(e['created_at'])
        if isinstance(e.get('enrollment_date'), str):
            e['enrollment_date'] = datetime.fromisoformat(e['enrollment_date']).date()
        
        students.append({
            **e,
            "total_paid": total_paid,
            "pending_amount": pending_amount,
            "has_payment_plan": payment_plan is not None,
            "payment_plan_type": payment_plan.get('plan_type') if payment_plan else None,
            "payments_count": len(payments)
        })
    
    return students

@api_router.get("/students/{enrollment_id}")
async def get_student_details(enrollment_id: str, current_user: User = Depends(get_current_user)):
    """Get full details of an enrolled student"""
    enrollment = await db.enrollments.find_one({"id": enrollment_id}, {"_id": 0})
    if not enrollment:
        raise HTTPException(status_code=404, detail="Student not found")
    
    # Check branch access
    if current_user.role not in [UserRole.ADMIN] and enrollment.get('branch_id') != current_user.branch_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get payment plan
    payment_plan = await db.payment_plans.find_one({"enrollment_id": enrollment_id}, {"_id": 0})
    
    # Get all payments
    payments = await db.payments.find({"enrollment_id": enrollment_id}, {"_id": 0}).sort("payment_date", -1).to_list(100)
    total_paid = sum(p.get('amount', 0) for p in payments)
    
    # Get branch info
    branch = await db.branches.find_one({"id": enrollment.get('branch_id')}, {"_id": 0, "name": 1, "location": 1})
    
    return {
        "enrollment": enrollment,
        "payment_plan": payment_plan,
        "payments": payments,
        "total_paid": total_paid,
        "pending_amount": max(0, enrollment.get('final_fee', 0) - total_paid),
        "branch": branch
    }

@api_router.put("/students/{enrollment_id}/cancel")
async def cancel_enrollment(enrollment_id: str, reason: str = "", current_user: User = Depends(get_current_user)):
    """Cancel/Drop an enrollment - Branch Admin only"""
    if current_user.role not in [UserRole.ADMIN, UserRole.BRANCH_ADMIN]:
        raise HTTPException(status_code=403, detail="Only Branch Admin can cancel enrollments")
    
    enrollment = await db.enrollments.find_one({"id": enrollment_id}, {"_id": 0})
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    
    # Branch Admin can only cancel their branch's enrollments
    if current_user.role == UserRole.BRANCH_ADMIN and enrollment.get('branch_id') != current_user.branch_id:
        raise HTTPException(status_code=403, detail="You can only cancel enrollments from your branch")
    
    await db.enrollments.update_one(
        {"id": enrollment_id},
        {"$set": {
            "status": "Cancelled",
            "cancelled_at": datetime.now(timezone.utc).isoformat(),
            "cancelled_by": current_user.id,
            "cancellation_reason": reason
        }}
    )
    
    return {"message": "Enrollment cancelled successfully"}

@api_router.put("/students/{enrollment_id}/status")
async def update_enrollment_status(enrollment_id: str, status: str, reason: str = "", current_user: User = Depends(get_current_user)):
    """Update enrollment status (Active, Dropped, Inactive, Cancelled) - Branch Admin only"""
    if current_user.role not in [UserRole.ADMIN, UserRole.BRANCH_ADMIN]:
        raise HTTPException(status_code=403, detail="Only Branch Admin can update enrollment status")
    
    allowed_statuses = ["Active", "Dropped", "Inactive", "Cancelled"]
    if status not in allowed_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Allowed: {', '.join(allowed_statuses)}")
    
    enrollment = await db.enrollments.find_one({"id": enrollment_id}, {"_id": 0})
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    
    # Branch Admin can only update their branch's enrollments
    if current_user.role == UserRole.BRANCH_ADMIN and enrollment.get('branch_id') != current_user.branch_id:
        raise HTTPException(status_code=403, detail="You can only update enrollments from your branch")
    
    update_data = {"status": status}
    if status in ["Dropped", "Cancelled", "Inactive"]:
        update_data["cancelled_at"] = datetime.now(timezone.utc).isoformat()
        update_data["cancelled_by"] = current_user.id
        update_data["cancellation_reason"] = reason
    
    await db.enrollments.update_one({"id": enrollment_id}, {"$set": update_data})
    
    return {"message": f"Enrollment status updated to {status}"}

# Add-on Course Endpoints
@api_router.post("/enrollments/{enrollment_id}/add-on-course")
async def add_addon_course(enrollment_id: str, addon: AddOnCourseCreate, current_user: User = Depends(get_current_user)):
    """Add an additional course to an existing enrollment"""
    if current_user.role not in [UserRole.ADMIN, UserRole.BRANCH_ADMIN, UserRole.FRONT_DESK]:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Get enrollment
    enrollment = await db.enrollments.find_one({"id": enrollment_id}, {"_id": 0})
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    
    # Get program details
    program = await db.programs.find_one({"id": addon.program_id}, {"_id": 0})
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    
    # Calculate final fee with discount
    discount = addon.discount_percent or 0
    final_fee = addon.fee_quoted * (1 - discount / 100)
    
    # Create add-on course record
    new_addon = AddOnCourse(
        enrollment_id=enrollment_id,
        program_id=addon.program_id,
        program_name=program['name'],
        fee_quoted=addon.fee_quoted,
        discount_percent=discount,
        final_fee=final_fee,
        added_by=current_user.id
    )
    
    addon_dict = new_addon.model_dump()
    addon_dict['added_at'] = addon_dict['added_at'].isoformat()
    
    await db.addon_courses.insert_one(addon_dict)
    
    # Update enrollment's final_fee
    current_final_fee = enrollment.get('final_fee', 0)
    new_total_fee = current_final_fee + final_fee
    
    await db.enrollments.update_one(
        {"id": enrollment_id},
        {"$set": {"final_fee": new_total_fee}}
    )
    
    return {
        "message": f"Add-on course '{program['name']}' added successfully",
        "addon_fee": final_fee,
        "new_total_fee": new_total_fee
    }

@api_router.get("/enrollments/{enrollment_id}/add-on-courses")
async def get_addon_courses(enrollment_id: str, current_user: User = Depends(get_current_user)):
    """Get all add-on courses for an enrollment"""
    addons = await db.addon_courses.find(
        {"enrollment_id": enrollment_id},
        {"_id": 0}
    ).to_list(100)
    return addons

# Schools/Colleges Outreach Management
@api_router.post("/organizations")
async def create_organization(org: OrganizationCreate, current_user: User = Depends(get_current_user)):
    """Create a new school/college organization"""
    new_org = Organization(
        organization_type=OrganizationType(org.organization_type),
        name=org.name,
        city=org.city,
        address=org.address,
        contact_person_name=org.contact_person_name,
        contact_number=org.contact_number,
        email=org.email,
        alternate_number=org.alternate_number,
        alternate_email=org.alternate_email,
        notes=org.notes,
        created_by=current_user.id,
        branch_id=current_user.branch_id
    )
    
    org_dict = new_org.model_dump()
    org_dict['created_at'] = org_dict['created_at'].isoformat()
    org_dict['organization_type'] = org_dict['organization_type'].value
    
    await db.organizations.insert_one(org_dict)
    
    return {"message": "Organization created successfully", "id": new_org.id}

@api_router.get("/organizations")
async def get_organizations(current_user: User = Depends(get_current_user)):
    """Get all organizations"""
    organizations = await db.organizations.find({}, {"_id": 0}).to_list(1000)
    
    # Get follow-up counts for each organization
    for org in organizations:
        followups = await db.organization_followups.find(
            {"organization_id": org['id']},
            {"_id": 0}
        ).to_list(100)
        org['followup_count'] = len(followups)
        org['last_followup'] = followups[-1] if followups else None
    
    return organizations

@api_router.get("/organizations/{org_id}")
async def get_organization(org_id: str, current_user: User = Depends(get_current_user)):
    """Get a single organization with its follow-ups"""
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    followups = await db.organization_followups.find(
        {"organization_id": org_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    org['followups'] = followups
    return org

@api_router.put("/organizations/{org_id}")
async def update_organization(org_id: str, org: OrganizationUpdate, current_user: User = Depends(get_current_user)):
    """Update an organization"""
    existing = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    update_data = {k: v for k, v in org.model_dump().items() if v is not None}
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.organizations.update_one({"id": org_id}, {"$set": update_data})
    
    return {"message": "Organization updated successfully"}

@api_router.delete("/organizations/{org_id}")
async def delete_organization(org_id: str, current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.BRANCH_ADMIN]))):
    """Delete an organization"""
    result = await db.organizations.delete_one({"id": org_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    # Also delete related follow-ups
    await db.organization_followups.delete_many({"organization_id": org_id})
    
    return {"message": "Organization deleted successfully"}

@api_router.post("/organizations/{org_id}/followups")
async def create_organization_followup(org_id: str, followup: OrganizationFollowUpCreate, current_user: User = Depends(get_current_user)):
    """Add a follow-up to an organization"""
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    new_followup = OrganizationFollowUp(
        organization_id=org_id,
        follow_up_date=followup.follow_up_date,
        follow_up_time=followup.follow_up_time,
        notes=followup.notes,
        outcome=followup.outcome,
        created_by=current_user.id,
        created_by_name=current_user.name
    )
    
    followup_dict = new_followup.model_dump()
    followup_dict['created_at'] = followup_dict['created_at'].isoformat()
    
    await db.organization_followups.insert_one(followup_dict)
    
    return {"message": "Follow-up added successfully", "id": new_followup.id}

@api_router.get("/organizations/{org_id}/followups")
async def get_organization_followups(org_id: str, current_user: User = Depends(get_current_user)):
    """Get all follow-ups for an organization"""
    followups = await db.organization_followups.find(
        {"organization_id": org_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return followups

# Task Management Endpoints
@api_router.post("/tasks")
async def create_task(task: TaskCreate, current_user: User = Depends(get_current_user)):
    """Create a task - Branch Admin only. Automatically notifies assigned user."""
    if current_user.role not in [UserRole.ADMIN, UserRole.BRANCH_ADMIN]:
        raise HTTPException(status_code=403, detail="Only Branch Admin can create tasks")
    
    # Get assigned user
    assigned_user = await db.users.find_one({"id": task.assigned_to}, {"_id": 0, "name": 1, "branch_id": 1})
    if not assigned_user:
        raise HTTPException(status_code=404, detail="Assigned user not found")
    
    # Branch Admin can only assign to their branch
    if current_user.role == UserRole.BRANCH_ADMIN and assigned_user.get('branch_id') != current_user.branch_id:
        raise HTTPException(status_code=403, detail="You can only assign tasks to users in your branch")
    
    new_task = Task(
        title=task.title,
        description=task.description,
        assigned_by=current_user.id,
        assigned_by_name=current_user.name,
        assigned_to=task.assigned_to,
        assigned_to_name=assigned_user['name'],
        branch_id=current_user.branch_id or assigned_user.get('branch_id'),
        priority=task.priority,
        due_date=task.due_date
    )
    
    task_dict = new_task.model_dump()
    task_dict['created_at'] = task_dict['created_at'].isoformat()
    
    await db.tasks.insert_one(task_dict)
    
    # Create in-app notification for the assigned user
    task_notification = PushNotification(
        sender_id=current_user.id,
        sender_name=current_user.name,
        sender_role=current_user.role.value,
        recipient_ids=[task.assigned_to],
        branch_id=current_user.branch_id or assigned_user.get('branch_id'),
        title="New Task Assigned",
        message=f"{current_user.name} assigned you a new task: {task.title}",
        notification_type="task"
    )
    
    notif_dict = task_notification.model_dump()
    notif_dict['created_at'] = notif_dict['created_at'].isoformat()
    
    await db.notifications.insert_one(notif_dict)
    
    logging.info(f"Task '{task.title}' assigned to {assigned_user['name']} by {current_user.name}")
    
    return {"message": "Task created and notification sent", "task_id": new_task.id}

@api_router.get("/tasks")
async def get_tasks(current_user: User = Depends(get_current_user)):
    """Get tasks - assigned to me or created by me"""
    query = {
        "$or": [
            {"assigned_to": current_user.id},
            {"assigned_by": current_user.id}
        ]
    }
    
    tasks = await db.tasks.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for t in tasks:
        if isinstance(t.get('created_at'), str):
            t['created_at'] = datetime.fromisoformat(t['created_at'])
        if isinstance(t.get('completed_at'), str):
            t['completed_at'] = datetime.fromisoformat(t['completed_at'])
    return tasks

@api_router.put("/tasks/{task_id}/status")
async def update_task_status(task_id: str, status: str, current_user: User = Depends(get_current_user)):
    """Update task status"""
    task = await db.tasks.find_one({"id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Only assigned user or creator can update
    if task['assigned_to'] != current_user.id and task['assigned_by'] != current_user.id:
        raise HTTPException(status_code=403, detail="You don't have permission to update this task")
    
    update_data = {"status": status}
    if status == "Completed":
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.tasks.update_one({"id": task_id}, {"$set": update_data})
    return {"message": "Task status updated successfully"}

# International Exams Management
@api_router.post("/admin/exams")
async def create_exam(exam_data: dict, current_user: User = Depends(require_role([UserRole.ADMIN]))):
    """Create international exam type - Super Admin only"""
    new_exam = InternationalExam(
        name=exam_data['name'],
        description=exam_data.get('description'),
        price=exam_data['price']
    )
    
    exam_dict = new_exam.model_dump()
    exam_dict['created_at'] = exam_dict['created_at'].isoformat()
    
    await db.international_exams.insert_one(exam_dict)
    return new_exam

@api_router.get("/admin/exams")
async def get_exams(current_user: User = Depends(get_current_user)):
    """Get all international exam types"""
    exams = await db.international_exams.find({"is_active": True}, {"_id": 0}).to_list(1000)
    return exams

@api_router.delete("/admin/exams/{exam_id}")
async def delete_exam(exam_id: str, current_user: User = Depends(require_role([UserRole.ADMIN]))):
    """Delete/deactivate an exam type - Super Admin only"""
    await db.international_exams.update_one({"id": exam_id}, {"$set": {"is_active": False}})
    return {"message": "Exam type deleted successfully"}

@api_router.post("/exam-bookings")
async def create_exam_booking(booking_data: dict, current_user: User = Depends(get_current_user)):
    """Book an international exam for a student"""
    if current_user.role == UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Please use a branch account to create bookings")
    
    # Get exam details
    exam = await db.international_exams.find_one({"id": booking_data['exam_id']}, {"_id": 0})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    branch_id = current_user.branch_id
    
    # Generate custom booking ID
    custom_booking_id = await generate_custom_id(branch_id, "X")
    
    new_booking = ExamBooking(
        booking_id=custom_booking_id,
        student_name=booking_data['student_name'],
        student_phone=booking_data['student_phone'],
        student_email=booking_data.get('student_email'),
        exam_id=booking_data['exam_id'],
        exam_name=exam['name'],
        exam_price=exam['price'],
        branch_id=branch_id,
        exam_date=booking_data.get('exam_date'),
        notes=booking_data.get('notes'),
        created_by=current_user.id
    )
    
    booking_dict = new_booking.model_dump()
    booking_dict['created_at'] = booking_dict['created_at'].isoformat()
    
    await db.exam_bookings.insert_one(booking_dict)
    return new_booking

@api_router.get("/exam-bookings")
async def get_exam_bookings(current_user: User = Depends(get_current_user)):
    """Get exam bookings"""
    query = {}
    if current_user.role not in [UserRole.ADMIN]:
        query["branch_id"] = current_user.branch_id
    
    bookings = await db.exam_bookings.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for b in bookings:
        if isinstance(b.get('created_at'), str):
            b['created_at'] = datetime.fromisoformat(b['created_at'])
    return bookings

@api_router.put("/exam-bookings/{booking_id}/status")
async def update_booking_status(booking_id: str, status: str, current_user: User = Depends(get_current_user)):
    """Update exam booking status"""
    booking = await db.exam_bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Check branch access
    if current_user.role not in [UserRole.ADMIN] and booking.get('branch_id') != current_user.branch_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await db.exam_bookings.update_one({"id": booking_id}, {"$set": {"status": status}})
    return {"message": "Booking status updated successfully"}

# Update Branch counter for exam bookings
async def update_branch_exam_counter(branch_id: str):
    """Increment the exam booking counter for a branch"""
    result = await db.branches.find_one_and_update(
        {"id": branch_id},
        {"$inc": {"exam_counter": 1}},
        return_document=True,
        projection={"_id": 0, "exam_counter": 1}
    )
    return result.get('exam_counter', 1) if result else 1

# ============ Quiz-Based Exams Endpoints ============

@api_router.post("/quiz-exams")
async def create_quiz_exam(exam: QuizExamCreate, current_user: User = Depends(require_role([UserRole.ADMIN]))):
    """Create a new quiz exam - Super Admin only"""
    # Validate questions (max 100)
    if len(exam.questions) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 questions allowed")
    
    # Convert question dicts to QuizQuestion objects
    questions = []
    for i, q in enumerate(exam.questions, 1):
        questions.append(QuizQuestion(
            question_number=i,
            question_text=q.get('question_text', ''),
            option_a=q.get('option_a', ''),
            option_b=q.get('option_b', ''),
            option_c=q.get('option_c', ''),
            option_d=q.get('option_d', ''),
            correct_answer=q.get('correct_answer', 'A').upper()
        ))
    
    new_exam = QuizExam(
        name=exam.name,
        description=exam.description,
        duration_minutes=exam.duration_minutes,
        pass_percentage=exam.pass_percentage,
        questions=questions,
        created_by=current_user.id
    )
    
    exam_dict = new_exam.model_dump()
    exam_dict['created_at'] = exam_dict['created_at'].isoformat()
    exam_dict['questions'] = [q.model_dump() for q in questions]
    
    await db.quiz_exams.insert_one(exam_dict)
    return {"message": "Quiz exam created successfully", "exam_id": new_exam.id}

@api_router.get("/quiz-exams")
async def get_quiz_exams(current_user: User = Depends(get_current_user)):
    """Get all quiz exams - for Admin/FDE"""
    exams = await db.quiz_exams.find({"is_active": True}, {"_id": 0}).to_list(100)
    for exam in exams:
        if isinstance(exam.get('created_at'), str):
            exam['created_at'] = datetime.fromisoformat(exam['created_at'])
        # Add attempt count
        attempts = await db.quiz_attempts.count_documents({"exam_id": exam['id']})
        exam['total_attempts'] = attempts
        # Count questions and remove the actual questions list
        exam['total_questions'] = len(exam.get('questions', []))
        exam.pop('questions', None)
    return exams

@api_router.get("/quiz-exams/{exam_id}")
async def get_quiz_exam_details(exam_id: str, current_user: User = Depends(get_current_user)):
    """Get full quiz exam with questions - Admin only"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only Super Admin can view exam details")
    
    exam = await db.quiz_exams.find_one({"id": exam_id}, {"_id": 0})
    if not exam:
        raise HTTPException(status_code=404, detail="Quiz exam not found")
    return exam

@api_router.put("/quiz-exams/{exam_id}")
async def update_quiz_exam(exam_id: str, exam: QuizExamCreate, current_user: User = Depends(require_role([UserRole.ADMIN]))):
    """Update a quiz exam - Super Admin only"""
    existing = await db.quiz_exams.find_one({"id": exam_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Quiz exam not found")
    
    # Convert question dicts to QuizQuestion objects
    questions = []
    for i, q in enumerate(exam.questions, 1):
        questions.append({
            "question_number": i,
            "question_text": q.get('question_text', ''),
            "option_a": q.get('option_a', ''),
            "option_b": q.get('option_b', ''),
            "option_c": q.get('option_c', ''),
            "option_d": q.get('option_d', ''),
            "correct_answer": q.get('correct_answer', 'A').upper()
        })
    
    await db.quiz_exams.update_one(
        {"id": exam_id},
        {"$set": {
            "name": exam.name,
            "description": exam.description,
            "duration_minutes": exam.duration_minutes,
            "pass_percentage": exam.pass_percentage,
            "questions": questions
        }}
    )
    return {"message": "Quiz exam updated successfully"}

@api_router.delete("/quiz-exams/{exam_id}")
async def delete_quiz_exam(exam_id: str, current_user: User = Depends(require_role([UserRole.ADMIN]))):
    """Delete (deactivate) a quiz exam"""
    result = await db.quiz_exams.update_one({"id": exam_id}, {"$set": {"is_active": False}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Quiz exam not found")
    return {"message": "Quiz exam deleted successfully"}

# Public endpoints for students to take exams
@api_router.get("/public/quiz/{exam_id}")
async def get_public_quiz(exam_id: str):
    """Get quiz exam for students (without correct answers)"""
    exam = await db.quiz_exams.find_one({"id": exam_id, "is_active": True}, {"_id": 0})
    if not exam:
        raise HTTPException(status_code=404, detail="Quiz exam not found or inactive")
    
    # Remove correct answers from questions
    questions_for_student = []
    for q in exam.get('questions', []):
        questions_for_student.append({
            "question_number": q.get('question_number'),
            "question_text": q.get('question_text'),
            "option_a": q.get('option_a'),
            "option_b": q.get('option_b'),
            "option_c": q.get('option_c'),
            "option_d": q.get('option_d')
            # No correct_answer field
        })
    
    return {
        "id": exam['id'],
        "name": exam['name'],
        "description": exam.get('description'),
        "duration_minutes": exam.get('duration_minutes', 30),
        "total_questions": len(questions_for_student),
        "questions": questions_for_student
    }

@api_router.post("/public/quiz/{exam_id}/start")
async def start_quiz_attempt(exam_id: str, data: QuizAttemptCreate):
    """Start a quiz attempt - student enters enrollment number"""
    exam = await db.quiz_exams.find_one({"id": exam_id, "is_active": True}, {"_id": 0})
    if not exam:
        raise HTTPException(status_code=404, detail="Quiz exam not found or inactive")
    
    # Verify enrollment number exists
    enrollment = await db.enrollments.find_one(
        {"enrollment_id": data.enrollment_number},
        {"_id": 0, "student_name": 1}
    )
    if not enrollment:
        # Also check by custom enrollment ID format
        enrollment = await db.enrollments.find_one(
            {"id": data.enrollment_number},
            {"_id": 0, "student_name": 1}
        )
    
    student_name = enrollment.get('student_name') if enrollment else None
    
    # Create new attempt
    attempt = QuizAttempt(
        exam_id=exam_id,
        exam_name=exam['name'],
        enrollment_number=data.enrollment_number,
        student_name=student_name,
        total_questions=len(exam.get('questions', []))
    )
    
    attempt_dict = attempt.model_dump()
    attempt_dict['started_at'] = attempt_dict['started_at'].isoformat()
    
    await db.quiz_attempts.insert_one(attempt_dict)
    return {"attempt_id": attempt.id, "student_name": student_name}

@api_router.post("/public/quiz/attempt/{attempt_id}/submit")
async def submit_quiz_attempt(attempt_id: str, submission: QuizAttemptSubmit):
    """Submit quiz answers and get result"""
    attempt = await db.quiz_attempts.find_one({"id": attempt_id}, {"_id": 0})
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    
    if attempt.get('completed_at'):
        raise HTTPException(status_code=400, detail="This attempt has already been submitted")
    
    # Get exam to check answers
    exam = await db.quiz_exams.find_one({"id": attempt['exam_id']}, {"_id": 0})
    if not exam:
        raise HTTPException(status_code=404, detail="Quiz exam not found")
    
    # Calculate score
    correct_count = 0
    questions = exam.get('questions', [])
    for q in questions:
        q_num = str(q['question_number'])
        student_answer = submission.answers.get(q_num, '').upper()
        if student_answer == q['correct_answer'].upper():
            correct_count += 1
    
    total_questions = len(questions)
    percentage = (correct_count / total_questions * 100) if total_questions > 0 else 0
    passed = percentage >= exam.get('pass_percentage', 60)
    
    # Calculate time taken
    started_at = attempt.get('started_at')
    if isinstance(started_at, str):
        started_at = datetime.fromisoformat(started_at)
    time_taken = int((datetime.now(timezone.utc) - started_at).total_seconds())
    
    # Update attempt
    await db.quiz_attempts.update_one(
        {"id": attempt_id},
        {"$set": {
            "answers": submission.answers,
            "score": correct_count,
            "total_questions": total_questions,
            "percentage": round(percentage, 1),
            "passed": passed,
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "time_taken_seconds": time_taken
        }}
    )
    
    return {
        "score": correct_count,
        "total_questions": total_questions,
        "percentage": round(percentage, 1),
        "passed": passed,
        "result": "PASS" if passed else "FAIL",
        "time_taken_seconds": time_taken
    }

@api_router.get("/quiz-attempts")
async def get_quiz_attempts(exam_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    """Get all quiz attempts - Admin/FDE can see all"""
    query = {}
    if exam_id:
        query["exam_id"] = exam_id
    
    attempts = await db.quiz_attempts.find(query, {"_id": 0}).sort("started_at", -1).to_list(1000)
    for a in attempts:
        if isinstance(a.get('started_at'), str):
            a['started_at'] = datetime.fromisoformat(a['started_at'])
        if isinstance(a.get('completed_at'), str):
            a['completed_at'] = datetime.fromisoformat(a['completed_at'])
    return attempts

# ============================================
# WEBHOOK ENDPOINTS - External Lead Capture
# ============================================

@api_router.post("/webhooks/leads/{webhook_key}")
async def webhook_lead_capture(webhook_key: str, lead_data: WebhookLeadCreate):
    """
    Public webhook endpoint for capturing leads from Google Ads, Meta (Facebook), etc.
    Each branch has a unique webhook_key for security.
    
    Example URLs:
    - Google Ads: https://yourapp.com/api/webhooks/leads/{branch_webhook_key}
    - Meta/Facebook: https://yourapp.com/api/webhooks/leads/{branch_webhook_key}
    """
    # Find branch by webhook key
    branch = await db.branches.find_one({"webhook_key": webhook_key}, {"_id": 0})
    if not branch:
        raise HTTPException(status_code=404, detail="Invalid webhook key")
    
    # Find or create a default program for webhook leads
    default_program = await db.programs.find_one({}, {"_id": 0})
    if not default_program:
        raise HTTPException(status_code=400, detail="No programs configured in the system")
    
    # Try to match program by name if provided
    program = default_program
    if lead_data.program_name:
        matched_program = await db.programs.find_one(
            {"name": {"$regex": lead_data.program_name, "$options": "i"}}, 
            {"_id": 0}
        )
        if matched_program:
            program = matched_program
    
    # Determine lead source
    source = lead_data.source or "Webhook"
    if lead_data.campaign:
        source = f"{source} - {lead_data.campaign}"
    
    # Generate custom lead ID
    custom_lead_id = await generate_custom_id(branch['id'], "L")
    
    # Create the lead
    new_lead = Lead(
        lead_id=custom_lead_id,
        name=lead_data.name,
        number=lead_data.phone,
        email=lead_data.email or f"webhook_{datetime.now().timestamp()}@placeholder.com",
        program_id=program['id'],
        program_name=program['name'],
        lead_source=source,
        branch_id=branch['id'],
        counsellor_id="system",  # System-generated lead
        city=lead_data.city,
        state=lead_data.state,
    )
    
    lead_dict = new_lead.model_dump()
    lead_dict['created_at'] = lead_dict['created_at'].isoformat()
    lead_dict['updated_at'] = lead_dict['updated_at'].isoformat()
    lead_dict['webhook_metadata'] = {
        "campaign": lead_data.campaign,
        "ad_name": lead_data.ad_name,
        "form_name": lead_data.form_name,
        "additional_data": lead_data.additional_data
    }
    
    await db.leads.insert_one(lead_dict)
    
    # Send WhatsApp notification for new enquiry
    await send_whatsapp_notification(
        new_lead.number, 
        "enquiry_saved",
        {"name": new_lead.name, "course": program['name']}
    )
    
    logging.info(f"Webhook lead captured: {new_lead.name} for branch {branch['name']}")
    
    return {
        "success": True,
        "lead_id": new_lead.lead_id,
        "message": f"Lead captured successfully for {branch['name']}"
    }

@api_router.post("/admin/branches/{branch_id}/regenerate-webhook-key")
async def regenerate_webhook_key(branch_id: str, current_user: User = Depends(require_role([UserRole.ADMIN]))):
    """Regenerate webhook key for a branch - Super Admin only"""
    import secrets
    new_key = secrets.token_urlsafe(32)
    
    result = await db.branches.update_one(
        {"id": branch_id},
        {"$set": {"webhook_key": new_key}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Branch not found")
    
    return {"webhook_key": new_key, "message": "Webhook key regenerated successfully"}

@api_router.get("/admin/branches/{branch_id}/webhook-info")
async def get_branch_webhook_info(branch_id: str, current_user: User = Depends(require_role([UserRole.ADMIN]))):
    """Get webhook URL and key for a branch - Super Admin only"""
    branch = await db.branches.find_one({"id": branch_id}, {"_id": 0})
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    
    # Generate webhook key if not exists
    if not branch.get('webhook_key'):
        import secrets
        webhook_key = secrets.token_urlsafe(32)
        await db.branches.update_one({"id": branch_id}, {"$set": {"webhook_key": webhook_key}})
        branch['webhook_key'] = webhook_key
    
    base_url = os.environ.get('FRONTEND_URL', os.environ.get('REACT_APP_BACKEND_URL', ''))
    webhook_url = f"{base_url}/api/webhooks/leads/{branch['webhook_key']}"
    
    return {
        "branch_id": branch_id,
        "branch_name": branch['name'],
        "webhook_key": branch['webhook_key'],
        "webhook_url": webhook_url,
        "usage_instructions": {
            "google_ads": "Use this URL as your Google Ads Lead Form Webhook URL",
            "meta": "Use this URL as your Facebook Lead Ads Webhook URL",
            "method": "POST",
            "content_type": "application/json",
            "sample_payload": {
                "name": "John Doe",
                "phone": "9876543210",
                "email": "john@example.com",
                "source": "Google Ads",
                "campaign": "Summer Course 2024",
                "program_name": "Optional - Will match with existing programs"
            }
        }
    }

# ============================================
# BROWSER PUSH NOTIFICATION SUBSCRIPTIONS
# ============================================

@api_router.post("/push-subscriptions")
async def save_push_subscription(subscription: PushSubscriptionCreate, current_user: User = Depends(get_current_user)):
    """Save browser push subscription for a user"""
    # Remove existing subscription for this user/endpoint
    await db.push_subscriptions.delete_many({
        "$or": [
            {"user_id": current_user.id},
            {"endpoint": subscription.endpoint}
        ]
    })
    
    new_sub = PushSubscription(
        user_id=current_user.id,
        endpoint=subscription.endpoint,
        keys=subscription.keys
    )
    
    sub_dict = new_sub.model_dump()
    sub_dict['created_at'] = sub_dict['created_at'].isoformat()
    
    await db.push_subscriptions.insert_one(sub_dict)
    return {"message": "Push subscription saved successfully"}

@api_router.delete("/push-subscriptions")
async def remove_push_subscription(current_user: User = Depends(get_current_user)):
    """Remove browser push subscription for current user"""
    await db.push_subscriptions.delete_many({"user_id": current_user.id})
    return {"message": "Push subscription removed"}

@api_router.get("/push-subscriptions/vapid-public-key")
async def get_vapid_public_key():
    """Get VAPID public key for browser push notifications"""
    # In production, generate proper VAPID keys
    vapid_public_key = os.environ.get('VAPID_PUBLIC_KEY', 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U')
    return {"publicKey": vapid_public_key}

# ============================================
# FOLLOW-UP REMINDERS - Due Soon Notifications
# ============================================

@api_router.get("/followups/due-soon")
async def get_due_soon_followups(current_user: User = Depends(get_current_user)):
    """
    Get follow-ups due within the next 10 minutes.
    Used by frontend to show alarm notifications.
    """
    now = datetime.now(timezone.utc)
    ten_minutes_later = now + timedelta(minutes=10)
    
    query = {
        "status": FollowUpStatus.PENDING.value,
        "followup_date": {
            "$gte": now.isoformat(),
            "$lte": ten_minutes_later.isoformat()
        }
    }
    
    # Filter by user if not admin
    if current_user.role != UserRole.ADMIN:
        query["created_by"] = current_user.id
    
    followups = await db.followups.find(query, {"_id": 0}).sort("followup_date", 1).to_list(100)
    
    for fu in followups:
        if isinstance(fu.get('created_at'), str):
            fu['created_at'] = datetime.fromisoformat(fu['created_at'])
        if isinstance(fu.get('followup_date'), str):
            fu['followup_date'] = datetime.fromisoformat(fu['followup_date'])
    
    return followups

@api_router.get("/followups/overdue")
async def get_overdue_followups(current_user: User = Depends(get_current_user)):
    """Get overdue follow-ups that haven't been completed"""
    now = datetime.now(timezone.utc)
    
    query = {
        "status": FollowUpStatus.PENDING.value,
        "followup_date": {"$lt": now.isoformat()}
    }
    
    if current_user.role != UserRole.ADMIN:
        query["created_by"] = current_user.id
    
    followups = await db.followups.find(query, {"_id": 0}).sort("followup_date", 1).to_list(100)
    
    for fu in followups:
        if isinstance(fu.get('created_at'), str):
            fu['created_at'] = datetime.fromisoformat(fu['created_at'])
        if isinstance(fu.get('followup_date'), str):
            fu['followup_date'] = datetime.fromisoformat(fu['followup_date'])
    
    return followups

# ============================================
# TASK NOTIFICATIONS - Auto-notify on task assignment
# ============================================

# ============================================
# CERTIFICATE MANAGEMENT SYSTEM
# ============================================

async def generate_certificate_id():
    """Generate unique certificate ID: ETI-2025-00001"""
    year = datetime.now().year
    # Get the count of certificates this year
    count = await db.certificate_requests.count_documents({
        "created_at": {"$regex": f"^{year}"}
    })
    return f"ETI-{year}-{str(count + 1).zfill(5)}"

async def generate_verification_id():
    """Generate unique verification ID for QR code"""
    import secrets
    return secrets.token_urlsafe(16)

@api_router.get("/public/enrollment/{enrollment_number}")
async def get_enrollment_for_certificate(enrollment_number: str):
    """Public endpoint to fetch enrollment details for certificate request"""
    enrollment = await db.enrollments.find_one(
        {"enrollment_id": enrollment_number},
        {"_id": 0}
    )
    
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    
    # Get branch details
    branch = await db.branches.find_one({"id": enrollment['branch_id']}, {"_id": 0, "name": 1})
    
    # Get program details
    program = await db.programs.find_one({"id": enrollment['program_id']}, {"_id": 0, "name": 1, "duration": 1})
    
    return {
        "student_name": enrollment['student_name'],
        "program_name": program['name'] if program else enrollment.get('program_name', ''),
        "program_duration": program['duration'] if program else '',
        "branch_name": branch['name'] if branch else '',
        "branch_id": enrollment['branch_id'],
        "enrollment_id": enrollment['id'],
        "enrollment_number": enrollment['enrollment_id']
    }

@api_router.post("/public/certificate-requests")
async def create_certificate_request(request_data: CertificateRequestCreate):
    """Public endpoint for students to request certificates"""
    # Fetch enrollment
    enrollment = await db.enrollments.find_one(
        {"enrollment_id": request_data.enrollment_number},
        {"_id": 0}
    )
    
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found with this ID")
    
    # Check if there's already a pending/approved request
    existing = await db.certificate_requests.find_one({
        "enrollment_number": request_data.enrollment_number,
        "status": {"$in": ["Pending", "Approved"]}
    })
    
    if existing:
        raise HTTPException(
            status_code=400, 
            detail=f"A certificate request already exists with status: {existing['status']}"
        )
    
    # Get branch and program details
    branch = await db.branches.find_one({"id": enrollment['branch_id']}, {"_id": 0, "name": 1})
    program = await db.programs.find_one({"id": enrollment['program_id']}, {"_id": 0, "name": 1, "duration": 1})
    
    # Generate IDs
    certificate_id = await generate_certificate_id()
    verification_id = await generate_verification_id()
    registration_number = f"ETI-STU-{str(await db.certificate_requests.count_documents({}) + 1).zfill(4)}"
    
    # Create certificate request
    cert_request = CertificateRequest(
        certificate_id=certificate_id,
        enrollment_id=enrollment['id'],
        enrollment_number=request_data.enrollment_number,
        student_name=enrollment['student_name'],
        program_name=program['name'] if program else enrollment.get('program_name', ''),
        program_duration=program['duration'] if program else '',
        branch_name=branch['name'] if branch else '',
        branch_id=enrollment['branch_id'],
        email=request_data.email,
        phone=request_data.phone,
        program_start_date=request_data.program_start_date,
        program_end_date=request_data.program_end_date,
        training_mode=request_data.training_mode,
        training_hours=request_data.training_hours,
        registration_number=registration_number,
        verification_id=verification_id
    )
    
    cert_dict = cert_request.model_dump()
    cert_dict['created_at'] = cert_dict['created_at'].isoformat()
    
    await db.certificate_requests.insert_one(cert_dict)
    
    return {
        "message": "Certificate request submitted successfully",
        "certificate_id": certificate_id,
        "status": "Pending"
    }

@api_router.get("/certificate-requests")
async def get_certificate_requests(
    status: Optional[str] = None,
    branch_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get all certificate requests - Certificate Manager or Admin"""
    if current_user.role not in [UserRole.ADMIN, UserRole.CERTIFICATE_MANAGER]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    query = {}
    if status:
        query["status"] = status
    if branch_id:
        query["branch_id"] = branch_id
    
    requests = await db.certificate_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return requests

@api_router.get("/certificate-requests/{request_id}")
async def get_certificate_request(request_id: str, current_user: User = Depends(get_current_user)):
    """Get single certificate request"""
    if current_user.role not in [UserRole.ADMIN, UserRole.CERTIFICATE_MANAGER]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    request = await db.certificate_requests.find_one({"id": request_id}, {"_id": 0})
    if not request:
        raise HTTPException(status_code=404, detail="Certificate request not found")
    return request

@api_router.put("/certificate-requests/{request_id}")
async def update_certificate_request(
    request_id: str,
    update_data: CertificateRequestUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update certificate request - Certificate Manager or Admin"""
    if current_user.role not in [UserRole.ADMIN, UserRole.CERTIFICATE_MANAGER]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    if update_dict.get('training_mode'):
        update_dict['training_mode'] = update_dict['training_mode'].value
    
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await db.certificate_requests.update_one(
        {"id": request_id},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Certificate request not found")
    
    return {"message": "Certificate request updated successfully"}

@api_router.post("/certificate-requests/{request_id}/approve")
async def approve_certificate_request(request_id: str, current_user: User = Depends(get_current_user)):
    """Approve a certificate request"""
    if current_user.role not in [UserRole.ADMIN, UserRole.CERTIFICATE_MANAGER]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    result = await db.certificate_requests.update_one(
        {"id": request_id, "status": CertificateStatus.PENDING.value},
        {"$set": {
            "status": CertificateStatus.APPROVED.value,
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "approved_by": current_user.id,
            "approved_by_name": current_user.name
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Certificate request not found or not pending")
    
    return {"message": "Certificate request approved"}

@api_router.post("/certificate-requests/{request_id}/reject")
async def reject_certificate_request(
    request_id: str,
    reason: str = "",
    current_user: User = Depends(get_current_user)
):
    """Reject a certificate request"""
    if current_user.role not in [UserRole.ADMIN, UserRole.CERTIFICATE_MANAGER]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    result = await db.certificate_requests.update_one(
        {"id": request_id, "status": CertificateStatus.PENDING.value},
        {"$set": {
            "status": CertificateStatus.REJECTED.value,
            "rejection_reason": reason,
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "approved_by": current_user.id,
            "approved_by_name": current_user.name
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Certificate request not found or not pending")
    
    return {"message": "Certificate request rejected"}

@api_router.post("/certificate-requests/{request_id}/download")
async def download_certificate(request_id: str, current_user: User = Depends(get_current_user)):
    """Generate and download certificate PDF, mark as ready, send WhatsApp"""
    if current_user.role not in [UserRole.ADMIN, UserRole.CERTIFICATE_MANAGER]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    cert_request = await db.certificate_requests.find_one({"id": request_id}, {"_id": 0})
    if not cert_request:
        raise HTTPException(status_code=404, detail="Certificate request not found")
    
    if cert_request['status'] not in [CertificateStatus.APPROVED.value, CertificateStatus.READY.value]:
        raise HTTPException(status_code=400, detail="Certificate must be approved before download")
    
    # Mark as ready if first download
    if cert_request['status'] == CertificateStatus.APPROVED.value:
        await db.certificate_requests.update_one(
            {"id": request_id},
            {"$set": {
                "status": CertificateStatus.READY.value,
                "issued_at": datetime.now(timezone.utc).isoformat(),
                "issued_by": current_user.id
            }}
        )
        
        # Send WhatsApp notification
        await send_whatsapp_notification(
            cert_request['phone'],
            "certificate_ready",
            {
                "name": cert_request['student_name'],
                "certificate_id": cert_request['certificate_id'],
                "course": cert_request['program_name']
            }
        )
    
    # Return certificate data for PDF generation on frontend
    return {
        "certificate_id": cert_request['certificate_id'],
        "student_name": cert_request['student_name'],
        "program_name": cert_request['program_name'],
        "program_duration": cert_request['program_duration'],
        "branch_name": cert_request['branch_name'],
        "training_mode": cert_request['training_mode'],
        "training_hours": cert_request.get('training_hours', 120),
        "program_start_date": cert_request['program_start_date'],
        "program_end_date": cert_request['program_end_date'],
        "registration_number": cert_request['registration_number'],
        "verification_id": cert_request['verification_id'],
        "issued_date": datetime.now().strftime("%d-%m-%Y")
    }

@api_router.get("/public/verify/{verification_id}")
async def verify_certificate(verification_id: str):
    """Public endpoint to verify certificate authenticity via QR code"""
    cert = await db.certificate_requests.find_one(
        {"verification_id": verification_id},
        {"_id": 0}
    )
    
    if not cert:
        return {
            "verified": False,
            "message": "Certificate not found or invalid verification code"
        }
    
    if cert['status'] != CertificateStatus.READY.value:
        return {
            "verified": False,
            "message": f"Certificate status: {cert['status']} (not issued yet)"
        }
    
    return {
        "verified": True,
        "message": "Certificate is authentic and verified",
        "certificate_details": {
            "certificate_id": cert['certificate_id'],
            "student_name": cert['student_name'],
            "program_name": cert['program_name'],
            "program_duration": cert['program_duration'],
            "branch_name": cert['branch_name'],
            "training_mode": cert['training_mode'],
            "issued_date": cert.get('issued_at', ''),
            "registration_number": cert['registration_number']
        }
    }

# ========== FEE REMINDER AUTOMATION ==========
async def send_fee_reminders():
    """
    Send WhatsApp fee reminders for pending payments.
    Sends reminders 7 days, 5 days, 3 days, 1 day before due date, and on the due date.
    """
    try:
        logger.info("Running fee reminder job...")
        today = datetime.now(timezone.utc).date()
        reminder_days = [7, 5, 3, 1, 0]  # Days before due date
        
        for days_before in reminder_days:
            target_date = today + timedelta(days=days_before)
            target_date_str = target_date.isoformat()
            
            # Find installments due on the target date
            installments = await db.installment_schedule.find(
                {"due_date": target_date_str, "status": {"$ne": "Paid"}},
                {"_id": 0}
            ).to_list(1000)
            
            for inst in installments:
                payment_plan = await db.payment_plans.find_one(
                    {"id": inst.get("payment_plan_id")},
                    {"_id": 0}
                )
                if not payment_plan:
                    continue
                
                enrollment = await db.enrollments.find_one(
                    {"id": payment_plan.get("enrollment_id")},
                    {"_id": 0}
                )
                if not enrollment:
                    continue
                
                # Send WhatsApp reminder
                reminder_text = f"on {target_date_str}" if days_before == 0 else f"in {days_before} day(s)"
                await send_whatsapp_notification(
                    enrollment.get('phone', ''),
                    "fee_reminder",
                    {
                        "name": enrollment.get('student_name', ''),
                        "amount_due": str(inst.get('amount', 0)),
                        "due_date": target_date_str
                    }
                )
                logger.info(f"Fee reminder sent to {enrollment.get('student_name')} for ₹{inst.get('amount')} due {reminder_text}")
        
        # Also check for one-time payments that are overdue
        # For one-time payments, send reminder if enrollment date was 23, 25, 27, 29, or 30 days ago
        # (Equivalent to 7, 5, 3, 1, 0 days before 30-day mark)
        for days_since in [23, 25, 27, 29, 30]:
            check_date = today - timedelta(days=days_since)
            check_date_str = check_date.isoformat()
            
            # Find enrollments from that date with pending one-time payments
            enrollments = await db.enrollments.find(
                {"enrollment_date": check_date_str},
                {"_id": 0}
            ).to_list(1000)
            
            for enrollment in enrollments:
                enrollment_id = enrollment.get('id')
                final_fee = enrollment.get('final_fee', 0)
                
                # Check if it's a one-time payment plan
                payment_plan = await db.payment_plans.find_one(
                    {"enrollment_id": enrollment_id},
                    {"_id": 0}
                )
                if payment_plan and payment_plan.get('plan_type') == 'Installments':
                    continue  # Skip installment plans
                
                # Get total paid
                payments = await db.payments.find(
                    {"enrollment_id": enrollment_id},
                    {"_id": 0, "amount": 1}
                ).to_list(100)
                total_paid = sum(p.get('amount', 0) for p in payments)
                pending_amount = final_fee - total_paid
                
                if pending_amount > 0:
                    days_left = 30 - days_since
                    due_date_str = (today + timedelta(days=days_left)).isoformat() if days_left > 0 else today.isoformat()
                    await send_whatsapp_notification(
                        enrollment.get('phone', ''),
                        "fee_reminder",
                        {
                            "name": enrollment.get('student_name', ''),
                            "amount_due": str(pending_amount),
                            "due_date": due_date_str
                        }
                    )
                    logger.info(f"One-time payment reminder sent to {enrollment.get('student_name')} for ₹{pending_amount}")
        
        logger.info("Fee reminder job completed successfully")
    except Exception as e:
        logger.error(f"Error in fee reminder job: {str(e)}")

async def send_birthday_wishes():
    """
    Send WhatsApp birthday wishes to students on their birthday.
    """
    try:
        logger.info("Running birthday wishes job...")
        today = datetime.now(timezone.utc)
        today_month_day = today.strftime("%m-%d")  # MM-DD format
        
        # Find students with birthday today
        # date_of_birth is stored as YYYY-MM-DD string
        enrollments = await db.enrollments.find(
            {"status": "Active"},
            {"_id": 0}
        ).to_list(10000)
        
        for enrollment in enrollments:
            dob = enrollment.get('date_of_birth', '')
            if not dob:
                continue
            
            # Check if birthday matches today (MM-DD)
            try:
                dob_month_day = dob[5:10]  # Extract MM-DD from YYYY-MM-DD
                if dob_month_day == today_month_day:
                    await send_whatsapp_notification(
                        enrollment.get('phone', ''),
                        "birthday_wishes",
                        {"name": enrollment.get('student_name', '')}
                    )
                    logger.info(f"Birthday wish sent to {enrollment.get('student_name')}")
            except Exception as e:
                logger.warning(f"Error parsing DOB for {enrollment.get('student_name')}: {e}")
        
        logger.info("Birthday wishes job completed successfully")
    except Exception as e:
        logger.error(f"Error in birthday wishes job: {str(e)}")

# Initialize scheduler
scheduler = AsyncIOScheduler()

# ========== ADMIN RESET ENDPOINT ==========
@api_router.post("/admin/reset-system")
async def reset_system(current_user: User = Depends(require_role([UserRole.ADMIN]))):
    """
    Reset all system data - SUPER ADMIN ONLY.
    This will delete ALL data from the system except the super admin account.
    USE WITH EXTREME CAUTION!
    """
    try:
        # Keep track of collections to clear
        collections_to_clear = [
            "leads", "followups", "enrollments", "payments", "payment_plans",
            "installment_schedule", "expenses", "tasks", "notifications",
            "certificate_requests", "quiz_attempts", "exam_bookings",
            "push_subscriptions"
        ]
        
        deleted_counts = {}
        for collection_name in collections_to_clear:
            result = await db[collection_name].delete_many({})
            deleted_counts[collection_name] = result.deleted_count
        
        # Reset branch counters (don't delete branches)
        await db.branches.update_many(
            {},
            {"$set": {"lead_counter": 0, "enrollment_counter": 0, "receipt_counter": 0}}
        )
        
        # Delete all users except the current super admin
        user_delete_result = await db.users.delete_many({
            "id": {"$ne": current_user.id}
        })
        deleted_counts["users"] = user_delete_result.deleted_count
        
        logger.warning(f"SYSTEM RESET performed by {current_user.email}. Data deleted: {deleted_counts}")
        
        return {
            "success": True,
            "message": "System data has been reset successfully",
            "deleted_records": deleted_counts,
            "preserved": {
                "branches": "All branches preserved with counters reset",
                "programs": "All programs preserved",
                "expense_categories": "All expense categories preserved",
                "lead_sources": "All lead sources preserved",
                "whatsapp_settings": "WhatsApp settings preserved",
                "current_admin": current_user.email
            }
        }
    except Exception as e:
        logger.error(f"Error during system reset: {str(e)}")
        raise HTTPException(status_code=500, detail=f"System reset failed: {str(e)}")

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    """Initialize scheduler on app startup"""
    # Schedule fee reminders to run daily at 9:00 AM
    scheduler.add_job(
        send_fee_reminders,
        CronTrigger(hour=9, minute=0),
        id="fee_reminders",
        replace_existing=True
    )
    
    # Schedule birthday wishes to run daily at 8:00 AM
    scheduler.add_job(
        send_birthday_wishes,
        CronTrigger(hour=8, minute=0),
        id="birthday_wishes",
        replace_existing=True
    )
    
    scheduler.start()
    logger.info("Scheduler started - Fee reminders at 9:00 AM, Birthday wishes at 8:00 AM")

@app.on_event("shutdown")
async def shutdown_db_client():
    scheduler.shutdown()
    client.close()
    logger.info("Scheduler and database connection closed")
