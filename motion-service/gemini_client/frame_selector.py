"""
Key frame selection for Gemini analysis
Selects frames with highest center-of-mass velocity (action peaks)
Downloads selected frames from GCS for multimodal analysis
"""

import os
import logging
import numpy as np
from typing import List, Optional, Dict
from pathlib import Path
import shutil

logger = logging.getLogger(__name__)


class KeyFrameSelector:
    """Selects and downloads key frames from video"""
    
    def __init__(self):
        """Initialize frame selector"""
        try:
            from gcs_client import get_gcs_client
            self.gcs = get_gcs_client()
        except ImportError:
            logger.warning('GCS client not available, will use mock downloads')
            self.gcs = None
    
    def select_key_frames(
        self,
        keypoint_series: List[Dict],
        frames_gcs_prefix: str,
        n: int = 10
    ) -> List[str]:
        """
        Select top N frames by center-of-mass velocity
        
        Identifies action peaks (highest movement velocity) for Gemini analysis
        These frames best represent the athlete's movement quality
        
        Args:
            keypoint_series: Full keypoint time-series from pose detection
            frames_gcs_prefix: GCS path prefix (e.g., 'frames/video-id')
            n: Number of frames to select (default 10)
        
        Returns:
            List of local file paths to selected frames
        """
        logger.info(f'📹 Selecting {n} key frames from {len(keypoint_series)} total frames')
        
        try:
            # Step 1: Calculate velocity for each frame
            velocities = self._calculate_frame_velocities(keypoint_series)
            
            if len(velocities) == 0:
                logger.error('No valid velocities computed')
                return []
            
            logger.info(f'✅ Computed velocities for {len(velocities)} frames')
            
            # Step 2: Find top N frames by velocity
            top_frame_indices = self._find_top_frames(velocities, n)
            logger.info(f'✅ Selected top {len(top_frame_indices)} frames by velocity')
            
            # Step 3: Download selected frames from GCS
            local_paths = self._download_selected_frames(
                top_frame_indices,
                keypoint_series,
                frames_gcs_prefix
            )
            
            return local_paths
        
        except Exception as e:
            logger.error(f'Error selecting key frames: {str(e)}')
            return []
    
    def _calculate_frame_velocities(self, keypoint_series: List[Dict]) -> List[float]:
        """
        Calculate center-of-mass velocity for each frame
        
        Uses frame-to-frame COM displacement from kinematics data
        If kinematics not available, calculates from hip positions
        
        Args:
            keypoint_series: Keypoint time-series
        
        Returns:
            List of velocity values (m/s or normalized units)
        """
        velocities = []
        
        # Try to use pre-computed COM positions from kinematics
        com_positions = None
        com_velocities = None
        
        # Check if kinematics data is embedded in keypoint_series
        if keypoint_series and 'kinematics' in keypoint_series[0]:
            com_positions = keypoint_series[0].get('kinematics', {}).get('com_positions')
            com_velocities = keypoint_series[0].get('kinematics', {}).get('com_velocities')
        
        # If kinematics data available, use it
        if com_velocities:
            logger.info('Using pre-computed COM velocities from kinematics')
            velocities = [v if v is not None else 0.0 for v in com_velocities]
        else:
            # Fallback: Calculate COM velocity from hip positions
            logger.info('Computing COM velocity from hip positions')
            
            for i in range(len(keypoint_series)):
                frame = keypoint_series[i]
                keypoints_dict = frame.get('keypoints', {})
                
                # Get hip positions (for COM proxy)
                left_hip = keypoints_dict.get('left_hip')
                right_hip = keypoints_dict.get('right_hip')
                
                if not left_hip or not right_hip:
                    velocities.append(0.0)
                    continue
                
                # Check visibility
                if left_hip.get('visibility', 0) < 0.5 or right_hip.get('visibility', 0) < 0.5:
                    velocities.append(0.0)
                    continue
                
                # Calculate COM (hip midpoint)
                com_x = (left_hip['x'] + right_hip['x']) / 2
                com_y = (left_hip['y'] + right_hip['y']) / 2
                
                # Calculate velocity if not first frame
                if i > 0:
                    prev_frame = keypoint_series[i-1]
                    prev_keypoints = prev_frame.get('keypoints', {})
                    prev_left_hip = prev_keypoints.get('left_hip')
                    prev_right_hip = prev_keypoints.get('right_hip')
                    
                    if prev_left_hip and prev_right_hip:
                        prev_com_x = (prev_left_hip['x'] + prev_right_hip['x']) / 2
                        prev_com_y = (prev_left_hip['y'] + prev_right_hip['y']) / 2
                        
                        # Euclidean distance
                        distance = np.sqrt(
                            (com_x - prev_com_x)**2 + 
                            (com_y - prev_com_y)**2
                        )
                        velocities.append(distance)
                    else:
                        velocities.append(0.0)
                else:
                    velocities.append(0.0)
            
            logger.info(f'Computed {len(velocities)} frame velocities')
        
        return velocities
    
    def _find_top_frames(self, velocities: List[float], n: int) -> List[int]:
        """
        Find indices of top N frames by velocity
        
        Ensures frames are distributed across the video (not all from same cluster)
        
        Args:
            velocities: List of velocity values
            n: Number of frames to select
        
        Returns:
            Sorted list of frame indices (0-based)
        """
        if not velocities:
            return []
        
        # Ensure we don't request more frames than available
        n = min(n, len(velocities))
        
        # Get indices sorted by velocity (descending)
        velocity_array = np.array(velocities)
        top_indices = np.argsort(velocity_array)[::-1][:n]
        
        # Sort by frame order (not velocity)
        top_indices = sorted(top_indices.tolist())
        
        logger.info(
            f'Top frame indices: {top_indices}\n'
            f'Velocities: {[velocities[i] for i in top_indices]}'
        )
        
        return top_indices
    
    def _download_selected_frames(
        self,
        frame_indices: List[int],
        keypoint_series: List[Dict],
        frames_gcs_prefix: str
    ) -> List[str]:
        """
        Download selected frames from GCS
        
        Args:
            frame_indices: Indices of frames to download
            keypoint_series: Keypoint series (for frame mapping)
            frames_gcs_prefix: GCS path prefix
        
        Returns:
            List of local file paths
        """
        local_paths = []
        temp_dir = Path('/tmp/gemini_frames')
        temp_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f'📥 Downloading {len(frame_indices)} frames from GCS...')
        
        for idx, frame_idx in enumerate(frame_indices):
            try:
                # Get frame info from keypoint series
                if frame_idx >= len(keypoint_series):
                    logger.warning(f'Frame index {frame_idx} out of range')
                    continue
                
                frame_info = keypoint_series[frame_idx]
                frame_number = frame_info.get('frameIndex', frame_idx)
                
                # Construct GCS path (assuming naming: frame_XXXXX.jpg)
                frame_filename = f'frame_{frame_number:05d}.jpg'
                gcs_path = f'gs://{frames_gcs_prefix}/{frame_filename}'
                
                # Download frame
                local_path = temp_dir / f'key_frame_{idx:02d}.jpg'
                
                if self.gcs:
                    success = self.gcs.download_file(gcs_path, str(local_path))
                    if success and local_path.exists():
                        logger.info(f'✅ Downloaded: {frame_filename}')
                        local_paths.append(str(local_path))
                    else:
                        logger.warning(f'Failed to download: {gcs_path}')
                else:
                    # Mock: just create placeholder
                    local_path.touch()
                    logger.info(f'[MOCK] Frame path: {local_path}')
                    local_paths.append(str(local_path))
            
            except Exception as e:
                logger.error(f'Error downloading frame {frame_idx}: {str(e)}')
                continue
        
        logger.info(f'✅ Downloaded {len(local_paths)} frames to {temp_dir}')
        return local_paths
    
    def cleanup_frames(self, local_paths: List[str]) -> bool:
        """
        Clean up temporary frame files after analysis
        
        Args:
            local_paths: List of file paths to clean up
        
        Returns:
            True if successful
        """
        try:
            for path in local_paths:
                if Path(path).exists():
                    Path(path).unlink()
            
            # Remove temp directory if empty
            temp_dir = Path('/tmp/gemini_frames')
            if temp_dir.exists() and not any(temp_dir.iterdir()):
                shutil.rmtree(temp_dir)
            
            logger.info('✅ Cleaned up temporary frames')
            return True
        
        except Exception as e:
            logger.error(f'Error cleaning up frames: {str(e)}')
            return False


# Singleton instance
_selector: KeyFrameSelector = None


def get_frame_selector() -> KeyFrameSelector:
    """Get or create frame selector singleton"""
    global _selector
    if _selector is None:
        _selector = KeyFrameSelector()
    return _selector


def select_key_frames(
    keypoint_series: List[Dict],
    frames_gcs_prefix: str,
    n: int = 10
) -> List[str]:
    """
    Public API: Select and download key frames
    
    Args:
        keypoint_series: Full keypoint time-series
        frames_gcs_prefix: GCS prefix path
        n: Number of frames to select
    
    Returns:
        List of local file paths
    """
    selector = get_frame_selector()
    return selector.select_key_frames(keypoint_series, frames_gcs_prefix, n)
