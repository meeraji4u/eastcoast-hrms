# Payroll Approval Workflow Implementation

## Status
Completed.

## Changes Made
1. **Backend Models (`backend/models/models.py`)**:
   - Added `SalaryRevisionRequest` model to track pending edits to HRA and Basic Salary. Includes fields `emp_code`, `basic_salary`, `hra`, `status`, `requested_by`, and `approved_by`.

2. **Backend Routers (`backend/routers/payroll_router.py`)**:
   - Updated the `update_payroll` endpoint (at `/{payroll_id}/salary`). Creating a salary for the first time remains unrestricted, but updating an existing basic salary creates a `PENDING` `SalaryRevisionRequest` instead of immediately applying the change.
   - Added endpoints for listing pending revisions (`/revisions/pending`), approving revisions (`/revisions/{req_id}/approve`), and rejecting revisions (`/revisions/{req_id}/reject`), accessible to roles like `management`, `director`, and `hr_admin`.

3. **Frontend UI (`frontend/src/pages/Payroll.js`)**:
   - Added an HRA input field to the Set Salary modal.
   - Modified the "Save & Calculate" button logic in the Set Salary modal to dynamically display "Submit for Approval" when an existing salary is edited.
   - Added an "Approvals" tab/section visible to admins to review, approve, and reject pending salary revision requests.

## Next Steps
- Validate the Payroll Approval Workflow end-to-end to ensure that a revision submitted by HR correctly impacts the active payroll once approved by the Director/Admin.

---

# IT Admin Dashboard and User Management Implementation

## Status
Completed.

## Changes Made
1. **Backend (`backend/routers/admin_router.py`)**:
   - Removed restrictions for the `it_admin` role when assigning roles in `create_employee` and `update_employee_role` endpoints.
   - Added a new `reset_employee_password` endpoint (`/employees/{emp_code}/reset-password`) strictly for the `it_admin` to allow manual password resets.

2. **Frontend UI (`frontend/src/pages/Users.js`)**:
   - Created a dedicated `Users.js` page for the IT Admin.
   - Added functionality to list all users, filter by name/code, and view their status.
   - Built modals for creating new users and resetting user passwords.
   - Integrated dropdowns to change a user's role on the fly.

3. **Frontend Routing and Dashboard**:
   - Updated `frontend/src/App.js` to include the new `UsersPage` route.
   - Modified `frontend/src/pages/Dashboard.js` to tailor the IT Admin Dashboard Quick Actions to user management (Manage Users, Roles, Devices, Sync).
   - Updated `frontend/src/components/Sidebar.js` to include a "User Management" tab specifically for the IT Admin.
   - Registered the `resetPassword` API call in `frontend/src/utils/api.js`.

## Next Steps
- Verify the user management flow manually as an IT Admin.
