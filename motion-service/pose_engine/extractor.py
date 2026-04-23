"""
Pose extraction from video frames using MediaPipe
Detects 33 body keypoints per frame with confidence scores
"""

import os
import logging
import cv2
import mediapipe as mp
import numpy as np
from typing import Dict, List, Optional, Tuple
from pathlib import Path

logger = logging.getLogger(__name__)

# MediaPipe Pose keypoint names (33 total)
KEYPOINT_NAMES = [
    'nose', 'left_eye_inner', 'left_eye', 'left_eye_outer',
    'right_eye_inner', 'right_eye', 'right_eye_outer',
    'left_ear', 'right_ear',
    'mouth_left', 'mouth_right',
    'left_shoulder', 'right_shoulder',
    'left_elbow', 'right_elbow',
    'left_wrist', 'right_wrist',
    'left_pinky', 'right_pinky',
    'left_index', 'right_index',
    'left_thumb', 'right_thumb',
    'left_hip', 'right_hip',
    'left_knee', 'right_knee',
    'left_ankle', 'right_ankle',
    'left_heel', 'right_heel',
    'left_foot_index', 'right_foot_index'
]

# Key joints for athlete detection (must be visible)
KEY_JOINTS = ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip', 'left_knee', 'right_knee']
KEY_JOINT_INDICES = [11, 12, 23, 24, 25, 26]


