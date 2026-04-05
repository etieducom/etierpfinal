# ETI Educom - Institute Management System PRD

## Original Problem Statement
Build a comprehensive institute management system with role-based access, student management, lead tracking, payments, academics, and business analytics.

## Current Status (April 2026)

### Just Completed (This Session - April 5, 2026)
- ✅ **View Followups Feature** - Branch Admin and Super Admin can now view all follow-ups added to a lead via Eye icon button
  - Opens a modal dialog showing lead info and followup timeline
  - Displays note, added by, date, and status for each followup
  - Timeline view with blue dots connecting entries
  - Role-based visibility: Only Admin & Branch Admin see the button
- ✅ **Session Format Fix** - Fixed session parsing to handle both "2026" and "2026-2027" formats

### Previously Completed (This Week)
- ✅ **AdminPanel.js Final Refactoring** - ExamsTab and SystemSettingsTab components integrated
- ✅ **WhatsApp Tab Fixed** - Added missing testNumber state and handler functions
- ✅ **Indian Currency Formatting** - Fixed all dashboards to use proper Indian numbering (L for Lakhs, Cr for Crores instead of just K)
- ✅ **Session-Based Stats (Academic Year Filtering)** - All dashboard stats now filtered by academic session (April 1 - March 31)
- ✅ **Testing Verified** - AdminPanel tabs working (iteration_25.json - 100% pass)
- ✅ **View Followups Testing** - All tests passed (iteration_26.json - 100% pass)

### Session-Based Stats Implementation
**Problem:** Dashboard cards showed "This Month" but displayed all-time data

**Solution:**
- Backend `/api/branch-admin/financial-stats` now filters by academic session (April 1 - March 31)
- Returns `session_leads`, `session_admissions`, `session_revenue`, `session_expenses`, `session_exam_revenue`, `session_net_revenue`
- Frontend labels changed from "This Month" to "This Session"
- Session is determined from the JWT token's academic session header

**Session Definition:**
- Session "2025" = April 1, 2025 → March 31, 2026 (labeled as "2025-2026")
- Session "2026" = April 1, 2026 → March 31, 2027 (labeled as "2026-2027")

### Indian Currency Formatting Details
The `formatIndianCurrency()` function was added to:
- `/app/frontend/src/pages/Dashboard.js`
- `/app/frontend/src/components/dashboards/BranchAdminDashboard.jsx`
- `/app/frontend/src/components/dashboards/FDEDashboard.jsx`
- `/app/frontend/src/components/dashboards/CounsellorDashboard.jsx`

Format rules:
- ₹1Cr+ = Crores (1,00,00,000)
- ₹1L+ = Lakhs (1,00,000)
- ₹1K+ = Thousands (1,000)
- Below ₹1K = Exact amount

### Previously Completed
- Academic Session-based login and filtering
- Session Summary Card on Dashboard (Super Admin & Branch Admin only)
- Redesigned Branch Admin dashboard (cleaner, less cluttered)
- Redesigned FDE Dashboard with overdue payments, ready-to-enroll, pending exams
- Redesigned Counsellor Dashboard with missed follow-ups, incentives
- Fixed race condition bug in Dashboard loading
- AI-Powered Business Insights (GPT-4o via emergentintegrations)
- Full CRUD Session Management for Super Admin
- Dashboard.js modularization (1,704 → 1,042 lines, 39% reduction)
- AdminPanel.js modularization (1,536 → 1,468 lines, all tabs extracted)
- Delete from Ready to Enroll feature
- Fixed Unique Student Count on dashboard

### Pending Issues
1. **(P0) Backend server.py Modularization** - Router scaffolding exists at `/app/backend/routes/` but endpoints haven't been migrated yet
2. **(P1) StudentsPage.js Refactoring** - PaymentDialog, ReceiptDialog created but not integrated (~1,900 lines)
3. **(P1) InsightsPage.js Refactoring** - BusinessOverviewComponents created but not integrated

