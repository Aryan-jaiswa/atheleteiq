"""
Video processing job - main orchestration for frame extraction
Runs as a Redis Queue job (RQ) worker
"""

import os
import logging
import requests
import json
from pathlib import Path
from gcs_client import get_gcs_client
from ffmpeg_processor import get_ffmpeg_processor

logger = logging.getLogger(__name__)


class VideoProcessingJob:
    """Orchestrates video frame extraction pipeline"""

    def __init__(self):
        """Initialize job handler"""
        self.gcs = get_gcs_client()
        self.ffmpeg = get_ffmpeg_processor()
        self.backend_url = os.getenv('BACKEND_URL', 'http://localhost:4000')
        self.internal_token = os.getenv('INTERNAL_SERVICE_TOKEN', '')
        self.bucket_name = os.getenv('GCS_BUCKET_NAME', 'athleteiq-videos')

    def process_video(self, video_id: str, gcs_url: str, sport: str, athlete_id: str, duration_seconds: float) -> bool:
        """
        Process video: download, extract frames, upload frames

        Args:
            video_id: Unique video identifier
            gcs_url: GCS URL of raw video (gs://bucket/path/to/video.mp4)
            sport: Sport type (for context)
            athlete_id: Athlete ID
            duration_seconds: Video duration in seconds

        Returns:
            True if successful, False otherwise
        """
        local_video_path = None
        frames_dir = None

        try:
            logger.info(f'🎬 Starting video processing for video: {video_id}')
            logger.info(f'GCS URL: {gcs_url}, Sport: {sport}, Duration: {duration_seconds}s')

            # Step 1: Create temporary directories
            local_video_path = f'/tmp/video_{video_id}.mp4'
            frames_dir = f'/tmp/frames_{video_id}'

            Path(frames_dir).mkdir(parents=True, exist_ok=True)

            # Step 2: Download video from GCS
            logger.info('📥 Step 1/4: Downloading video from GCS...')
            if not self._download_video(gcs_url, local_video_path):
                self._update_status_error(video_id, 'Failed to download video from GCS')
                return False

            # Step 3: Extract frames
            logger.info('🎥 Step 2/4: Extracting frames with FFmpeg...')
            success, frame_count = self._extract_frames(local_video_path, frames_dir)
            if not success or frame_count == 0:
                self._update_status_error(video_id, 'Failed to extract frames from video')
                return False

            logger.info(f'✅ Extracted {frame_count} frames')

            # Step 4: Upload frames to GCS
            logger.info('📤 Step 3/4: Uploading frames to GCS...')
            uploaded_count, failed_count = self._upload_frames(video_id, frames_dir)

            if uploaded_count == 0:
                self._update_status_error(video_id, 'Failed to upload frames to GCS')
                return False

            if failed_count > 0:
                logger.warning(f'⚠️  {failed_count} frames failed to upload out of {frame_count}')

            # Step 5: Update video status in database
            logger.info('🔄 Step 4/4: Updating database status...')
            if not self._update_status(video_id, 'POSE_DETECTION', frame_count):
                self._update_status_error(video_id, 'Failed to update database status')
                return False

            # Step 6: Cleanup local files
            self._cleanup(local_video_path, frames_dir)

            logger.info(f'✅ Video processing complete for {video_id}')
            return True

        except Exception as e:
            logger.error(f'❌ Unexpected error in video processing: {str(e)}')
            self._update_status_error(video_id, f'Processing error: {str(e)}')
            self._cleanup(local_video_path, frames_dir)
            return False

    def _download_video(self, gcs_url: str, local_path: str) -> bool:
        """Download video from GCS"""
        try:
            if not self.gcs.download_video(gcs_url, local_path):
                logger.error('GCS download failed')
                return False

            # Verify file exists and has content
            if not os.path.exists(local_path) or os.path.getsize(local_path) == 0:
                logger.error('Downloaded file is empty or does not exist')
                return False

            file_size_mb = os.path.getsize(local_path) / (1024 * 1024)
            logger.info(f'✅ Downloaded video: {file_size_mb:.2f} MB')
            return True

        except Exception as e:
            logger.error(f'Error downloading video: {str(e)}')
            return False

    def _extract_frames(self, video_path: str, output_dir: str) -> tuple:
        """Extract frames from video"""
        try:
            success, frame_count = self.ffmpeg.extract_frames(
                video_path=video_path,
                output_dir=output_dir,
                fps=1.0,  # 1 frame per second
                frame_format='frame_%04d.jpg'
            )

            if not success:
                logger.error('FFmpeg frame extraction failed')
                return False, None

            return True, frame_count

        except Exception as e:
            logger.error(f'Error extracting frames: {str(e)}')
            return False, None

    def _upload_frames(self, video_id: str, frames_dir: str) -> tuple:
        """Upload frames to GCS"""
        try:
            gcs_prefix = f'frames/{video_id}'
            uploaded, failed = self.gcs.upload_frames_batch(frames_dir, gcs_prefix)

            if uploaded == 0:
                logger.error('No frames were uploaded')
                return 0, failed

            logger.info(f'✅ Uploaded {uploaded} frames ({failed} failed)')
            return uploaded, failed

        except Exception as e:
            logger.error(f'Error uploading frames: {str(e)}')
            return 0, None

    def _update_status(self, video_id: str, status: str, frame_count: int = None) -> bool:
        """Update video status in backend database"""
        try:
            headers = {
                'Content-Type': 'application/json',
                'x-internal-token': self.internal_token,
            }

            # Enqueue next job when transitioning to POSE_DETECTION
            enqueue_next = status == 'POSE_DETECTION'

            payload = {
                'status': status,
                'frameCount': frame_count,
                'enqueueNextJob': enqueue_next,
            }

            url = f'{self.backend_url}/api/internal/videos/{video_id}'
            response = requests.patch(url, json=payload, headers=headers, timeout=30)

            if response.status_code != 200:
                logger.error(f'Backend returned {response.status_code}: {response.text}')
                return False

            logger.info(f'✅ Status updated in database: {status}')
            return True

        except Exception as e:
            logger.error(f'Failed to update status in database: {str(e)}')
            return False

    def _update_status_error(self, video_id: str, error_message: str) -> bool:
        """Report error to backend"""
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

    def _cleanup(self, video_path: str = None, frames_dir: str = None) -> None:
        """Clean up temporary files"""
        try:
            if video_path and os.path.exists(video_path):
                os.remove(video_path)
                logger.info(f'Cleaned up video file: {video_path}')

            if frames_dir:
                self.ffmpeg.cleanup_frames(frames_dir)
                if os.path.exists(frames_dir):
                    os.rmdir(frames_dir)

        except Exception as e:
            logger.warning(f'Cleanup warning: {str(e)}')


# Singleton instance
_job_processor: VideoProcessingJob = None


def get_video_processor() -> VideoProcessingJob:
    """Get or create video processor singleton"""
    global _job_processor
    if _job_processor is None:
        _job_processor = VideoProcessingJob()
    return _job_processor


def process_video_job(video_id: str, gcs_url: str, sport: str, athlete_id: str, duration_seconds: float) -> dict:
    """
    Main job function - called by RQ worker

    Args:
        video_id: Video identifier
        gcs_url: GCS URL of video
        sport: Sport type
        athlete_id: Athlete ID
        duration_seconds: Video duration

    Returns:
        Job result dictionary
    """
    logger.info(f'Processing video job: {video_id}')

    processor = get_video_processor()
    success = processor.process_video(video_id, gcs_url, sport, athlete_id, duration_seconds)

    return {
        'videoId': video_id,
        'success': success,
        'message': 'Video processing complete' if success else 'Video processing failed'
    }
