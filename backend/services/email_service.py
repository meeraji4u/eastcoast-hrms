import smtplib, ssl, random, string
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from pydantic_settings import BaseSettings
import logging

logger = logging.getLogger(__name__)

class EmailSettings(BaseSettings):
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = "hrms@eastcoasthospitals.in"
    SMTP_PASSWORD: str = "your_app_password"
    SMTP_FROM_NAME: str = "EastCoast HRMS"

    class Config:
        env_file = ".env"
        extra = "ignore"

email_settings = EmailSettings()

def generate_otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))

def send_email(to_email: str, subject: str, html_body: str) -> bool:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{email_settings.SMTP_FROM_NAME} <{email_settings.SMTP_USER}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP(email_settings.SMTP_HOST, email_settings.SMTP_PORT) as server:
            server.starttls(context=context)
            server.login(email_settings.SMTP_USER, email_settings.SMTP_PASSWORD)
            server.sendmail(email_settings.SMTP_USER, to_email, msg.as_string())
        return True
    except Exception as e:
        logger.error(f"Email send failed to {to_email}: {e}")
        return False

def otp_email_template(name: str, otp: str, purpose: str) -> str:
    action_text = {
        "reset": "reset your password",
        "activate": "activate your account",
    }.get(purpose, "verify your identity")

    return f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;
                border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#0f4c81,#1a73e8);padding:24px;text-align:center">
        <h2 style="color:#fff;margin:0;font-size:18px">EastCoast HRMS</h2>
        <p style="color:#dbeafe;margin:4px 0 0;font-size:12px">East Coast Hospitals Ltd</p>
      </div>
      <div style="padding:28px 24px">
        <p style="font-size:14px;color:#1e293b">Hi {name},</p>
        <p style="font-size:14px;color:#475569;line-height:1.6">
          Use the OTP below to {action_text}. This code expires in <b>10 minutes</b>.
        </p>
        <div style="background:#f1f5f9;border-radius:8px;padding:18px;text-align:center;margin:20px 0">
          <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#0f4c81">{otp}</span>
        </div>
        <p style="font-size:12px;color:#94a3b8">
          If you did not request this, please ignore this email or contact HR/IT support.
        </p>
      </div>
      <div style="background:#f8fafc;padding:14px 24px;text-align:center">
        <p style="font-size:11px;color:#94a3b8;margin:0">
          &copy; {datetime.now().year} East Coast Hospitals Ltd, Pondicherry
        </p>
      </div>
    </div>
    """
