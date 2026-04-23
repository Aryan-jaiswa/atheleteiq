"""
Velocity and acceleration calculations from keypoint time-series
Includes pixel-to-meter conversion and movement analysis
"""

import numpy as np
import logging
from typing import Dict, List, Tuple, Optional

logger = logging.getLogger(__name__)


class PixelToMeterConverter:
    """
    Convert pixel distances to approximate real-world meters
    Uses known body segment proportions to estimate actual distances
    """
    
    # Average human body proportions (fraction of body height)
    # Used to estimate scale from keypoint coordinates
    BODY_SEGMENT_PROPORTIONS = {
        'shoulder_width': 0.22,      # Shoulder width ~22% of height
        'arm_length': 0.40,          # Arm length ~40% of height
        'leg_length': 0.50,          # Leg length ~50% of height
        'torso_length': 0.30,        # Torso ~30% of height
    }
    
    @staticmethod
    def estimate_body_height(keypoints_series: List[Dict]) -> float:
        """
        Estimate body height from shoulder-to-ankle distance
        Takes median across frames for robustness
        
        Args:
            keypoints_series: List of keypoint dictionaries
        
        Returns:
            Estimated body height in pixels
        """
        heights = []
        
        for frame in keypoints_series:
            keypoints = frame.get('keypoints', {})
            
            # Get shoulder and ankle positions
            left_shoulder = keypoints.get('left_shoulder')
            left_ankle = keypoints.get('left_ankle')
            
            if left_shoulder and left_ankle:
                visibility_s = left_shoulder.get('visibility', 0)
                visibility_a = left_ankle.get('visibility', 0)
                
                if visibility_s > 0.5 and visibility_a > 0.5:
                    height = np.sqrt(
                        (left_shoulder['x'] - left_ankle['x'])**2 +
                        (left_shoulder['y'] - left_ankle['y'])**2
                    )
                    if height > 0:
                        heights.append(height)
        
        if heights:
            return float(np.median(heights))
        return 1.0  # Fallback
    
    @staticmethod
    def estimate_pixels_per_meter(body_height_pixels: float) -> float:
        """
        Convert from pixels to meters using estimated body height
        Average human body height: 1.7 meters
        
        Args:
            body_height_pixels: Estimated body height in pixels
        
        Returns:
            Pixels per meter conversion factor
        """
        average_human_height = 1.7  # meters
        if body_height_pixels <= 0:
            return 1.0
        return body_height_pixels / average_human_height


def calculate_center_of_mass(keypoints_dict: Dict) -> Optional[np.ndarray]:
    """
    Calculate center of mass (COM) from hip midpoint
    COM typically located at hip level for standing/moving humans
    
    Args:
        keypoints_dict: MediaPipe keypoints
    
    Returns:
        Array [x, y] of COM position or None
    """
    left_hip = keypoints_dict.get('left_hip')
    right_hip = keypoints_dict.get('right_hip')
    
    if not left_hip or not right_hip:
        return None
    
    if left_hip.get('visibility', 0) < 0.5 or right_hip.get('visibility', 0) < 0.5:
        return None
    
    # COM at midpoint of hips
    com_x = (left_hip['x'] + right_hip['x']) / 2
    com_y = (left_hip['y'] + right_hip['y']) / 2
    
    return np.array([com_x, com_y])


def calculate_velocity(
    position1: np.ndarray,
    position2: np.ndarray,
    time_delta_seconds: float,
    pixels_per_meter: float = 1.0
) -> Optional[float]:
    """
    Calculate velocity between two positions
    
    Args:
        position1: Start position [x, y] in pixels
        position2: End position [x, y] in pixels
        time_delta_seconds: Time between positions in seconds
        pixels_per_meter: Conversion factor (pixels per meter)
    
    Returns:
        Velocity in meters/second or None
    """
    if time_delta_seconds <= 0:
        return None
    
    # Distance in pixels
    distance_pixels = np.linalg.norm(position2 - position1)
    
    # Convert to meters
    distance_meters = distance_pixels / pixels_per_meter if pixels_per_meter > 0 else 0
    
    # Velocity in m/s
    velocity = distance_meters / time_delta_seconds
    
    return velocity if velocity >= 0 else None


