"""
Gemini AI analysis for athletic performance
Uses multimodal input (video frames + biomechanics data) for expert analysis
"""

import os
import json
import logging
import base64
import requests
import re
from typing import Dict, List, Optional
from pathlib import Path

logger = logging.getLogger(__name__)


class GeminiAnalysisResult:
    """Data class for Gemini analysis output"""
    
    def __init__(
        self,
        video_id: str,
        athlete_id: str,
        sport: str,
        strengths: List[str],
        weaknesses: List[str],
        movement_efficiency: str,
        tactical_intelligence: str,
        injury_risk_score: float,
        injury_risk_areas: List[str],
        injury_prevention: List[str],
        training_recommendations: List[str],
        selection_readiness: str,
        selection_rationale: str,
        ai_summary: str,
        raw_response: str = '',
    ):
        """Initialize analysis result"""
        self.video_id = video_id
        self.athlete_id = athlete_id
        self.sport = sport
        self.strengths = strengths
        self.weaknesses = weaknesses
        self.movement_efficiency = movement_efficiency
        self.tactical_intelligence = tactical_intelligence
        self.injury_risk_score = injury_risk_score
        self.injury_risk_areas = injury_risk_areas
        self.injury_prevention = injury_prevention
        self.training_recommendations = training_recommendations
        self.selection_readiness = selection_readiness
        self.selection_rationale = selection_rationale
        self.ai_summary = ai_summary
        self.raw_response = raw_response
    
    def to_dict(self) -> Dict:
        """Convert to JSON-serializable dictionary"""
        return {
            'videoId': self.video_id,
            'athleteId': self.athlete_id,
            'sport': self.sport,
            'strengths': self.strengths,
            'weaknesses': self.weaknesses,
            'movementEfficiency': self.movement_efficiency,
            'tacticalIntelligence': self.tactical_intelligence,
            'injuryRiskScore': self.injury_risk_score,
            'injuryRiskAreas': self.injury_risk_areas,
            'injuryPrevention': self.injury_prevention,
            'trainingRecommendations': self.training_recommendations,
            'selectionReadiness': self.selection_readiness,
            'selectionRationale': self.selection_rationale,
            'aiSummary': self.ai_summary,
        }


