from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://football:football@localhost:5432/football"
    cors_origins: str = "http://localhost:3000"
    models_dir: str = "../models"
    football_data_api_key: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
