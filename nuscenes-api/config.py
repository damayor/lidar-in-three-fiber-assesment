import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    NUSCENES_VERSION: str = os.getenv("NUSCENES_VERSION", "v1.0-mini")
    NUSCENES_DATAROOT: str = os.getenv("NUSCENES_DATAROOT", "./data/nuscenes")
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    class Config:
        env_file = ".env"

settings = Settings()
