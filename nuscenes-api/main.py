from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os

from routers import scenes, samples, sensor_data
from config import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load nuScenes dataset on startup."""
    from database import init_nuscenes
    init_nuscenes()
    yield

app = FastAPI(
    title="nuScenes API",
    description="REST API to explore the nuScenes autonomous driving dataset",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scenes.router, prefix="/scenes", tags=["Scenes"])
app.include_router(samples.router, prefix="/samples", tags=["Samples (Frames)"])
app.include_router(sensor_data.router, prefix="/sensor-data", tags=["Sensor Data"])

@app.get("/", tags=["Health"])
def root():
    return {
        "status": "ok",
        "message": "nuScenes API is running",
        "docs": "/docs",
    }

@app.get("/health", tags=["Health"])
def health():
    from database import nusc
    return {
        "status": "ok",
        "dataset_version": nusc.version if nusc else "not loaded",
        "total_scenes": len(nusc.scene) if nusc else 0,
        "total_samples": len(nusc.sample) if nusc else 0,
    }

app.mount("/data", StaticFiles(directory=settings.NUSCENES_DATAROOT), name="data")
