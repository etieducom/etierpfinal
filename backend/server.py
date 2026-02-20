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
    query = {}
    
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

@api_router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, current_user: User = Depends(get_current_user)):
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    if current_user.role != UserRole.ADMIN and lead.get('branch_id') != current_user.branch_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    result = await db.leads.delete_one({"id": lead_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Lead not found")
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
    for status in LeadStatus:
        count = await db.leads.count_documents({**query, "status": status.value})
        status_counts[status.value] = count
    
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
