"""Database Schema Initializer.
Applies db/schema.sql to the database configured in DATABASE_URL (e.g. Neon DB or PostgreSQL),
and seeds core leagues and seasons.
Usage: python -m scripts.init_db
"""
from pathlib import Path
import sys
from app.config import get_settings
from app.db import conn, query_one, execute, executemany

LEAGUES = {
    "E0": ("Premier League", "England", 1), "E1": ("Championship", "England", 2),
    "E2": ("League One", "England", 3), "E3": ("League Two", "England", 4), "EC": ("National League", "England", 5),
    "SP1": ("La Liga", "Spain", 1), "SP2": ("La Liga 2", "Spain", 2),
    "D1": ("Bundesliga", "Germany", 1), "D2": ("2. Bundesliga", "Germany", 2),
    "I1": ("Serie A", "Italy", 1), "I2": ("Serie B", "Italy", 2),
    "F1": ("Ligue 1", "France", 1), "F2": ("Ligue 2", "France", 2),
    "N1": ("Eredivisie", "Netherlands", 1), "B1": ("Pro League", "Belgium", 1),
    "P1": ("Primeira Liga", "Portugal", 1), "T1": ("Super Lig", "Turkey", 1), "G1": ("Super League", "Greece", 1),
    "SC0": ("Scottish Premiership", "Scotland", 1), "SC1": ("Scottish Championship", "Scotland", 2),
    "SC2": ("Scottish League One", "Scotland", 3), "SC3": ("Scottish League Two", "Scotland", 4),
}

SEASONS = [
    ("2023/24", "2023-07-01", "2024-06-30"),
    ("2024/25", "2024-07-01", "2025-06-30"),
    ("2025/26", "2025-07-01", "2026-06-30"),
    ("2026/27", "2026-07-01", "2027-06-30"),
]


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
            cur.execute(sql)
            print("Successfully executed db/schema.sql!")
        except Exception as e:
            print(f"Error executing schema: {e}")
            sys.exit(1)
        finally:
            cur.close()

    # Seed core leagues
    print("Seeding core leagues and seasons...")
    for code, (name, country, tier) in LEAGUES.items():
        execute("""
            INSERT INTO leagues (code, name, country, tier, source, last_updated)
            VALUES (%s, %s, %s, %s, 'seed', now())
            ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, country = coalesce(EXCLUDED.country, leagues.country)
        """, (code, name, country, tier))

    for label, s_date, e_date in SEASONS:
        execute("""
            INSERT INTO seasons (label, start_date, end_date)
            VALUES (%s, %s, %s)
            ON CONFLICT (label) DO NOTHING
        """, (label, s_date, e_date))

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
        rows = cur.fetchall()
        tables = [
            r["table_name"] if hasattr(r, "keys") or isinstance(r, dict) else r[0]
            for r in rows
        ]
        cur.close()

    l_count = query_one("SELECT count(*) as count FROM leagues")["count"]
    print(f"Database ready! Tables: {len(tables)}, Registered Leagues: {l_count}")


if __name__ == "__main__":
    main()
