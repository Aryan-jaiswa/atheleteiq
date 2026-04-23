"""
Athletic performance scoring functions
Computes quantified metrics for movement quality and athletic traits
"""

import numpy as np
import logging
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


def compute_symmetry_score(frame_angles_list: List[Dict]) -> Dict:
    """
    Calculate symmetry score (0-100) comparing left vs right joint angles
    
    Higher score = more symmetric movement
    Compares: knee flexion, hip angle, shoulder angle, elbow angle, ankle dorsiflexion
    
    Asymmetry Detection: Flags when mean difference > 15° (potential injury indicator)
    
    Args:
        frame_angles_list: List of angle dictionaries from each frame
    
    Returns:
        Symmetry analysis:
        {
            'score': float,                        # 0-100 score
            'left_right_differences': {            # Per-frame differences
                'knee_flexion': [...],
                'hip_angle': [...],
                ...
            },
            'mean_differences': {                  # Average difference per joint
                'knee_flexion': float,
                'hip_angle': float,
                ...
            },
            'max_differences': {                   # Max difference per joint
                'knee_flexion': float,
                ...
            },
            'injury_risk_flags': [...]            # Joints with >15° asymmetry
        }
    """
    joint_pairs = [
        'knee_flexion',
        'hip_angle',
        'shoulder_angle',
        'elbow_angle',
        'ankle_dorsiflexion',
    ]
    
    left_right_diffs = {pair: [] for pair in joint_pairs}
    all_differences = []
    
    # Calculate frame-by-frame differences
    for frame in frame_angles_list:
        for pair in joint_pairs:
            left_val = frame.get(f'{pair}_left')
            right_val = frame.get(f'{pair}_right')
            
            # Skip if either value is None
            if left_val is None or right_val is None:
                continue
            
            # Calculate absolute difference
            diff = abs(left_val - right_val)
            left_right_diffs[pair].append(diff)
            all_differences.append(diff)
    
    # Calculate statistics
    if not all_differences:
        return {
            'score': 0,
            'left_right_differences': left_right_diffs,
            'mean_differences': {},
            'max_differences': {},
            'injury_risk_flags': [],
        }
    
    # Mean difference (lower is more symmetric)
    mean_diff = float(np.mean(all_differences))
    
    # Normalize to 0-100 scale
    # 0° difference = 100 score, 30° difference = 0 score
    max_asymmetry = 30.0
    symmetry_score = max(0, 100 - (mean_diff / max_asymmetry * 100))
    
    # Calculate per-joint statistics
    mean_differences = {}
    max_differences = {}
    injury_flags = []
    
    for pair in joint_pairs:
        if left_right_diffs[pair]:
            pair_mean = float(np.mean(left_right_diffs[pair]))
            pair_max = float(np.max(left_right_diffs[pair]))
            
            mean_differences[pair] = pair_mean
            max_differences[pair] = pair_max
            
            # Flag if mean asymmetry > 15°
            if pair_mean > 15.0:
                injury_flags.append({
                    'joint': pair,
                    'mean_asymmetry': pair_mean,
                    'risk_level': 'high' if pair_mean > 20 else 'moderate',
                })
    
    return {
        'score': float(symmetry_score),
        'left_right_differences': left_right_diffs,
        'mean_differences': mean_differences,
        'max_differences': max_differences,
        'injury_risk_flags': injury_flags,
        'interpretation': 'Excellent symmetry' if symmetry_score > 80
                         else 'Good symmetry' if symmetry_score > 60
                         else 'Moderate asymmetry - check for imbalances' if symmetry_score > 40
                         else 'Significant asymmetry - potential injury risk',
    }


