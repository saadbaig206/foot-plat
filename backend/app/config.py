from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Support running from either repo root or backend/ directory
_ROOT_DIR = Path(__file__).resolve().parent.parent.parent
_BACKEND_DIR = Path(__file__).resolve().parent.parent

_ENV_FILES = (
    str(_ROOT_DIR / ".env"),
    str(_BACKEND_DIR / ".env"),
    ".env",
    "../.env",
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_ENV_FILES, extra="ignore")

    database_url: str = "postgresql://football:football@localhost:5432/football"
    cors_origins: str = "http://localhost:3000"
    models_dir: str = "../models"
    football_data_api_key: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
