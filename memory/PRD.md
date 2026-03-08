# ETI Educom - Institute Management System PRD

## Original Problem Statement
Build a comprehensive institute management system with role-based access, student management, lead tracking, payments, academics, and business analytics.

## User Personas
- **Super Admin**: Full system access, manages all branches
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

## Current Status (March 2026)

### Recently Completed
- Meta Tab fix verified
- All Insights tabs functional
- My Responsibilities CRUD working
- Quiz Import feature working
- Deleted Leads restore working
- Testing agent fixes applied

### Pending Issues
1. **(P0) Complete Quiz Content Generation** - Several quizzes need more questions
2. **(P1) AI-Powered Business Insights** - Core AI logic not implemented
3. **(P2) Unique Student Count** - Dashboard shows enrollments, not unique students

### Technical Debt (CRITICAL)
- `server.py` (8,500+ lines) - Must split into routers
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

## Key Credentials (Testing)
- Super Admin: admin@etieducom.com / admin@123
- Branch Admin: branchadmin@etieducom.com / admin@123
- Academic: academic@etieducom.com / password
- FDE: fde@etieducom.com / password

## Test Reports
- Latest: `/app/test_reports/iteration_22.json`
- Backend: 100% pass rate (20/20 tests)
- Frontend: All features verified
