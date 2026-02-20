# ETI Educom Lead Management System - PRD

## Original Problem Statement
The user, representing a training institute named "ETI Educom", requested a full-fledged lead management system with the following requirements:

### Core Features
- **Lead Management:** Capture leads with details (name, numbers, address, email, program, fee quoted, payment plan, source). Manage lead statuses: New, Contacted, Demo Booked, Follow-up, Converted, Lost.
- **Role-Based Access Control (RBAC):**
  - Admin: Superuser with full access. Can create branches, programs, users. Can view all data across branches.
  - Counsellor: Can add/manage leads and follow-ups for their assigned branch only.
  - Front Desk Executive (FDE): Can manage expenses for their branch. Can view converted leads and enroll them.
- **User and Branch Management:** Admin can create/edit/delete branches and users with comprehensive details.
- **Program Management:** Admin can create/edit/delete programs with details like duration, fee, max discount.
- **Follow-ups:** Counsellors can schedule follow-ups. Pending Follow-ups page displays follow-ups due today.
- **Enrollment and Payments (FDE Role):** FDE enrolls converted leads via multi-step form. System handles one-time and installment payments.
- **Expense Management (FDE Role):** Admin defines expense categories. FDE records branch-specific expenses.
- **Dashboard & Analytics:** Admin dashboard shows branch-wise performance reports.
- **WhatsApp Integration:** MSG91 WhatsApp API for automated messages on lead creation and status updates.

## Tech Stack
- **Frontend:** React, Tailwind CSS, Shadcn/UI, Recharts
- **Backend:** FastAPI, Pydantic, Motor (async MongoDB driver)
- **Database:** MongoDB

## What's Been Implemented

### Phase 1: Core System (COMPLETE)
- [x] Multi-role (Admin, Counsellor, FDE) authentication system
- [x] Multi-branch data isolation
- [x] Login page with professional UI
- [x] JWT-based authentication

### Phase 2: Admin Panel (COMPLETE)
- [x] Branches CRUD with comprehensive details (owner info, contact)
- [x] Programs CRUD with fee and discount management
- [x] Users CRUD with role assignment and branch assignment
- [x] Expense Categories management tab

### Phase 3: Lead Management (COMPLETE)
- [x] Lead creation with program selection
- [x] Lead status management (New, Contacted, Demo Booked, Follow-up, Converted, Lost)
- [x] Lead filtering and search
- [x] Follow-up scheduling
- [x] WhatsApp messages on lead creation and status change (MOCKED - MSG91 not fully integrated)

### Phase 4: Dashboard & Analytics (COMPLETE)
- [x] Admin dashboard with branch-wise performance table
- [x] Status breakdown per branch
- [x] Conversion rate calculation
- [x] Counsellor count per branch

### Phase 5: FDE Features (COMPLETE - December 20, 2026)
- [x] Expense Categories tab in Admin Panel
- [x] Expenses Page for FDE role
  - [x] Create expenses with category selection
  - [x] View expense history with totals
- [x] Enrollments Page
  - [x] View converted leads ready for enrollment
  - [x] Multi-step enrollment form (Personal, Academic, Program, Confirmation)
  - [x] Final fee calculation with discount
- [x] Payment Management
  - [x] Create payment plans (One-time or Installments)
  - [x] Configure installment schedule
  - [x] Record payments
  - [x] View payment history per enrollment
- [x] Navigation updates for FDE role

## Pending/Backlog

### P0 - High Priority
- [ ] MSG91 WhatsApp Integration (Auth key available: 354230AManBGHBNB694046f8P1)
  - Current: Function exists but doesn't actually send messages
  - Need: Use integration_playbook_expert_v2 for proper MSG91 setup

### P1 - Medium Priority
- [ ] Reports Page enhancement
  - Add date range filters
  - Add branch/counsellor/status filters
  - Export to CSV functionality (backend ready)
- [ ] Pending Follow-ups Page finalization
  - Currently shows all pending follow-ups
  - Need: Better UI and filtering

### P2 - Low Priority
- [ ] Receipt Generation
  - Generate printable/downloadable receipts for payments
- [ ] Code Refactoring
  - Split server.py into routers/models/schemas
  - Add state management to frontend (Zustand/Redux)

## API Endpoints

### Authentication
- POST /api/auth/login
- POST /api/auth/register
- GET /api/auth/me

### Admin
- GET/POST /api/admin/branches
- GET/PUT/DELETE /api/admin/branches/{id}
- GET/POST /api/admin/programs
- PUT/DELETE /api/admin/programs/{id}
- GET/POST /api/admin/users
- DELETE /api/admin/users/{id}
- GET/POST /api/admin/expense-categories

### Leads
- GET/POST /api/leads
- GET/PUT/DELETE /api/leads/{id}
- GET /api/leads/converted
- GET /api/leads/{id}/followups

### Follow-ups
- POST /api/followups
- GET /api/followups/pending
- GET /api/followups/pending/count
- PUT /api/followups/{id}/status

### Analytics
- GET /api/analytics/overview
- GET /api/analytics/branch-wise

### Expenses (FDE)
- GET /api/expense-categories
- GET/POST /api/expenses

### Enrollments (FDE)
- GET/POST /api/enrollments
- GET /api/enrollments/{id}/payment-plan
- GET /api/enrollments/{id}/payments

### Payments (FDE)
- POST /api/payment-plans
- POST /api/payments
- GET /api/payments/{id}/receipt

## Test Credentials
- Admin: admin@eti.com / admin123

## Known Issues/Notes
- MSG91 WhatsApp integration is MOCKED - messages are not actually sent
- Reports page is a placeholder
- Database migrations are manual - if Pydantic models change, existing documents need migration scripts
