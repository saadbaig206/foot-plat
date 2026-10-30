"""Database schema. One table per spec entity; fixtures and historical results both live in
`matches` (status = scheduled | live | finished) so they cannot drift apart.
Every table carries `source` and `updated_at` so data updates are traceable."""
from datetime import datetime, timezone
from sqlalchemy import (String, Integer, Float, DateTime, Date, ForeignKey, UniqueConstraint, JSON, Boolean, Index)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base


def now():
    return datetime.now(timezone.utc)


class Stamped:
    source: Mapped[str] = mapped_column(String(64), default="unknown")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)


class League(Stamped, Base):
    __tablename__ = "leagues"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(16), unique=True)  # e.g. E0, SP1
    name: Mapped[str] = mapped_column(String(100))
    country: Mapped[str | None] = mapped_column(String(64), nullable=True)
    tier: Mapped[int | None] = mapped_column(Integer, nullable=True)


class Season(Stamped, Base):
    __tablename__ = "seasons"
    id: Mapped[int] = mapped_column(primary_key=True)
    label: Mapped[str] = mapped_column(String(9), unique=True)  # 2025/26
    start_date: Mapped[datetime] = mapped_column(Date)
    end_date: Mapped[datetime] = mapped_column(Date)


class Team(Stamped, Base):
    __tablename__ = "teams"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    country: Mapped[str | None] = mapped_column(String(64), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(300), nullable=True)  # None = unavailable


class Player(Stamped, Base):
    __tablename__ = "players"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    team_id: Mapped[int | None] = mapped_column(ForeignKey("teams.id"), nullable=True)
    nationality: Mapped[str | None] = mapped_column(String(64), nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String(300), nullable=True)


class Match(Stamped, Base):
    __tablename__ = "matches"
    __table_args__ = (UniqueConstraint("league_id", "match_date", "home_team_id", "away_team_id", name="uq_match"),
                      Index("ix_match_date", "match_date"))
    id: Mapped[int] = mapped_column(primary_key=True)
    league_id: Mapped[int] = mapped_column(ForeignKey("leagues.id"))
    season_id: Mapped[int | None] = mapped_column(ForeignKey("seasons.id"), nullable=True)
    match_date: Mapped[datetime] = mapped_column(Date)
    kickoff_time: Mapped[str | None] = mapped_column(String(8), nullable=True)
    home_team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"))
    away_team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"))
    status: Mapped[str] = mapped_column(String(12), default="finished")
    home_goals: Mapped[int | None] = mapped_column(Integer, nullable=True)
    away_goals: Mapped[int | None] = mapped_column(Integer, nullable=True)
    result: Mapped[str | None] = mapped_column(String(1), nullable=True)  # H/D/A
    # Pre-match model inputs, captured as known before kickoff
    home_elo: Mapped[float | None] = mapped_column(Float, nullable=True)
    away_elo: Mapped[float | None] = mapped_column(Float, nullable=True)
    form3_home: Mapped[float | None] = mapped_column(Float, nullable=True)
    form5_home: Mapped[float | None] = mapped_column(Float, nullable=True)
    form3_away: Mapped[float | None] = mapped_column(Float, nullable=True)
    form5_away: Mapped[float | None] = mapped_column(Float, nullable=True)
    odd_home: Mapped[float | None] = mapped_column(Float, nullable=True)
    odd_draw: Mapped[float | None] = mapped_column(Float, nullable=True)
    odd_away: Mapped[float | None] = mapped_column(Float, nullable=True)
    home_team = relationship("Team", foreign_keys=[home_team_id])
    away_team = relationship("Team", foreign_keys=[away_team_id])
    league = relationship("League")


