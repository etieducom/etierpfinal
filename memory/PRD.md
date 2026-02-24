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

### Phase 8: Advanced Features (COMPLETE - February 21, 2026)
- [x] Dashboard Deleted Leads Fix
  - [x] Deleted leads now shown as separate count card
  - [x] Deleted leads excluded from Total Leads count
  - [x] Deleted leads excluded from status breakdown (Converted, Lost, etc.)
  - [x] Pie chart excludes "Deleted" status
- [x] Per-Event WhatsApp Templates (5 Events)
  - [x] Enquiry Saved - Variables: {name}, {course}
  - [x] Demo Booked - Variables: {name}, {demo_date}, {demo_time}, {trainer}
  - [x] Enrollment Confirmed - Variables: {name}, {enrollment_number}, {course}
  - [x] Fee Reminder - Variables: {name}, {amount_due}, {due_date}
  - [x] Birthday Wishes - Variables: {name}
  - [x] Each event has: enabled toggle, template_name, namespace, variables
- [x] Quiz-Based Exams Module
  - [x] Super Admin creates MCQ exams (up to 100 questions, 4 options each)
  - [x] Quiz settings: name, description, duration, pass percentage
  - [x] FDE can view quizzes and copy shareable links
  - [x] Public exam page (/exam/:examId) - no auth required
  - [x] Student enters enrollment number to start exam
  - [x] Timer countdown with auto-submit
  - [x] Question navigation with answered status indicators
  - [x] Pass/Fail result display with score and time taken
  - [x] All attempts tracked with student details
- [x] Task Assignment Bug Fix
  - [x] Branch Admin can now see users in task dropdown
  - [x] New /api/branch/users endpoint for branch-specific users

### Phase 9: Notifications & External Lead Capture (COMPLETE - December 23, 2025)
- [x] Follow-up Alarm Notification System
  - [x] GET /api/followups/due-soon - Returns follow-ups due within 10 minutes
  - [x] GET /api/followups/overdue - Returns overdue follow-ups
  - [x] NotificationCenter component with alarm sound for due-soon followups
  - [x] In-app toast notifications for approaching follow-ups
- [x] Branch-Specific Lead Capture Webhooks (for Google Ads & Meta)
  - [x] POST /api/webhooks/leads/{webhook_key} - PUBLIC endpoint for external lead capture
  - [x] GET /api/admin/branches/{branch_id}/webhook-info - Get webhook URL and instructions
  - [x] POST /api/admin/branches/{branch_id}/regenerate-webhook-key - Regenerate webhook key
  - [x] Admin Panel Webhooks tab showing all branches with webhook URLs
  - [x] Sample payload display and copy-to-clipboard functionality
- [x] Push Notifications for Task Assignment
  - [x] Auto-create in-app notification when task is assigned
  - [x] NotificationCenter component in header with bell icon
  - [x] Unread count badge on notification bell
  - [x] "Enable Push" button for browser push notification permission
  - [x] GET /api/push-subscriptions/vapid-public-key - VAPID key for push subscription
  - [x] POST /api/push-subscriptions - Save browser push subscription
  - [x] DELETE /api/push-subscriptions - Remove push subscription
  - [x] PUT /api/notifications/mark-all-read - Mark all notifications as read
  - [x] GET /api/notifications/unread-count - Get unread notification count

### Phase 10: Certificate Management System (COMPLETE - December 23, 2025)
- [x] New Role: Certificate Manager
  - [x] Added to UserRole enum and admin panel dropdown
  - [x] Certificate Manager can access /certificates page
  - [x] Certificate Manager redirected to /certificates after login (no Dashboard)
  - [x] Sidebar shows only "Certificate Requests" and "Ready Certificates" tabs
- [x] Public Certificate Request Form (/certificate-request)
  - [x] Student enters Enrollment ID to auto-fetch details
  - [x] Form captures: email, phone, program dates, training mode, hours
  - [x] GET /api/public/enrollment/{enrollment_number} - Fetch student details
  - [x] POST /api/public/certificate-requests - Submit new request
- [x] Certificate Manager Dashboard (/certificates)
  - [x] Stats cards: Pending, Approved, Issued, Total
  - [x] Filter tabs by status
  - [x] View, Edit, Approve, Reject, Download actions
  - [x] GET /api/certificate-requests - List all requests
  - [x] PUT /api/certificate-requests/{id} - Edit request details
  - [x] POST /api/certificate-requests/{id}/approve - Approve request
  - [x] POST /api/certificate-requests/{id}/reject - Reject with reason
  - [x] POST /api/certificate-requests/{id}/download - Download certificate
