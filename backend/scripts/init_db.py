"""Database Schema Initializer.
Applies db/schema.sql to the database configured in DATABASE_URL (e.g. Neon DB or PostgreSQL).
Usage: python -m scripts.init_db
"""
from pathlib import Path
import sys
from app.config import get_settings
from app.db import conn, query_one, _backend


def main():
    schema_path = Path(__file__).resolve().parent.parent.parent / "db" / "schema.sql"
    if not schema_path.exists():
        schema_path = Path("db/schema.sql")
    if not schema_path.exists():
        print(f"Error: schema file not found at {schema_path}")
        sys.exit(1)

    sql = schema_path.read_text(encoding="utf-8")
    settings = get_settings()

    target_type = "Neon/PostgreSQL" if "postgres" in settings.database_url else "SQLite"
    print(f"Connecting to database: {target_type}...")

    with conn() as c:
        cur = c.cursor()
        try:
            # PostgreSQL / Neon executes script via execute()
            cur.execute(sql)
            print("Successfully executed db/schema.sql!")
        except Exception as e:
            print(f"Error executing schema: {e}")
            sys.exit(1)
        finally:
            cur.close()

    # Verify tables
    print("Verifying tables...")
    with conn() as c:
        cur = c.cursor()
        cur.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name;
        """)
        tables = [r[0] for r in cur.fetchall()]
        cur.close()

    print(f"Database initialized successfully with {len(tables)} tables:")
    for t in tables:
        print(f"  - {t}")


if __name__ == "__main__":
    main()
