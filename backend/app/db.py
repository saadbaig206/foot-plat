"""Database connection manager with dual PostgreSQL (psycopg3 / psycopg2) and SQLite fallback.
Exposes query(), query_one(), execute(), executemany(), conn(), get_pool(), close_pool().
"""
from contextlib import contextmanager
import logging
from pathlib import Path
import re
from typing import Any
from .config import get_settings

logger = logging.getLogger(__name__)

try:
    from sqlalchemy.orm import DeclarativeBase
    class Base(DeclarativeBase):
        pass
except ImportError:
    Base = None

_pool = None
_backend = None  # 'psycopg', 'psycopg2', or 'sqlite3'
_last_url = None

SQLITE_SCHEMA = """
CREATE TABLE IF NOT EXISTS leagues (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  country       TEXT,
  tier          INTEGER,
  kind          TEXT NOT NULL DEFAULT 'domestic',
  source        TEXT NOT NULL,
  last_updated  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seasons (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  label       TEXT NOT NULL UNIQUE,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS teams (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  short_name    TEXT,
  country       TEXT,
  logo_url      TEXT,
  external_ids  TEXT NOT NULL DEFAULT '{}',
  source        TEXT NOT NULL,
  last_updated  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (name, country)
);

CREATE TABLE IF NOT EXISTS players (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  nationality   TEXT,
  birth_date    DATE,
  position      TEXT,
  photo_url     TEXT,
  current_team_id INTEGER REFERENCES teams(id),
  external_ids  TEXT NOT NULL DEFAULT '{}',
  source        TEXT NOT NULL,
  last_updated  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS matches (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  league_id     INTEGER NOT NULL REFERENCES leagues(id),
  season_id     INTEGER REFERENCES seasons(id),
  match_date    DATE NOT NULL,
  kickoff_utc   DATETIME,
  home_team_id  INTEGER NOT NULL REFERENCES teams(id),
  away_team_id  INTEGER NOT NULL REFERENCES teams(id),
  status        TEXT NOT NULL DEFAULT 'scheduled',
  home_goals    INTEGER,
  away_goals    INTEGER,
  ht_home_goals INTEGER,
  ht_away_goals INTEGER,
  result        TEXT,
  home_elo REAL, away_elo REAL,
  form3_home INTEGER, form5_home INTEGER, form3_away INTEGER, form5_away INTEGER,
  odd_home REAL, odd_draw REAL, odd_away REAL,
  source        TEXT NOT NULL,
  last_updated  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (league_id, match_date, home_team_id, away_team_id)
);

CREATE TABLE IF NOT EXISTS match_stats (
  match_id INTEGER PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
  home_shots INTEGER, away_shots INTEGER,
  home_shots_on_target INTEGER, away_shots_on_target INTEGER,
  home_corners INTEGER, away_corners INTEGER,
  home_fouls INTEGER, away_fouls INTEGER,
  home_yellow INTEGER, away_yellow INTEGER,
  home_red INTEGER, away_red INTEGER,
  home_possession REAL, away_possession REAL,
  home_xg REAL, away_xg REAL,
  xg_source TEXT,
  source TEXT NOT NULL,
  last_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS elo_ratings (
  team_id INTEGER NOT NULL REFERENCES teams(id),
  as_of   DATE NOT NULL,
  elo     REAL NOT NULL,
  provisional BOOLEAN NOT NULL DEFAULT 0,
  source  TEXT NOT NULL,
  PRIMARY KEY (team_id, as_of)
);

CREATE TABLE IF NOT EXISTS league_standings (
  league_id INTEGER NOT NULL REFERENCES leagues(id),
  season_id INTEGER NOT NULL REFERENCES seasons(id),
  team_id   INTEGER NOT NULL REFERENCES teams(id),
  position INTEGER, played INTEGER, won INTEGER, drawn INTEGER, lost INTEGER,
  goals_for INTEGER, goals_against INTEGER, points INTEGER,
  form TEXT,
  source TEXT NOT NULL,
  last_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (league_id, season_id, team_id)
);

CREATE TABLE IF NOT EXISTS player_stats (
  player_id INTEGER NOT NULL REFERENCES players(id),
  league_id INTEGER NOT NULL REFERENCES leagues(id),
  season_id INTEGER NOT NULL REFERENCES seasons(id),
  team_id   INTEGER REFERENCES teams(id),
  appearances INTEGER, minutes INTEGER, goals INTEGER, assists INTEGER,
  source TEXT NOT NULL,
  last_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (player_id, league_id, season_id)
);

CREATE TABLE IF NOT EXISTS team_performance (
  team_id INTEGER NOT NULL REFERENCES teams(id),
  league_id INTEGER NOT NULL REFERENCES leagues(id),
  season_id INTEGER NOT NULL REFERENCES seasons(id),
  home_played INTEGER, home_won INTEGER, home_drawn INTEGER, home_lost INTEGER,
  home_gf INTEGER, home_ga INTEGER,
  away_played INTEGER, away_won INTEGER, away_drawn INTEGER, away_lost INTEGER,
  away_gf INTEGER, away_ga INTEGER,
  last_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (team_id, league_id, season_id)
);

CREATE TABLE IF NOT EXISTS model_versions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  version      TEXT NOT NULL,
  artifact_path TEXT NOT NULL,
  trained_at   DATETIME NOT NULL,
  train_range  TEXT,
  test_range   TEXT,
  metrics      TEXT NOT NULL DEFAULT '{}',
  feature_list TEXT NOT NULL DEFAULT '[]',
  is_active    BOOLEAN NOT NULL DEFAULT 0,
  UNIQUE (name, version)
);

CREATE TABLE IF NOT EXISTS predictions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id    INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  model_version_id INTEGER NOT NULL REFERENCES model_versions(id),
  generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  p_home REAL, p_draw REAL, p_away REAL,
  p_fav_avoids_defeat REAL, favourite_side TEXT,
  exp_home_goals REAL, exp_away_goals REAL,
  predicted_score TEXT,
  confidence REAL,
  features_used TEXT NOT NULL DEFAULT '{}',
  UNIQUE (match_id, model_version_id)
);

CREATE TABLE IF NOT EXISTS ingestion_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL, started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME, status TEXT NOT NULL DEFAULT 'running',
  rows_read INTEGER DEFAULT 0, rows_written INTEGER DEFAULT 0, error TEXT
);
"""


