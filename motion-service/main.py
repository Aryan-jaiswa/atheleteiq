from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List
from pose_engine.extractor import extract_pose
from biomechanics.calculator import calculate_metrics
from gemini_client.analyzer import analyze_motion
from injury_predictor.model import predict_injury_risk
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="AthleteIQ Motion Service")

class VideoAnalysisRequest(BaseModel):
    video_url: str
    athlete_id: str

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "motion-service"}

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
