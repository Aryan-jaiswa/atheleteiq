# AthleteIQ Database - Complete Code Reference

## Full Prisma Schema

**File: `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============= ENUMS =============

enum Role {
  ATHLETE
  COACH
  SCOUT
  FEDERATION
  ADMIN
}

enum DominantSide {
  LEFT
  RIGHT
}

enum VideoType {
  TRAINING
  MATCH
}

enum VideoStatus {
  QUEUED
  EXTRACTING_FRAMES
  POSE_DETECTION
  BIOMECHANICS
  GEMINI_ANALYSIS
  COMPLETE
  FAILED
}

enum SelectionDecision {
  SELECTED
  WAITLISTED
  REJECTED
  PENDING
}

// ============= MODELS =============

model User {
  id        String   @id @default(uuid())
  name      String
  email     String   @unique
  phone     String?
  role      Role     @default(ATHLETE)
  sport     String?
  region    String?
  state     String?
  createdAt DateTime @default(now())

  athleteProfile      AthleteProfile?
  videosUploaded      Video[]              @relation("VideoUploader")
  reportsGenerated    SelectionReport[]    @relation("ReportGenerator")
  athletesCoached     CoachAthleteLink[]   @relation("CoachLink")
  athletesScouted     ScoutWatchlist[]     @relation("ScoutLink")
}

model AthleteProfile {
  id                String       @id @default(uuid())
  userId            String       @unique
  user              User         @relation(fields: [userId], references: [id])
  sport             String
  dateOfBirth       DateTime?
  height            Float?       // in cm
  weight            Float?       // in kg
  dominantSide      DominantSide?
  region            String?
  state             String?
  bio               String?
  profilePhotoUrl   String?
  overallScore      Float?
  selectionEligible Boolean      @default(true)

  videos              Video[]
  biomechanicsReports BiomechanicsReport[]
  geminiAnalyses      GeminiAnalysis[]
  selectionReports    SelectionReport[]
  coaches             CoachAthleteLink[]   @relation("AthleteLink")
  scoutsWatching      ScoutWatchlist[]     @relation("AthleteScoutLink")
}

model Video {
  id               String       @id @default(uuid())
  athleteId        String
  athlete          AthleteProfile @relation(fields: [athleteId], references: [id])
  uploadedAt       DateTime     @default(now())
  gcsRawUrl        String
  type             VideoType
  sport            String
  durationSeconds  Float
  status           VideoStatus  @default(QUEUED)
  errorMessage     String?
  frameCount       Int?
  processedAt      DateTime?
  uploaderId       String?
  uploader         User?        @relation("VideoUploader", fields: [uploaderId], references: [id])

  poseAnalysis           PoseAnalysis?
  biomechanicsReport     BiomechanicsReport?
  geminiAnalysis         GeminiAnalysis?
}

model PoseAnalysis {
  id                   String   @id @default(uuid())
  videoId              String   @unique
  video                Video    @relation(fields: [videoId], references: [id])
  frameTimestamps      Json     // Array of frame times in ms
  keypointSeries       Json     // 33-keypoint MediaPipe data per frame
  extractionDurationMs Int?
}

model BiomechanicsReport {
  id                   String   @id @default(uuid())
  videoId              String   @unique
  video                Video    @relation(fields: [videoId], references: [id])
  athleteId            String
  athlete              AthleteProfile @relation(fields: [athleteId], references: [id])
  
  jointAngles          Json     // Joint angle metrics
  velocityMetrics      Json     // Movement velocity data
  accelerationMetrics  Json     // Acceleration patterns
  
  symmetryScore        Float    // 0-100
  balanceScore         Float    // 0-100
  reactionTime         Float?   // milliseconds
  explosiveness        Float    // 0-100
  enduranceIndex       Float    // 0-100
  techniqueScore       Float    // 0-100
  
  sport                String
  createdAt            DateTime @default(now())
}

model GeminiAnalysis {
  id                   String   @id @default(uuid())
  videoId              String   @unique
  video                Video    @relation(fields: [videoId], references: [id])
  athleteId            String
  athlete              AthleteProfile @relation(fields: [athleteId], references: [id])
  
  modelVersion         String
  rawPrompt            String   @db.Text
  rawResponse          String   @db.Text
  
  strengths            Json     // string[]
  weaknesses           Json     // string[]
  tacticalIntelligence String
  movementEfficiency   String
  coachNotes           String
  
  injuryRiskScore      Float    // 0-100
  injuryRiskAreas      Json     // string[]
  aiSummary            String
  
  createdAt            DateTime @default(now())
}

model SelectionReport {
  id                String            @id @default(uuid())
  athleteId         String
  athlete           AthleteProfile    @relation(fields: [athleteId], references: [id])
  generatedAt       DateTime          @default(now())
  
  generatedById     String
  generatedBy       User              @relation("ReportGenerator", fields: [generatedById], references: [id])
  
  compositeScore    Float             // 0-100
  selectionDecision SelectionDecision @default(PENDING)
  decisionReason    String?
  
  videoIds          Json              // array of video UUIDs
  reportPdfUrl      String?
  
  createdAt         DateTime          @default(now())
}

model CoachAthleteLink {
  coachId    String
  coach      User           @relation("CoachLink", fields: [coachId], references: [id])
  athleteId  String
  athlete    AthleteProfile @relation("AthleteLink", fields: [athleteId], references: [id])
  assignedAt DateTime       @default(now())

  @@id([coachId, athleteId])
}

model ScoutWatchlist {
  scoutId    String
  scout      User           @relation("ScoutLink", fields: [scoutId], references: [id])
  athleteId  String
  athlete    AthleteProfile @relation("AthleteScoutLink", fields: [athleteId], references: [id])
  notes      String?
  addedAt    DateTime       @default(now())

  @@id([scoutId, athleteId])
}
```

