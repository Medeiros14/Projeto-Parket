"""Configurações do parket-rh-api."""
import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "https://hbxpilrxmitvzebluoom.supabase.co")
    SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "https://rh.parket.works,http://localhost:5173")

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
