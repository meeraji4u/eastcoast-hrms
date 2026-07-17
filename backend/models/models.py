from sqlalchemy import Column, Integer, String, DateTime, Date, Boolean, Text, Float, ForeignKey, Enum, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base
import enum

class RoleEnum(str, enum.Enum):
    it_admin = "it_admin"
    employee = "employee"
    dept_head = "dept_head"
    hr_admin = "hr_admin"
    management = "management"

class LeaveStatusEnum(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    cancelled = "cancelled"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    emp_code = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(120), unique=True)
    phone = Column(String(20))
    password_hash = Column(String(200), nullable=False)
    role = Column(Enum(RoleEnum), default=RoleEnum.employee)
    dept_id = Column(Integer, ForeignKey("departments.id"))
    company_id = Column(Integer, ForeignKey("companies.id"))
    designation = Column(String(100))
    date_of_join = Column(Date)
    is_active = Column(Boolean, default=True)
    fcm_token = Column(String(300))  # push notifications
    is_activated = Column(Boolean, default=False)
    must_change_password = Column(Boolean, default=True)
    basic_salary = Column(Float, default=0.0)
    hra = Column(Float, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    department = relationship("Department", back_populates="users", foreign_keys=[dept_id])
    company = relationship("Company", back_populates="users")
    leaves = relationship("Leave", back_populates="employee", foreign_keys="Leave.emp_id")


class Company(Base):
    __tablename__ = "companies"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)
    code = Column(String(20), unique=True)
    users = relationship("User", back_populates="company")

class Department(Base):
    __tablename__ = "departments"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)
    head_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    users = relationship("User", back_populates="department", foreign_keys="User.dept_id")

class Shift(Base):
    __tablename__ = "shifts"
    id = Column(Integer, primary_key=True)
    name = Column(String(50), nullable=False)
    code = Column(String(10), unique=True)
    start_time = Column(String(5))   # HH:MM
    end_time = Column(String(5))
    grace_late = Column(Integer, default=15)   # minutes
    grace_early = Column(Integer, default=15)
    is_night = Column(Boolean, default=False)
    working_hours = Column(Float, default=8.0)
    is_flexible = Column(Boolean, default=False)

class ShiftAssignment(Base):
    __tablename__ = "shift_assignments"
    id = Column(Integer, primary_key=True)
    emp_id = Column(Integer, ForeignKey("users.id"))
    shift_id = Column(Integer, ForeignKey("shifts.id"))
    from_date = Column(Date, nullable=False)
    to_date = Column(Date)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class LeaveType(Base):
    __tablename__ = "leave_types"
    id = Column(Integer, primary_key=True)
    name = Column(String(50), nullable=False)
    code = Column(String(10), unique=True)
    max_days_per_year = Column(Integer, default=12)
    carry_forward = Column(Boolean, default=False)
    is_paid = Column(Boolean, default=True)

class Leave(Base):
    __tablename__ = "leaves"
    id = Column(Integer, primary_key=True)
    emp_id = Column(Integer, ForeignKey("users.id"))
    leave_type_id = Column(Integer, ForeignKey("leave_types.id"))
    from_date = Column(Date, nullable=False)
    to_date = Column(Date, nullable=False)
    days = Column(Float, nullable=False)
    reason = Column(Text)
    status = Column(Enum(LeaveStatusEnum), default=LeaveStatusEnum.pending)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    employee = relationship("User", back_populates="leaves", foreign_keys=[emp_id])
    approver = relationship("User", foreign_keys=[approved_by])
    leave_type = relationship("LeaveType")

class Payroll(Base):
    __tablename__ = "payrolls"
    __table_args__ = (UniqueConstraint('emp_code','month','year',name='uq_payroll_emp_month'),
                      {'extend_existing': True})
    id = Column(Integer, primary_key=True)
    emp_code = Column(String(20), index=True, nullable=False)
    emp_name = Column(String(100))
    dept = Column(String(100))
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    present_days = Column(Integer, default=0)
    absent_days = Column(Integer, default=0)
    leave_days = Column(Integer, default=0)
    work_hours = Column(Float, default=0)
    ot_hours = Column(Float, default=0)
    basic_salary = Column(Float, default=0)   # monthly CTC / gross base
    per_day = Column(Float, default=0)
    # Earnings breakdown
    earned_basic = Column(Float, default=0)   # Basic earned based on present days
    hra_amount = Column(Float, default=0)
    da_amount = Column(Float, default=0)
    ot_amount = Column(Float, default=0)
    gross = Column(Float, default=0)          # earned_basic + hra_amount + da_amount + ot_amount
    # Deductions breakdown
    pf = Column(Float, default=0)
    esic = Column(Float, default=0)
    advance = Column(Float, default=0)
    other_deductions = Column(Float, default=0)
    deductions = Column(Float, default=0)     # total deductions
    net_pay = Column(Float, default=0)
    status = Column(String(20), default="draft")  # draft, finalized
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    # Legacy aliases kept for compatibility
    earned = Column(Float, default=0)         # same as earned_basic

class PayrollFormula(Base):
    __tablename__ = "payroll_formulas"
    id = Column(Integer, primary_key=True)
    # Earnings percentages (% of CTC)
    basic_pct = Column(Float, default=60.0)   # Basic = 60% of CTC
    hra_pct   = Column(Float, default=20.0)   # HRA   = 20% of CTC
    da_pct    = Column(Float, default=20.0)   # DA    = 20% of CTC
    # Deductions percentages (% of Basic earned)
    pf_pct    = Column(Float, default=12.0)   # PF    = 12% of Basic earned
    esic_pct  = Column(Float, default=0.75)   # ESIC  = 0.75% of Basic earned
    # OT rate: per hour = (per_day / ot_divisor)
    ot_hours_divisor = Column(Float, default=8.0)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class AppSetting(Base):
    __tablename__ = "app_settings"
    id = Column(Integer, primary_key=True)
    month_start_day = Column(Integer, default=1)


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String(100))
    message = Column(Text)
    type = Column(String(30))  # leave, attendance, payroll, system
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class OTPPurposeEnum(str, enum.Enum):
    reset = "reset"
    activate = "activate"

class OTP(Base):
    __tablename__ = "otps"
    id = Column(Integer, primary_key=True)
    emp_code = Column(String(20), nullable=False, index=True)
    email = Column(String(120), nullable=False)
    otp_code = Column(String(10), nullable=False)
    purpose = Column(Enum(OTPPurposeEnum), nullable=False)
    is_used = Column(Boolean, default=False)
    attempts = Column(Integer, default=0)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class SalaryRevisionRequest(Base):
    __tablename__ = "salary_revision_requests"
    id = Column(Integer, primary_key=True)
    emp_code = Column(String(20), index=True, nullable=False)
    basic_salary = Column(Float, nullable=False)
    hra = Column(Float, nullable=False, default=0.0)
    status = Column(String(20), default="PENDING")  # PENDING, APPROVED, REJECTED
    requested_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
