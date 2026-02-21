# ETI Educom Lead Management System - PRD

## Original Problem Statement
The user, representing a training institute named "ETI Educom", requested a full-fledged lead management system with the following requirements:

### Core Features
- **Lead Management:** Capture leads with details (name, numbers, address, email, program, fee quoted, payment plan, source). Manage lead statuses: New, Contacted, Demo Booked, Follow-up, Converted, Lost. Soft-delete leads with reason.
- **Role-Based Access Control (RBAC):**
  - Super Admin: Full access to all branches and data. Manages branches, programs, users, expense categories, lead sources, and WhatsApp settings.
  - Branch Admin: Full access to their branch only. Can delete leads/payments/expenses for their branch. Cannot see Admin Panel.
  - Counsellor: Can add/manage leads and follow-ups for their assigned branch only.
  - Front Desk Executive (FDE): Can manage expenses for their branch. Can view converted leads and enroll them.
- **User and Branch Management:** Super Admin can create/edit/delete branches and users with comprehensive details.
- **Program Management:** Super Admin can create/edit/delete programs with details like duration, fee, max discount.
- **Lead Source Management:** Super Admin can dynamically create/delete lead sources.
- **Follow-ups:** Counsellors can schedule follow-ups. Pending Follow-ups page displays follow-ups due today.
- **Enrollment and Payments (FDE Role):** FDE enrolls converted leads via multi-step form. System handles one-time and installment payments.
- **Expense Management (FDE Role):** Admin defines expense categories. FDE and Branch Admin record branch-specific expenses.
- **Dashboard & Analytics:** 
  - Super Admin: Branch-wise comparison dashboard with performance metrics.
  - Branch Admin: Branch-specific dashboard with key metrics.
- **WhatsApp Integration:** MSG91 WhatsApp API for automated notifications (configurable by Super Admin).

## Tech Stack
- **Frontend:** React, Tailwind CSS, Shadcn/UI, Recharts
- **Backend:** FastAPI, Pydantic, Motor (async MongoDB driver)
- **Database:** MongoDB

## What's Been Implemented

### Phase 1: Core System (COMPLETE)
- [x] Multi-role (Super Admin, Branch Admin, Counsellor, FDE) authentication system
- [x] Multi-branch data isolation
- [x] Login page with professional UI
- [x] JWT-based authentication

### Phase 2: Admin Panel (COMPLETE)
- [x] Branches CRUD with comprehensive details (owner info, contact)
- [x] Programs CRUD with fee and discount management
- [x] Users CRUD with role assignment (including Branch Admin role)
- [x] Expense Categories management tab
- [x] Lead Sources management tab
- [x] WhatsApp Settings tab (notification toggles)

### Phase 3: Lead Management (COMPLETE)
- [x] Lead creation with program selection
- [x] Lead status management (New, Contacted, Demo Booked, Follow-up, Converted, Lost)
- [x] Lead filtering and search
- [x] Follow-up scheduling
- [x] Soft-delete leads with reason (Super Admin/Branch Admin only)
- [x] View deleted leads page
- [x] WhatsApp notifications on lead creation and status change

### Phase 4: Dashboard & Analytics (COMPLETE)
- [x] Super Admin dashboard with branch performance overview
  - Total Leads, Total Enrollments, Total Income, Avg Income/Branch
  - Branch-wise comparison table with performance badges (Outperforming/Needs Attention)
- [x] Branch Admin dashboard (scoped to their branch)
- [x] Status distribution pie chart
- [x] Lead sources bar chart
- [x] Conversion rate calculation

### Phase 5: FDE Features (COMPLETE)
- [x] Expense Categories tab in Admin Panel
- [x] Expenses Page for FDE/Branch Admin role
- [x] Enrollments Page with multi-step form
- [x] Payment Management (One-time or Installments)
- [x] Payment recording with over-payment prevention
- [x] Receipt generation with print functionality

### Phase 6: Financial Analytics & Resources (COMPLETE)
- [x] Monthly Income & Expenses bar chart (Year selector)
- [x] Super Admin Branch-wise Financial Summary
- [x] Marketing Resources Section (Brochures, Videos, Documents)
- [x] All Payments page with comprehensive filters
- [x] Pending Payments page for installment tracking