class PoseExtractor:
    """Extracts pose keypoints from video frames using MediaPipe"""

    def __init__(self, min_detection_confidence: float = 0.7, min_tracking_confidence: float = 0.5):
        """
        Initialize MediaPipe Pose detector

        Args:
            min_detection_confidence: Minimum confidence for pose detection
            min_tracking_confidence: Minimum confidence for pose tracking
        """
        self.min_detection_confidence = min_detection_confidence
        self.min_tracking_confidence = min_tracking_confidence

        # Initialize MediaPipe Pose
        self.mp_pose = mp.solutions.pose
        self.pose = self.mp_pose.Pose(
            static_image_mode=True,
            model_complexity=1,
            smooth_landmarks=False,
            min_detection_confidence=min_detection_confidence,
            min_tracking_confidence=min_tracking_confidence
        )

        logger.info(f'✅ PoseExtractor initialized (confidence={min_detection_confidence})')

    def extract_pose_from_frame(self, image_path: str, frame_index: int = 0, total_frames: int = 1) -> Optional[Dict]:
        """
        Extract pose keypoints from a single frame image

        Args:
            image_path: Path to frame image file
            frame_index: Frame number (for timestamp calculation)
            total_frames: Total frames in video (for progress estimation)

        Returns:
            {
                'videoId': str,
                'frameIndex': int,
                'frameTimestampMs': int,
                'athlete_detected': bool,
                'keypoints': {
                    'nose': {'x': float, 'y': float, 'z': float, 'visibility': float},
                    'left_shoulder': {...},
                    ... (33 total)
                },
                'bounding_box': {'xMin': float, 'yMin': float, 'xMax': float, 'yMax': float},
                'body_orientation': {
                    'shoulder_angle': float (degrees),
                    'hip_angle': float (degrees)
                }
            }
            Or None if image cannot be loaded
        """
        try:
            # Read image
            if not os.path.exists(image_path):
                logger.error(f'Frame file not found: {image_path}')
                return None

            image = cv2.imread(image_path)
            if image is None:
                logger.error(f'Failed to read frame: {image_path}')
                return None

            # Convert BGR to RGB
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            height, width, _ = image.shape

            # Run pose detection
            results = self.pose.process(image_rgb)

            # Extract keypoints
            keypoints = {}
            if results.pose_landmarks:
                for idx, landmark in enumerate(results.pose_landmarks.landmark):
                    keypoint_name = KEYPOINT_NAMES[idx]
                    keypoints[keypoint_name] = {
                        'x': float(landmark.x),
                        'y': float(landmark.y),
                        'z': float(landmark.z),
                        'visibility': float(landmark.visibility)
                    }
            else:
                # No pose detected
                logger.debug(f'No pose detected in frame: {image_path}')
                return None

            # Check if athlete is in frame (key joints visible)
            athlete_detected = self._check_athlete_detected(keypoints)

            # Calculate bounding box
            bounding_box = self._calculate_bounding_box(keypoints, width, height)

            # Calculate body orientation
            body_orientation = self._calculate_body_orientation(keypoints)

            # Estimate timestamp (assuming 1 fps = 1 second per frame)
            frame_timestamp_ms = int(frame_index * 1000)

            return {
                'frameIndex': frame_index,
                'frameTimestampMs': frame_timestamp_ms,
                'athlete_detected': athlete_detected,
                'keypoints': keypoints,
                'bounding_box': bounding_box,
                'body_orientation': body_orientation
            }

        except Exception as e:
            logger.error(f'Error extracting pose from {image_path}: {str(e)}')
            return None

    def _check_athlete_detected(self, keypoints: Dict) -> bool:
        """
        Check if athlete is detected based on key joint visibility

        Args:
            keypoints: Dictionary of keypoint data

        Returns:
            True if enough key joints are visible
        """
        if not keypoints:
            return False

        visible_key_joints = 0
        visibility_threshold = 0.5

        for joint_name in KEY_JOINTS:
            if joint_name in keypoints:
                visibility = keypoints[joint_name].get('visibility', 0)
                if visibility > visibility_threshold:
                    visible_key_joints += 1

        # Require at least 4 out of 6 key joints visible
        return visible_key_joints >= 4

    def _calculate_bounding_box(self, keypoints: Dict, frame_width: int, frame_height: int) -> Dict:
        """
        Calculate bounding box around detected pose

        Args:
            keypoints: Dictionary of keypoint data
            frame_width: Frame width in pixels
            frame_height: Frame height in pixels

        Returns:
            {'xMin': float, 'yMin': float, 'xMax': float, 'yMax': float}
        """
        if not keypoints:
            return {'xMin': 0.0, 'yMin': 0.0, 'xMax': 1.0, 'yMax': 1.0}

        x_coords = []
        y_coords = []

        for keypoint in keypoints.values():
            if keypoint.get('visibility', 0) > 0.5:
                x_coords.append(keypoint.get('x', 0))
                y_coords.append(keypoint.get('y', 0))

        if not x_coords or not y_coords:
            return {'xMin': 0.0, 'yMin': 0.0, 'xMax': 1.0, 'yMax': 1.0}

        # Add 10% padding
        x_min, x_max = min(x_coords), max(x_coords)
        y_min, y_max = min(y_coords), max(y_coords)

        x_padding = (x_max - x_min) * 0.1
        y_padding = (y_max - y_min) * 0.1

        return {
            'xMin': max(0.0, x_min - x_padding),
            'yMin': max(0.0, y_min - y_padding),
            'xMax': min(1.0, x_max + x_padding),
            'yMax': min(1.0, y_max + y_padding)
        }

    def _calculate_body_orientation(self, keypoints: Dict) -> Dict:
        """
        Calculate body orientation angles from keypoints

        Args:
            keypoints: Dictionary of keypoint data

        Returns:
            {'shoulder_angle': float, 'hip_angle': float} in degrees
        """
        shoulder_angle = 0.0
        hip_angle = 0.0

        try:
            # Calculate shoulder angle (using shoulder-to-hip vector)
            left_shoulder = keypoints.get('left_shoulder', {})
            right_shoulder = keypoints.get('right_shoulder', {})
            left_hip = keypoints.get('left_hip', {})
            right_hip = keypoints.get('right_hip', {})

            if all([
                left_shoulder.get('visibility', 0) > 0.5,
                right_shoulder.get('visibility', 0) > 0.5,
                left_hip.get('visibility', 0) > 0.5,
                right_hip.get('visibility', 0) > 0.5
            ]):
                # Vector from left shoulder to right shoulder
                shoulder_vector = (
                    right_shoulder.get('x', 0) - left_shoulder.get('x', 0),
                    right_shoulder.get('y', 0) - left_shoulder.get('y', 0)
                )
                # Vector from left hip to right hip
                hip_vector = (
                    right_hip.get('x', 0) - left_hip.get('x', 0),
                    right_hip.get('y', 0) - left_hip.get('y', 0)
                )

                # Calculate angles
                shoulder_angle = np.arctan2(shoulder_vector[1], shoulder_vector[0]) * 180 / np.pi
                hip_angle = np.arctan2(hip_vector[1], hip_vector[0]) * 180 / np.pi

        except Exception as e:
            logger.debug(f'Could not calculate body orientation: {str(e)}')

        return {
            'shoulder_angle': float(shoulder_angle),
            'hip_angle': float(hip_angle)
        }

    def close(self):
        """Clean up resources"""
        if self.pose:
            self.pose.close()
            logger.info('PoseExtractor closed')


# Singleton instance
_extractor: Optional[PoseExtractor] = None


def get_pose_extractor(min_detection_confidence: float = 0.7) -> PoseExtractor:
    """Get or create pose extractor singleton"""
    global _extractor
    if _extractor is None:
        _extractor = PoseExtractor(min_detection_confidence=min_detection_confidence)
    return _extractor


def extract_pose_from_frame(image_path: str, frame_index: int = 0, total_frames: int = 1) -> Optional[Dict]:
    """
    Convenience function to extract pose from frame

    Args:
        image_path: Path to frame image
        frame_index: Frame number
        total_frames: Total frames in video

    Returns:
        Pose data or None if extraction failed
    """
    extractor = get_pose_extractor()
    return extractor.extract_pose_from_frame(image_path, frame_index, total_frames)