def _ensure_sqlite_schema(db_path: str):
    import sqlite3
    conn = sqlite3.connect(db_path)
    conn.executescript(SQLITE_SCHEMA)
    conn.commit()
    conn.close()


def _init_pool():
    global _pool, _backend
    url = get_settings().database_url

    if url.startswith("sqlite"):
        db_path = url.replace("sqlite:///", "").replace("sqlite://", "")
        if not db_path:
            db_path = "dev.db"
        _backend = "sqlite3"
        _pool = db_path
        _ensure_sqlite_schema(db_path)
        return

    # Try psycopg (psycopg 3)
    try:
        from psycopg.rows import dict_row
        from psycopg_pool import ConnectionPool
        _pool = ConnectionPool(url, min_size=1, max_size=5, kwargs={"row_factory": dict_row}, open=True)
        _backend = "psycopg"
        return
    except ImportError:
        pass
    except Exception as e:
        logger.warning(f"Could not initialize psycopg3 pool: {e}")

    # Fall back to psycopg2
    try:
        import psycopg2
        import psycopg2.pool
        from psycopg2.extras import RealDictCursor
        dsn = url
        if "connect_timeout" not in dsn and "?" not in dsn:
            dsn += "?connect_timeout=3"
        elif "connect_timeout" not in dsn and "?" in dsn:
            dsn += "&connect_timeout=3"
        _pool = psycopg2.pool.ThreadedConnectionPool(1, 5, dsn=dsn, cursor_factory=RealDictCursor)
        # Test connection immediately
        test_conn = _pool.getconn()
        _pool.putconn(test_conn)
        _backend = "psycopg2"
        return
    except Exception as e:
        logger.warning(f"PostgreSQL connection unavailable ({e}); falling back to SQLite dev.db.")
        _pool = None

    # Fallback to sqlite if postgres is not reachable
    _backend = "sqlite3"
    db_path = "dev.db"
    _pool = db_path
    _ensure_sqlite_schema(db_path)


