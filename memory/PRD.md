# ETI Educom - Institute Management System PRD

## Original Problem Statement
Build a comprehensive institute management system with role-based access, student management, lead tracking, payments, academics, and business analytics.

## Current Status (March 2026)

### Recently Completed (This Session)
- ✅ Verified FDE Dashboard "breathable" layout with proper spacing
- ✅ Verified Counsellor Dashboard "breathable" layout with proper spacing
- ✅ AI-Powered Business Insights fully functional
  - Health Score (1-10 from AI, displayed as x10 for 0-100 scale)
  - AI Summary text showing branch performance analysis
  - "What's Going Well" section with AI-derived insights
  - "Needs Attention" section with actionable AI recommendations
- ✅ Deployment guide exists: `/app/DEPLOYMENT_QUICKSTART.md`

### Previously Completed
- Academic Session-based login and filtering
- Session Summary Card on Dashboard (Super Admin & Branch Admin only)
- Redesigned Branch Admin dashboard (cleaner, less cluttered)
- Redesigned FDE Dashboard with overdue payments, ready-to-enroll, pending exams
- Redesigned Counsellor Dashboard with missed follow-ups, incentives
- Fixed race condition bug in Dashboard loading

### AI Insights Implementation
- Backend endpoint: `GET /api/analytics/ai-branch-insights`
- Uses GPT-4o via emergentintegrations LlmChat
- Returns structured JSON with:
  - `trainer_analysis` (overloaded/underutilized trainers, recommendation)
  - `income_insights` (trend, forecast, recommendation)
  - `student_insights` (retention risk, fee collection status)
  - `overall_health` (score 1-10, status, top_priority, summary)

### Pending Issues
1. **(P1) Complete Quiz Content Generation** - Several quizzes need more questions
2. **(P2) Unique Student Count** - Dashboard shows enrollments, not unique students

### Technical Debt (CRITICAL)
- `server.py` (10,000+ lines) - Must split into FastAPI routers
- `Dashboard.js` (1,600+ lines) - Must split into role-specific components
- `InsightsPage.js` (1,400+ lines) - Large but functional

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
- Academic: academic@etieducom.com / password

## Test Reports
- Latest: `/app/test_reports/iteration_24.json` (All features verified)
