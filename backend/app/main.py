from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import get_settings
from .db import close_pool
from .ml.registry import register_v1_artifact
from .routers import football, system, predictions, rankings, analytics

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    try:
        close_pool()
    except Exception:
        pass


app = FastAPI(title="PitchsideIQ API", version="0.2.0", lifespan=lifespan)

origins = [o.strip() for o in get_settings().cors_origins.split(",") if o.strip()]
if not origins:
    origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(system.router)
app.include_router(football.router)
app.include_router(predictions.router)
app.include_router(rankings.router)
app.include_router(analytics.router)
