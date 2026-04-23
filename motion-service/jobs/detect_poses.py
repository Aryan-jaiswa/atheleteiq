"""
Pose detection job - orchestrates full pose analysis pipeline
Runs after frame extraction and before biomechanics analysis
"""

import os
import logging
import requests
import json
from typing import Dict, Optional

from pose_engine.batch_processor import process_video_frames, PoseAnalysisResult
from pose_engine.validator import validate_keypoint_series, get_series_stats

logger = logging.getLogger(__name__)


class PoseDetectionJob:
    """Orchestrates pose detection for video frames"""

    def __init__(self):
        """Initialize pose detection job"""
        self.backend_url = os.getenv('BACKEND_URL', 'http://localhost:4000')
        self.internal_token = os.getenv('INTERNAL_SERVICE_TOKEN', '')

    def detect_poses(self, video_id: str, frames_gcs_prefix: str) -> bool:
        """
        Main pose detection orchestration

        Args:
            video_id: Video identifier
            frames_gcs_prefix: GCS prefix where frames are stored (e.g., 'frames/video-id')

        Returns:
            True if successful, False otherwise
        """
        try:
            logger.info(f'🎯 Starting pose detection for video: {video_id}')

            # Step 1: Process all frames for pose
            logger.info('📊 Step 1/3: Processing frames for pose detection...')
            result = process_video_frames(video_id, frames_gcs_prefix)

            if result is None:
                self._update_status_error(video_id, 'Failed to process frames for pose detection')
                return False

            logger.info(f'✅ Processed frames: {result.frame_count} total, {result.valid_frame_count} valid')

            # Step 2: Validate keypoint series
            logger.info('🔍 Step 2/3: Validating keypoint series...')
            validation_result = validate_keypoint_series(result.keypoint_series)

            if not validation_result.is_valid:
                error_msg = f'Pose validation failed: {"; ".join(validation_result.errors)}'
                logger.error(f'❌ {error_msg}')
                self._update_status_error(video_id, error_msg)
                return False

            # Log warnings
            if validation_result.warnings:
                logger.warning(f'⚠️  Validation warnings: {len(validation_result.warnings)}')
                for warning in validation_result.warnings[:3]:  # Log first 3
                    logger.warning(f'   - {warning}')

            logger.info(f'✅ Keypoint series validated')

            # Step 3: Calculate statistics
            stats = get_series_stats(result.keypoint_series)
            logger.info(f'   - Duration: {stats["durationSeconds"]:.1f}s')
            logger.info(f'   - Avg visibility: {stats["averageVisibility"]:.2f}')
            logger.info(f'   - Processing time: {result.processing_duration_ms}ms')

            # Step 4: Update backend with results
            logger.info('🔄 Step 3/3: Updating backend with pose results...')
            if not self._update_pose_results(video_id, result):
                self._update_status_error(video_id, 'Failed to save pose results to database')
                return False

            logger.info(f'✅ Pose detection complete for {video_id}')
            return True

        except Exception as e:
            logger.error(f'❌ Unexpected error in pose detection: {str(e)}')
            self._update_status_error(video_id, f'Processing error: {str(e)}')
            return False

    def _update_pose_results(self, video_id: str, result: PoseAnalysisResult) -> bool:
        """
        Save pose analysis results to backend

        Args:
            video_id: Video identifier
            result: PoseAnalysisResult from batch processor

        Returns:
            True if successful
        """
        try:
            headers = {
                'Content-Type': 'application/json',
                'x-internal-token': self.internal_token,
            }

            # Prepare payload with pose analysis data
            payload = {
                'status': 'BIOMECHANICS',
                'poseAnalysisResult': result.to_dict(),
                'enqueueNextJob': True
            }

            url = f'{self.backend_url}/api/internal/videos/{video_id}'
            response = requests.patch(url, json=payload, headers=headers, timeout=60)

            if response.status_code != 200:
                logger.error(f'Backend returned {response.status_code}: {response.text}')
                return False

            logger.info(f'✅ Pose results saved to database')
            return True

        except Exception as e:
            logger.error(f'Failed to save pose results: {str(e)}')
            return False

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
            logger.error(f'Failed to report error to backend: {str(e)}')
            return False


# Singleton instance
_job_processor: PoseDetectionJob = None


def get_pose_detection_job() -> PoseDetectionJob:
    """Get or create pose detection job singleton"""
    global _job_processor
    if _job_processor is None:
        _job_processor = PoseDetectionJob()
    return _job_processor


def detect_poses_job(video_id: str, frames_gcs_prefix: str) -> dict:
    """
    Main job function - called by RQ worker

    Args:
        video_id: Video identifier
        frames_gcs_prefix: GCS prefix where frames are stored

    Returns:
        Job result dictionary
    """
    logger.info(f'Processing pose detection job: {video_id}')

    job = get_pose_detection_job()
    success = job.detect_poses(video_id, frames_gcs_prefix)

    return {
        'videoId': video_id,
        'success': success,
        'message': 'Pose detection complete' if success else 'Pose detection failed'
    }