class GeminiAnalyzer:
    """Interfaces with Gemini 1.5 Pro for multimodal athletic analysis"""
    
    def __init__(self):
        """Initialize Gemini analyzer"""
        self.api_key = os.getenv('GOOGLE_AI_API_KEY', '')
        self.backend_url = os.getenv('BACKEND_URL', 'http://localhost:4000')
        self.internal_token = os.getenv('INTERNAL_SERVICE_TOKEN', '')
        
        # Lazy import to handle missing dependency
        self.genai = None
        try:
            import google.generativeai as genai
            self.genai = genai
            if self.api_key:
                self.genai.configure(api_key=self.api_key)
                logger.info('✅ Gemini AI configured')
        except ImportError:
            logger.warning('google-generativeai not installed')
        
        # Import frame selector
        from frame_selector import get_frame_selector
        self.frame_selector = get_frame_selector()
    
    def analyze_athlete(
        self,
        video_id: str,
        athlete_id: str,
        sport: str,
        dominant_side: str,
        video_type: str,
        biomechanics_report: Dict,
        keypoint_series: List[Dict],
        frames_gcs_prefix: str,
    ) -> Optional[GeminiAnalysisResult]:
        """
        Analyze athlete using Gemini 1.5 Pro multimodal input
        
        Args:
            video_id: Video identifier
            athlete_id: Athlete identifier
            sport: Sport type
            dominant_side: LEFT or RIGHT
            video_type: TRAINING or MATCH
            biomechanics_report: BiomechanicsReport.to_dict()
            keypoint_series: Full keypoint time-series
            frames_gcs_prefix: GCS prefix for frames
        
        Returns:
            GeminiAnalysisResult or None if failed
        """
        logger.info(f'🧠 Starting Gemini analysis for athlete: {athlete_id}')
        logger.info(f'   Video: {video_id}, Sport: {sport}, Type: {video_type}')
        
        try:
            # Step 1: Select key frames
            logger.info('📹 Step 1/4: Selecting key frames...')
            local_frames = self.frame_selector.select_key_frames(
                keypoint_series,
                frames_gcs_prefix,
                n=10
            )
            
            if not local_frames:
                logger.error('Failed to select frames')
                return None
            
            logger.info(f'✅ Selected {len(local_frames)} key frames')
            
            # Step 2: Encode frames as base64
            logger.info('🖼️  Step 2/4: Encoding frames...')
            encoded_frames = self._encode_frames(local_frames)
            
            if not encoded_frames:
                logger.error('Failed to encode frames')
                return None
            
            logger.info(f'✅ Encoded {len(encoded_frames)} frames')
            
            # Step 3: Call Gemini API with multimodal content
            logger.info('🤖 Step 3/4: Calling Gemini API...')
            analysis = self._call_gemini_api(
                encoded_frames,
                sport,
                athlete_id,
                dominant_side,
                video_type,
                biomechanics_report,
                video_id,
            )
            
            if not analysis:
                logger.error('Gemini API analysis failed')
                return None
            
            logger.info('✅ Gemini analysis complete')
            
            # Step 4: Clean up temporary frames
            logger.info('🧹 Step 4/4: Cleaning up...')
            self.frame_selector.cleanup_frames(local_frames)
            
            return analysis
        
        except Exception as e:
            logger.error(f'❌ Error in athlete analysis: {str(e)}')
            return None
    
    def _encode_frames(self, local_paths: List[str]) -> List[str]:
        """
        Encode image frames as base64
        
        Args:
            local_paths: List of local image file paths
        
        Returns:
            List of base64-encoded image strings
        """
        encoded = []
        
        try:
            from PIL import Image
            import io
        except ImportError:
            logger.error('Pillow not installed')
            return []
        
        for path in local_paths:
            try:
                # Load image
                img = Image.open(path)
                
                # Convert to RGB if necessary
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                
                # Encode to JPEG bytes
                buffer = io.BytesIO()
                img.save(buffer, format='JPEG', quality=85)
                
                # Encode to base64
                img_bytes = buffer.getvalue()
                b64 = base64.b64encode(img_bytes).decode('utf-8')
                encoded.append(b64)
                
                logger.info(f'✅ Encoded: {Path(path).name}')
            
            except Exception as e:
                logger.error(f'Error encoding {path}: {str(e)}')
                continue
        
        return encoded
    
    def _call_gemini_api(
        self,
        encoded_frames: List[str],
        sport: str,
        athlete_id: str,
        dominant_side: str,
        video_type: str,
        biomechanics_report: Dict,
        video_id: str,
    ) -> Optional[GeminiAnalysisResult]:
        """
        Call Gemini 1.5 Pro with multimodal content
        
        Sends: images (base64) + biomechanics JSON text
        Expects: JSON response with analysis fields
        
        Args:
            encoded_frames: List of base64-encoded images
            sport: Sport type
            athlete_id: Athlete identifier
            dominant_side: LEFT or RIGHT
            video_type: TRAINING or MATCH
            biomechanics_report: BiomechanicsReport.to_dict()
            video_id: Video identifier
        
        Returns:
            GeminiAnalysisResult or None
        """
        if not self.genai:
            logger.error('Gemini not configured')
            return None
        
        try:
            # Build system prompt
            system_prompt = (
                f"You are an expert sports scientist, biomechanist, and elite performance coach "
                f"specializing in {sport}. You are reviewing video frames and biomechanical sensor data "
                f"for an athlete. Your analysis must be specific, evidence-based, and directly reference "
                f"the numerical data provided. Your output must be strictly valid JSON."
            )
            
            # Build user prompt
            user_prompt = (
                f"Athlete ID: {athlete_id}. Sport: {sport}. Video type: {video_type}. "
                f"Dominant side: {dominant_side}.\n\n"
                f"Biomechanics data:\n{json.dumps(biomechanics_report, indent=2)}\n\n"
                f"Based on the video frames and biomechanics data above, return ONLY a JSON object "
                f"with these exact fields:\n"
                f"{{\n"
                f'  "strengths": [string] — 3-5 specific observed strengths citing actual metrics,\n'
                f'  "weaknesses": [string] — 3-5 specific technical deficiencies with body part and metric referenced,\n'
                f'  "movementEfficiency": string — paragraph describing energy efficiency, wasted motion,\n'
                f'  "tacticalIntelligence": string — paragraph on decision-making, positioning,\n'
                f'  "injuryRiskScore": number 0-100 — overall injury risk,\n'
                f'  "injuryRiskAreas": [string] — specific body parts at risk with reason,\n'
                f'  "injuryPrevention": [string] — 3-4 corrective exercises or technique adjustments,\n'
                f'  "trainingRecommendations": [string] — 4-6 targeted training interventions,\n'
                f'  "selectionReadiness": string — one of: ELITE | NATIONAL_READY | DEVELOPMENT | NOT_READY,\n'
                f'  "selectionRationale": string — 2-3 sentence justification,\n'
                f'  "aiSummary": string — 3-4 sentence summary for non-scientists\n'
                f"}}"
            )
            
            # Build multimodal content
            content = []
            
            # Add images
            for i, b64_img in enumerate(encoded_frames):
                content.append({
                    'type': 'image',
                    'image': {
                        'mime_type': 'image/jpeg',
                        'data': b64_img,
                    }
                })
            
            # Add text (system prompt + user prompt)
            content.append({
                'type': 'text',
                'text': system_prompt + '\n\n' + user_prompt,
            })
            
            logger.info(f'📤 Sending {len(encoded_frames)} images + text to Gemini...')
            
            # Call Gemini 1.5 Pro
            model = self.genai.GenerativeModel('gemini-1.5-pro')
            response = model.generate_content(content)
            
            logger.info('✅ Received response from Gemini')
            
            # Parse response
            result = self._parse_gemini_response(
                response.text,
                athlete_id,
                video_id,
                sport,
            )
            
            if result:
                # Store raw response in result
                result.raw_response = response.text
                return result
            else:
                # Retry with stricter prompt if parsing failed
                logger.warning('First parse failed, retrying with stricter prompt...')
                result = self._retry_gemini_with_strict_prompt(
                    model,
                    encoded_frames,
                    sport,
                    athlete_id,
                    dominant_side,
                    video_type,
                    biomechanics_report,
                    video_id,
                )
                if result:
                    result.raw_response = response.text
                return result
        
        except Exception as e:
            logger.error(f'Gemini API error: {str(e)}')
            return None
    
    def _parse_gemini_response(
        self,
        response_text: str,
        athlete_id: str,
        video_id: str,
        sport: str,
    ) -> Optional[GeminiAnalysisResult]:
        """
        Parse JSON from Gemini response
        Handles markdown code fences, trailing commas, etc.
        
        Args:
            response_text: Raw response from Gemini
            athlete_id: Athlete identifier
            video_id: Video identifier
            sport: Sport type
        
        Returns:
            GeminiAnalysisResult or None
        """
        try:
            # Remove markdown code fences
            json_text = response_text
            json_text = re.sub(r'^```json\s*', '', json_text)
            json_text = re.sub(r'```\s*$', '', json_text)
            json_text = re.sub(r'^```\s*', '', json_text)
            
            # Parse JSON
            data = json.loads(json_text.strip())
            
            # Validate required fields
            required_fields = [
                'strengths', 'weaknesses', 'movementEfficiency',
                'tacticalIntelligence', 'injuryRiskScore', 'injuryRiskAreas',
                'injuryPrevention', 'trainingRecommendations',
                'selectionReadiness', 'selectionRationale', 'aiSummary'
            ]
            
            missing = [f for f in required_fields if f not in data]
            if missing:
                logger.error(f'Missing fields in response: {missing}')
                return None
            
            # Create result
            result = GeminiAnalysisResult(
                video_id=video_id,
                athlete_id=athlete_id,
                sport=sport,
                strengths=data.get('strengths', []),
                weaknesses=data.get('weaknesses', []),
                movement_efficiency=data.get('movementEfficiency', ''),
                tactical_intelligence=data.get('tacticalIntelligence', ''),
                injury_risk_score=float(data.get('injuryRiskScore', 50)),
                injury_risk_areas=data.get('injuryRiskAreas', []),
                injury_prevention=data.get('injuryPrevention', []),
                training_recommendations=data.get('trainingRecommendations', []),
                selection_readiness=data.get('selectionReadiness', 'DEVELOPMENT'),
                selection_rationale=data.get('selectionRationale', ''),
                ai_summary=data.get('aiSummary', ''),
            )
            
            logger.info(f'✅ Parsed Gemini response successfully')
            logger.info(f'   Injury Risk: {result.injury_risk_score:.0f}/100')
            logger.info(f'   Selection Readiness: {result.selection_readiness}')
            
            return result
        
        except json.JSONDecodeError as e:
            logger.error(f'JSON parse error: {str(e)}')
            logger.error(f'Response text: {response_text[:500]}...')
            return None
        
        except Exception as e:
            logger.error(f'Error parsing response: {str(e)}')
            return None
    
    def _retry_gemini_with_strict_prompt(
        self,
        model,
        encoded_frames: List[str],
        sport: str,
        athlete_id: str,
        dominant_side: str,
        video_type: str,
        biomechanics_report: Dict,
        video_id: str,
    ) -> Optional[GeminiAnalysisResult]:
        """
        Retry with stricter prompt format
        
        Args:
            model: Gemini model instance
            encoded_frames: Base64-encoded images
            sport: Sport type
            athlete_id: Athlete identifier
            dominant_side: LEFT or RIGHT
            video_type: TRAINING or MATCH
            biomechanics_report: Biomechanics data
            video_id: Video identifier
        
        Returns:
            GeminiAnalysisResult or None
        """
        try:
            logger.info('🔄 Retrying with stricter prompt...')
            
            strict_prompt = (
                f'Return ONLY valid JSON (no markdown, no extra text), with these fields: '
                f'strengths, weaknesses, movementEfficiency, tacticalIntelligence, injuryRiskScore, '
                f'injuryRiskAreas, injuryPrevention, trainingRecommendations, selectionReadiness, '
                f'selectionRationale, aiSummary'
            )
            
            # Build minimal content
            content = []
            for b64_img in encoded_frames[:3]:  # Use fewer images
                content.append({
                    'type': 'image',
                    'image': {
                        'mime_type': 'image/jpeg',
                        'data': b64_img,
                    }
                })
            
            content.append({
                'type': 'text',
                'text': strict_prompt,
            })
            
            response = model.generate_content(content)
            
            return self._parse_gemini_response(
                response.text,
                athlete_id,
                video_id,
                sport,
            )
        
        except Exception as e:
            logger.error(f'Retry failed: {str(e)}')
            return None
    
    def save_analysis_results(self, result: GeminiAnalysisResult) -> bool:
        """
        Save analysis results to backend
        
        Args:
            result: GeminiAnalysisResult
        
        Returns:
            True if successful
        """
        try:
            logger.info('💾 Saving analysis to backend...')
            
            headers = {
                'Content-Type': 'application/json',
                'x-internal-token': self.internal_token,
            }
            
            payload = {
                'status': 'COMPLETE',
                'geminiAnalysis': result.to_dict(),
                'enqueueNextJob': False,  # Analysis is final stage for now
            }
            
            url = f'{self.backend_url}/api/internal/gemini/{result.video_id}'
            response = requests.patch(url, json=payload, headers=headers, timeout=60)
            
            if response.status_code != 200:
                logger.error(f'Backend returned {response.status_code}: {response.text}')
                return False
            
            logger.info('✅ Analysis saved to database')
            return True
        
        except Exception as e:
            logger.error(f'Failed to save analysis: {str(e)}')
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
                logger.info('Error recorded in database')
                return True
            
            logger.error(f'Failed to record error: {response.status_code}')
            return False
        
        except Exception as e:
            logger.error(f'Failed to report error: {str(e)}')
            return False