def get_pool():
    global _pool, _last_url
    current_url = get_settings().database_url
    if _pool is None or _last_url != current_url:
        close_pool()
        _last_url = current_url
        _init_pool()
    return _pool


def close_pool() -> None:
    global _pool, _backend, _last_url
    if _pool is not None:
        if _backend == "psycopg" and hasattr(_pool, "close"):
            _pool.close()
        elif _backend == "psycopg2" and hasattr(_pool, "closeall"):
            _pool.closeall()
        _pool = None
        _backend = None
        _last_url = None


@contextmanager
def conn():
    pool = get_pool()
    global _backend
    if _backend == "psycopg":
        with pool.connection() as c:
            yield c
    elif _backend == "psycopg2":
        try:
            c = pool.getconn()
            if getattr(c, "closed", 0) != 0:
                pool.putconn(c, close=True)
                c = pool.getconn()
        except Exception:
            _init_pool()
            c = _pool.getconn()
        try:
            yield c
            c.commit()
        except Exception:
            c.rollback()
            raise
        finally:
            if not getattr(c, "closed", 0):
                pool.putconn(c)
    elif _backend == "sqlite3":
        import sqlite3
        c = sqlite3.connect(pool)
        c.row_factory = sqlite3.Row
        try:
            yield c
            c.commit()
        except Exception:
            c.rollback()
            raise
        finally:
            c.close()


def _normalize_sql(sql: str, params: Any) -> tuple[str, Any]:
    global _backend
    if _backend is None:
        get_pool()
    if _backend != "sqlite3":
        return sql, params

    # Strip Postgres type casts like ::text, ::jsonb, ::date, ::numeric, ::int
    sql = re.sub(r'::[a-zA-Z0-9_]+', '', sql)
    # Replace now() with CURRENT_TIMESTAMP
    sql = re.sub(r'\bnow\(\)', 'CURRENT_TIMESTAMP', sql)
    # Replace ILIKE with LIKE
    sql = re.sub(r'\bILIKE\b', 'LIKE', sql)
    # Convert %(name)s to :name for sqlite
    if isinstance(params, dict):
        sql = re.sub(r'%\((\w+)\)s', r':\1', sql)
    elif isinstance(params, (tuple, list)):
        sql = sql.replace("%s", "?")

    return sql, params


def query(sql: str, params: tuple | dict | list = ()) -> list[dict]:
    sql, params = _normalize_sql(sql, params)
    with conn() as c:
        cur = c.cursor()
        try:
            cur.execute(sql, params)
            rows = cur.fetchall()
            if not rows:
                return []
            if hasattr(rows[0], "keys"):
                return [dict(r) for r in rows]
            return [dict(r) for r in rows]
        finally:
            cur.close()


def query_one(sql: str, params: tuple | dict | list = ()) -> dict | None:
    sql, params = _normalize_sql(sql, params)
    with conn() as c:
        cur = c.cursor()
        try:
            cur.execute(sql, params)
            row = cur.fetchone()
            if row is None:
                return None
            return dict(row)
        finally:
            cur.close()


def execute(sql: str, params: tuple | dict | list = ()) -> Any:
    sql, params = _normalize_sql(sql, params)
    with conn() as c:
        cur = c.cursor()
        try:
            cur.execute(sql, params)
            if hasattr(cur, "rowcount"):
                return cur.rowcount
            return None
        finally:
            cur.close()


def executemany(sql: str, params_seq: list) -> Any:
    if not params_seq:
        return 0
    sample_params = params_seq[0] if params_seq else ()
    sql, _ = _normalize_sql(sql, sample_params)
    with conn() as c:
        cur = c.cursor()
        try:
            cur.executemany(sql, params_seq)
            if hasattr(cur, "rowcount"):
                return cur.rowcount
            return None
        finally:
            cur.close()