- [x] PDF Certificate Generation
  - [x] Uses user-provided background image with fallback gradient
  - [x] Generates on frontend using HTML canvas
  - [x] Includes student name, program, duration, dates, training mode
  - [x] Unique QR code for verification
- [x] Public Certificate Verification (/verify/{verification_id})
  - [x] GET /api/public/verify/{verification_id} - Verify certificate
  - [x] Shows verified badge and certificate details
- [x] WhatsApp Integration
  - [x] Added "certificate_ready" event to settings
  - [x] Sends notification when certificate is downloaded

### Phase 11: Security Enhancement (COMPLETE - December 23, 2025)
- [x] Auto-Logout After Inactivity
  - [x] ActivityTracker component monitors user activity
  - [x] 30-minute inactivity timeout
  - [x] Warning toast shown 2 minutes before logout
  - [x] Automatic logout and redirect to login page

### Phase 12: UI/UX Improvements (COMPLETE - December 23, 2025)
- [x] Enhanced Fee Receipt
  - [x] A4 format with dual copies (Student Copy / Center Copy)
  - [x] ETI logo and branch address
  - [x] Fee breakdown: Total Fee, Amount Paid, Total Paid, Pending Fee
  - [x] Next Due Date for pending fees
  - [x] Terms & Conditions section
  - [x] Authorized Signatory section
- [x] Payment Installment Validation
  - [x] Frontend validation prevents amount exceeding remaining fee
  - [x] Backend validation with descriptive error message
  - [x] Record Payment dialog shows Total/Paid/Pending amounts
- [x] Demo Booking Popup
  - [x] Popup appears when lead status changed to "Demo Booked"
  - [x] Captures demo date, time, and trainer name
  - [x] WhatsApp notification sent with demo details

### Phase 13: Lead Workflow & Navigation Improvements (COMPLETE - February 23, 2026)
- [x] Converted Leads Locking
  - [x] Converted leads display locked status badge with 🔒 icon
  - [x] Status dropdown replaced with static badge for converted leads
  - [x] Edit button disabled for converted leads
  - [x] Followup button disabled for converted leads
  - [x] Delete button disabled for converted leads
  - [x] Tooltip explains "Converted leads are locked" on hover
- [x] Sidebar Navigation Reordering
  - [x] Menu order follows user specification for Branch Admin:
    - Dashboard → Leads → Enrollments → Students → All Payments → Pending Payments
    - International Exams → Manage Exams → Tasks → Analytics → Reports → Resources
  - [x] Quiz Exams visible only for Super Admin and FDE roles
  - [x] Additional items (Pending Follow-ups, Expenses, Deleted Leads) at bottom
- [x] Ready to Enroll Flow Verified
  - [x] Converted leads appear in Enrollments page "Ready to Enroll" tab
  - [x] After enrollment, leads move to "Enrolled" tab

### Phase 14: Payment System Improvements (COMPLETE - February 23, 2026)
- [x] Fee Payment in Students Tab
  - [x] "Pay Fee" button added to Students table for students with pending payments
  - [x] Green button with wallet icon in Actions column
  - [x] Opens streamlined payment dialog
- [x] Improved Payment Dialog
  - [x] Shows student info: Name, Enrollment ID
  - [x] Displays Total Fee, Paid, Pending amounts
  - [x] For one-time payments: Amount pre-filled with pending amount
  - [x] For installments: Dropdown to select installment (shows amount)
  - [x] Payment Mode dropdown: Cash, Card, UPI, Net Banking, Cheque
  - [x] Payment Date defaults to today
  - [x] Optional Remarks field
  - [x] Save Payment button with validation
- [x] Receipt Dialog & Printing
  - [x] Appears after successful payment
  - [x] Shows Receipt Number, Amount Received, Student Name
  - [x] Displays Total Paid, Pending amounts
  - [x] Print Receipt button generates professional A4 receipt