def compute_balance_score(kinematics_data: Dict) -> Dict:
    """
    Calculate balance score (0-100) from center of mass stability
    
    Lower horizontal COM displacement = better balance
    Uses variance of x-coordinate displacement
    
    Args:
        kinematics_data: Output from compute_com_kinematics()
    
    Returns:
        Balance analysis:
        {
            'score': float,                    # 0-100 score
            'com_x_positions': [...],          # X-coordinates of COM
            'com_x_variance': float,           # Variance of x-position
            'com_x_std': float,                # Standard deviation
            'com_x_range': {                   # Min/max x-position
                'min': float,
                'max': float,
                'range': float,
            }
        }
    """
    com_positions = kinematics_data.get('com_positions', [])
    
    # Extract valid x-positions
    valid_x_positions = []
    for pos in com_positions:
        if pos is not None:
            valid_x_positions.append(pos[0])
    
    if not valid_x_positions:
        return {
            'score': 0,
            'com_x_positions': [],
            'com_x_variance': None,
            'com_x_std': None,
            'com_x_range': None,
        }
    
    x_array = np.array(valid_x_positions)
    
    # Normalize x-positions to 0-1 range for variance calculation
    x_normalized = (x_array - np.min(x_array)) / (np.max(x_array) - np.min(x_array) + 1e-6)
    
    # Calculate statistics
    x_variance = float(np.var(x_normalized))
    x_std = float(np.std(x_normalized))
    x_range = float(np.max(x_array) - np.min(x_array))
    
    # Score: lower variance = higher balance
    # Normalize: 0.05 variance = 100 score, 0.2 variance = 0 score
    max_variance = 0.2
    balance_score = max(0, 100 - (x_variance / max_variance * 100))
    
    return {
        'score': float(balance_score),
        'com_x_positions': valid_x_positions,
        'com_x_variance': x_variance,
        'com_x_std': x_std,
        'com_x_range': {
            'min': float(np.min(x_array)),
            'max': float(np.max(x_array)),
            'range': x_range,
        },
        'interpretation': 'Excellent balance' if balance_score > 80
                         else 'Good balance' if balance_score > 60
                         else 'Moderate balance' if balance_score > 40
                         else 'Poor balance - check stability',
    }


def compute_explosiveness_score(kinematics_data: Dict, burst_window_ms: int = 200) -> Dict:
    """
    Calculate explosiveness score (0-100) from peak acceleration
    
    Detects rapid acceleration phases (typical in jumping, sprinting)
    Scores based on maximum acceleration in burst window
    
    Args:
        kinematics_data: Output from compute_com_kinematics()
        burst_window_ms: Time window for burst detection (default 200ms)
    
    Returns:
        Explosiveness analysis:
        {
            'score': float,                    # 0-100 score
            'peak_acceleration': float,        # Highest m/s² recorded
            'avg_acceleration': float,         # Average acceleration
            'burst_count': int,                # Number of acceleration bursts
        }
    """
    peak_acceleration = kinematics_data.get('peak_acceleration', 0)
    avg_acceleration = kinematics_data.get('avg_acceleration', 0)
    
    # Normalize acceleration to 0-100 scale
    # 10 m/s² = 100 score (very explosive), 0 m/s² = 0 score
    # Athletes typically show 5-15 m/s² in explosive movements
    max_acceleration = 15.0
    
    explosiveness_score = max(0, min(100, (peak_acceleration / max_acceleration * 100)))
    
    # Count acceleration bursts (frames where acceleration > 5 m/s²)
    accelerations = kinematics_data.get('com_accelerations', [])
    valid_accel = [a for a in accelerations if a is not None and a > 5.0]
    burst_count = len(valid_accel)
    
    return {
        'score': float(explosiveness_score),
        'peak_acceleration': peak_acceleration,
        'avg_acceleration': avg_acceleration,
        'burst_count': burst_count,
        'interpretation': 'Highly explosive' if explosiveness_score > 80
                         else 'Good explosiveness' if explosiveness_score > 60
                         else 'Moderate explosiveness' if explosiveness_score > 40
                         else 'Low explosiveness - needs power development',
    }


def compute_endurance_index(
    frame_angles_list: List[Dict],
    frame_kinematics: Dict,
    segment_ratio: float = 0.2
) -> Dict:
    """
    Calculate endurance index (0-100) from fatigue detection
    
    Compares biomechanics quality in first 20% of movement vs last 20%
    Degradation indicates fatigue
    
    Args:
        frame_angles_list: All frame angle data
        frame_kinematics: All frame kinematics
        segment_ratio: Fraction of video to compare (default 0.2 = first/last 20%)
    
    Returns:
        Endurance analysis:
        {
            'score': float,                    # 0-100 score
            'early_angle_quality': float,      # Mean angle std in first segment
            'late_angle_quality': float,       # Mean angle std in last segment
            'degradation': float,              # Percentage of degradation
            'interpretation': str,
        }
    """
    if not frame_angles_list:
        return {
            'score': 0,
            'early_angle_quality': 0,
            'late_angle_quality': 0,
            'degradation': 0,
        }
    
    total_frames = len(frame_angles_list)
    segment_size = max(1, int(total_frames * segment_ratio))
    
    # Early segment (first 20%)
    early_segment = frame_angles_list[:segment_size]
    
    # Late segment (last 20%)
    late_segment = frame_angles_list[-segment_size:] if segment_size < total_frames else frame_angles_list
    
    # Calculate angle quality for each segment
    # Quality = consistency (low variance) of angles
    
    def calculate_segment_quality(segment):
        """Calculate movement consistency in segment"""
        if not segment:
            return 0
        
        all_stds = []
        for frame in segment:
            # For each frame, collect STDs across different angles
            frame_stds = []
            for key, val in frame.items():
                if isinstance(val, (int, float)) and val is not None:
                    frame_stds.append(val)
            
            if frame_stds:
                all_stds.append(np.std(frame_stds))
        
        if all_stds:
            return float(np.mean(all_stds))
        return 0
    
    early_quality = calculate_segment_quality(early_segment)
    late_quality = calculate_segment_quality(late_segment)
    
    # Degradation: increase in angle variability indicates fatigue
    # (higher std = less consistent movement)
    if early_quality > 0:
        degradation_pct = max(0, (late_quality - early_quality) / early_quality * 100)
    else:
        degradation_pct = 0
    
    # Endurance score: less degradation = higher score
    # 0% degradation = 100 score, 50% degradation = 0 score
    endurance_score = max(0, 100 - (degradation_pct / 0.5 * 100))
    
    return {
        'score': float(endurance_score),
        'early_angle_quality': early_quality,
        'late_angle_quality': late_quality,
        'degradation_percentage': float(degradation_pct),
        'interpretation': 'Excellent endurance' if endurance_score > 80
                         else 'Good endurance' if endurance_score > 60
                         else 'Moderate endurance - fatigue detected' if endurance_score > 40
                         else 'Significant fatigue - technique degradation',
    }