def calculate_acceleration(
    velocity1: float,
    velocity2: float,
    time_delta_seconds: float
) -> Optional[float]:
    """
    Calculate acceleration between two velocities
    
    Args:
        velocity1: Initial velocity (m/s)
        velocity2: Final velocity (m/s)
        time_delta_seconds: Time between measurements
    
    Returns:
        Acceleration in m/s² or None
    """
    if time_delta_seconds <= 0:
        return None
    
    acceleration = (velocity2 - velocity1) / time_delta_seconds
    return acceleration


def compute_com_kinematics(
    keypoints_series: List[Dict],
    frame_timestamps_ms: List[int]
) -> Dict:
    """
    Compute center of mass velocity and acceleration across time
    
    Args:
        keypoints_series: List of keypoint frames
        frame_timestamps_ms: Timestamps for each frame in milliseconds
    
    Returns:
        Kinematics dictionary:
        {
            'com_positions': [...],           # COM x,y for each frame
            'com_velocities': [...],          # Velocity for each frame
            'com_accelerations': [...],       # Acceleration for each frame
            'avg_velocity': float,            # Average velocity m/s
            'peak_velocity': float,           # Maximum velocity m/s
            'avg_acceleration': float,        # Average acceleration m/s²
            'peak_acceleration': float,       # Max acceleration magnitude m/s²
            'peak_deceleration': float,       # Max deceleration magnitude m/s²
        }
    """
    # Estimate body height and conversion factor
    body_height_pixels = PixelToMeterConverter.estimate_body_height(keypoints_series)
    pixels_per_meter = PixelToMeterConverter.estimate_pixels_per_meter(body_height_pixels)
    
    com_positions = []
    com_velocities = []
    com_accelerations = []
    
    # Extract COM positions
    for frame in keypoints_series:
        keypoints_dict = frame.get('keypoints', {})
        com = calculate_center_of_mass(keypoints_dict)
        if com is not None:
            com_positions.append(com)
        else:
            com_positions.append(None)
    
    # Calculate velocities
    for i in range(1, len(com_positions)):
        if com_positions[i-1] is None or com_positions[i] is None:
            com_velocities.append(None)
            continue
        
        # Time delta in seconds
        time_delta = (frame_timestamps_ms[i] - frame_timestamps_ms[i-1]) / 1000.0
        
        velocity = calculate_velocity(
            com_positions[i-1],
            com_positions[i],
            time_delta,
            pixels_per_meter
        )
        com_velocities.append(velocity)
    
    # Calculate accelerations
    for i in range(1, len(com_velocities)):
        if com_velocities[i-1] is None or com_velocities[i] is None:
            com_accelerations.append(None)
            continue
        
        time_delta = (frame_timestamps_ms[i] - frame_timestamps_ms[i-1]) / 1000.0
        
        acceleration = calculate_acceleration(
            com_velocities[i-1],
            com_velocities[i],
            time_delta
        )
        com_accelerations.append(acceleration)
    
    # Filter out None values for statistics
    valid_velocities = [v for v in com_velocities if v is not None]
    valid_accelerations = [a for a in com_accelerations if a is not None]
    
    # Calculate statistics
    avg_velocity = float(np.mean(valid_velocities)) if valid_velocities else 0
    peak_velocity = float(np.max(valid_velocities)) if valid_velocities else 0
    
    avg_acceleration = float(np.mean(valid_accelerations)) if valid_accelerations else 0
    
    # Peak acceleration and deceleration
    if valid_accelerations:
        accelerations_array = np.array(valid_accelerations)
        peak_acceleration = float(np.max(accelerations_array))
        peak_deceleration = float(np.min(accelerations_array))  # Most negative = max decel
    else:
        peak_acceleration = 0
        peak_deceleration = 0
    
    return {
        'com_positions': com_positions,
        'com_velocities': com_velocities,
        'com_accelerations': com_accelerations,
        'avg_velocity': avg_velocity,
        'peak_velocity': peak_velocity,
        'avg_acceleration': avg_acceleration,
        'peak_acceleration': peak_acceleration,
        'peak_deceleration': peak_deceleration,
        'pixels_per_meter': pixels_per_meter,
        'body_height_pixels': body_height_pixels,
    }


