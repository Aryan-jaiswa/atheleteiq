export interface Point3D {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface PoseKeypoints {
  nose: Point3D;
  left_eye: Point3D;
  right_eye: Point3D;
  left_ear: Point3D;
  right_ear: Point3D;
  left_shoulder: Point3D;
  right_shoulder: Point3D;
  left_elbow: Point3D;
  right_elbow: Point3D;
  left_wrist: Point3D;
  right_wrist: Point3D;
  left_hip: Point3D;
  right_hip: Point3D;
  left_knee: Point3D;
  right_knee: Point3D;
  left_ankle: Point3D;
  right_ankle: Point3D;
}

export interface JointAngle {
  joint: string;
  angle: number;
  timestamp: number;
}

export interface MotionMetrics {
  max_velocity: number;
  max_acceleration: number;
  symmetry_score: number; // 0-100
  joint_angles: JointAngle[];
}

export interface BiomechanicsReport {
  metrics: MotionMetrics;
  key_findings: string[];
  anomalies: string[];
}

export interface InjuryRiskResult {
  risk_score: number; // 0-100
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  contributing_factors: string[];
  recommendations: string[];
}

export interface SelectionReport {
  athlete_id: string;
  video_id: string;
  overall_score: number;
  biomechanics: BiomechanicsReport;
  injury_risk: InjuryRiskResult;
  gemini_analysis: string; // Qualitative analysis from Gemini
  generated_at: string;
}
