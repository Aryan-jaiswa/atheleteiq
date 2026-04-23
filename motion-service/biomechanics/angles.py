"""
Joint angle calculations using MediaPipe keypoint positions
All angles computed in degrees using vector mathematics
"""

import numpy as np
import logging
from typing import Dict, Optional, List

logger = logging.getLogger(__name__)

# MediaPipe keypoint indices (0-32)
KEYPOINTS = {
    'nose': 0,
    'left_eye_inner': 1, 'left_eye': 2, 'left_eye_outer': 3,
    'right_eye_inner': 4, 'right_eye': 5, 'right_eye_outer': 6,
    'left_ear': 7, 'right_ear': 8,
    'mouth_left': 9, 'mouth_right': 10,
    'left_shoulder': 11, 'right_shoulder': 12,
    'left_elbow': 13, 'right_elbow': 14,
    'left_wrist': 15, 'right_wrist': 16,
    'left_pinky': 17, 'right_pinky': 18,
    'left_index': 19, 'right_index': 20,
    'left_thumb': 21, 'right_thumb': 22,
    'left_hip': 23, 'right_hip': 24,
    'left_knee': 25, 'right_knee': 26,
    'left_ankle': 27, 'right_ankle': 28,
    'left_heel': 29, 'right_heel': 30,
    'left_foot_index': 31, 'right_foot_index': 32,
}


def calculate_angle(point1: np.ndarray, vertex: np.ndarray, point2: np.ndarray) -> float:
    """
    Calculate angle at vertex using three points
    
    Uses dot product formula: cos(angle) = (u·v) / (|u||v|)
    where u = point1 - vertex, v = point2 - vertex
    
    Args:
        point1: First point coordinates [x, y]
        vertex: Vertex point (angle location)
        point2: Second point coordinates [x, y]
    
    Returns:
        Angle in degrees (0-180), or None if invalid
    """
    # Calculate vectors from vertex to each point
    u = point1[:2] - vertex[:2]  # Use only x,y (ignore z)
    v = point2[:2] - vertex[:2]
    
    # Calculate magnitudes
    mag_u = np.linalg.norm(u)
    mag_v = np.linalg.norm(v)
    
    # Handle zero-length vectors (invalid keypoints)
    if mag_u == 0 or mag_v == 0:
        return None
    
    # Clamp dot product to [-1, 1] to avoid numerical errors in arccos
    cos_angle = np.dot(u, v) / (mag_u * mag_v)
    cos_angle = np.clip(cos_angle, -1.0, 1.0)
    
    # Convert radians to degrees
    angle_rad = np.arccos(cos_angle)
    angle_deg = np.degrees(angle_rad)
    
    return angle_deg


def extract_keypoint(keypoints_dict: Dict, keypoint_name: str) -> Optional[np.ndarray]:
    """
    Extract and validate keypoint coordinates
    
    Args:
        keypoints_dict: Dictionary with keypoint names as keys
        keypoint_name: Name of keypoint to extract
    
    Returns:
        Array [x, y, z, visibility] or None if invalid
    """
    if keypoint_name not in keypoints_dict:
        return None
    
    kp = keypoints_dict[keypoint_name]
    
    # Validate structure
    if not isinstance(kp, dict) or 'visibility' not in kp:
        return None
    
    # Check visibility threshold (confidence)
    if kp.get('visibility', 0) < 0.5:
        return None
    
    # Extract coordinates
    x = kp.get('x')
    y = kp.get('y')
    z = kp.get('z', 0)
    
    if x is None or y is None:
        return None
    
    return np.array([x, y, z])


def knee_flexion_angle(keypoints_dict: Dict, side: str = 'left') -> Optional[float]:
    """
    Calculate knee flexion angle (hip-knee-ankle angle)
    Higher angle = more flexion (knee bent more)
    Normal walking: 20-30°, running: 40-60°, jumping: 80-120°
    
    Args:
        keypoints_dict: MediaPipe keypoints
        side: 'left' or 'right'
    
    Returns:
        Angle in degrees or None
    """
    if side == 'left':
        hip = extract_keypoint(keypoints_dict, 'left_hip')
        knee = extract_keypoint(keypoints_dict, 'left_knee')
        ankle = extract_keypoint(keypoints_dict, 'left_ankle')
    else:
        hip = extract_keypoint(keypoints_dict, 'right_hip')
        knee = extract_keypoint(keypoints_dict, 'right_knee')
        ankle = extract_keypoint(keypoints_dict, 'right_ankle')
    
    if hip is None or knee is None or ankle is None:
        return None
    
    return calculate_angle(hip, knee, ankle)


