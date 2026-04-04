from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional
import os

class Settings(BaseSettings):
    """
    Manages application-wide settings, loading strictly from the project root .env file.
    No secrets or project-specific IDs are hardcoded in the source code.
    """

    # --- Environment Control ---
    APP_ENV: str = "development"
    PROJECT_NAME: str = "FieldOps BOQ AI Platform"

    # --- AI Provider API Keys (Optional defaults to prevent startup crashes) ---
    GEMINI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None

    # --- Vertex AI / Google Cloud Configuration ---
    # These MUST be provided in the .env file
    GOOGLE_CLOUD_PROJECT_ID: str
    GOOGLE_CLOUD_LOCATION: str
    GOOGLE_CREDENTIALS_JSON: str

    # --- Redis Cache Configuration ---
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379

    # --- PostgreSQL Database Configuration ---
    DATABASE_URL: str

    # --- Model Configuration ---
    model_config = SettingsConfigDict(
        # Locate the .env file in the PROJECT ROOT (three folders up from here)
        env_file=os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.env")),
        env_file_encoding='utf-8',
        extra='allow' 
    )

# Create the singleton settings instance
settings = Settings()
