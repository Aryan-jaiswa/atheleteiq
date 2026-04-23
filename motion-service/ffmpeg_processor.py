"""
FFmpeg processor for video frame extraction
Extracts 1 frame per second from video
"""

import subprocess
import os
import logging
from pathlib import Path
from typing import Optional, Tuple

logger = logging.getLogger(__name__)


class FFmpegProcessor:
    """Handles video processing with FFmpeg"""

    def __init__(self):
        """Initialize FFmpeg processor"""
        self.temp_dir = '/tmp/athleteiq_video_processing'
        self._ensure_temp_dir()
        self._check_ffmpeg()

    def _ensure_temp_dir(self) -> None:
        """Ensure temp directory exists"""
        Path(self.temp_dir).mkdir(parents=True, exist_ok=True)
        logger.info(f'Temp directory ready: {self.temp_dir}')

    def _check_ffmpeg(self) -> bool:
        """Check if FFmpeg is installed"""
        try:
            result = subprocess.run(
                ['ffmpeg', '-version'],
                capture_output=True,
                timeout=5
            )
            if result.returncode == 0:
                logger.info('✅ FFmpeg is installed and available')
                return True
        except Exception as e:
            logger.error(f'❌ FFmpeg not found: {str(e)}')
            return False

    def extract_frames(
        self,
        video_path: str,
        output_dir: str,
        fps: float = 1.0,
        frame_format: str = 'frame_%04d.jpg'
    ) -> Tuple[bool, Optional[int]]:
        """
        Extract frames from video at specified fps

        Args:
            video_path: Path to input video file
            output_dir: Directory to save frames
            fps: Frames per second to extract (default 1.0 = 1 frame per second)
            frame_format: Output frame filename format

        Returns:
            Tuple of (success: bool, frame_count: Optional[int])
        """
        try:
            if not os.path.exists(video_path):
                raise FileNotFoundError(f'Video file not found: {video_path}')

            # Create output directory
            Path(output_dir).mkdir(parents=True, exist_ok=True)

            output_pattern = os.path.join(output_dir, frame_format)

            logger.info(f'Extracting frames from video: {video_path}')
            logger.info(f'FPS: {fps}, Output pattern: {output_pattern}')

            # Run FFmpeg to extract frames
            cmd = [
                'ffmpeg',
                '-i', video_path,
                '-vf', f'fps={fps}',
                '-q:v', '3',  # Quality (3 is good for JPG)
                output_pattern,
                '-y'  # Overwrite output files
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=600  # 10 minute timeout
            )

            if result.returncode != 0:
                error_msg = result.stderr or 'Unknown error'
                raise RuntimeError(f'FFmpeg failed: {error_msg}')

            # Count extracted frames
            frame_files = [f for f in os.listdir(output_dir) if f.endswith('.jpg')]
            frame_count = len(frame_files)

            if frame_count == 0:
                raise RuntimeError('No frames were extracted')

            logger.info(f'✅ Successfully extracted {frame_count} frames')
            return True, frame_count

        except FileNotFoundError as e:
            logger.error(f'❌ File not found: {str(e)}')
            return False, None
        except subprocess.TimeoutExpired:
            logger.error('❌ FFmpeg extraction timed out')
            return False, None
        except Exception as e:
            logger.error(f'❌ Frame extraction error: {str(e)}')
            return False, None

    def get_video_duration(self, video_path: str) -> Optional[float]:
        """
        Get video duration in seconds using FFprobe

        Args:
            video_path: Path to video file

        Returns:
            Duration in seconds, or None if error
        """
        try:
            if not os.path.exists(video_path):
                return None

            cmd = [
                'ffprobe',
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1:noprint_names=1',
                video_path
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30
            )

            if result.returncode == 0:
                duration = float(result.stdout.strip())
                logger.info(f'Video duration: {duration:.2f} seconds')
                return duration
            else:
                return None

        except Exception as e:
            logger.error(f'Failed to get video duration: {str(e)}')
            return None

    def get_video_info(self, video_path: str) -> Optional[dict]:
        """
        Get video information (codec, resolution, etc.)

        Args:
            video_path: Path to video file

        Returns:
            Dictionary with video info, or None if error
        """
        try:
            if not os.path.exists(video_path):
                return None

            cmd = [
                'ffprobe',
                '-v', 'error',
                '-select_streams', 'v:0',
                '-show_entries', 'stream=width,height,r_frame_rate,codec_name',
                '-of', 'csv=p=0',
                video_path
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30
            )

            if result.returncode == 0 and result.stdout:
                parts = result.stdout.strip().split(',')
                return {
                    'width': int(parts[0]) if len(parts) > 0 else None,
                    'height': int(parts[1]) if len(parts) > 1 else None,
                    'frame_rate': parts[2] if len(parts) > 2 else None,
                    'codec': parts[3] if len(parts) > 3 else None,
                }
            return None

        except Exception as e:
            logger.error(f'Failed to get video info: {str(e)}')
            return None

    def cleanup_frames(self, output_dir: str) -> bool:
        """
        Clean up extracted frames from local storage

        Args:
            output_dir: Directory containing frames

        Returns:
            True if successful, False otherwise
        """
        try:
            if not os.path.exists(output_dir):
                return True

            for filename in os.listdir(output_dir):
                if filename.endswith('.jpg'):
                    filepath = os.path.join(output_dir, filename)
                    os.remove(filepath)

            logger.info(f'✅ Cleaned up frames directory: {output_dir}')
            return True

        except Exception as e:
            logger.error(f'❌ Failed to cleanup frames: {str(e)}')
            return False


# Singleton instance
_ffmpeg_processor: Optional[FFmpegProcessor] = None


def get_ffmpeg_processor() -> FFmpegProcessor:
    """Get or create FFmpeg processor singleton"""
    global _ffmpeg_processor
    if _ffmpeg_processor is None:
        _ffmpeg_processor = FFmpegProcessor()
    return _ffmpeg_processor
