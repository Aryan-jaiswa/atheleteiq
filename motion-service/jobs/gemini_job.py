"""
Gemini AI analysis RQ job
Orchestrates multimodal analysis using Gemini 1.5 Pro
Combines Gemini output with ML-based injury prediction
"""

import os
import json
import logging
import requests
from typing import Dict, Optional

logger = logging.getLogger(__name__)


class GeminiAnalysisJob:
    """RQ job wrapper for Gemini analysis"""
    
    def __init__(self):
        """Initialize job"""
        self.backend_url = os.getenv('BACKEND_URL', 'http://localhost:4000')
        self.internal_token = os.getenv('INTERNAL_SERVICE_TOKEN', '')
    
    def analyze_video(
        self,
        video_id: str,
        athlete_id: str,
        sport: str,
        dominant_side: str = 'RIGHT',
        video_type: str = 'TRAINING',
    ) -> bool:
        """
        Orchestrate full Gemini analysis pipeline
        
        Step 1: Fetch biomechanics results from backend
        Step 2: Fetch keypoint series from backend
        Step 3: Run Gemini multimodal analysis
        Step 4: Get ML injury prediction
        Step 5: Combine scores and save results
        
        Args:
            video_id: Video identifier
            athlete_id: Athlete identifier
            sport: Sport type
            dominant_side: LEFT or RIGHT
            video_type: TRAINING or MATCH
        
        Returns:
            True if successful
        """
        logger.info(f'🎬 Starting Gemini analysis job for video: {video_id}')
        logger.info(f'   Athlete: {athlete_id}, Sport: {sport}')
        
        try:
            # Step 1: Fetch biomechanics results
            logger.info('📊 Step 1/5: Fetching biomechanics results...')
            biomechanics_report = self._fetch_biomechanics_results(video_id)
            
            if not biomechanics_report:
                logger.error('Failed to fetch biomechanics results')
                return self._report_error(video_id, 'No biomechanics data available')
            
            logger.info('✅ Fetched biomechanics results')
            
            # Step 2: Fetch keypoint series
            logger.info('🔑 Step 2/5: Fetching keypoint series...')
            keypoint_series = self._fetch_keypoint_series(video_id)
            
            if not keypoint_series:
                logger.error('Failed to fetch keypoint series')
                return self._report_error(video_id, 'No keypoint data available')
            
            logger.info(f'✅ Fetched {len(keypoint_series)} keypoints')
            
            # Step 3: Run Gemini analysis
            logger.info('🤖 Step 3/5: Running Gemini analysis...')
            from gemini_client import analyze_athlete
            
            frames_gcs_prefix = f'gs://athleteiq-videos/frames/{video_id}/'
            gemini_result = analyze_athlete(
                video_id=video_id,
                athlete_id=athlete_id,
                sport=sport,
                dominant_side=dominant_side,
                video_type=video_type,
                biomechanics_report=biomechanics_report,
                keypoint_series=keypoint_series,
                frames_gcs_prefix=frames_gcs_prefix,
            )
            
            if not gemini_result or not gemini_result.get('success', False):
                logger.error('Gemini analysis failed')
                return self._report_error(video_id, 'Gemini analysis failed')
            
            logger.info('✅ Gemini analysis complete')
            
            # Step 4: ML injury prediction
            logger.info('🧬 Step 4/5: Running ML injury prediction...')
            from injury_predictor import predict_injury_risk, combine_injury_scores
            
            ml_prediction = predict_injury_risk(biomechanics_report)
            
            ml_risk_score = ml_prediction.get('riskScore', 50)
            gemini_risk_score = gemini_result.get('injuryRiskScore', 50)
            
            combined_risk_score = combine_injury_scores(ml_risk_score, gemini_risk_score)
            
            logger.info(f'✅ ML Risk: {ml_risk_score:.0f}, Gemini Risk: {gemini_risk_score:.0f}')
            logger.info(f'   Combined Risk: {combined_risk_score:.0f}')
            
            # Step 5: Save combined results
            logger.info('💾 Step 5/5: Saving results...')
            
            # Merge injury predictions
            merged_result = gemini_result.copy()
            merged_result['injuryRiskScore'] = combined_risk_score
            
            # Add ML insights to injury prevention
            merged_result['injuryRiskAreas'] = list(set(
                merged_result.get('injuryRiskAreas', []) +
                ml_prediction.get('riskAreas', [])
            ))
            
            success = self._save_analysis_results(
                video_id=video_id,
                analysis_result=merged_result,
                ml_prediction=ml_prediction,
            )
            
            if success:
                logger.info('✅ Gemini analysis pipeline complete')
                return True
            else:
                logger.error('Failed to save results')
                return self._report_error(video_id, 'Failed to save analysis results')
        
        except Exception as e:
            logger.error(f'❌ Job error: {str(e)}')
            return self._report_error(video_id, f'Job error: {str(e)}')
    
    def _fetch_biomechanics_results(self, video_id: str) -> Optional[Dict]:
        """
        Fetch biomechanics results from backend
        
        Args:
            video_id: Video identifier
        
        Returns:
            BiomechanicsReport dictionary or None
        """
        try:
            headers = {
                'x-internal-token': self.internal_token,
            }
            
            url = f'{self.backend_url}/api/internal/videos/{video_id}/biomechanics-results'
            response = requests.get(url, headers=headers, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                return data.get('biomechanicsResult', data)
            
            logger.error(f'Backend returned {response.status_code}')
            return None
        
        except Exception as e:
            logger.error(f'Error fetching biomechanics: {str(e)}')
            return None
    
    def _fetch_keypoint_series(self, video_id: str) -> Optional[list]:
        """
        Fetch keypoint time-series from backend
        
        Args:
            video_id: Video identifier
        
        Returns:
            List of keypoint frames or None
        """
        try:
            headers = {
                'x-internal-token': self.internal_token,
            }
            
            url = f'{self.backend_url}/api/internal/videos/{video_id}/pose-results'
            response = requests.get(url, headers=headers, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                result = data.get('poseAnalysisResult', {})
                return result.get('keypointSeries', [])
            
            logger.error(f'Backend returned {response.status_code}')
            return None
        
        except Exception as e:
            logger.error(f'Error fetching keypoints: {str(e)}')
            return None
    
    def _save_analysis_results(
        self,
        video_id: str,
        analysis_result: Dict,
        ml_prediction: Dict,
    ) -> bool:
        """
        Save analysis results to backend
        
        Args:
            video_id: Video identifier
            analysis_result: Merged Gemini + ML result
            ml_prediction: ML injury prediction
        
        Returns:
            True if successful
        """
        try:
            headers = {
                'Content-Type': 'application/json',
                'x-internal-token': self.internal_token,
            }
            
            payload = {
                'status': 'COMPLETE',
                'geminiAnalysis': analysis_result,
                'mlPrediction': ml_prediction,
                'enqueueNextJob': False,  # Analysis is final pipeline stage
            }
            
            url = f'{self.backend_url}/api/internal/gemini/{video_id}'
            response = requests.patch(url, json=payload, headers=headers, timeout=60)
            
            if response.status_code == 200:
                logger.info('✅ Results saved to database')
                return True
            
            logger.error(f'Backend returned {response.status_code}: {response.text}')
            return False
        
        except Exception as e:
            logger.error(f'Error saving results: {str(e)}')
            return False
    
    def _report_error(self, video_id: str, error_message: str) -> bool:
        """
        Report error to backend
        
        Args:
            video_id: Video identifier
            error_message: Error description
        
        Returns:
            True if reported
        """
        try:
            headers = {
                'Content-Type': 'application/json',
                'x-internal-token': self.internal_token,
            }
            
            payload = {
                'errorMessage': f'Gemini job error: {error_message}',
            }
            
            url = f'{self.backend_url}/api/internal/videos/{video_id}/error'
            response = requests.post(url, json=payload, headers=headers, timeout=30)
            
            if response.status_code == 200:
                logger.info('Error recorded in database')
                return True
            
            logger.error(f'Failed to record error: {response.status_code}')
            return False
        
        except Exception as e:
            logger.error(f'Error reporting error: {str(e)}')
            return False


# Singleton instance
_job: GeminiAnalysisJob = None


def get_gemini_job() -> GeminiAnalysisJob:
    """Get or create Gemini job singleton"""
    global _job
    if _job is None:
        _job = GeminiAnalysisJob()
    return _job


def gemini_job(
    video_id: str,
    athlete_id: str,
    sport: str,
    dominant_side: str = 'RIGHT',
    video_type: str = 'TRAINING',
) -> dict:
    """
    RQ job entry point for Gemini analysis
    
    Args:
        video_id: Video identifier
        athlete_id: Athlete identifier
        sport: Sport type
        dominant_side: LEFT or RIGHT
        video_type: TRAINING or MATCH
    
    Returns:
        Result dictionary
    """
    logger.info(f'RQ Job started: gemini_job({video_id})')
    
    job = get_gemini_job()
    success = job.analyze_video(
        video_id=video_id,
        athlete_id=athlete_id,
        sport=sport,
        dominant_side=dominant_side,
        video_type=video_type,
    )
    
    return {
        'jobId': 'gemini_job',
        'videoId': video_id,
        'success': success,
        'message': 'Analysis complete' if success else 'Analysis failed',
    }
