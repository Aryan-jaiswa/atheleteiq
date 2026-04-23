"""
Batch processing of video frames for pose detection
Downloads frames from GCS and processes them sequentially
"""

import os
import logging
import shutil
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime
import time

from gcs_client import get_gcs_client
from pose_engine.extractor import get_pose_extractor, KEYPOINT_NAMES

logger = logging.getLogger(__name__)


class PoseAnalysisResult:
    """Result of pose analysis for a video"""

    def __init__(self, video_id: str, frame_count: int, valid_frame_count: int,
                 keypoint_series: List[Dict], processing_duration_ms: int):
        self.video_id = video_id
        self.frame_count = frame_count
        self.valid_frame_count = valid_frame_count
        self.keypoint_series = keypoint_series
        self.processing_duration_ms = processing_duration_ms
        self.created_at = datetime.utcnow().isoformat()

    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization"""
        return {
            'videoId': self.video_id,
            'frameCount': self.frame_count,
            'validFrameCount': self.valid_frame_count,
            'keypointSeriesLength': len(self.keypoint_series),
            'processingDurationMs': self.processing_duration_ms,
            'createdAt': self.created_at,
            'keypoints': [
                {
                    'frameIndex': frame['frameIndex'],
                    'frameTimestampMs': frame['frameTimestampMs'],
                    'keypoints': frame['keypoints'],
                    'boundingBox': frame['bounding_box'],
                    'bodyOrientation': frame['body_orientation']
                }
                for frame in self.keypoint_series
            ]
        }


class BatchPoseProcessor:
    """Processes all frames in a video for pose detection"""

    def __init__(self):
        """Initialize batch processor"""
        self.gcs = get_gcs_client()
        self.extractor = get_pose_extractor()
        self.bucket_name = os.getenv('GCS_BUCKET_NAME', 'athleteiq-videos')

    def process_video_frames(self, video_id: str, frames_gcs_prefix: str) -> Optional[PoseAnalysisResult]:
        """
        Process all frames in a video for pose detection

        Args:
            video_id: Video identifier
            frames_gcs_prefix: GCS prefix where frames are stored (e.g., 'frames/video-id')

        Returns:
            PoseAnalysisResult with keypoint time-series
            Or None if processing failed
        """
        start_time = time.time()
        local_frames_dir = f'/tmp/frames_pose_{video_id}'

        try:
            logger.info(f'🎯 Starting pose analysis for video: {video_id}')
            logger.info(f'GCS prefix: {frames_gcs_prefix}')

            # Step 1: Create local directory
            Path(local_frames_dir).mkdir(parents=True, exist_ok=True)

            # Step 2: Download all frames from GCS
            logger.info('📥 Step 1/3: Downloading frames from GCS...')
            frame_files = self._download_frames(frames_gcs_prefix, local_frames_dir, video_id)

            if not frame_files:
                logger.error('No frames downloaded')
                return None

            frame_files.sort()  # Sort by filename
            logger.info(f'✅ Downloaded {len(frame_files)} frames')

            # Step 3: Process each frame for pose
            logger.info(f'🏃 Step 2/3: Extracting pose from {len(frame_files)} frames...')
            keypoint_series = self._extract_pose_from_frames(frame_files, video_id)

            if not keypoint_series:
                logger.error('No valid frames with pose detected')
                return None

            logger.info(f'✅ Extracted pose from {len(keypoint_series)} valid frames')

            # Step 4: Calculate processing time
            duration_ms = int((time.time() - start_time) * 1000)

            logger.info(f'🎉 Pose analysis complete: {len(keypoint_series)} valid frames in {duration_ms}ms')

            # Create result
            result = PoseAnalysisResult(
                video_id=video_id,
                frame_count=len(frame_files),
                valid_frame_count=len(keypoint_series),
                keypoint_series=keypoint_series,
                processing_duration_ms=duration_ms
            )

            # Step 5: Cleanup
            self._cleanup_frames(local_frames_dir)

            return result

        except Exception as e:
            logger.error(f'❌ Error processing video frames: {str(e)}')
            self._cleanup_frames(local_frames_dir)
            return None

    def _download_frames(self, gcs_prefix: str, local_dir: str, video_id: str) -> List[str]:
        """
        Download all frames from GCS to local directory

        Args:
            gcs_prefix: GCS path prefix (e.g., 'frames/video-id')
            local_dir: Local directory to save frames
            video_id: Video ID for logging

        Returns:
            List of local frame file paths
        """
        try:
            # List all frames in GCS
            frame_blobs = self.gcs.list_files(gcs_prefix)

            if not frame_blobs:
                logger.warning(f'No frames found in GCS prefix: {gcs_prefix}')
                return []

            logger.info(f'Found {len(frame_blobs)} frame files in GCS')

            local_files = []
            for blob_name in frame_blobs:
                if not blob_name.endswith('.jpg'):
                    continue

                try:
                    # Download frame
                    local_path = os.path.join(local_dir, os.path.basename(blob_name))
                    gcs_path = f'gs://{self.bucket_name}/{blob_name}'

                    if self.gcs.download_file(gcs_path, local_path):
                        local_files.append(local_path)

                except Exception as e:
                    logger.warning(f'Failed to download frame {blob_name}: {str(e)}')
                    continue

            logger.info(f'Successfully downloaded {len(local_files)} frames')
            return local_files

        except Exception as e:
            logger.error(f'Error downloading frames: {str(e)}')
            return []

    def _extract_pose_from_frames(self, frame_files: List[str], video_id: str) -> List[Dict]:
        """
        Extract pose from each frame

        Args:
            frame_files: List of frame file paths
            video_id: Video ID for logging

        Returns:
            List of keypoint data for frames with detected athlete
        """
        keypoint_series = []
        skipped_frames = 0

        for frame_index, frame_path in enumerate(frame_files):
            try:
                # Extract pose
                pose_data = self.extractor.extract_pose_from_frame(
                    frame_path,
                    frame_index=frame_index,
                    total_frames=len(frame_files)
                )

                if pose_data is None:
                    skipped_frames += 1
                    continue

                # Check if athlete detected
                if not pose_data.get('athlete_detected', False):
                    skipped_frames += 1
                    logger.debug(f'Athlete not detected in frame {frame_index}')
                    continue

                # Add to series
                keypoint_series.append(pose_data)

            except Exception as e:
                logger.warning(f'Error processing frame {frame_path}: {str(e)}')
                skipped_frames += 1
                continue

        logger.info(f'Pose extraction complete: {len(keypoint_series)} valid, {skipped_frames} skipped')
        return keypoint_series

    def _cleanup_frames(self, local_dir: str) -> None:
        """Clean up local frame files"""
        try:
            if os.path.exists(local_dir):
                shutil.rmtree(local_dir)
                logger.info(f'Cleaned up frame directory: {local_dir}')
        except Exception as e:
            logger.warning(f'Error cleaning up frames: {str(e)}')


# Singleton instance
_processor: Optional[BatchPoseProcessor] = None


def get_batch_processor() -> BatchPoseProcessor:
    """Get or create batch processor singleton"""
    global _processor
    if _processor is None:
        _processor = BatchPoseProcessor()
    return _processor


def process_video_frames(video_id: str, frames_gcs_prefix: str) -> Optional[PoseAnalysisResult]:
    """
    Convenience function to process video frames

    Args:
        video_id: Video identifier
        frames_gcs_prefix: GCS prefix where frames are stored

    Returns:
        PoseAnalysisResult or None if failed
    """
    processor = get_batch_processor()
    return processor.process_video_frames(video_id, frames_gcs_prefix)
