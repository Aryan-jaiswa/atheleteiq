"""
Biomechanics calculation orchestrator
Computes all athletic performance metrics from keypoint time-series
Integrates with backend via PATCH API and enqueues next job
"""

import os
import json
import logging
import requests
from typing import Dict, Optional, List
from pathlib import Path

from angles import compute_frame_angles, aggregate_angles
from velocity import compute_com_kinematics, compute_limb_velocity, compute_stride_velocity
from scores import (
    compute_symmetry_score,
    compute_balance_score,
    compute_explosiveness_score,
    compute_endurance_index,
    compute_technique_score,
)

logger = logging.getLogger(__name__)


class BiomechanicsReport:
    """Data class for complete biomechanics analysis report"""
    
    def __init__(
        self,
        video_id: str,
        sport: str,
        frame_count: int,
        duration_seconds: float,
        angles_aggregated: Dict,
        kinematics: Dict,
        symmetry: Dict,
        balance: Dict,
        explosiveness: Dict,
        endurance: Dict,
        technique: Dict,
    ):
        """Initialize biomechanics report"""
        self.video_id = video_id
        self.sport = sport
        self.frame_count = frame_count
        self.duration_seconds = duration_seconds
        self.angles_aggregated = angles_aggregated
        self.kinematics = kinematics
        self.symmetry = symmetry
        self.balance = balance
        self.explosiveness = explosiveness
        self.endurance = endurance
        self.technique = technique
    
    def to_dict(self) -> Dict:
        """Convert report to JSON-serializable dictionary"""
        return {
            'videoId': self.video_id,
            'sport': self.sport,
            'frameCount': self.frame_count,
            'durationSeconds': self.duration_seconds,
            'analysis': {
                'angles': self.angles_aggregated,
                'kinematics': {
                    'com': {
                        'avgVelocity': self.kinematics.get('avg_velocity'),
                        'peakVelocity': self.kinematics.get('peak_velocity'),
                        'avgAcceleration': self.kinematics.get('avg_acceleration'),
                        'peakAcceleration': self.kinematics.get('peak_acceleration'),
                        'peakDeceleration': self.kinematics.get('peak_deceleration'),
                    },
                    'bodyHeightPixels': self.kinematics.get('body_height_pixels'),
                    'pixelsPerMeter': self.kinematics.get('pixels_per_meter'),
                },
                'scores': {
                    'symmetry': self.symmetry,
                    'balance': self.balance,
                    'explosiveness': self.explosiveness,
                    'endurance': self.endurance,
                    'technique': self.technique,
                },
            },
            'overallScore': self._calculate_overall_score(),
        }
    
    def _calculate_overall_score(self) -> float:
        """Calculate weighted average of all scores (0-100)"""
        scores = [
            self.symmetry.get('score', 50),
            self.balance.get('score', 50),
            self.explosiveness.get('score', 50),
            self.endurance.get('score', 50),
            self.technique.get('score', 50),
        ]
        return float(sum(scores) / len(scores))