class MatchStat(Stamped, Base):
    __tablename__ = "match_stats"
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id"), primary_key=True)
    home_shots: Mapped[int | None] = mapped_column(Integer, nullable=True)
    away_shots: Mapped[int | None] = mapped_column(Integer, nullable=True)
    home_target: Mapped[int | None] = mapped_column(Integer, nullable=True)
    away_target: Mapped[int | None] = mapped_column(Integer, nullable=True)
    home_corners: Mapped[int | None] = mapped_column(Integer, nullable=True)
    away_corners: Mapped[int | None] = mapped_column(Integer, nullable=True)
    home_fouls: Mapped[int | None] = mapped_column(Integer, nullable=True)
    away_fouls: Mapped[int | None] = mapped_column(Integer, nullable=True)
    home_yellow: Mapped[int | None] = mapped_column(Integer, nullable=True)
    away_yellow: Mapped[int | None] = mapped_column(Integer, nullable=True)
    home_red: Mapped[int | None] = mapped_column(Integer, nullable=True)
    away_red: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # No possession or xG columns: the current data source does not provide them.


class Standing(Stamped, Base):
    __tablename__ = "standings"
    __table_args__ = (UniqueConstraint("league_id", "season_id", "team_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    league_id: Mapped[int] = mapped_column(ForeignKey("leagues.id"))
    season_id: Mapped[int] = mapped_column(ForeignKey("seasons.id"))
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"))
    position: Mapped[int] = mapped_column(Integer)
    played: Mapped[int] = mapped_column(Integer)
    won: Mapped[int] = mapped_column(Integer)
    drawn: Mapped[int] = mapped_column(Integer)
    lost: Mapped[int] = mapped_column(Integer)
    goals_for: Mapped[int] = mapped_column(Integer)
    goals_against: Mapped[int] = mapped_column(Integer)
    points: Mapped[int] = mapped_column(Integer)
    form: Mapped[str | None] = mapped_column(String(10), nullable=True)


class PlayerStat(Stamped, Base):
    __tablename__ = "player_stats"
    __table_args__ = (UniqueConstraint("player_id", "league_id", "season_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("players.id"))
    league_id: Mapped[int] = mapped_column(ForeignKey("leagues.id"))
    season_id: Mapped[int] = mapped_column(ForeignKey("seasons.id"))
    appearances: Mapped[int] = mapped_column(Integer, default=0)
    goals: Mapped[int] = mapped_column(Integer, default=0)
    assists: Mapped[int] = mapped_column(Integer, default=0)
    minutes: Mapped[int] = mapped_column(Integer, default=0)


class TeamPerformance(Stamped, Base):
    """Per team, per match rolling aggregates derived from `matches` (home/away splits, attack, defence)."""
    __tablename__ = "team_performance"
    __table_args__ = (UniqueConstraint("team_id", "match_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id"))
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id"))
    is_home: Mapped[bool] = mapped_column(Boolean)
    goals_for: Mapped[int] = mapped_column(Integer)
    goals_against: Mapped[int] = mapped_column(Integer)
    points: Mapped[int] = mapped_column(Integer)


class ModelVersion(Base):
    __tablename__ = "model_versions"
    id: Mapped[int] = mapped_column(primary_key=True)
    version: Mapped[str] = mapped_column(String(32), unique=True)
    trained_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    train_range: Mapped[str] = mapped_column(String(64))
    test_range: Mapped[str] = mapped_column(String(64))
    metrics: Mapped[dict] = mapped_column(JSON)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)


class Prediction(Base):
    __tablename__ = "predictions"
    __table_args__ = (UniqueConstraint("match_id", "model_version_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id"))
    model_version_id: Mapped[int] = mapped_column(ForeignKey("model_versions.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    payload: Mapped[dict] = mapped_column(JSON)


class DataUpdate(Base):
    """Log of ingestion runs backing GET /api/data/last-updated."""
    __tablename__ = "data_updates"
    id: Mapped[int] = mapped_column(primary_key=True)
    source: Mapped[str] = mapped_column(String(64))
    finished_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    rows: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(16), default="ok")
    detail: Mapped[str | None] = mapped_column(String(300), nullable=True)
