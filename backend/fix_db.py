from core.database import PgSession, Base, pg_engine
from sqlalchemy import text
from models.models import Payroll, AppSetting, User

def run():
    print("Fixing database schema...")
    db = PgSession()
    try:
        # Drop the payrolls table so it can be cleanly recreated
        db.execute(text("DROP TABLE IF EXISTS payrolls CASCADE;"))
        db.execute(text("DROP TABLE IF EXISTS app_settings CASCADE;"))
        db.commit()
        print("Dropped old payrolls table.")
    except Exception as e:
        print(f"Error dropping table: {e}")
        db.rollback()

    try:
        db.execute(text("ALTER TABLE shifts ADD COLUMN is_flexible BOOLEAN DEFAULT FALSE;"))
        db.commit()
        print("Added is_flexible column to shifts.")
    except Exception as e:
        # Might already exist
        db.rollback()
    
    # Recreate all tables (this will create payrolls with the new schema, and app_settings)
    Base.metadata.create_all(bind=pg_engine)
    print("Created missing tables.")
    db.close()

if __name__ == "__main__":
    run()
