"""
ML-based injury risk prediction from biomechanics data
Uses scikit-learn RandomForestClassifier trained on synthetic athletic data
"""

import os
import json
import logging
import pickle
import numpy as np
from typing import Dict, List, Tuple
from pathlib import Path

logger = logging.getLogger(__name__)

# Try to import sklearn
try:
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.preprocessing import StandardScaler
    SKLEARN_AVAILABLE = True
except ImportError:
    logger.warning('scikit-learn not available, using mock predictions')
    SKLEARN_AVAILABLE = False


class InjuryRiskPredictor:
    """Predicts injury risk from biomechanics metrics"""
    
    # Features extracted from biomechanics report
    FEATURE_NAMES = [
        'symmetry_score',
        'balance_score',
        'endurance_score',
        'knee_flexion_asymmetry',
        'hip_angle_asymmetry',
        'trunk_lean_variance',
        'peak_acceleration',
    ]
    
    def __init__(self):
        """Initialize injury predictor"""
        self.model = None
        self.scaler = None
        self.model_path = Path(__file__).parent / 'models' / 'injury_risk_model.pkl'
        self.scaler_path = Path(__file__).parent / 'models' / 'scaler.pkl'
        
        # Try to load pretrained model
        if self.model_path.exists() and self.scaler_path.exists():
            self._load_model()
        elif SKLEARN_AVAILABLE:
            # Train model with synthetic data
            logger.info('Training injury risk model with synthetic data...')
            self._train_model()
        else:
            logger.warning('sklearn not available, will use mock predictions')
    
    def _load_model(self):
        """Load pretrained model from disk"""
        try:
            with open(self.model_path, 'rb') as f:
                self.model = pickle.load(f)
            
            with open(self.scaler_path, 'rb') as f:
                self.scaler = pickle.load(f)
            
            logger.info('✅ Loaded pretrained injury risk model')
        
        except Exception as e:
            logger.error(f'Error loading model: {str(e)}')
            self.model = None
            self.scaler = None
    
    def _train_model(self):
        """Train model with synthetic athletic data"""
        if not SKLEARN_AVAILABLE:
            logger.warning('sklearn not available for training')
            return
        
        try:
            # Generate synthetic training data
            X_train, y_train = self._generate_synthetic_data(n_samples=500)
            
            # Initialize scaler
            self.scaler = StandardScaler()
            X_train_scaled = self.scaler.fit_transform(X_train)
            
            # Train RandomForest model
            self.model = RandomForestClassifier(
                n_estimators=100,
                max_depth=10,
                min_samples_split=5,
                min_samples_leaf=2,
                random_state=42,
            )
            self.model.fit(X_train_scaled, y_train)
            
            # Save model
            os.makedirs(Path(__file__).parent / 'models', exist_ok=True)
            
            with open(self.model_path, 'wb') as f:
                pickle.dump(self.model, f)
            
            with open(self.scaler_path, 'wb') as f:
                pickle.dump(self.scaler, f)
            
            logger.info('✅ Trained and saved injury risk model')
        
        except Exception as e:
            logger.error(f'Error training model: {str(e)}')
            self.model = None
            self.scaler = None
    
    def _generate_synthetic_data(self, n_samples: int = 500) -> Tuple[np.ndarray, np.ndarray]:
        """
        Generate synthetic training data for injury risk
        
        Simulates athletic biomechanics scenarios with known injury patterns
        
        Args:
            n_samples: Number of training samples
        
        Returns:
            Tuple of (features array, labels array)
        """
        X = []
        y = []
        
        # Low-risk athletes (no injury)
        for _ in range(n_samples // 2):
            # Good symmetry, balance, endurance
            symmetry = np.random.uniform(80, 95)
            balance = np.random.uniform(75, 95)
            endurance = np.random.uniform(70, 95)
            
            # Low asymmetries
            knee_asym = np.random.uniform(0, 8)
            hip_asym = np.random.uniform(0, 8)
            trunk_var = np.random.uniform(0, 3)
            peak_accel = np.random.uniform(8, 18)
            
            X.append([
                symmetry, balance, endurance,
                knee_asym, hip_asym, trunk_var, peak_accel
            ])
            y.append(0)  # No injury risk
        
        # High-risk athletes (potential injury)
        for _ in range(n_samples // 2):
            # Poor symmetry, balance, endurance
            symmetry = np.random.uniform(40, 70)
            balance = np.random.uniform(30, 65)
            endurance = np.random.uniform(20, 60)
            
            # High asymmetries
            knee_asym = np.random.uniform(12, 30)
            hip_asym = np.random.uniform(10, 25)
            trunk_var = np.random.uniform(5, 15)
            peak_accel = np.random.uniform(2, 10)
            
            X.append([
                symmetry, balance, endurance,
                knee_asym, hip_asym, trunk_var, peak_accel
            ])
            y.append(1)  # High injury risk
        
        return np.array(X), np.array(y)
    
    def predict_injury_risk(self, biomechanics_report: Dict) -> Dict:
        """
        Predict injury risk from biomechanics report
        
        Args:
            biomechanics_report: BiomechanicsReport.to_dict()
        
        Returns:
            Dictionary with:
            {
                'riskScore': float (0-100),
                'riskAreas': [str],
                'confidence': float (0-1),
                'features': {name: value},
            }
        """
        try:
            # Extract features from report
            features = self._extract_features(biomechanics_report)
            
            if features is None:
                logger.warning('Could not extract features, returning mock prediction')
                return self._mock_prediction()
            
            # If model not available, use mock
            if self.model is None or self.scaler is None:
                logger.info('Using mock injury prediction')
                return self._score_from_features(features)
            
            # Prepare input
            X = np.array([features['feature_vector']])
            X_scaled = self.scaler.transform(X)
            
            # Get prediction
            risk_pred = self.model.predict(X_scaled)[0]  # 0 or 1
            risk_proba = self.model.predict_proba(X_scaled)[0]  # [prob_no_risk, prob_risk]
            
            # Convert to 0-100 score
            risk_score = risk_proba[1] * 100  # Probability of high risk
            
            # Identify at-risk areas
            risk_areas = self._identify_risk_areas(features)
            
            result = {
                'riskScore': float(risk_score),
                'riskAreas': risk_areas,
                'confidence': float(np.max(risk_proba)),
                'features': features['raw_values'],
                'modelPrediction': int(risk_pred),
            }
            
            logger.info(f'ML Risk Prediction: {risk_score:.0f}/100')
            logger.info(f'Risk areas: {risk_areas}')
            
            return result
        
        except Exception as e:
            logger.error(f'Error predicting risk: {str(e)}')
            return self._mock_prediction()
    
    def _extract_features(self, biomechanics_report: Dict) -> Dict:
        """
        Extract ML features from biomechanics report
        
        Args:
            biomechanics_report: Full biomechanics report
        
        Returns:
            Feature dictionary or None
        """
        try:
            scores = biomechanics_report.get('analysis', {}).get('scores', {})
            angles = biomechanics_report.get('analysis', {}).get('angles', {})
            
            # Extract scores
            symmetry_score = scores.get('symmetry', {}).get('score', 50)
            balance_score = scores.get('balance', {}).get('score', 50)
            endurance_score = scores.get('endurance', {}).get('score', 50)
            
            # Extract angle asymmetries
            symmetry_data = scores.get('symmetry', {})
            mean_diffs = symmetry_data.get('mean_differences', {})
            
            knee_asym = abs(mean_diffs.get('knee_flexion', 0))
            hip_asym = abs(mean_diffs.get('hip_angle', 0))
            
            # Calculate trunk lean variance from angles
            trunk_angles = []
            for angle_frame in biomechanics_report.get('analysis', {}).get('angles', {}).values():
                if isinstance(angle_frame, dict) and 'min' in angle_frame:
                    trunk_angles.append(angle_frame.get('mean', 0))
            
            trunk_var = float(np.std(trunk_angles)) if trunk_angles else 0
            
            # Peak acceleration
            kinematics = biomechanics_report.get('analysis', {}).get('kinematics', {})
            peak_accel = kinematics.get('com', {}).get('peakAcceleration', 5)
            
            # Feature vector (in order of FEATURE_NAMES)
            feature_vector = [
                symmetry_score,
                balance_score,
                endurance_score,
                knee_asym,
                hip_asym,
                trunk_var,
                peak_accel,
            ]
            
            return {
                'feature_vector': feature_vector,
                'raw_values': {
                    'symmetry_score': symmetry_score,
                    'balance_score': balance_score,
                    'endurance_score': endurance_score,
                    'knee_flexion_asymmetry': knee_asym,
                    'hip_angle_asymmetry': hip_asym,
                    'trunk_lean_variance': trunk_var,
                    'peak_acceleration': peak_accel,
                }
            }
        
        except Exception as e:
            logger.error(f'Error extracting features: {str(e)}')
            return None
    
    def _identify_risk_areas(self, features: Dict) -> List[str]:
        """
        Identify body areas at risk based on features
        
        Args:
            features: Feature dictionary
        
        Returns:
            List of at-risk body areas with reasons
        """
        risk_areas = []
        raw = features['raw_values']
        
        # Knee risk
        if raw['knee_flexion_asymmetry'] > 15:
            risk_areas.append(
                f"Knees — {raw['knee_flexion_asymmetry']:.1f}° asymmetry in flexion"
            )
        
        # Hip risk
        if raw['hip_angle_asymmetry'] > 15:
            risk_areas.append(
                f"Hips — {raw['hip_angle_asymmetry']:.1f}° asymmetry in angle"
            )
        
        # Low balance
        if raw['balance_score'] < 50:
            risk_areas.append(
                f"Core/Spine — Poor balance (score: {raw['balance_score']:.0f}) indicates instability"
            )
        
        # High trunk variance
        if raw['trunk_lean_variance'] > 5:
            risk_areas.append(
                f"Lower back — High trunk variance ({raw['trunk_lean_variance']:.1f}°) with fatigue"
            )
        
        # Low endurance
        if raw['endurance_score'] < 40:
            risk_areas.append(
                f"Full body — Significant fatigue detected (endurance score: {raw['endurance_score']:.0f})"
            )
        
        # Low symmetry
        if raw['symmetry_score'] < 60:
            risk_areas.append(
                f"Lateral chain — Poor symmetry ({raw['symmetry_score']:.0f}) suggests imbalance"
            )
        
        return risk_areas
    
    def _score_from_features(self, features: Dict) -> Dict:
        """
        Score risk based on features when model unavailable
        
        Args:
            features: Feature dictionary
        
        Returns:
            Risk prediction dictionary
        """
        raw = features['raw_values']
        
        # Simple heuristic scoring
        risk_score = 100 - (
            (raw['symmetry_score'] * 0.3 +
             raw['balance_score'] * 0.2 +
             raw['endurance_score'] * 0.2) / 0.7
        )
        
        # Add penalties for asymmetries
        risk_score += raw['knee_flexion_asymmetry'] * 2
        risk_score += raw['hip_angle_asymmetry'] * 2
        risk_score += raw['trunk_lean_variance'] * 1
        
        # Cap at 100
        risk_score = min(100, max(0, risk_score))
        
        risk_areas = self._identify_risk_areas(features)
        
        return {
            'riskScore': float(risk_score),
            'riskAreas': risk_areas,
            'confidence': 0.7,
            'features': features['raw_values'],
            'modelType': 'heuristic',
        }
    
    def _mock_prediction(self) -> Dict:
        """Return mock prediction when all else fails"""
        return {
            'riskScore': 50.0,
            'riskAreas': ['Insufficient data for prediction'],
            'confidence': 0.0,
            'features': {},
            'modelType': 'mock',
        }


# Singleton instance
_predictor: InjuryRiskPredictor = None


def get_predictor() -> InjuryRiskPredictor:
    """Get or create injury risk predictor singleton"""
    global _predictor
    if _predictor is None:
        _predictor = InjuryRiskPredictor()
    return _predictor


def predict_injury_risk(biomechanics_report: Dict) -> Dict:
    """
    Public API: Predict injury risk from biomechanics
    
    Args:
        biomechanics_report: BiomechanicsReport.to_dict()
    
    Returns:
        Prediction dictionary
    """
    predictor = get_predictor()
    return predictor.predict_injury_risk(biomechanics_report)


def combine_injury_scores(ml_score: float, gemini_score: float) -> float:
    """
    Combine ML and Gemini injury risk scores
    Weighted: 40% ML, 60% Gemini (Gemini has domain expertise)
    
    Args:
        ml_score: ML model prediction (0-100)
        gemini_score: Gemini AI prediction (0-100)
    
    Returns:
        Combined injury risk score (0-100)
    """
    combined = (ml_score * 0.4) + (gemini_score * 0.6)
    return float(min(100, max(0, combined)))


if __name__ == "__main__":
    models_dir = Path(__file__).parent / "models"
    models_dir.mkdir(parents=True, exist_ok=True)
    InjuryRiskPredictor()
    print("Model trained and saved to models/")
