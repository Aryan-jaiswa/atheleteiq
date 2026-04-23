"""
Biomechanics analysis module
Computes quantifiable athletic performance metrics from pose keypoint time-series
"""

from .angles import (
    compute_frame_angles,
    aggregate_angles,
    knee_flexion_angle,
    hip_angle,
    shoulder_angle,
    elbow_angle,
    trunk_lean_angle,
    ankle_dorsiflexion_angle,
)

from .velocity import (
    compute_com_kinematics,
    compute_limb_velocity,
    compute_stride_velocity,
    PixelToMeterConverter,
)

from .scores import (
    compute_symmetry_score,
    compute_balance_score,
    compute_explosiveness_score,
    compute_endurance_index,
    compute_technique_score,
)

from .calculator import (
    BiomechanicsReport,
    BiomechanicsCalculator,
    calculate_biomechanics_job,
    get_calculator,
)

__all__ = [
    # Angles
    'compute_frame_angles',
    'aggregate_angles',
    'knee_flexion_angle',
    'hip_angle',
    'shoulder_angle',
    'elbow_angle',
    'trunk_lean_angle',
    'ankle_dorsiflexion_angle',
    # Velocity
    'compute_com_kinematics',
    'compute_limb_velocity',
    'compute_stride_velocity',
    'PixelToMeterConverter',
    # Scores
    'compute_symmetry_score',
    'compute_balance_score',
    'compute_explosiveness_score',
    'compute_endurance_index',
    'compute_technique_score',
    # Calculator
    'BiomechanicsReport',
    'BiomechanicsCalculator',
    'calculate_biomechanics_job',
    'get_calculator',
]
