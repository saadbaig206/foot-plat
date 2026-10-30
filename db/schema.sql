-- Football analytics & prediction platform: core schema (PostgreSQL 14+)
-- Every ingested row carries its source and a last_updated timestamp.

CREATE TABLE IF NOT EXISTS leagues (
  id            SERIAL PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,          -- e.g. E0, SP1, CL
  name          TEXT NOT NULL,
  country       TEXT,
  tier          SMALLINT,
  kind          TEXT NOT NULL DEFAULT 'domestic' CHECK (kind IN ('domestic','international','cup')),
  source        TEXT NOT NULL,
  last_updated  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seasons (
  id          SERIAL PRIMARY KEY,
  label       TEXT NOT NULL UNIQUE,            -- '2025/26'
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  CHECK (end_date > start_date)
);

CREATE TABLE IF NOT EXISTS teams (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  short_name    TEXT,
  country       TEXT,
  logo_url      TEXT,                           -- NULL = unavailable from source
  external_ids  JSONB NOT NULL DEFAULT '{}',
  source        TEXT NOT NULL,
  last_updated  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, country)
);

CREATE TABLE IF NOT EXISTS players (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE,
  nationality   TEXT,
  birth_date    DATE,
  position      TEXT,
  photo_url     TEXT,
  current_team_id INT REFERENCES teams(id),
  external_ids  JSONB NOT NULL DEFAULT '{}',
  source        TEXT NOT NULL,
  last_updated  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS matches (
  id            BIGSERIAL PRIMARY KEY,
  league_id     INT NOT NULL REFERENCES leagues(id),
  season_id     INT REFERENCES seasons(id),
  match_date    DATE NOT NULL,
  kickoff_utc   TIMESTAMPTZ,
  home_team_id  INT NOT NULL REFERENCES teams(id),
  away_team_id  INT NOT NULL REFERENCES teams(id),
  status        TEXT NOT NULL DEFAULT 'scheduled'
                CHECK (status IN ('scheduled','live','finished','postponed','cancelled')),
  home_goals    SMALLINT, away_goals SMALLINT,
  ht_home_goals SMALLINT, ht_away_goals SMALLINT,
  result        CHAR(1) CHECK (result IN ('H','D','A')),
  -- pre-match features as supplied by the source (used for serving & training)
  home_elo REAL, away_elo REAL,
  form3_home SMALLINT, form5_home SMALLINT, form3_away SMALLINT, form5_away SMALLINT,
  odd_home REAL, odd_draw REAL, odd_away REAL,
  source        TEXT NOT NULL,
  last_updated  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (home_team_id <> away_team_id),
  -- duplicate prevention
  UNIQUE (league_id, match_date, home_team_id, away_team_id)
);
CREATE INDEX IF NOT EXISTS matches_date_idx   ON matches (match_date);
CREATE INDEX IF NOT EXISTS matches_status_idx ON matches (status, match_date);
CREATE INDEX IF NOT EXISTS matches_home_idx   ON matches (home_team_id);
CREATE INDEX IF NOT EXISTS matches_away_idx   ON matches (away_team_id);

-- Per-match stats; any column NULL means "not provided by the source".
CREATE TABLE IF NOT EXISTS match_stats (
  match_id BIGINT PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
  home_shots SMALLINT, away_shots SMALLINT,
  home_shots_on_target SMALLINT, away_shots_on_target SMALLINT,
  home_corners SMALLINT, away_corners SMALLINT,
  home_fouls SMALLINT, away_fouls SMALLINT,
  home_yellow SMALLINT, away_yellow SMALLINT,
  home_red SMALLINT, away_red SMALLINT,
  home_possession REAL, away_possession REAL,
  home_xg REAL, away_xg REAL,                   -- ONLY genuine shot-quality xG
  xg_source TEXT,
  source TEXT NOT NULL,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS elo_ratings (
  team_id INT NOT NULL REFERENCES teams(id),
  as_of   DATE NOT NULL,
  elo     REAL NOT NULL,
  provisional BOOLEAN NOT NULL DEFAULT FALSE,   -- derived, not published by ClubElo
  source  TEXT NOT NULL,
  PRIMARY KEY (team_id, as_of)
);

CREATE TABLE IF NOT EXISTS league_standings (
  league_id INT NOT NULL REFERENCES leagues(id),
  season_id INT NOT NULL REFERENCES seasons(id),
  team_id   INT NOT NULL REFERENCES teams(id),
  position SMALLINT, played SMALLINT, won SMALLINT, drawn SMALLINT, lost SMALLINT,
  goals_for SMALLINT, goals_against SMALLINT, points SMALLINT,
  form TEXT,
  source TEXT NOT NULL,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (league_id, season_id, team_id)
);

CREATE TABLE IF NOT EXISTS player_stats (
  player_id INT NOT NULL REFERENCES players(id),
  league_id INT NOT NULL REFERENCES leagues(id),
  season_id INT NOT NULL REFERENCES seasons(id),
  team_id   INT REFERENCES teams(id),
  appearances SMALLINT, minutes INT, goals SMALLINT, assists SMALLINT,
  source TEXT NOT NULL,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, league_id, season_id)
);

CREATE TABLE IF NOT EXISTS team_performance (
  team_id INT NOT NULL REFERENCES teams(id),
  league_id INT NOT NULL REFERENCES leagues(id),
  season_id INT NOT NULL REFERENCES seasons(id),
  home_played SMALLINT, home_won SMALLINT, home_drawn SMALLINT, home_lost SMALLINT,
  home_gf SMALLINT, home_ga SMALLINT,
  away_played SMALLINT, away_won SMALLINT, away_drawn SMALLINT, away_lost SMALLINT,
  away_gf SMALLINT, away_ga SMALLINT,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, league_id, season_id)
);

CREATE TABLE IF NOT EXISTS model_versions (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,                  -- 'favourite_avoids_defeat', 'outcome_1x2', 'goals_home'
  version      TEXT NOT NULL,
  artifact_path TEXT NOT NULL,
  trained_at   TIMESTAMPTZ NOT NULL,
  train_range  DATERANGE,
  test_range   DATERANGE,
  metrics      JSONB NOT NULL DEFAULT '{}',
  feature_list JSONB NOT NULL DEFAULT '[]',
  is_active    BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (name, version)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_model ON model_versions (name) WHERE is_active;

CREATE TABLE IF NOT EXISTS predictions (
  id          BIGSERIAL PRIMARY KEY,
  match_id    BIGINT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  model_version_id INT NOT NULL REFERENCES model_versions(id),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  p_home REAL, p_draw REAL, p_away REAL,        -- 3-class model only
  p_fav_avoids_defeat REAL, favourite_side CHAR(1) CHECK (favourite_side IN ('H','A')),
  exp_home_goals REAL, exp_away_goals REAL,     -- model-predicted goals, NOT xG
  predicted_score TEXT,
  confidence REAL,
  features_used JSONB NOT NULL DEFAULT '{}',    -- exact inputs, for traceability
  UNIQUE (match_id, model_version_id)
);

CREATE TABLE IF NOT EXISTS ingestion_runs (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL, started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ, status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running','ok','failed')),
  rows_read INT DEFAULT 0, rows_written INT DEFAULT 0, error TEXT
);
