"""
Pose detection engine for AthleteIQ
MediaPipe-based pose extraction with keypoint time-series analysis
"""

from pose_engine.extractor import (
    PoseExtractor,
    get_pose_extractor,
    extract_pose_from_frame,
    KEYPOINT_NAMES
)

from pose_engine.batch_processor import (
    BatchPoseProcessor,
    PoseAnalysisResult,
    get_batch_processor,
    process_video_frames
)

from pose_engine.validator import (
    KeypointValidator,
    ValidationResult,
    validate_keypoint_series,
    get_series_stats
)

__all__ = [
    'PoseExtractor',
    'get_pose_extractor',
    'extract_pose_from_frame',
    'KEYPOINT_NAMES',
    'BatchPoseProcessor',
    'PoseAnalysisResult',
    'get_batch_processor',
    'process_video_frames',
    'KeypointValidator',
    'ValidationResult',
    'validate_keypoint_series',
    'get_series_stats'
]
