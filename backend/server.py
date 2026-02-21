from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
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
    ADMIN = "Admin"
    COUNSELLOR = "Counsellor"
    FRONT_DESK = "Front Desk Executive"

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
    owner_name: str
    owner_email: EmailStr
    owner_phone: str
    owner_designation: str
    branch_phone: str
    branch_email: EmailStr
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

class Lead(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
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

# Enrollment Management
class Enrollment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
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
    
    enrollment_date: date
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
    payment_plan_id: str
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
    payment_plan_id: str
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

async def send_whatsapp_message(phone_number: str, message_text: str, lead_name: str):
    """Send WhatsApp message via MSG91 API"""
    if not MSG91_AUTH_KEY:
        logging.warning("MSG91_AUTH_KEY not configured. Skipping WhatsApp message.")
        return {"success": False, "error": "MSG91_AUTH_KEY not configured"}
    
    try:
        url = "https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/"
        
        headers = {
            "authkey": MSG91_AUTH_KEY,
            "Content-Type": "application/json"
        }
        
        payload = {
            "messaging_product": "whatsapp",
            "to": phone_number,
            "type": "text",
            "text": {
                "body": message_text
            }
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            
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
    new_branch = Branch(**branch.model_dump())
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
async def delete_user(user_id: str, current_user: User = Depends(require_role([UserRole.ADMIN]))):
    # Prevent deleting self
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted successfully"}

# Admin - User Management
@api_router.post("/admin/users", response_model=UserResponse)
async def create_user(user: UserCreate, current_user: User = Depends(require_role([UserRole.ADMIN]))):
    return await register(user)

@api_router.get("/admin/users", response_model=List[UserResponse])
async def get_users(current_user: User = Depends(require_role([UserRole.ADMIN]))):
    users = await db.users.find({}, {"_id": 0, "hashed_password": 0}).to_list(1000)
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
    
    new_lead = Lead(
        **lead.model_dump(),
        branch_id=branch_id or "default",
        counsellor_id=current_user.id,
        program_name=program['name']
    )
    lead_dict = new_lead.model_dump()
    lead_dict['created_at'] = lead_dict['created_at'].isoformat()
    lead_dict['updated_at'] = lead_dict['updated_at'].isoformat()
    
    await db.leads.insert_one(lead_dict)
    
    # Send WhatsApp welcome message
    message = f"Hi {new_lead.name}, welcome to ETI Educom! We're excited to help you with {program['name']}. Our team will contact you shortly."
    await send_whatsapp_message(new_lead.number, message, new_lead.name)
    
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
async def get_deleted_leads(current_user: User = Depends(require_role([UserRole.ADMIN]))):
    """Get all soft-deleted leads - Admin only"""
    query = {"is_deleted": True}
    
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
    
    if current_user.role != UserRole.ADMIN and lead.get('branch_id') != current_user.branch_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
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
    
    # Send WhatsApp on status change
    if lead_update.status and lead_update.status != old_status:
        messages = {
            LeadStatus.CONTACTED: f"Hi {updated_lead_obj.name}, thank you for your interest in {updated_lead_obj.program_name}. Our counselor will be in touch with you soon.",
            LeadStatus.DEMO_BOOKED: f"Hi {updated_lead_obj.name}, your demo session for {updated_lead_obj.program_name} has been booked! We look forward to meeting you.",
            LeadStatus.CONVERTED: f"Congratulations {updated_lead_obj.name}! Welcome to ETI Educom. We're excited to start your journey in {updated_lead_obj.program_name}.",
            LeadStatus.LOST: f"Hi {updated_lead_obj.name}, we're sorry we couldn't connect. If you change your mind about {updated_lead_obj.program_name}, we're always here to help!"
        }
        
        if lead_update.status in messages:
            await send_whatsapp_message(updated_lead_obj.number, messages[lead_update.status], updated_lead_obj.name)
    
    return updated_lead_obj

class LeadDeleteRequest(BaseModel):
    reason: Optional[str] = None

@api_router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, delete_request: Optional[LeadDeleteRequest] = None, current_user: User = Depends(get_current_user)):
    """Soft delete a lead - only the counsellor who created it can delete"""
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    if lead.get('is_deleted'):
        raise HTTPException(status_code=400, detail="Lead is already deleted")
    
    # Only the counsellor who created the lead or Admin can delete
    if current_user.role != UserRole.ADMIN and lead.get('counsellor_id') != current_user.id:
        raise HTTPException(status_code=403, detail="Only the counsellor who created this lead can delete it")
    
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
    query = {}
    if current_user.role != UserRole.ADMIN:
        query["branch_id"] = current_user.branch_id
    
    total_leads = await db.leads.count_documents(query)
    
    status_counts = {}
    for lead_status in LeadStatus:
        count = await db.leads.count_documents({**query, "status": lead_status.value})
        status_counts[lead_status.value] = count
    
    pipeline = [
        {"$match": query},
        {"$group": {"_id": "$lead_source", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    source_stats = await db.leads.aggregate(pipeline).to_list(100)
    
    pipeline = [
        {"$match": query},
        {"$group": {"_id": "$program_name", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    program_stats = await db.leads.aggregate(pipeline).to_list(100)
    
    return {
        "total_leads": total_leads,
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
        
        # Total leads
        total_leads = await db.leads.count_documents({"branch_id": branch_id})
        
        # Status counts
        new_count = await db.leads.count_documents({"branch_id": branch_id, "status": "New"})
        contacted_count = await db.leads.count_documents({"branch_id": branch_id, "status": "Contacted"})
        demo_count = await db.leads.count_documents({"branch_id": branch_id, "status": "Demo Booked"})
        followup_count = await db.leads.count_documents({"branch_id": branch_id, "status": "Follow-up"})
        converted_count = await db.leads.count_documents({"branch_id": branch_id, "status": "Converted"})
        lost_count = await db.leads.count_documents({"branch_id": branch_id, "status": "Lost"})
        
        # Conversion rate
        conversion_rate = (converted_count / total_leads * 100) if total_leads > 0 else 0
        
        # Active counsellors
        counsellors_count = await db.users.count_documents({"branch_id": branch_id, "role": "Counsellor"})
        
        branch_analytics.append({
            "branch_id": branch_id,
            "branch_name": branch["name"],
            "branch_location": branch["location"],
            "total_leads": total_leads,
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
    if current_user.role != UserRole.ADMIN:
        query["branch_id"] = current_user.branch_id
    
    expenses = await db.expenses.find(query, {"_id": 0}).sort("expense_date", -1).to_list(1000)
    for exp in expenses:
        if isinstance(exp.get('created_at'), str):
            exp['created_at'] = datetime.fromisoformat(exp['created_at'])
        if isinstance(exp.get('expense_date'), str):
            exp['expense_date'] = datetime.fromisoformat(exp['expense_date']).date()
    return [Expense(**e) for e in expenses]

# Enrollment Management (FDA)
@api_router.post("/enrollments", response_model=Enrollment)
async def create_enrollment(enrollment: EnrollmentCreate, current_user: User = Depends(get_current_user)):
    if current_user.role not in [UserRole.ADMIN, UserRole.FRONT_DESK]:
        raise HTTPException(status_code=403, detail="Only Front Desk Executive can create enrollments")
    
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
    
    enrollment_data = enrollment.model_dump()
    enrollment_data.pop('enrollment_date', None)  # Remove to avoid duplicate argument
    
    new_enrollment = Enrollment(
        **enrollment_data,
        branch_id=current_user.branch_id or lead["branch_id"],
        program_name=program['name'],
        final_fee=final_fee,
        enrollment_date=datetime.fromisoformat(enrollment.enrollment_date).date(),
        created_by=current_user.id
    )
    
    enrollment_dict = new_enrollment.model_dump()
    enrollment_dict['created_at'] = enrollment_dict['created_at'].isoformat()
    enrollment_dict['enrollment_date'] = enrollment_dict['enrollment_date'].isoformat()
    
    await db.enrollments.insert_one(enrollment_dict)
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
    if current_user.role not in [UserRole.ADMIN, UserRole.FRONT_DESK]:
        raise HTTPException(status_code=403, detail="Only Front Desk Executive can record payments")
    
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
    
    payment_data = payment.model_dump()
    payment_data.pop('payment_date', None)  # Remove to avoid duplicate argument
    
    new_payment = Payment(
        **payment_data,
        branch_id=enrollment.get('branch_id', current_user.branch_id or 'default'),
        payment_date=datetime.fromisoformat(payment.payment_date).date(),
        created_by=current_user.id
    )
    
    payment_dict = new_payment.model_dump()
    payment_dict['created_at'] = payment_dict['created_at'].isoformat()
    payment_dict['payment_date'] = payment_dict['payment_date'].isoformat()
    
    await db.payments.insert_one(payment_dict)
    
    # Update installment status if applicable
    if payment.installment_number:
        await db.installment_schedule.update_one(
            {
                "payment_plan_id": payment.payment_plan_id,
                "installment_number": payment.installment_number
            },
            {"$set": {"status": "Paid", "paid_date": payment.payment_date}}
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
    
    receipt_data = {
        "receipt_number": payment.get('receipt_number', payment_id[:8].upper()),
        "payment_id": payment_id,
        "payment_date": payment['payment_date'],
        "student_name": enrollment['student_name'] if enrollment else 'N/A',
        "student_email": enrollment.get('email', ''),
        "student_phone": enrollment.get('phone', ''),
        "program": enrollment['program_name'] if enrollment else 'N/A',
        "amount": payment['amount'],
        "payment_mode": payment['payment_mode'],
        "installment_number": payment.get('installment_number'),
        "remarks": payment.get('remarks', ''),
        "total_fee": enrollment.get('final_fee', 0) if enrollment else 0,
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

# Pending Payments (Upcoming Installments)
@api_router.get("/payments/pending")
async def get_pending_payments(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    student_name: Optional[str] = None,
    contact_number: Optional[str] = None,
    branch_id: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """Get pending/upcoming installments"""
    # Get all installment plans
    plan_query = {"plan_type": PaymentPlanType.INSTALLMENTS.value}
    
    if current_user.role != UserRole.ADMIN:
        # Get enrollments for user's branch
        enrollments = await db.enrollments.find({"branch_id": current_user.branch_id}, {"_id": 0, "id": 1}).to_list(1000)
        enrollment_ids = [e["id"] for e in enrollments]
        plan_query["enrollment_id"] = {"$in": enrollment_ids}
    elif branch_id:
        enrollments = await db.enrollments.find({"branch_id": branch_id}, {"_id": 0, "id": 1}).to_list(1000)
        enrollment_ids = [e["id"] for e in enrollments]
        plan_query["enrollment_id"] = {"$in": enrollment_ids}
    
    plans = await db.payment_plans.find(plan_query, {"_id": 0}).to_list(1000)
    
    pending_installments = []
    today = datetime.now(timezone.utc).date().isoformat()
    
    for plan in plans:
        enrollment = await db.enrollments.find_one({"id": plan.get('enrollment_id')}, {"_id": 0})
        if not enrollment:
            continue
        
        # Filter by student name
        if student_name and student_name.lower() not in enrollment.get('student_name', '').lower():
            continue
        
        # Filter by contact
        if contact_number and contact_number not in enrollment.get('phone', ''):
            continue
        
        # Get installment schedule
        schedule = await db.installment_schedule.find(
            {"payment_plan_id": plan['id'], "status": {"$ne": "Paid"}},
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
            
            pending_installments.append({
                "enrollment_id": plan['enrollment_id'],
                "student_name": enrollment.get('student_name', ''),
                "student_phone": enrollment.get('phone', ''),
                "student_email": enrollment.get('email', ''),
                "program_name": enrollment.get('program_name', ''),
                "installment_number": inst.get('installment_number'),
                "amount": inst.get('amount'),
                "due_date": due_date,
                "is_overdue": is_overdue,
                "payment_plan_id": plan['id'],
                "total_installments": plan.get('installments_count', 0),
                "total_fee": enrollment.get('final_fee', 0)
            })
    
    # Sort by due date
    pending_installments.sort(key=lambda x: x['due_date'])
    
    return pending_installments

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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
