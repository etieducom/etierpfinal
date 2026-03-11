# ETI Educom - Institute Management System PRD

## Original Problem Statement
Build a comprehensive institute management system with role-based access, student management, lead tracking, payments, academics, and business analytics.

## Current Status (March 2026)

### Recently Completed
- Academic Session-based login and filtering
- Session Summary Card on Dashboard (Super Admin & Branch Admin only)
- Redesigned Branch Admin dashboard (cleaner, less cluttered)
- Fixed race condition bug in Dashboard loading

### Session Summary Card
- Shows current vs previous session comparison
- Metrics: Leads, Converted, Conversion Rate, Enrollments, Income
- Percentage change indicators with arrows
- **Visible to:** Super Admin, Branch Admin only
- **Not visible to:** FDE, Counsellor, Trainer, Academic Controller, Certificate Manager

### Branch Admin Dashboard Layout
1. Session Summary (top)
2. Lead Stats Row (Total, Conversion, Converted, Lost)
3. Financial Overview (6 compact cards)
4. Trainer Stats + Royalty (side-by-side)
5. Monthly Admissions Chart + Program Distribution (side-by-side)
6. Counsellor Incentives (compact card)

### Pending Issues
1. **(P0) Complete Quiz Content Generation** - Several quizzes need more questions
2. **(P1) AI-Powered Business Insights** - Core AI logic not implemented
3. **(P2) Unique Student Count** - Dashboard shows enrollments, not unique students

### Technical Debt
- `server.py` (9,700+ lines) - Must split into routers
- Large frontend components need refactoring

## Key Credentials
- Super Admin: admin@etieducom.com / admin@123
- Branch Admin: branchadmin@etieducom.com / admin@123
- FDE: fde@etieducom.com / password
- Academic: academic@etieducom.com / password

## Test Reports
- Latest: `/app/test_reports/iteration_23.json`
