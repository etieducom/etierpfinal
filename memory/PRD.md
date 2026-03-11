# ETI Educom - Institute Management System PRD

## Original Problem Statement
Build a comprehensive institute management system with role-based access, student management, lead tracking, payments, academics, and business analytics.

## User Personas
- **Super Admin**: Full system access, manages all branches, can view all sessions
- **Branch Admin**: Branch-level management and analytics
- **Counsellor**: Lead management and follow-ups
- **Front Desk Executive (FDE)**: Student intake, payments
- **Academic Controller**: Quiz management, curriculum

## Core Requirements

### Phase 1 - Foundation (COMPLETED)
- [x] Role-based authentication
- [x] Lead management (CRUD, sources, statuses)
- [x] Student management
- [x] Enrollment system
- [x] Payment tracking

### Phase 2 - Advanced Features (COMPLETED)
- [x] Meta Ads integration
- [x] Royalty management
- [x] Audit logging
- [x] Role-specific dashboards
- [x] Follow-up system
- [x] Push notifications

### Phase 3 - UI Consolidation & Tools (COMPLETED - Dec 2025)
- [x] Insights page with 9 tabs for Branch Admin
- [x] My Responsibilities feature
- [x] Quiz CSV/Excel import
- [x] Deleted Leads report
- [x] Payment data discrepancy fix

### Phase 4 - Academic Session Feature (COMPLETED - Mar 2026)
- [x] Session selector on login page (2016 onwards)
- [x] Auto-select current session
- [x] Session badge in header for all users
- [x] Session switcher dropdown for Super Admin
- [x] "All Sessions" option for Super Admin
- [x] Data filtering by session (Leads, Enrollments, Students, Payments, Reports)
- [x] **Session Summary Card** on dashboard with current vs previous session comparison
- [x] Fixed race condition bug in Branch Admin dashboard

## Academic Session Logic
- **Format**: Session "2024" = April 1, 2024 → March 31, 2025
- **Available**: 2016-17 to current (2025-26)
- **Default**: Auto-selects current session based on today's date
- **Super Admin**: Can switch sessions and view "All Sessions"
- **Other Roles**: Locked to session selected at login

## Session Summary Card
Displays on dashboard for Super Admin and Branch Admin:
- Current session metrics: Leads, Converted, Conversion Rate, Enrollments, Income
- Percentage change vs previous session
- Previous session reference line

## Current Status (March 2026)

### Recently Completed
- Session Summary Card on Dashboard
- Fixed Branch Admin dashboard loading bug (race condition)
- All session features tested and working

### Pending Issues
1. **(P0) Complete Quiz Content Generation** - Several quizzes need more questions
2. **(P1) AI-Powered Business Insights** - Core AI logic not implemented
3. **(P2) Unique Student Count** - Dashboard shows enrollments, not unique students

### Technical Debt (CRITICAL)
- `server.py` (9,700+ lines) - Must split into routers
- `InsightsPage.js` (1,300+ lines) - Extract tab components
- `StudentsPage.js` (1,800+ lines) - Break down
- `Dashboard.js` - Extract role-specific components

## Architecture

### Backend
- FastAPI
- MongoDB with Motor
- Pydantic models

### Frontend
- React
- Tailwind CSS
- Shadcn/UI
- Recharts

### Third-Party Integrations
- MSG91 (WhatsApp)
- OpenAI GPT-4o (via Emergent LLM Key)
- pywebpush
- facebook-business (Meta API)
- openpyxl (Excel parsing)

## Key API Endpoints
- `GET /api/auth/sessions` - Returns available sessions
- `POST /api/auth/login` - Accepts session parameter
- `GET /api/analytics/session-comparison` - Current vs previous session metrics
- `GET /api/leads?session=2024` - Filter leads by session
- `GET /api/enrollments?session=2024` - Filter enrollments
- `GET /api/payments/all?session=2024` - Filter payments
- All APIs accept `X-Academic-Session` header

## Key Credentials (Testing)
- Super Admin: admin@etieducom.com / admin@123
- Branch Admin: branchadmin@etieducom.com / admin@123
- Academic: academic@etieducom.com / password
- FDE: fde@etieducom.com / password

## Test Reports
- Latest: `/app/test_reports/iteration_23.json`
- All features verified via screenshots and API testing