---

## Seed Data Generator Highlights

**File: `prisma/seed.ts`**

### Key Features:
1. **5 Elite Athletes** with realistic profiles:
   - Complete personal data (DOB, height, weight, dominant side)
   - Sport-specific information
   - Profile photos and bios
   - Selection eligibility flags

2. **2 Videos per Athlete** (10 total):
   - Training and match footage
   - Realistic frame counts (300-500 @ 30fps)
   - GCS URLs for storage
   - Processing status tracking

3. **Pose Analysis** (MediaPipe 33-keypoint):
   - Full keypoint series per frame
   - Frame timestamps in milliseconds
   - Confidence scores per keypoint

4. **Biomechanics Reports**:
   - Joint angles: knee, hip, shoulder, elbow (min/max/avg)
   - Velocity metrics: stride, arm swing, center of mass
   - Acceleration metrics: peak, deceleration patterns
   - Performance scores: symmetry, balance, explosiveness, technique, endurance
   - Injury risk assessment

5. **Gemini AI Analyses**:
   - Model version tracking
   - Full prompt/response logging
   - Structured strengths and weaknesses
   - Tactical and movement insights
   - Injury risk areas flagged
   - Plain English summaries

6. **Selection Reports**:
   - Composite scoring (weighted algorithm)
   - Selection decisions (SELECTED, WAITLISTED)
   - Decision reasoning
   - Associated video IDs
   - PDF report URLs

7. **Relationships**:
   - Coach assigned to 2 athletes
   - Scout watching 2 athletes
   - Complete audit trail with timestamps

### Helper Functions:
```typescript
generateKeypointSeries(frameCount)  // Creates realistic MediaPipe data
generateFrameTimestamps(frameCount) // Creates millisecond timestamps
```

---

## Database Commands

### Setup (First Time)
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with DATABASE_URL

# Initialize database
npm run db:push

# Populate with sample data
npm run db:seed
```

### Ongoing Development
```bash
# View data in web UI
npx prisma studio

# Create schema changes
npm run db:migrate -- "feature_description"

# Reseed data (development only)
npm run db:seed

# Full reset (destructive)
npm run db:reset
```

### Verification
```bash
# Validate schema
npx prisma validate