def hip_angle(keypoints_dict: Dict, side: str = 'left') -> Optional[float]:
    """
    Calculate hip angle (shoulder-hip-knee angle)
    Reflects hip extension/flexion
    Normal: 160-180°, squatting: 60-90°
    
    Args:
        keypoints_dict: MediaPipe keypoints
        side: 'left' or 'right'
    
    Returns:
        Angle in degrees or None
    """
    if side == 'left':
        shoulder = extract_keypoint(keypoints_dict, 'left_shoulder')
        hip = extract_keypoint(keypoints_dict, 'left_hip')
        knee = extract_keypoint(keypoints_dict, 'left_knee')
    else:
        shoulder = extract_keypoint(keypoints_dict, 'right_shoulder')
        hip = extract_keypoint(keypoints_dict, 'right_hip')
        knee = extract_keypoint(keypoints_dict, 'right_knee')
    
    if shoulder is None or hip is None or knee is None:
        return None
    
    return calculate_angle(shoulder, hip, knee)


def shoulder_angle(keypoints_dict: Dict, side: str = 'left') -> Optional[float]:
    """
    Calculate shoulder angle (hip-shoulder-elbow angle)
    Reflects shoulder abduction/adduction and arm position
    Normal: 170-180°, raised arm: 90-100°
    
    Args:
        keypoints_dict: MediaPipe keypoints
        side: 'left' or 'right'
    
    Returns:
        Angle in degrees or None
    """
    if side == 'left':
        hip = extract_keypoint(keypoints_dict, 'left_hip')
        shoulder = extract_keypoint(keypoints_dict, 'left_shoulder')
        elbow = extract_keypoint(keypoints_dict, 'left_elbow')
    else:
        hip = extract_keypoint(keypoints_dict, 'right_hip')
        shoulder = extract_keypoint(keypoints_dict, 'right_shoulder')
        elbow = extract_keypoint(keypoints_dict, 'right_elbow')
    
    if hip is None or shoulder is None or elbow is None:
        return None
    
    return calculate_angle(hip, shoulder, elbow)


def elbow_angle(keypoints_dict: Dict, side: str = 'left') -> Optional[float]:
    """
    Calculate elbow angle (shoulder-elbow-wrist angle)
    Reflects arm flexion/extension
    Extended: 170-180°, flexed: 90°, maximum flexion: 30-40°
    
    Args:
        keypoints_dict: MediaPipe keypoints
        side: 'left' or 'right'
    
    Returns:
        Angle in degrees or None
    """
    if side == 'left':
        shoulder = extract_keypoint(keypoints_dict, 'left_shoulder')
        elbow = extract_keypoint(keypoints_dict, 'left_elbow')
        wrist = extract_keypoint(keypoints_dict, 'left_wrist')
    else:
        shoulder = extract_keypoint(keypoints_dict, 'right_shoulder')
        elbow = extract_keypoint(keypoints_dict, 'right_elbow')
        wrist = extract_keypoint(keypoints_dict, 'right_wrist')
    
    if shoulder is None or elbow is None or wrist is None:
        return None
    
    return calculate_angle(shoulder, elbow, wrist)


def trunk_lean_angle(keypoints_dict: Dict) -> Optional[float]:
    """
    Calculate forward lean of torso from vertical
    Uses shoulder and hip midpoints to define vertical reference
    0° = perfectly upright, 30° = significant forward lean
    
    Args:
        keypoints_dict: MediaPipe keypoints
    
    Returns:
        Angle in degrees or None
    """
    left_shoulder = extract_keypoint(keypoints_dict, 'left_shoulder')
    right_shoulder = extract_keypoint(keypoints_dict, 'right_shoulder')
    left_hip = extract_keypoint(keypoints_dict, 'left_hip')
    right_hip = extract_keypoint(keypoints_dict, 'right_hip')
    
    if any(x is None for x in [left_shoulder, right_shoulder, left_hip, right_hip]):
        return None
    
    # Calculate midpoints
    shoulder_mid = (left_shoulder[:2] + right_shoulder[:2]) / 2
    hip_mid = (left_hip[:2] + right_hip[:2]) / 2
    
    # Vector from hip to shoulder (torso orientation)
    torso_vec = shoulder_mid - hip_mid
    
    # Vertical reference (negative y is up in image coordinates)
    vertical = np.array([0, -1])
    
    # Angle from vertical
    mag_torso = np.linalg.norm(torso_vec)
    if mag_torso == 0:
        return None
    
    torso_normalized = torso_vec / mag_torso
    cos_angle = np.dot(torso_normalized, vertical)
    cos_angle = np.clip(cos_angle, -1.0, 1.0)
    
    angle_rad = np.arccos(cos_angle)
    angle_deg = np.degrees(angle_rad)
    
    return angle_deg


