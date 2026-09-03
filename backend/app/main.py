
import os
from dotenv import load_dotenv

# --- Explicitly load .env file from the project root ---
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
dotenv_path = os.path.join(project_root, ".env")

if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)
else:
    print(f"Warning: .env file not found at {dotenv_path}. Relying on environment variables.")

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware # Import CORS middleware
from fastapi.responses import JSONResponse
import redis.asyncio as redis
import logging

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from .core.config import settings
from .limiter import limiter
from .routes import projects, activities, ai_parser, integrations, users, notes, documents, financials, contracts
from .routes import tech
from .routes import field_ops
from .routes import budget
from .routes import ipc
from .routes import activity_schedule
from .routes import milestone_claims
from .routes import rate_schedule
from .routes import reimbursable_claims
from .routes import program_of_works

# --- Configure Logging ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# --- Startup and Shutdown Events ---
async def lifespan(app: FastAPI):
    # --- Connect to Redis on startup ---
    logger.info("Connecting to Redis...")
    try:
        app.state.redis = redis.Redis(
            host=settings.REDIS_HOST, 
            port=settings.REDIS_PORT, 
            db=0, 
            decode_responses=True,
            socket_timeout=1.0,
            socket_connect_timeout=1.0
        )
        await app.state.redis.ping()
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
app_configs = {"title": settings.PROJECT_NAME, "lifespan": lifespan}
if settings.APP_ENV == "production":
    app_configs["docs_url"] = None
    app_configs["redoc_url"] = None

app = FastAPI(**app_configs)

# --- Add CORS Middleware ---
# This is crucial for allowing the frontend (running on a different port)
# to communicate with the backend.
origins = [
    # --- Local development ---
    "http://localhost:3000",
    "http://localhost:3001",
    # --- Cloud Workstation development ---
    "https://3001-firebase-fieldops-1771239563342.cluster-fbfjltn375c6wqxlhoehbz44sk.cloudworkstations.dev",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add the rate limiter to the app state and exception handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# --- Include Routers ---
app.include_router(projects.router, prefix="/api", tags=["Projects"])
app.include_router(contracts.router, prefix="/api", tags=["Contracts"])
app.include_router(activities.router, prefix="/api", tags=["Activities"])
app.include_router(ai_parser.router, prefix="/api", tags=["AI Parser"])
app.include_router(integrations.router, prefix="/api", tags=["Integrations"])
app.include_router(users.router, prefix="/api", tags=["Users"])
app.include_router(notes.router, prefix="/api", tags=["Notes"])
app.include_router(documents.router, prefix="/api", tags=["Documents"])
app.include_router(tech.router, prefix='/api', tags=['Tech Documents'])
app.include_router(field_ops.router, prefix='/api', tags=['Field Ops Documents'])
app.include_router(budget.router, prefix='/api', tags=['Budget Documents'])
app.include_router(ipc.router, prefix='/api', tags=['IPC Documents'])
app.include_router(activity_schedule.router, prefix='/api', tags=['Activity Schedule Documents'])
app.include_router(milestone_claims.router, prefix='/api', tags=['Milestone Claim Documents'])
app.include_router(rate_schedule.router, prefix='/api', tags=['Rate Schedule Documents'])
app.include_router(reimbursable_claims.router, prefix='/api', tags=['Reimbursable Claim Documents'])
app.include_router(program_of_works.router, prefix='/api', tags=['Program Of Works Documents'])
app.include_router(financials.router, prefix="/api", tags=["Financials"])

# --- Root Endpoint ---
@app.get("/")
async def root():
    return {"message": f'{settings.PROJECT_NAME} backend is running! Env: {settings.APP_ENV}'}

from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.database import get_db
from fastapi import Depends

from app.models.document import Document
from app.models.project_integration import ProjectIntegration
from sqlalchemy.orm.attributes import flag_modified
from datetime import datetime





