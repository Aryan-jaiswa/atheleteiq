"""
Biomechanics calculation job - orchestrates biomechanics analysis pipeline
Runs after pose detection and before Gemini AI analysis
"""

import os
import logging
import requests
from typing import Dict, List, Optional

from biomechanics.calculator import calculate_biomechanics_job as run_biomechanics

logger = logging.getLogger(__name__)


class BiomechanicsJob:
    """Orchestrates biomechanics calculation for video"""

    def __init__(self):
        """Initialize biomechanics job"""
        self.backend_url = os.getenv('BACKEND_URL', 'http://localhost:4000')
        self.internal_token = os.getenv('INTERNAL_SERVICE_TOKEN', '')

    def calculate_biomechanics(self, video_id: str, sport: str = 'general') -> bool:
        """
        Main biomechanics calculation orchestration

        Steps:
        1. Fetch pose analysis results from backend
        2. Run biomechanics calculations
        3. Save results to backend
        4. Enqueue next job (Gemini analysis)

        Args:
            video_id: Video identifier
            sport: Sport type for benchmark selection

        Returns:
            True if successful, False otherwise
        """
        try:
            logger.info(f'🔬 Starting biomechanics calculation for video: {video_id}')

            # Step 1: Fetch pose analysis results from backend
            logger.info('📥 Step 1/2: Fetching pose analysis results...')
            keypoint_series = self._fetch_pose_results(video_id)

            if keypoint_series is None:
                self._update_status_error(video_id, 'Failed to fetch pose analysis results')
                return False

            logger.info(f'✅ Retrieved {len(keypoint_series)} keypoint frames')

            # Step 2: Run biomechanics calculations
            logger.info('🔬 Step 2/2: Computing biomechanics metrics...')
            result = run_biomechanics(video_id, keypoint_series, sport)

            if not result.get('success'):
                self._update_status_error(video_id, result.get('message', 'Unknown error'))
                return False

            logger.info(f'✅ Biomechanics calculation complete')
            logger.info(f'   Overall score: {result.get("overallScore", 0):.1f}/100')
            return True

        except Exception as e:
            logger.error(f'❌ Unexpected error in biomechanics job: {str(e)}')
            self._update_status_error(video_id, f'Processing error: {str(e)}')
            return False

    def _fetch_pose_results(self, video_id: str) -> Optional[List[Dict]]:
        """
        Fetch pose analysis results from backend

        Args:
            video_id: Video identifier

        Returns:
            Keypoint series list or None if failed
        """
        try:
            headers = {
                'x-internal-token': self.internal_token,
            }

            url = f'{self.backend_url}/api/internal/videos/{video_id}/pose-results'
            response = requests.get(url, headers=headers, timeout=30)

            if response.status_code != 200:
                logger.error(f'Backend returned {response.status_code}')
                return None

            data = response.json()
            keypoint_series = data.get('keypointSeries', [])

            if not keypoint_series:
                logger.error('Empty keypoint series received')
                return None

            return keypoint_series

        except Exception as e:
            logger.error(f'Failed to fetch pose results: {str(e)}')
            return None

    def _update_status_error(self, video_id: str, error_message: str) -> bool:
        """
        Report error to backend

        Args:
            video_id: Video identifier
            error_message: Error description

        Returns:
            True if successful
        """
        try:
            headers = {
                'Content-Type': 'application/json',
                'x-internal-token': self.internal_token,
            }

            payload = {
                'errorMessage': error_message,
            }

            url = f'{self.backend_url}/api/internal/videos/{video_id}/error'
            response = requests.post(url, json=payload, headers=headers, timeout=30)

            if response.status_code == 200:
                logger.info(f'Error recorded in database')
                return True

            logger.error(f'Failed to record error: {response.status_code}')
            return False

        except Exception as e:
            logger.error(f'Failed to report error: {str(e)}')
            return False


# Singleton instance
_job_processor: BiomechanicsJob = None


def get_biomechanics_job() -> BiomechanicsJob:
    """Get or create biomechanics job singleton"""
    global _job_processor
    if _job_processor is None:
        _job_processor = BiomechanicsJob()
    return _job_processor


def biomechanics_job(video_id: str, sport: str = 'general') -> dict:
    """
    Main job function - called by RQ worker

    Args:
        video_id: Video identifier
        sport: Sport type

    Returns:
        Job result dictionary
    """
    logger.info(f'Processing biomechanics job: {video_id}')

    job = get_biomechanics_job()
    success = job.calculate_biomechanics(video_id, sport)

    return {
        'videoId': video_id,
        'success': success,
        'message': 'Biomechanics calculation complete' if success else 'Biomechanics calculation failed'
    }
