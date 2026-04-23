"""
AthleteIQ Motion Service
Frame extraction and job queue processing for video analysis pipeline
"""

__version__ = "1.0.0"
__author__ = "AthleteIQ"
__description__ = "Motion analysis worker service for AthleteIQ"

# Export main components
from gcs_client import get_gcs_client, GCSClient
from ffmpeg_processor import get_ffmpeg_processor, FFmpegProcessor
from jobs.process_video import get_video_processor, process_video_job
from worker import VideoWorker

__all__ = [
    "get_gcs_client",
    "GCSClient",
    "get_ffmpeg_processor",
    "FFmpegProcessor",
    "get_video_processor",
    "process_video_job",
    "VideoWorker",
]