- [x] A4 Receipt Format with Terms & Conditions
  - [x] Dual copies (Student Copy / Center Copy) on single A4 page
  - [x] ETI Educom logo and branch details in header
  - [x] Student Information section with enrollment ID
  - [x] Fee Details section: Total Fee, Amount Paid, Total Paid, Balance
  - [x] Payment Mode and Remarks
  - [x] 7 Terms & Conditions points
  - [x] Signature lines for Student and Authorized Signatory
  - [x] Thank you footer with computer-generated disclaimer
- [x] Print Receipt in All Payments
  - [x] Green printer icon added to Actions column
  - [x] Same professional A4 format receipt
- [x] Pending Payments Shows All Types
  - [x] One-time payments with partial payments displayed
  - [x] Installment payments with due dates
  - [x] Type badges: "One-Time" (blue) and "Installment" (purple)
  - [x] Shows paid amount vs total for one-time payments
  - [x] Shows installment number (e.g., #2 of 3) for installments
- [x] WhatsApp Integration Verified
  - [x] MSG91 API integration working
  - [x] Lead creation triggers WhatsApp notification
  - [x] API returns success status

### Phase 15: Final Refinements for Go-Live (COMPLETE - February 23, 2026)
- [x] Receipt Format - Single Student Copy (Full A4)
  - [x] Changed from dual copy to single student copy format
  - [x] Full A4 page layout with proper spacing
  - [x] Professional formatting with Terms & Conditions
- [x] Date Filters on Leads Page
  - [x] Added "Date From" and "Date To" fields
  - [x] Clear filters button
  - [x] Filters leads by created_at date
- [x] Date Filters on Students Page
  - [x] Added "Date From" and "Date To" fields
  - [x] Clear filters button
  - [x] Filters students by enrollment date
- [x] Certificate Generation Improvements
  - [x] Proper A4 Landscape format (2970x2100 pixels)
  - [x] ETI Educom logo with text fallback
  - [x] Enhanced decorative borders and gradient background
  - [x] Larger, more readable fonts
  - [x] QR codes for verification

### Phase 16: Automation & System Management (COMPLETE - February 23, 2026)
- [x] Certificate Generation Fix
  - [x] Removed duplicate code block that was generating two QR codes
  - [x] Single generateCertificatePDF function with proper layout
  - [x] ETI logo properly loaded with fallback
- [x] Fee Reminder Automation (APScheduler)
  - [x] Daily job at 9:00 AM
  - [x] Sends reminders 7, 5, 3, 1 days before due date and on due date
  - [x] Handles both installment and one-time payment reminders
  - [x] Uses WhatsApp fee_reminder template configuration
- [x] Birthday Wishes Automation
  - [x] Daily job at 8:00 AM
  - [x] Checks student date_of_birth against today's MM-DD
  - [x] Uses WhatsApp birthday_wishes template configuration
- [x] Admin System Reset Feature
  - [x] Super Admin only (POST /api/admin/reset-system)
  - [x] Requires typing "RESET ALL DATA" confirmation
  - [x] Clears all operational data (leads, enrollments, payments, etc.)
  - [x] Preserves branches, programs, categories, and settings
  - [x] New System tab in Admin Panel with danger zone warning
  - [x] Automated Tasks info display showing scheduled jobs

### Phase 17: Student Management & Exams (COMPLETE - February 23, 2026)
- [x] Student Status Management
  - [x] Status dropdown in Students page Actions column
  - [x] Options: Active, Dropped, Inactive, Completed
  - [x] Only visible to Admin/Branch Admin roles
  - [x] Backend endpoint: PUT /api/students/{id}/status
- [x] International Exams Module Wiring (Verified)
  - [x] ManageExamsPage.js connected to backend endpoints
  - [x] Stats cards: Total Bookings, Pending, Confirmed, Completed, Revenue
  - [x] Booking table with status management
- [x] Certificate Layout Improvements
  - [x] Full A4 landscape utilization (3000x2121 canvas)
  - [x] Geometric triangle background pattern
  - [x] Better vertical spacing and text sizing
  - [x] Single QR code in proper position

### Phase 18: Branch Admin Permissions Enhancement (COMPLETE - February 24, 2026)
- [x] Branch Admin Can Create Trainers
  - [x] Fixed route protection in App.js - added `adminPanelAccess` prop for `/admin` route
  - [x] Admin Panel now accessible to Branch Admin (previously blocked)
  - [x] Conditional tab rendering - Branch Admin sees only "Users" and "Batch Info" tabs
  - [x] Users list filtered to show only Trainers from Branch Admin's branch
  - [x] "Add Trainer" button instead of "Add User" for Branch Admin
  - [x] Role dropdown restricted to "Trainer" option only
  - [x] Branch field disabled with auto-assignment message
  - [x] Backend already supports Branch Admin creating Trainers (branch auto-assigned)

## Pending/Backlog

### P0 - High Priority (None currently)
All high-priority features completed.

### P1 - Medium Priority
- [ ] Code Refactoring
  - Split server.py into routers/models/schemas using FastAPI APIRouters
  - Add state management to frontend (Zustand/Redux)

### P2 - Low Priority
- [ ] WhatsApp Fee Reminders - Implement 7, 5, 3, 1 day before due date logic
- [ ] Birthday Wishes Automation - Add date_of_birth field to enrollment UI
- [ ] Refactor AdminPanel.js - Break into smaller components
- [ ] Payment Data Discrepancy Fix - Handle partially paid installments correctly

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

### Quiz Exams
- GET /api/quiz-exams - List all active quizzes
- POST /api/quiz-exams - Create quiz (Super Admin only)
- GET /api/quiz-exams/{id} - Get quiz with all details (Super Admin only)
- PUT /api/quiz-exams/{id} - Update quiz (Super Admin only)
- DELETE /api/quiz-exams/{id} - Delete quiz (Super Admin only)
- GET /api/quiz-attempts - List all attempts
- GET /api/public/quiz/{id} - Public quiz (no auth, correct answers hidden)
- POST /api/public/quiz/{id}/start - Start quiz attempt
- POST /api/public/quiz/attempt/{id}/submit - Submit quiz answers

### Branch-Specific
- GET /api/branch/users - Get users in current user's branch (for task assignment)

### Notifications & Push Subscriptions
- GET /api/notifications - Get all notifications for current user
- POST /api/notifications - Send notification (Admin/Branch Admin)
- PUT /api/notifications/{id}/read - Mark notification as read
- PUT /api/notifications/mark-all-read - Mark all notifications as read
- GET /api/notifications/unread-count - Get count of unread notifications
- GET /api/push-subscriptions/vapid-public-key - Get VAPID public key for browser push
- POST /api/push-subscriptions - Save browser push subscription
- DELETE /api/push-subscriptions - Remove push subscription

### Follow-up Reminders
- GET /api/followups/due-soon - Get follow-ups due within 10 minutes
- GET /api/followups/overdue - Get overdue follow-ups

### External Lead Capture Webhooks
- POST /api/webhooks/leads/{webhook_key} - PUBLIC endpoint for lead capture from Google Ads/Meta
- GET /api/admin/branches/{branch_id}/webhook-info - Get webhook URL and instructions
- POST /api/admin/branches/{branch_id}/regenerate-webhook-key - Regenerate webhook key

### Certificate Management
- GET /api/public/enrollment/{enrollment_number} - Public: Fetch enrollment for certificate request
- POST /api/public/certificate-requests - Public: Submit certificate request
- GET /api/public/verify/{verification_id} - Public: Verify certificate authenticity
- GET /api/certificate-requests - List all requests (Certificate Manager/Admin)
- GET /api/certificate-requests/{id} - Get single request details
- PUT /api/certificate-requests/{id} - Update request details
- POST /api/certificate-requests/{id}/approve - Approve request
- POST /api/certificate-requests/{id}/reject - Reject request with reason
- POST /api/certificate-requests/{id}/download - Download certificate data & mark as Ready

### System Management (Super Admin only)
- POST /api/admin/reset-system - Reset all system data (preserves config)

## Test Credentials
- Super Admin: admin@etieducom.com / admin@123
- Branch Admin (test): director@etieducom.com / test123
- Certificate Manager: certmanager@etieducom.com / cert@123
- Test Enrollment: PBPTKE0001

## Public URLs
- Certificate Request Form: /certificate-request
- Certificate Verification: /verify/{verification_id}
- Public Quiz Exam: /exam/{exam_id}

## Known Issues/Notes
- MSG91 WhatsApp integration is FUNCTIONAL but registered number needs to be configured
- VAPID keys for browser push notifications are using test/default values - should be generated for production
- Certificate PDF is generated on frontend using canvas - works in modern browsers
- Reports page enhancement pending
- Database migrations are manual - if Pydantic models change, existing documents need migration scripts
