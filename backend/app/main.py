from fastapi import FastAPI
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from .routes import projects, activities, ai_parser

app = FastAPI(title="FieldOps BOQ AI Platform")

# Include routers from the routes module
app.include_router(projects.router, prefix="/api", tags=["Projects"])
app.include_router(activities.router, prefix="/api", tags=["Activities"])
app.include_router(ai_parser.router, prefix="/api", tags=["AI Parser"])

@app.get("/")
async def root():
    return {"message": "FieldOps backend is running!"}
