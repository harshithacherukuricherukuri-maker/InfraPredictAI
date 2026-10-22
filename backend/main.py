
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.database import check_database_connection, engine
from backend.models import Base
from backend.routes import router as projects_router
from backend.auth import router as auth_router
from backend.pdf_analysis import router as pdf_router
from backend.analytics import router as analytics_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="InfraPredict AI",
    description="Construction project progress and delay-risk prediction",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:5176",
        "http://127.0.0.1:5176",
        "http://localhost:5177",
        "http://127.0.0.1:5177",
        "http://localhost:5178",
        "http://127.0.0.1:5178",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "message": "Welcome to InfraPredict AI",
        "status": "running",
    }


@app.get("/api/health")
def health():
    return {"status": "healthy"}


@app.get("/api/db-health")
def database_health():
    if check_database_connection():
        return {"database": "connected"}

    return {
        "database": "disconnected",
        "message": "Check database settings and PostgreSQL service.",
    }


app.include_router(projects_router)
app.include_router(auth_router)
app.include_router(pdf_router)
app.include_router(analytics_router)