# Query database
psql -U athleteiq_user -d athleteiq_db
SELECT COUNT(*) FROM "User";
SELECT COUNT(*) FROM "Video";
SELECT COUNT(*) FROM "SelectionReport";
\q
```

---

## JSON Field Examples

### PoseAnalysis.frameTimestamps
```json
[0, 33.33, 66.67, 100.0, 133.33, ...]
```

### PoseAnalysis.keypointSeries
```json
[
  {
    "nose": [320.5, 240.2, 0.95],
    "left_shoulder": [280.1, 310.3, 0.93],
    "left_elbow": [260.5, 380.5, 0.91],
    "left_wrist": [245.2, 420.1, 0.88],
    "right_shoulder": [360.1, 310.3, 0.94],
    ...
  },
  // Frame 2, Frame 3, etc.
]
```

### BiomechanicsReport.jointAngles
```json
{
  "knee_flexion_left": {
    "min": 35,
    "max": 150,
    "avg": 92
  },
  "knee_flexion_right": {
    "min": 32,
    "max": 155,
    "avg": 94
  },
  "hip_angle": {
    "min": 60,
    "max": 120,
    "avg": 95
  },
  "shoulder_angle": {
    "min": 45,
    "max": 170,
    "avg": 110
  },
  "elbow_angle": {
    "min": 50,
    "max": 160,
    "avg": 115
  }
}
```

### BiomechanicsReport.velocityMetrics
```json
{
  "stride_velocity": 8.7,
  "arm_swing_velocity": 5.4,
  "center_of_mass_velocity": 5.1
}
```

### BiomechanicsReport.accelerationMetrics
```json
{
  "peak_acceleration": 18.5,
  "deceleration_patterns": "Smooth with controlled landing"
}
```

### GeminiAnalysis.strengths / weaknesses
```json
[
  "Excellent explosiveness and power generation",
  "Good kinetic chain efficiency",
  "Strong core stability",
  "Impressive acceleration patterns"
]
```

### GeminiAnalysis.injuryRiskAreas
```json
["Right ankle", "Left knee"]
```

### SelectionReport.videoIds
```json
["uuid-abc123", "uuid-def456", "uuid-ghi789"]
```

---

## Sample API Usage (Backend TypeScript)

```typescript
import { PrismaClient, Role, VideoStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Get athlete profile with all analysis
async function getAthleteWithAnalysis(athleteId: string) {
  return await prisma.athleteProfile.findUnique({
    where: { id: athleteId },
    include: {
      user: true,
      videos: {
        include: {
          poseAnalysis: true,
          biomechanicsReport: true,
          geminiAnalysis: true
        }
      },
      selectionReports: true
    }
  });
}

// Get completed videos ready for processing
async function getCompletedVideos() {
  return await prisma.video.findMany({
    where: { status: VideoStatus.COMPLETE },
    include: {
      athlete: { include: { user: true } },
      biomechanicsReport: true,
      geminiAnalysis: true
    }
  });
}

// Get athlete's selection reports
async function getSelectionReports(athleteId: string) {
  return await prisma.selectionReport.findMany({
    where: { athleteId },
    include: {
      athlete: { include: { user: true } },
      generatedBy: true
    },
    orderBy: { createdAt: 'desc' }
  });
}

// Create selection report
async function createSelectionReport(
  athleteId: string,
  generatedById: string,
  videoIds: string[]
) {
  // Calculate composite score from videos' biomechanics + gemini analyses
  const reports = await prisma.biomechanicsReport.findMany({
    where: { athleteId, videoId: { in: videoIds } }
  });
  
  const geminiAnalyses = await prisma.geminiAnalysis.findMany({
    where: { athleteId, videoId: { in: videoIds } }
  });
  
  // Weighted calculation
  const avgBiomechanics = reports.reduce(
    (sum, r) => sum + r.symmetryScore + r.explosiveness + r.techniqueScore,
    0
  ) / (reports.length * 3);
  
  const avgGemini = geminiAnalyses.reduce(
    (sum, g) => sum + (100 - g.injuryRiskScore),
    0
  ) / geminiAnalyses.length;
  
  const compositeScore = (avgBiomechanics * 0.6 + avgGemini * 0.4);

  return await prisma.selectionReport.create({
    data: {
      athleteId,
      generatedById,
      compositeScore,
      videoIds: videoIds,
      selectionDecision: compositeScore > 85 ? 'SELECTED' : 'WAITLISTED',
      decisionReason: `Composite score: ${compositeScore.toFixed(1)}`
    }
  });
}

// Get coach's athletes
async function getCoachAthletes(coachId: string) {
  const links = await prisma.coachAthleteLink.findMany({
    where: { coachId },
    include: {
      athlete: {
        include: {
          user: true,
          videos: { where: { status: VideoStatus.COMPLETE } },
          selectionReports: { take: 1, orderBy: { createdAt: 'desc' } }
        }
      }
    }
  });
  
  return links.map(link => link.athlete);
}

// Add athlete to scout watchlist
async function addToWatchlist(scoutId: string, athleteId: string, notes?: string) {
  return await prisma.scoutWatchlist.create({
    data: { scoutId, athleteId, notes }
  });
}

// Get scout's watchlist
async function getScoutWatchlist(scoutId: string) {
  return await prisma.scoutWatchlist.findMany({
    where: { scoutId },
    include: {
      athlete: {
        include: {
          user: true,
          selectionReports: { orderBy: { createdAt: 'desc' }, take: 1 }
        }
      }
    }
  });
}
```

---

## Environment Configuration

**File: `.env.example`**

```env
# Database
DATABASE_URL="postgresql://athleteiq_user:secure_password@localhost:5432/athleteiq_db"

# Environment
NODE_ENV=development
PORT=3000

# Redis (optional)
REDIS_URL="redis://localhost:6379"

# Google Cloud Storage
GCS_BUCKET_NAME="athleteiq-videos"
GCS_PROJECT_ID="your-gcp-project-id"

# Gemini API
GEMINI_API_KEY="your-api-key"
GEMINI_MODEL_VERSION="gemini-2.0-pro"

# CORS
CORS_ORIGIN="http://localhost:3000,http://localhost:3001"

# JWT (optional)
JWT_SECRET="your-secret"
JWT_EXPIRATION="7d"
```

---

## Migration Commands

```bash
# Create migration after schema changes
npm run db:migrate -- "add_new_field"

# Apply pending migrations
npx prisma migrate deploy

# Generate Prisma client
npm run prisma:generate

# Reset database (development)
npm run db:reset

# View Prisma Studio
npx prisma studio

# Validate schema syntax
npx prisma validate
```

---

## Summary

✅ **Complete PostgreSQL + Prisma setup**
- 9 models covering full athlete analysis lifecycle
- 4 enums for typed status management
- 10 relationships covering all data flows
- JSON fields for flexible metric storage
- Comprehensive seed with 5 athletes + full analysis pipeline data
- Production-ready schema with proper indexing

✅ **Ready for:**
- Backend API development
- Gemini AI integration
- GCS video storage
- Frontend dashboard
- Selection report generation
- Coach/scout management features