def compute_limb_velocity(
    keypoints_series: List[Dict],
    frame_timestamps_ms: List[int],
    limb_side: str = 'left',
    joint: str = 'wrist'
) -> Dict:
    """
    Compute velocity of a specific limb joint (e.g., arm swing velocity)
    
    Args:
        keypoints_series: List of keypoint frames
        frame_timestamps_ms: Timestamps in milliseconds
        limb_side: 'left' or 'right'
        joint: 'wrist', 'elbow', 'ankle', etc.
    
    Returns:
        Limb kinematics dictionary
    """
    keypoint_name = f'{limb_side}_{joint}'
    
    # Estimate conversion factor
    body_height_pixels = PixelToMeterConverter.estimate_body_height(keypoints_series)
    pixels_per_meter = PixelToMeterConverter.estimate_pixels_per_meter(body_height_pixels)
    
    positions = []
    velocities = []
    
    # Extract joint positions
    for frame in keypoints_series:
        keypoints_dict = frame.get('keypoints', {})
        joint_data = keypoints_dict.get(keypoint_name)
        
        if joint_data and joint_data.get('visibility', 0) > 0.5:
            pos = np.array([joint_data['x'], joint_data['y']])
            positions.append(pos)
        else:
            positions.append(None)
    
    # Calculate velocities
    for i in range(1, len(positions)):
        if positions[i-1] is None or positions[i] is None:
            velocities.append(None)
            continue
        
        time_delta = (frame_timestamps_ms[i] - frame_timestamps_ms[i-1]) / 1000.0
        
        velocity = calculate_velocity(
            positions[i-1],
            positions[i],
            time_delta,
            pixels_per_meter
        )
        velocities.append(velocity)
    
    # Calculate statistics
    valid_velocities = [v for v in velocities if v is not None]
    
    return {
        'positions': positions,
        'velocities': velocities,
        'avg_velocity': float(np.mean(valid_velocities)) if valid_velocities else 0,
        'peak_velocity': float(np.max(valid_velocities)) if valid_velocities else 0,
        'valid_frames': len(valid_velocities),
    }


def compute_stride_velocity(
    keypoints_series: List[Dict],
    frame_timestamps_ms: List[int]
) -> Dict:
    """
    Estimate stride velocity for running/walking
    Detects stride by tracking ankle positions
    
    Args:
        keypoints_series: List of keypoint frames
        frame_timestamps_ms: Timestamps in milliseconds
    
    Returns:
        Stride analysis
    """
    # Estimate conversion
    body_height_pixels = PixelToMeterConverter.estimate_body_height(keypoints_series)
    pixels_per_meter = PixelToMeterConverter.estimate_pixels_per_meter(body_height_pixels)
    
    # Get ankle y-positions (vertical) to detect stride cycle
    ankle_y_positions = []
    
    for frame in keypoints_series:
        keypoints_dict = frame.get('keypoints', {})
        left_ankle = keypoints_dict.get('left_ankle')
        right_ankle = keypoints_dict.get('right_ankle')
        
        if left_ankle and left_ankle.get('visibility', 0) > 0.5:
            ankle_y_positions.append(left_ankle['y'])
        elif right_ankle and right_ankle.get('visibility', 0) > 0.5:
            ankle_y_positions.append(right_ankle['y'])
        else:
            ankle_y_positions.append(None)
    
    # Simple stride detection: peaks and valleys in vertical position
    # (minimum y = foot on ground)
    stride_phases = []
    
    for i in range(1, len(ankle_y_positions) - 1):
        if ankle_y_positions[i] is None:
            continue
        
        # Detect local minima (foot contact)
        if (ankle_y_positions[i] < ankle_y_positions[i-1] and
            ankle_y_positions[i] < ankle_y_positions[i+1]):
            stride_phases.append(i)
    
    # Calculate stride velocities
    stride_velocities = []
    
    for i in range(1, len(stride_phases)):
        frame_delta = stride_phases[i] - stride_phases[i-1]
        time_delta = (frame_timestamps_ms[stride_phases[i]] - 
                     frame_timestamps_ms[stride_phases[i-1]]) / 1000.0
        
        if time_delta > 0:
            stride_velocities.append(frame_delta / time_delta)
    
    return {
        'stride_count': len(stride_phases),
        'avg_stride_velocity': float(np.mean(stride_velocities)) if stride_velocities else 0,
        'peak_stride_velocity': float(np.max(stride_velocities)) if stride_velocities else 0,
        'stride_phases': stride_phases,
    }
