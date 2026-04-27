from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Dict, Any, List
from pose_engine.extractor import extract_pose
from biomechanics.calculator import calculate_metrics
from gemini_client.analyzer import analyze_motion
from injury_predictor import get_predictor, predict_injury_risk
from gcs_client import LOCAL_STORAGE_ROOT, USE_LOCAL_STORAGE
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="AthleteIQ Motion Service")


@app.on_event("startup")
def startup_event():
    get_predictor()

class VideoAnalysisRequest(BaseModel):
    video_url: str
    athlete_id: str

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "motion-service",
        "timestamp": datetime.utcnow().isoformat(),
        "storage": "local" if USE_LOCAL_STORAGE else "gcs",
    }


@app.get("/local-media/{blob_name:path}")
async def local_media(blob_name: str):
    local_path = (LOCAL_STORAGE_ROOT / blob_name).resolve()
    storage_root = LOCAL_STORAGE_ROOT.resolve()

    if storage_root not in local_path.parents and local_path != storage_root:
        raise HTTPException(status_code=404, detail="File not found")

    if not local_path.exists() or not local_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(local_path)

@app.post("/analyze")
async def analyze_video(request: VideoAnalysisRequest):
    try:
        # 1. Pose Extraction
        # In a real scenario, we'd download the video from video_url first
        keypoints = extract_pose(request.video_url)
        
        # 2. Biomechanics Calculation
        biomechanics = calculate_metrics(keypoints)
        
        # 3. Gemini Multimodal Analysis
        gemini_analysis = await analyze_motion(request.video_url, biomechanics)
        
        # 4. Injury Prediction
        injury_risk = predict_injury_risk(biomechanics)
        
        return {
            "athlete_id": request.athlete_id,
            "status": "completed",
            "pose_data_points": len(keypoints),
            "biomechanics": biomechanics,
            "gemini_analysis": gemini_analysis,
            "injury_risk": injury_risk
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