# Singleton instance
_analyzer: GeminiAnalyzer = None


def get_analyzer() -> GeminiAnalyzer:
    """Get or create Gemini analyzer singleton"""
    global _analyzer
    if _analyzer is None:
        _analyzer = GeminiAnalyzer()
    return _analyzer


def analyze_athlete(
    video_id: str,
    athlete_id: str,
    sport: str,
    dominant_side: str,
    video_type: str,
    biomechanics_report: Dict,
    keypoint_series: List[Dict],
    frames_gcs_prefix: str,
) -> dict:
    """
    Public API: Analyze athlete using Gemini
    
    Args:
        video_id: Video identifier
        athlete_id: Athlete identifier
        sport: Sport type
        dominant_side: LEFT or RIGHT
        video_type: TRAINING or MATCH
        biomechanics_report: BiomechanicsReport.to_dict()
        keypoint_series: Full keypoint time-series
        frames_gcs_prefix: GCS prefix
    
    Returns:
        Result dictionary
    """
    analyzer = get_analyzer()
    result = analyzer.analyze_athlete(
        video_id,
        athlete_id,
        sport,
        dominant_side,
        video_type,
        biomechanics_report,
        keypoint_series,
        frames_gcs_prefix,
    )
    
    if result:
        analyzer.save_analysis_results(result)
        return {
            'videoId': video_id,
            'success': True,
            'message': 'Analysis complete',
            'selectionReadiness': result.selection_readiness,
            'injuryRiskScore': result.injury_risk_score,
        }
    else:
        analyzer.report_error(video_id, 'Gemini analysis failed')
        return {
            'videoId': video_id,
            'success': False,
            'message': 'Analysis failed',
        }
        # Mocking the actual call for boilerplate
        # response = await model.generate_content_async([video_file, prompt])
        # return response.text
        return "Mock Gemini Analysis: Excellent form with minor asymmetry detected in the left knee during landing."
    except Exception as e:
        return f"Error during Gemini analysis: {str(e)}"