class BiomechanicsCalculator:
    """Main orchestrator for biomechanics analysis"""
    
    def __init__(self):
        """Initialize calculator"""
        self.backend_url = os.getenv('BACKEND_URL', 'http://localhost:4000')
        self.internal_token = os.getenv('INTERNAL_SERVICE_TOKEN', '')
        self.benchmarks_dir = Path(__file__).parent / 'benchmarks'
    
    def compute_biomechanics(
        self,
        video_id: str,
        keypoint_series: List[Dict],
        sport: str = 'general'
    ) -> BiomechanicsReport:
        """
        Compute complete biomechanics analysis
        
        Args:
            video_id: Video identifier
            keypoint_series: Keypoint time-series from pose detection
            sport: Sport type for benchmark selection
        
        Returns:
            BiomechanicsReport with all metrics
        """
        logger.info(f'🔬 Starting biomechanics analysis for video: {video_id}')
        logger.info(f'   Sport: {sport}, Frames: {len(keypoint_series)}')
        
        try:
            # Extract metadata
            frame_count = len(keypoint_series)
            frame_timestamps_ms = [
                frame.get('frameTimestampMs', i * 1000)
                for i, frame in enumerate(keypoint_series)
            ]
            
            if frame_timestamps_ms:
                duration_seconds = (frame_timestamps_ms[-1] - frame_timestamps_ms[0]) / 1000.0
            else:
                duration_seconds = 0
            
            logger.info(f'📊 Step 1/5: Computing joint angles...')
            # Step 1: Compute all joint angles for each frame
            frame_angles_list = []
            for frame in keypoint_series:
                keypoints_dict = frame.get('keypoints', {})
                frame_angles = compute_frame_angles(keypoints_dict)
                frame_angles_list.append(frame_angles)
            
            # Aggregate angles (min/max/mean/std)
            angles_aggregated = aggregate_angles(frame_angles_list)
            logger.info(f'✅ Computed angles for {len(frame_angles_list)} frames')
            
            logger.info(f'📊 Step 2/5: Computing kinematics (velocity/acceleration)...')
            # Step 2: Compute velocity and acceleration
            kinematics = compute_com_kinematics(keypoint_series, frame_timestamps_ms)
            logger.info(f'✅ Peak velocity: {kinematics["peak_velocity"]:.2f} m/s')
            logger.info(f'✅ Peak acceleration: {kinematics["peak_acceleration"]:.2f} m/s²')
            
            logger.info(f'📊 Step 3/5: Computing movement scores...')
            # Step 3: Compute scores
            symmetry = compute_symmetry_score(frame_angles_list)
            logger.info(f'✅ Symmetry score: {symmetry["score"]:.1f}/100')
            
            balance = compute_balance_score(kinematics)
            logger.info(f'✅ Balance score: {balance["score"]:.1f}/100')
            
            explosiveness = compute_explosiveness_score(kinematics)
            logger.info(f'✅ Explosiveness score: {explosiveness["score"]:.1f}/100')
            
            endurance = compute_endurance_index(frame_angles_list, kinematics)
            logger.info(f'✅ Endurance index: {endurance["score"]:.1f}/100')
            
            logger.info(f'📊 Step 4/5: Computing technique score...')
            # Step 4: Load benchmarks and compute technique score
            benchmark_data = self._load_benchmarks()
            technique = compute_technique_score(frame_angles_list, benchmark_data, sport)
            logger.info(f'✅ Technique score: {technique["score"]:.1f}/100')
            
            logger.info(f'📊 Step 5/5: Assembling final report...')
            # Step 5: Create final report
            report = BiomechanicsReport(
                video_id=video_id,
                sport=sport,
                frame_count=frame_count,
                duration_seconds=duration_seconds,
                angles_aggregated=angles_aggregated,
                kinematics=kinematics,
                symmetry=symmetry,
                balance=balance,
                explosiveness=explosiveness,
                endurance=endurance,
                technique=technique,
            )
            
            overall_score = report._calculate_overall_score()
            logger.info(f'✅ OVERALL SCORE: {overall_score:.1f}/100')
            
            return report
        
        except Exception as e:
            logger.error(f'❌ Error computing biomechanics: {str(e)}')
            raise
    
    def _load_benchmarks(self) -> Dict:
        """
        Load sport-specific benchmark data
        
        Returns:
            Dictionary of benchmarks by sport
        """
        benchmarks = {}
        
        if not self.benchmarks_dir.exists():
            logger.warning(f'Benchmarks directory not found: {self.benchmarks_dir}')
            return benchmarks
        
        for benchmark_file in self.benchmarks_dir.glob('*.json'):
            try:
                with open(benchmark_file, 'r') as f:
                    sport_data = json.load(f)
                    sport = sport_data.get('sport', benchmark_file.stem)
                    benchmarks[sport] = sport_data
                    logger.info(f'✅ Loaded benchmark: {sport}')
            except Exception as e:
                logger.error(f'Error loading benchmark {benchmark_file}: {str(e)}')
        
        return benchmarks
    
    def save_biomechanics_results(self, report: BiomechanicsReport) -> bool:
        """
        Save biomechanics results to backend database
        
        Args:
            report: BiomechanicsReport to save
        
        Returns:
            True if successful
        """
        try:
            logger.info(f'🔄 Saving biomechanics results to backend...')
            
            headers = {
                'Content-Type': 'application/json',
                'x-internal-token': self.internal_token,
            }
            
            payload = {
                'status': 'GEMINI_ANALYSIS',
                'biomechanicsResult': report.to_dict(),
                'enqueueNextJob': True,
            }
            
            url = f'{self.backend_url}/api/internal/videos/{report.video_id}'
            response = requests.patch(url, json=payload, headers=headers, timeout=60)
            
            if response.status_code != 200:
                logger.error(f'Backend returned {response.status_code}: {response.text}')
                return False
            
            logger.info(f'✅ Results saved to database')
            return True
        
        except Exception as e:
            logger.error(f'Failed to save results: {str(e)}')
            return False
    
    def report_error(self, video_id: str, error_message: str) -> bool:
        """
        Report error to backend
        
        Args:
            video_id: Video identifier
            error_message: Error description
        
        Returns:
            True if successful
        """
        try:
            headers = {
                'Content-Type': 'application/json',
                'x-internal-token': self.internal_token,
            }
            
            payload = {
                'errorMessage': error_message,
            }
            
            url = f'{self.backend_url}/api/internal/videos/{video_id}/error'
            response = requests.post(url, json=payload, headers=headers, timeout=30)
            
            if response.status_code == 200:
                logger.info(f'Error recorded in database')
                return True
            
            logger.error(f'Failed to record error: {response.status_code}')
            return False
        
        except Exception as e:
            logger.error(f'Failed to report error: {str(e)}')
            return False


# Singleton instance
_calculator: BiomechanicsCalculator = None


def get_calculator() -> BiomechanicsCalculator:
    """Get or create biomechanics calculator singleton"""
    global _calculator
    if _calculator is None:
        _calculator = BiomechanicsCalculator()
    return _calculator


def calculate_biomechanics_job(
    video_id: str,
    keypoint_series: List[Dict],
    sport: str = 'general'
) -> dict:
    """
    Main job function - called by RQ worker
    
    Args:
        video_id: Video identifier
        keypoint_series: Keypoint time-series from pose detection
        sport: Sport type
    
    Returns:
        Job result dictionary
    """
    logger.info(f'Processing biomechanics calculation job: {video_id}')
    
    calculator = get_calculator()
    
    try:
        # Compute biomechanics
        report = calculator.compute_biomechanics(video_id, keypoint_series, sport)
        
        # Save to backend
        if calculator.save_biomechanics_results(report):
            logger.info(f'✅ Biomechanics job complete for {video_id}')
            return {
                'videoId': video_id,
                'success': True,
                'message': 'Biomechanics analysis complete',
                'overallScore': report._calculate_overall_score(),
            }
        else:
            calculator.report_error(video_id, 'Failed to save biomechanics results')
            return {
                'videoId': video_id,
                'success': False,
                'message': 'Failed to save results',
            }
    
    except Exception as e:
        logger.error(f'❌ Biomechanics job failed: {str(e)}')
        calculator.report_error(video_id, f'Biomechanics calculation error: {str(e)}')
        return {
            'videoId': video_id,
            'success': False,
            'message': f'Error: {str(e)}',
        }