### Phase 7: Role-Based Features & WhatsApp (COMPLETE - December 21, 2026)
- [x] Branch Admin role implementation
  - [x] Role added to user creation dropdown
  - [x] Navigation restricted (no Admin Panel)
  - [x] Can delete leads only from their branch
  - [x] Access to Deleted Leads (branch-scoped)
- [x] WhatsApp Notification Settings UI
  - [x] Master switch to enable/disable all notifications
  - [x] Individual toggles: Lead Added, Demo Booked, Demo Completed, Enrollment Confirmed, Payment Received, Installment Reminder
- [x] Role-based navigation updates
  - [x] Super Admin: Full navigation including Admin Panel
  - [x] Branch Admin: No Admin Panel, includes Deleted Leads
  - [x] Counsellor: Leads, Follow-ups, Analytics, Reports, Resources
  - [x] FDE: Expenses, Enrollments, Payments, Resources

## Pending/Backlog

### P0 - High Priority
- [ ] MSG91 WhatsApp Integration verification
  - Backend logic exists (send_whatsapp_notification function)
  - AUTH KEY: 354230AManBGHBNB694046f8P1
  - Integrated number needs to be configured in MSG91 dashboard

### P1 - Medium Priority
- [ ] Branch Admin - Payment/Expense deletion
  - Backend endpoints exist (DELETE /api/payments/{id}, DELETE /api/expenses/{id})
  - Frontend UI needs implementation
- [ ] WhatsApp Payment Reminders (automated)
  - Need background task or scheduled endpoint
- [ ] Reports Page enhancement
  - Add more filters (date range, branch, counsellor)
  - Branch filter for Super Admin

### P2 - Low Priority
- [ ] Code Refactoring
  - Split server.py into routers/models/schemas
  - Add state management to frontend (Zustand/Redux)

## API Endpoints

### Authentication
- POST /api/auth/login
- POST /api/auth/register
- GET /api/auth/me

### Admin (Super Admin only)
- GET/POST /api/admin/branches
- GET/PUT/DELETE /api/admin/branches/{id}
- GET/POST /api/admin/programs
- PUT/DELETE /api/admin/programs/{id}
- GET/POST /api/admin/users
- DELETE /api/admin/users/{id}
- GET/POST /api/admin/expense-categories
- DELETE /api/admin/expense-categories/{id}
- GET/POST /api/admin/lead-sources
- DELETE /api/admin/lead-sources/{id}
- GET/PUT /api/admin/whatsapp-settings

### Leads
- GET/POST /api/leads
- GET/PUT /api/leads/{id}
- DELETE /api/leads/{id} (Super Admin/Branch Admin only)
- GET /api/leads/converted
- GET /api/leads/deleted (Super Admin: all, Branch Admin: their branch)
- GET /api/leads/{id}/followups

### Follow-ups
- POST /api/followups
- GET /api/followups/pending
- GET /api/followups/pending/count
- PUT /api/followups/{id}/status

### Analytics
- GET /api/analytics/overview
- GET /api/analytics/branch-wise
- GET /api/analytics/super-admin-dashboard
- GET /api/analytics/financial/monthly?year={year}

### Expenses (FDE/Branch Admin)
- GET /api/expense-categories
- GET/POST /api/expenses

### Enrollments (FDE/Branch Admin)
- GET/POST /api/enrollments
- GET /api/enrollments/{id}/payment-plan
- GET /api/enrollments/{id}/payments

### Payments (FDE/Branch Admin)
- POST /api/payment-plans
- POST /api/payments
- GET /api/payments/{id}/receipt
- GET /api/payments/all (with filters)
- GET /api/payments/pending

### Resources
- GET /api/resources
- POST /api/admin/resources (Super Admin only)
- DELETE /api/admin/resources/{id} (Super Admin only)

## Test Credentials
- Super Admin: admin@eti.com / admin123
- Branch Admin (test): test_branch_admin_iter4@eti.com / test123

## Known Issues/Notes
- MSG91 WhatsApp integration is FUNCTIONAL but registered number needs to be configured (currently using placeholder "919876543210")
- Reports page enhancement pending
- Database migrations are manual - if Pydantic models change, existing documents need migration scripts
