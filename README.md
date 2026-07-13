# EastCoast HRMS
### Custom-built HR & Attendance system for East Coast Hospitals Ltd

A from-scratch HRMS — **not** a clone of any existing product — covering
attendance (synced from your eSSL biometric devices), leave, shifts,
payroll, and admin reporting. Includes **email-OTP account activation**
and **password reset**.

---

## What's included so far

| Layer | Status |
|---|---|
| Auth: login, OTP-based account activation, OTP-based password reset, change password | ✅ Built & tested |
| Admin: employee onboarding (auto-sends activation email) | ✅ Built & tested |
| eSSL MS SQL integration: punch logs, daily/monthly attendance, dashboards | ✅ Built |
| PDF monthly report generator | ✅ Built |
| Web UI: custom-designed auth screens (teal/coral identity, distinct from Greythr) | ✅ Built |
| Web UI: attendance / leave / shift / payroll dashboards | 🔜 Next |
| Mobile app (Android + iOS, React Native) | 🔜 Next |

This is being delivered in layers given the scope — auth + onboarding +
eSSL integration is the foundation everything else builds on.

---

## How OTP activation & reset work

**New employee onboarding (HR/Admin does this):**
1. Admin calls `POST /api/admin/employees` with emp_code, name, email, role, etc.
2. System creates the user as `is_activated=False` and emails a welcome message
   with their employee code.
3. Employee opens the app, clicks **"Activate account"**, enters their employee code.
4. System emails a 6-digit OTP (10-minute expiry).
5. Employee enters the OTP + sets their own password → account activated, logged in.

**Forgot password:**
1. Employee clicks **"Forgot password"**, enters employee code.
2. System emails a 6-digit OTP to their registered email (masked on screen, e.g. `t**t@example.com`).
3. Employee enters OTP + new password → password reset, logged in.

**Security details:**
- OTPs expire in 10 minutes, max 5 incorrect attempts before requiring a fresh OTP
- 45-second cooldown between resend requests
- Passwords hashed with bcrypt, never stored or logged in plaintext
- JWT session tokens, 8-hour expiry by default

---

## Setup

### 1. Configure environment
```bash
cd backend
cp .env.example .env
nano .env
```
Fill in:
- `ESSL_SERVER`, `ESSL_USERNAME`, `ESSL_PASSWORD` — your eSSL MS SQL Server (192.168.1.23)
- `SMTP_USER`, `SMTP_PASSWORD` — an email account to send OTPs from
  - **Gmail**: create an [App Password](https://myaccount.google.com/apppasswords) (not your real password)
  - Or use any SMTP provider (Office 365, SendGrid, your own mail server)
- `SECRET_KEY` — generate a random string: `openssl rand -hex 32`

### 2. Deploy
```bash
docker compose up -d --build
```

### 3. Access
```
http://192.168.0.74:8091
```

### 4. Create your first admin user
Since the activation flow needs an existing record, create the first HR/Admin
account directly in the database (or via a one-time setup script):

```bash
docker exec -it hrms-backend python3 -c "
from core.database import PgSession, Base, pg_engine
from models.models import User, RoleEnum
from services.auth import hash_password
Base.metadata.create_all(bind=pg_engine)
db = PgSession()
admin = User(
    emp_code='ADMIN001', name='HR Admin',
    email='hr@eastcoasthospitals.in',
    password_hash=hash_password('temporary-not-used'),
    role=RoleEnum.hr_admin, is_activated=False, must_change_password=True,
)
db.add(admin); db.commit()
print('Created. Now use Activate Account flow with emp_code=ADMIN001')
"
```
Then go to the web app → **Activate account** → enter `ADMIN001` → check the
admin email inbox for the OTP → set a real password.

---

## API Reference (Auth)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/login` | Login with emp_code + password |
| POST | `/api/auth/activate/request-otp` | Send activation OTP |
| POST | `/api/auth/activate/verify` | Verify OTP, set password, activate |
| POST | `/api/auth/forgot-password/request-otp` | Send reset OTP |
| POST | `/api/auth/forgot-password/verify` | Verify OTP, set new password |
| POST | `/api/auth/resend-otp` | Resend OTP (rate-limited 45s) |
| POST | `/api/auth/change-password` | Change password (logged in) |
| GET  | `/api/auth/me` | Current user info |
| POST | `/api/admin/employees` | HR creates employee → sends welcome email |
| GET  | `/api/admin/employees` | HR lists all employees |

Full interactive API docs: `http://192.168.0.74:8091/api/docs` (FastAPI Swagger UI,
proxied through Nginx — adjust if you lock this down for production).

---

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌───────────────────┐
│   Browser   │─────▶│ Nginx :8091  │─────▶│  FastAPI :8000     │
│  (React UI) │      │ (static+proxy)│      │  (backend)         │
└─────────────┘      └──────────────┘      └─────────┬──────────┘
                                                        │
                                    ┌───────────────────┼───────────────────┐
                                    ▼                   ▼                   ▼
                            ┌──────────────┐   ┌────────────────┐  ┌──────────────┐
                            │ PostgreSQL   │   │ eSSL MS SQL     │  │ SMTP server  │
                            │ (app data:   │   │ Server          │  │ (OTP emails) │
                            │ users,leave, │   │ 192.168.1.23    │  │              │
                            │ payroll,OTP) │   │ (punch logs)    │  │              │
                            └──────────────┘   └────────────────┘  └──────────────┘
```

---

## Next steps to complete the full system

1. **Attendance module UI** — calendar + daily punch log, pulling live from eSSL
2. **Leave module** — apply/approve/reject workflow with dept-head routing
3. **Shift management** — assign shifts, view team schedules
4. **Payroll module** — monthly payroll summary, payslip view
5. **Admin dashboard** — company-wide charts, department breakdowns
6. **Mobile app** — React Native, shares the same backend API

Let me know which to build next, or I can continue through the list in order.

---
*Built for East Coast Hospitals Ltd, Pondicherry*
