"""
Validation of keypoint time-series data
Ensures data quality before biomechanics calculation
"""

import logging
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


class ValidationResult:
    """Result of keypoint series validation"""

    def __init__(self, is_valid: bool, warnings: List[str] = None, errors: List[str] = None):
        self.is_valid = is_valid
        self.warnings = warnings or []
        self.errors = errors or []

    def to_dict(self) -> Dict:
        """Convert to dictionary"""
        return {
            'isValid': self.is_valid,
            'warnings': self.warnings,
            'errors': self.errors
        }


class KeypointValidator:
    """Validates keypoint time-series data"""

    # Configuration
    MIN_VALID_FRAMES = 30
    MAX_DETECTION_GAP_MS = 2000  # 2 seconds max gap
    MIN_KEY_JOINT_VISIBILITY = 0.5

    # Key joints that must be visible
    KEY_JOINTS = ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip', 'left_knee', 'right_knee']

    @staticmethod
    def validate_keypoint_series(series: List[Dict]) -> ValidationResult:
        """
        Validate keypoint time-series

        Args:
            series: List of keypoint data from batch processor

        Returns:
            ValidationResult with isValid bool and warnings/errors
        """
        errors = []
        warnings = []

        # Check 1: Minimum frame count
        if not series:
            errors.append('No keypoint frames provided')
            return ValidationResult(False, warnings, errors)

        if len(series) < KeypointValidator.MIN_VALID_FRAMES:
            errors.append(f'Only {len(series)} valid frames (minimum {KeypointValidator.MIN_VALID_FRAMES} required)')

        # Check 2: Frame continuity and gaps
        gap_check = KeypointValidator._check_frame_gaps(series)
        if gap_check['has_large_gaps']:
            errors.append(f'Large gap in detection (> {KeypointValidator.MAX_DETECTION_GAP_MS}ms)')
            for gap in gap_check['large_gaps']:
                warnings.append(f'  Gap at frame {gap["frame"]}: {gap["duration"]}ms')

        # Check 3: Key joint visibility
        visibility_check = KeypointValidator._check_key_joint_visibility(series)
        if visibility_check['low_visibility_frames']:
            warnings.append(f'{len(visibility_check["low_visibility_frames"])} frames with low key joint visibility')

        # Check 4: Data consistency
        consistency_check = KeypointValidator._check_data_consistency(series)
        if consistency_check['inconsistent']:
            warnings.extend(consistency_check['issues'])

        # Determine overall validity
        is_valid = len(errors) == 0 and len(series) >= KeypointValidator.MIN_VALID_FRAMES

        logger.info(f'✅ Validation result: {"VALID" if is_valid else "INVALID"}')
        if warnings:
            logger.info(f'⚠️  Warnings: {len(warnings)}')
        if errors:
            logger.error(f'❌ Errors: {len(errors)}')

        return ValidationResult(is_valid, warnings, errors)

    @staticmethod
    def _check_frame_gaps(series: List[Dict]) -> Dict:
        """Check for large gaps in frame detection"""
        has_large_gaps = False
        large_gaps = []

        for i in range(1, len(series)):
            current_timestamp = series[i].get('frameTimestampMs', 0)
            prev_timestamp = series[i - 1].get('frameTimestampMs', 0)

            gap = current_timestamp - prev_timestamp

            if gap > KeypointValidator.MAX_DETECTION_GAP_MS:
                has_large_gaps = True
                large_gaps.append({
                    'frame': i,
                    'duration': gap
                })

        return {
            'has_large_gaps': has_large_gaps,
            'large_gaps': large_gaps
        }

    @staticmethod
    def _check_key_joint_visibility(series: List[Dict]) -> Dict:
        """Check visibility of key joints"""
        low_visibility_frames = []

        for frame_idx, frame in enumerate(series):
            keypoints = frame.get('keypoints', {})

            visible_key_joints = 0
            for joint_name in KeypointValidator.KEY_JOINTS:
                if joint_name in keypoints:
                    visibility = keypoints[joint_name].get('visibility', 0)
                    if visibility > KeypointValidator.MIN_KEY_JOINT_VISIBILITY:
                        visible_key_joints += 1

            # Flag if fewer than 4 key joints visible
            if visible_key_joints < 4:
                low_visibility_frames.append(frame_idx)

        return {
            'low_visibility_frames': low_visibility_frames,
            'total_low_visibility': len(low_visibility_frames)
        }

    @staticmethod
    def _check_data_consistency(series: List[Dict]) -> Dict:
        """Check consistency of keypoint data"""
        inconsistent = False
        issues = []

        for frame_idx, frame in enumerate(series):
            # Check 1: All keypoints present
            keypoints = frame.get('keypoints', {})
            if len(keypoints) != 33:
                issues.append(f'Frame {frame_idx}: Expected 33 keypoints, got {len(keypoints)}')
                inconsistent = True

            # Check 2: Valid coordinate ranges (normalized 0-1 for x,y; can be outside for z)
            for joint_name, keypoint in keypoints.items():
                x = keypoint.get('x', 0)
                y = keypoint.get('y', 0)
                visibility = keypoint.get('visibility', 0)

                if not (0 <= x <= 1):
                    issues.append(f'Frame {frame_idx}: Invalid x coordinate for {joint_name}: {x}')
                    inconsistent = True

                if not (0 <= y <= 1):
                    issues.append(f'Frame {frame_idx}: Invalid y coordinate for {joint_name}: {y}')
                    inconsistent = True

                if not (0 <= visibility <= 1):
                    issues.append(f'Frame {frame_idx}: Invalid visibility for {joint_name}: {visibility}')
                    inconsistent = True

            # Check 3: Required fields present
            required_fields = ['frameIndex', 'frameTimestampMs', 'athlete_detected', 'keypoints', 'bounding_box', 'body_orientation']
            for field in required_fields:
                if field not in frame:
                    issues.append(f'Frame {frame_idx}: Missing field {field}')
                    inconsistent = True

        return {
            'inconsistent': inconsistent,
            'issues': issues
        }

    @staticmethod
    def get_series_stats(series: List[Dict]) -> Dict:
        """Calculate statistics about keypoint series"""
        if not series:
            return {
                'frameCount': 0,
                'durationMs': 0,
                'averageVisibility': 0.0,
                'minVisibility': 0.0,
                'maxVisibility': 0.0
            }

        # Calculate duration
        first_timestamp = series[0].get('frameTimestampMs', 0)
        last_timestamp = series[-1].get('frameTimestampMs', 0)
        duration_ms = last_timestamp - first_timestamp

        # Calculate visibility stats
        all_visibilities = []
        for frame in series:
            keypoints = frame.get('keypoints', {})
            for keypoint in keypoints.values():
                visibility = keypoint.get('visibility', 0)
                all_visibilities.append(visibility)

        avg_visibility = sum(all_visibilities) / len(all_visibilities) if all_visibilities else 0.0
        min_visibility = min(all_visibilities) if all_visibilities else 0.0
        max_visibility = max(all_visibilities) if all_visibilities else 0.0

        return {
            'frameCount': len(series),
            'durationMs': duration_ms,
            'durationSeconds': duration_ms / 1000,
            'averageVisibility': avg_visibility,
            'minVisibility': min_visibility,
            'maxVisibility': max_visibility
        }


def validate_keypoint_series(series: List[Dict]) -> ValidationResult:
    """
    Convenience function to validate keypoint series

    Args:
        series: List of keypoint frames

    Returns:
        ValidationResult
    """
    return KeypointValidator.validate_keypoint_series(series)


def get_series_stats(series: List[Dict]) -> Dict:
    """Get statistics about keypoint series"""
    return KeypointValidator.get_series_stats(series)
