import os
from dotenv import load_dotenv

# --- Explicitly load .env file from the project root ---
# This is the most reliable way to ensure settings are loaded, regardless of where the app is started from.
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
dotenv_path = os.path.join(project_root, ".env")

if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)
else:
    # In a production environment, we would expect real environment variables
    # and might want to log a warning or raise an error if the .env is missing.
    print(f"Warning: .env file not found at {dotenv_path}. Relying on environment variables.")

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import redis.asyncio as redis
import logging

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from .core.config import settings
from .limiter import limiter  # Import from the new central file
from .routes import projects, activities, ai_parser

# --- Configure Logging ---
# In a production setting, you would likely use a more robust logging configuration
# that writes to files or a centralized logging service.
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# --- Startup and Shutdown Events ---
# Using lifespan events is the recommended modern way to handle startup/shutdown logic
async def lifespan(app: FastAPI):
    # --- Connect to Redis on startup ---
    logger.info("Connecting to Redis...")
    try:
        # Use an async redis client
        app.state.redis = redis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=0, decode_responses=True)
        await app.state.redis.ping() # Check connection
        logger.info("Successfully connected to Redis.")
    except Exception as e:
        logger.error(f"Could not connect to Redis: {e}")
        logger.warning("Caching will be disabled.")
        app.state.redis = None
    yield
    # --- Disconnect from Redis on shutdown ---
    if app.state.redis:
        logger.info("Closing Redis connection...")
        await app.state.redis.close()
        logger.info("Redis connection closed.")

# --- Initialize FastAPI App ---
# In a production environment, you might want to disable the interactive docs
app_configs = {"title": settings.PROJECT_NAME, "lifespan": lifespan}
if settings.APP_ENV == "production":
    app_configs["docs_url"] = None
    app_configs["redoc_url"] = None

app = FastAPI(**app_configs)

# Add the rate limiter to the app state and exception handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# --- Include Routers ---
# This can now be done safely as the circular import is resolved
app.include_router(projects.router, prefix="/api", tags=["Projects"])
app.include_router(activities.router, prefix="/api", tags=["Activities"])
app.include_router(ai_parser.router, prefix="/api", tags=["AI Parser"])

# --- Root Endpoint ---
@app.get("/")
async def root():
    return {"message": f'{settings.PROJECT_NAME} backend is running! Env: {settings.APP_ENV}'}