### Technical Debt Status
| File | Original | Current | Status |
|------|----------|---------|--------|
| `Dashboard.js` | 1,704 | 1,042 | **✅ DONE (39%)** |
| `AdminPanel.js` | 1,536 | 1,468 | **✅ DONE (All tabs modular)** |
| `StudentsPage.js` | 1,965 | ~1,900 | Components created, pending integration |
| `InsightsPage.js` | 1,453 | ~1,455 | Components created, pending integration |
| `server.py` | 10,225 | 10,232 | Router structure created, pending migration |

### Extracted Components Summary
**Dashboard Components (735 lines):**
- `FDEDashboard.jsx`
- `CounsellorDashboard.jsx`
- `BranchAdminDashboard.jsx`

**Admin Components (10 files):**
- `BranchesTab.jsx`, `ProgramsTab.jsx`, `SessionsTab.jsx`
- `ExpenseCategoriesTab.jsx`, `LeadSourcesTab.jsx`, `UsersTab.jsx`
- `WhatsAppSettingsTab.jsx`, `ExamsTab.jsx`, `SystemSettingsTab.jsx`
- `index.js` (barrel export)

**Student Components (pending integration):**
- `PaymentDialog.jsx`, `ReceiptDialog.jsx`, `CancelEnrollmentDialog.jsx`

**Insights Components (pending integration):**
- `BusinessOverviewComponents.jsx`

## Architecture

### Frontend Structure
```
/app/frontend/src/
├── components/
│   ├── dashboards/
│   │   ├── FDEDashboard.jsx
│   │   ├── CounsellorDashboard.jsx
│   │   ├── BranchAdminDashboard.jsx
│   │   └── index.js
│   ├── admin/
│   │   ├── BranchesTab.jsx
│   │   ├── ProgramsTab.jsx
│   │   ├── SessionsTab.jsx
│   │   ├── ExpenseCategoriesTab.jsx
│   │   ├── LeadSourcesTab.jsx
│   │   ├── UsersTab.jsx
│   │   ├── WhatsAppSettingsTab.jsx
│   │   ├── ExamsTab.jsx
│   │   ├── SystemSettingsTab.jsx
│   │   └── index.js
│   ├── students/ (created, pending integration)
│   └── insights/ (created, pending integration)
└── pages/
    ├── Dashboard.js (uses modular components)
    ├── AdminPanel.js (uses modular components)
    ├── StudentsPage.js (pending refactor)
    └── InsightsPage.js (pending refactor)
```

### Backend Structure (Prepared for migration)
```
/app/backend/
├── core/
│   ├── deps.py (shared dependencies)
│   └── session.py (academic session helpers)
├── routes/
│   ├── auth.py (stub)
│   ├── admin.py (stub)
│   ├── leads.py (stub)
│   ├── enrollments.py (stub)
│   ├── students.py (stub)
│   ├── analytics.py (stub)
│   ├── finances.py (stub)
│   ├── batches.py (stub)
│   └── exams.py (stub)
└── server.py (main file - all logic still here)
```

## Deployment
Full deployment guide available at: `/app/DEPLOYMENT_QUICKSTART.md`
- VPS requirements: 2GB RAM, 2 vCPU minimum
- Stack: Python 3.11 + FastAPI/Gunicorn, Node 18 + React, MongoDB Atlas
- SSL via Certbot + Nginx

## Key Credentials
- Super Admin: admin@etieducom.com / admin@123
- Branch Admin: branchadmin@etieducom.com / admin@123
- FDE: fde@etieducom.com / password
- Counsellor: counsellor@etieducom.com / password

## Documentation
- `/app/DEPLOYMENT_QUICKSTART.md` - Deployment guide
- `/app/DEPLOYMENT_GUIDE.md` - Detailed deployment instructions
- `/app/COMMANDS.md` - Useful commands
- `/app/REFACTORING_GUIDE.md` - Code refactoring plan

## Test Reports
- Latest: `/app/test_reports/iteration_26.json` (View Followups verified - 100% pass)
- Previous: `/app/test_reports/iteration_25.json` (AdminPanel tabs verified - 100% pass)

## 3rd Party Integrations
- MSG91 (WhatsApp API)
- pywebpush (Push Notifications)
- OpenAI GPT-4o (via Emergent LLM Key)
- qrcode
- facebook-business (Meta Marketing API)
- openpyxl