def compute_technique_score(
    frame_angles_list: List[Dict],
    benchmark_data: Dict,
    sport: str = 'general'
) -> Dict:
    """
    Calculate technique score (0-100) comparing to sport-specific benchmarks
    
    Uses benchmark JSON to compare joint angle ranges
    Score = percentage of angles within ideal ranges
    
    Args:
        frame_angles_list: All frame angle data
        benchmark_data: Sport-specific benchmark ranges
        sport: Sport type (used for selecting benchmark)
    
    Returns:
        Technique analysis:
        {
            'score': float,                    # 0-100 score
            'angle_matches': {                 # Per-angle matching
                'knee_flexion': {'match%': float, 'status': 'in_range'|'too_low'|'too_high'},
                ...
            },
            'interpretation': str,
        }
    """
    if not frame_angles_list or not benchmark_data:
        return {
            'score': 50,
            'angle_matches': {},
            'interpretation': 'No benchmark data available',
        }
    
    # Extract benchmark ranges for this sport
    sport_benchmark = benchmark_data.get(sport, {}).get('ideal_ranges', {})
    
    if not sport_benchmark:
        return {
            'score': 50,
            'angle_matches': {},
            'interpretation': f'No benchmark for {sport}',
        }
    
    angle_matches = {}
    total_matches = 0
    total_angles = 0
    
    # Check each angle type
    for angle_key, ideal_range in sport_benchmark.items():
        if angle_key not in frame_angles_list[0]:
            continue
        
        # Collect all values for this angle (from all frames)
        values = []
        for frame in frame_angles_list:
            val = frame.get(angle_key)
            if val is not None:
                values.append(val)
        
        if not values:
            continue
        
        values_array = np.array(values)
        mean_val = float(np.mean(values_array))
        
        # Check if mean is in ideal range
        min_ideal = ideal_range.get('min', 0)
        max_ideal = ideal_range.get('max', 180)
        
        in_range = min_ideal <= mean_val <= max_ideal
        
        if in_range:
            match_pct = 100.0
            status = 'in_range'
            total_matches += 1
        elif mean_val < min_ideal:
            # Calculate how far below range
            gap = min_ideal - mean_val
            match_pct = max(0, 100 - (gap / (min_ideal - 0 + 1e-6) * 100))
            status = 'too_low'
        else:
            # Calculate how far above range
            gap = mean_val - max_ideal
            match_pct = max(0, 100 - (gap / (180 - max_ideal + 1e-6) * 100))
            status = 'too_high'
        
        angle_matches[angle_key] = {
            'mean': mean_val,
            'ideal_range': ideal_range,
            'match_percentage': float(match_pct),
            'status': status,
        }
        total_angles += 1
    
    # Calculate overall technique score
    if total_angles > 0:
        avg_match = sum(m['match_percentage'] for m in angle_matches.values()) / total_angles
        technique_score = avg_match
    else:
        technique_score = 50
    
    return {
        'score': float(technique_score),
        'angle_matches': angle_matches,
        'total_angles_matched': total_angles,
        'interpretation': 'Excellent technique' if technique_score > 80
                         else 'Good technique' if technique_score > 60
                         else 'Adequate technique' if technique_score > 50
                         else 'Needs technique improvement',
    }