def ankle_dorsiflexion_angle(keypoints_dict: Dict, side: str = 'left') -> Optional[float]:
    """
    Calculate ankle dorsiflexion angle (knee-ankle-foot angle)
    Upward bend of ankle: 90° = neutral, 110° = dorsiflexion, 60° = plantarflexion
    
    Args:
        keypoints_dict: MediaPipe keypoints
        side: 'left' or 'right'
    
    Returns:
        Angle in degrees or None
    """
    if side == 'left':
        knee = extract_keypoint(keypoints_dict, 'left_knee')
        ankle = extract_keypoint(keypoints_dict, 'left_ankle')
        foot = extract_keypoint(keypoints_dict, 'left_foot_index')
    else:
        knee = extract_keypoint(keypoints_dict, 'right_knee')
        ankle = extract_keypoint(keypoints_dict, 'right_ankle')
        foot = extract_keypoint(keypoints_dict, 'right_foot_index')
    
    if knee is None or ankle is None or foot is None:
        return None
    
    return calculate_angle(knee, ankle, foot)


def compute_frame_angles(keypoints_dict: Dict) -> Dict[str, Optional[float]]:
    """
    Compute all joint angles for a single frame
    
    Args:
        keypoints_dict: MediaPipe keypoints for one frame
    
    Returns:
        Dictionary with all angle measurements:
        {
            'knee_flexion_left': float,
            'knee_flexion_right': float,
            'hip_angle_left': float,
            'hip_angle_right': float,
            'shoulder_angle_left': float,
            'shoulder_angle_right': float,
            'elbow_angle_left': float,
            'elbow_angle_right': float,
            'trunk_lean': float,
            'ankle_dorsiflexion_left': float,
            'ankle_dorsiflexion_right': float,
        }
    """
    return {
        'knee_flexion_left': knee_flexion_angle(keypoints_dict, 'left'),
        'knee_flexion_right': knee_flexion_angle(keypoints_dict, 'right'),
        'hip_angle_left': hip_angle(keypoints_dict, 'left'),
        'hip_angle_right': hip_angle(keypoints_dict, 'right'),
        'shoulder_angle_left': shoulder_angle(keypoints_dict, 'left'),
        'shoulder_angle_right': shoulder_angle(keypoints_dict, 'right'),
        'elbow_angle_left': elbow_angle(keypoints_dict, 'left'),
        'elbow_angle_right': elbow_angle(keypoints_dict, 'right'),
        'trunk_lean': trunk_lean_angle(keypoints_dict),
        'ankle_dorsiflexion_left': ankle_dorsiflexion_angle(keypoints_dict, 'left'),
        'ankle_dorsiflexion_right': ankle_dorsiflexion_angle(keypoints_dict, 'right'),
    }


def aggregate_angles(frame_angles_list: List[Dict[str, Optional[float]]]) -> Dict[str, Dict[str, Optional[float]]]:
    """
    Aggregate joint angles across all frames
    Calculate min, max, mean, and std deviation for each angle
    
    Args:
        frame_angles_list: List of angle dictionaries from each frame
    
    Returns:
        Aggregated statistics:
        {
            'knee_flexion_left': {'min': float, 'max': float, 'mean': float, 'std': float},
            ...
        }
    """
    # Extract all angle names from first frame
    angle_names = list(frame_angles_list[0].keys()) if frame_angles_list else []
    
    aggregated = {}
    
    for angle_name in angle_names:
        # Collect all values for this angle, filtering out None
        values = []
        for frame in frame_angles_list:
            val = frame.get(angle_name)
            if val is not None:
                values.append(val)
        
        if len(values) == 0:
            # No valid data for this angle
            aggregated[angle_name] = {
                'min': None,
                'max': None,
                'mean': None,
                'std': None,
                'valid_frames': 0,
            }
        else:
            # Calculate statistics
            values_array = np.array(values)
            aggregated[angle_name] = {
                'min': float(np.min(values_array)),
                'max': float(np.max(values_array)),
                'mean': float(np.mean(values_array)),
                'std': float(np.std(values_array)),
                'valid_frames': len(values),
            }
    
    return aggregated
