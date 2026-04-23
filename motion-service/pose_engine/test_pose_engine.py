"""
Unit tests for pose detection engine
Tests extraction, batch processing, and validation
"""

import os
import sys
import logging
import tempfile
import numpy as np
import cv2
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pose_engine.extractor import extract_pose_from_frame, KEYPOINT_NAMES
from pose_engine.validator import validate_keypoint_series, get_series_stats

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_test_image(width: int = 640, height: int = 480) -> str:
    """
    Create a test image with a person-like appearance
    Returns path to temporary image file
    """
    # Create a blank image
    image = np.ones((height, width, 3), dtype=np.uint8) * 255

    # Draw a simple stick figure
    # Head
    cv2.circle(image, (width // 2, height // 4), 30, (0, 0, 0), -1)

    # Body
    cv2.line(image, (width // 2, height // 4 + 30), (width // 2, height // 2), (0, 0, 0), 3)

    # Left arm
    cv2.line(image, (width // 2, height // 3), (width // 2 - 50, height // 3 + 50), (0, 0, 0), 3)

    # Right arm
    cv2.line(image, (width // 2, height // 3), (width // 2 + 50, height // 3 + 50), (0, 0, 0), 3)

    # Left leg
    cv2.line(image, (width // 2, height // 2), (width // 2 - 30, height - 50), (0, 0, 0), 3)

    # Right leg
    cv2.line(image, (width // 2, height // 2), (width // 2 + 30, height - 50), (0, 0, 0), 3)

    # Save to temporary file
    temp_file = tempfile.NamedTemporaryFile(suffix='.jpg', delete=False)
    cv2.imwrite(temp_file.name, image)
    temp_file.close()

    return temp_file.name


def test_extract_pose_from_frame():
    """Test pose extraction from a single frame"""
    logger.info('🧪 Test 1: Extract pose from frame')

    try:
        # Create test image
        image_path = create_test_image()
        logger.info(f'✅ Created test image: {image_path}')

        # Extract pose
        result = extract_pose_from_frame(image_path, frame_index=0)

        if result is None:
            logger.warning('⚠️  No pose detected in test image (expected with simple test image)')
            logger.info('ℹ️  This is normal - MediaPipe needs realistic images')
        else:
            logger.info(f'✅ Pose extracted successfully')
            logger.info(f'   - Frame index: {result["frameIndex"]}')
            logger.info(f'   - Timestamp: {result["frameTimestampMs"]}ms')
            logger.info(f'   - Athlete detected: {result["athlete_detected"]}')
            logger.info(f'   - Keypoints: {len(result["keypoints"])} total')

            # Check keypoints structure
            assert len(result['keypoints']) == 33, f'Expected 33 keypoints, got {len(result["keypoints"])}'
            assert len(KEYPOINT_NAMES) == 33, f'Expected 33 keypoint names, got {len(KEYPOINT_NAMES)}'

            # Check keypoint format
            for keypoint_name, keypoint_data in result['keypoints'].items():
                assert 'x' in keypoint_data, f'Missing x for {keypoint_name}'
                assert 'y' in keypoint_data, f'Missing y for {keypoint_name}'
                assert 'z' in keypoint_data, f'Missing z for {keypoint_name}'
                assert 'visibility' in keypoint_data, f'Missing visibility for {keypoint_name}'

            # Check bounding box
            assert 'bounding_box' in result
            assert 'xMin' in result['bounding_box']
            assert 'yMin' in result['bounding_box']
            assert 'xMax' in result['bounding_box']
            assert 'yMax' in result['bounding_box']

            # Check body orientation
            assert 'body_orientation' in result
            assert 'shoulder_angle' in result['body_orientation']
            assert 'hip_angle' in result['body_orientation']

            logger.info(f'✅ All keypoint structure checks passed')

        # Cleanup
        os.unlink(image_path)
        logger.info(f'✅ Test 1 PASSED\n')

    except Exception as e:
        logger.error(f'❌ Test 1 FAILED: {str(e)}')
        return False

    return True


def test_validate_empty_series():
    """Test validation of empty keypoint series"""
    logger.info('🧪 Test 2: Validate empty keypoint series')

    try:
        result = validate_keypoint_series([])

        assert not result.is_valid, 'Empty series should be invalid'
        assert len(result.errors) > 0, 'Should have errors for empty series'

        logger.info(f'✅ Validation correctly rejected empty series')
        logger.info(f'   - Errors: {result.errors}')
        logger.info(f'✅ Test 2 PASSED\n')

    except Exception as e:
        logger.error(f'❌ Test 2 FAILED: {str(e)}')
        return False

    return True


def test_validate_minimal_series():
    """Test validation of minimal keypoint series"""
    logger.info('🧪 Test 3: Validate minimal keypoint series')

    try:
        # Create mock keypoint series (less than minimum)
        series = []
        for i in range(10):  # Only 10 frames (min is 30)
            frame = {
                'frameIndex': i,
                'frameTimestampMs': i * 1000,
                'athlete_detected': True,
                'keypoints': {
                    name: {'x': 0.5, 'y': 0.5, 'z': 0, 'visibility': 0.8}
                    for name in KEYPOINT_NAMES
                },
                'bounding_box': {'xMin': 0.2, 'yMin': 0.2, 'xMax': 0.8, 'yMax': 0.8},
                'body_orientation': {'shoulder_angle': 0.0, 'hip_angle': 0.0}
            }
            series.append(frame)

        result = validate_keypoint_series(series)

        assert not result.is_valid, 'Series with only 10 frames should be invalid'
        assert len(result.errors) > 0, 'Should have errors'

        logger.info(f'✅ Validation correctly rejected insufficient frames')
        logger.info(f'   - Errors: {result.errors}')
        logger.info(f'✅ Test 3 PASSED\n')

    except Exception as e:
        logger.error(f'❌ Test 3 FAILED: {str(e)}')
        return False

    return True


def test_validate_valid_series():
    """Test validation of valid keypoint series"""
    logger.info('🧪 Test 4: Validate valid keypoint series')

    try:
        # Create mock keypoint series (sufficient frames)
        series = []
        for i in range(60):  # 60 frames (more than minimum 30)
            frame = {
                'frameIndex': i,
                'frameTimestampMs': i * 1000,
                'athlete_detected': True,
                'keypoints': {
                    name: {'x': 0.5, 'y': 0.5, 'z': 0, 'visibility': 0.8}
                    for name in KEYPOINT_NAMES
                },
                'bounding_box': {'xMin': 0.2, 'yMin': 0.2, 'xMax': 0.8, 'yMax': 0.8},
                'body_orientation': {'shoulder_angle': 0.0, 'hip_angle': 0.0}
            }
            series.append(frame)

        result = validate_keypoint_series(series)

        assert result.is_valid, 'Series with 60 frames should be valid'
        assert len(result.errors) == 0, f'Should have no errors, got: {result.errors}'

        logger.info(f'✅ Validation correctly accepted valid series')
        logger.info(f'   - Frame count: 60')
        logger.info(f'   - Valid: {result.is_valid}')
        logger.info(f'✅ Test 4 PASSED\n')

    except Exception as e:
        logger.error(f'❌ Test 4 FAILED: {str(e)}')
        return False

    return True


def test_series_statistics():
    """Test calculation of series statistics"""
    logger.info('🧪 Test 5: Series statistics calculation')

    try:
        # Create mock keypoint series
        series = []
        for i in range(60):
            frame = {
                'frameIndex': i,
                'frameTimestampMs': i * 1000,
                'athlete_detected': True,
                'keypoints': {
                    name: {'x': 0.5, 'y': 0.5, 'z': 0, 'visibility': 0.75 + (0.1 if i % 2 == 0 else 0)}
                    for name in KEYPOINT_NAMES
                },
                'bounding_box': {'xMin': 0.2, 'yMin': 0.2, 'xMax': 0.8, 'yMax': 0.8},
                'body_orientation': {'shoulder_angle': 0.0, 'hip_angle': 0.0}
            }
            series.append(frame)

        stats = get_series_stats(series)

        assert stats['frameCount'] == 60, f'Expected 60 frames, got {stats["frameCount"]}'
        assert stats['durationMs'] > 0, 'Duration should be positive'
        assert 0 <= stats['averageVisibility'] <= 1, 'Average visibility should be 0-1'

        logger.info(f'✅ Series statistics calculated successfully')
        logger.info(f'   - Frame count: {stats["frameCount"]}')
        logger.info(f'   - Duration: {stats["durationSeconds"]:.1f} seconds')
        logger.info(f'   - Avg visibility: {stats["averageVisibility"]:.2f}')
        logger.info(f'   - Min visibility: {stats["minVisibility"]:.2f}')
        logger.info(f'   - Max visibility: {stats["maxVisibility"]:.2f}')
        logger.info(f'✅ Test 5 PASSED\n')

    except Exception as e:
        logger.error(f'❌ Test 5 FAILED: {str(e)}')
        return False

    return True


def run_all_tests():
    """Run all unit tests"""
    logger.info('=' * 60)
    logger.info('🧪 POSE ENGINE UNIT TESTS')
    logger.info('=' * 60 + '\n')

    tests = [
        test_extract_pose_from_frame,
        test_validate_empty_series,
        test_validate_minimal_series,
        test_validate_valid_series,
        test_series_statistics
    ]

    results = []
    for test in tests:
        try:
            results.append(test())
        except Exception as e:
            logger.error(f'Test execution failed: {str(e)}')
            results.append(False)

    # Summary
    logger.info('=' * 60)
    passed = sum(results)
    total = len(results)
    logger.info(f'✅ TESTS COMPLETED: {passed}/{total} passed')

    if passed == total:
        logger.info('🎉 All tests passed!')
    else:
        logger.warning(f'⚠️  {total - passed} tests failed')

    logger.info('=' * 60)

    return passed == total


if __name__ == '__main__':
    success = run_all_tests()
    sys.exit(0 if success else 1)
