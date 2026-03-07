from pydantic_settings import BaseSettings, SettingsConfigDict
import os

class Settings(BaseSettings):
    """
    Manages application-wide settings, loading from environment variables or a .env file.
    This provides a single, consistent source of configuration for the entire app.
    """

    # --- Environment Control ---
    # Set to 'development' or 'production'
    # In a production environment, this should be set as a true environment variable.
    APP_ENV: str = "development"

    # --- Project Metadata ---
    PROJECT_NAME: str = "FieldOps BOQ AI Platform"

    # --- AI Provider API Keys ---
    # These are loaded from the environment. They MUST be set for the app to work.
    GEMINI_API_KEY: str
    ANTHROPIC_API_KEY: str
    OPENAI_API_KEY: str

    # --- Redis Cache Configuration ---
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379

    # --- PostgreSQL Database Configuration ---
    # Format: postgresql://[USER]:[PASSWORD]@[HOST]:[PORT]/[DATABASE_NAME]
    DATABASE_URL: str

    # --- Model Configuration for Pydantic ---
    model_config = SettingsConfigDict(
        # This tells Pydantic to look for a .env file for local development
        env_file_encoding='utf-8',
        # Allows the model to be used without calling .model_dump() on it
        extra='allow' 
    )

# Create a single, importable instance of the settings
settings = Settings()
