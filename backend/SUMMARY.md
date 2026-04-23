# AthleteIQ Database Setup - Complete Summary

## ✅ What Has Been Set Up

### 1. **Prisma Schema** (`prisma/schema.prisma`)
Complete data model with 9 interconnected models and 4 enums:

#### Enums:
- `Role`: ATHLETE, COACH, SCOUT, FEDERATION, ADMIN
- `DominantSide`: LEFT, RIGHT
- `VideoType`: TRAINING, MATCH
- `VideoStatus`: QUEUED → EXTRACTING_FRAMES → POSE_DETECTION → BIOMECHANICS → GEMINI_ANALYSIS → COMPLETE (or FAILED)
- `SelectionDecision`: SELECTED, WAITLISTED, REJECTED, PENDING

#### Models:

**1. User** (Authentication & Management)
```
- id (UUID, primary key)
- name, email (unique), phone, role, sport, region, state, createdAt
- Relationships: athleteProfile, videosUploaded, reportsGenerated, athletesCoached, athletesScouted
```

**2. AthleteProfile** (Athlete Data)
```
- id (UUID), userId (unique FK), sport, dateOfBirth, height (cm), weight (kg)
- dominantSide, region, state, bio, profilePhotoUrl
- overallScore (float 0-100), selectionEligible (boolean)
- Relationships: user, videos, biomechanicsReports, geminiAnalyses, selectionReports, coaches, scoutsWatching
```

**3. Video** (Raw Content Pipeline)
```
- id, athleteId (FK), uploadedAt, gcsRawUrl, type, sport, durationSeconds
- status (pipeline stage), errorMessage, frameCount, processedAt, uploaderId (FK)
- Relationships: athlete, uploader, poseAnalysis, biomechanicsReport, geminiAnalysis
- One-to-one relationships with PoseAnalysis, BiomechanicsReport, GeminiAnalysis
```

**4. PoseAnalysis** (MediaPipe Extraction)
```
- id, videoId (unique FK)
- frameTimestamps (JSON array: milliseconds per frame)
- keypointSeries (JSON: 33 keypoints [x, y, confidence] per frame)
- extractionDurationMs
```

**5. BiomechanicsReport** (Movement Metrics)
```
- id, videoId (unique FK), athleteId (FK)
- jointAngles (JSON: knee_flexion_left/right, hip_angle, shoulder_angle, elbow_angle)
- velocityMetrics (JSON: stride_velocity, arm_swing_velocity, center_of_mass_velocity)
- accelerationMetrics (JSON: peak values, deceleration patterns)
- Scores (0-100): symmetryScore, balanceScore, explosiveness, enduranceIndex, techniqueScore
- reactionTime (ms), sport, createdAt
```

**6. GeminiAnalysis** (AI Insights)
```
- id, videoId (unique FK), athleteId (FK)
- modelVersion, rawPrompt, rawResponse (full interaction logs)
- strengths (JSON: string[]), weaknesses (JSON: string[])
- tacticalIntelligence, movementEfficiency, coachNotes (text)
- injuryRiskScore (0-100), injuryRiskAreas (JSON: string[])
- aiSummary (3-4 sentence plain English), createdAt
```

**7. SelectionReport** (Final Evaluation)
```
- id, athleteId (FK), generatedById (FK), generatedAt, createdAt
- compositeScore (0-100), selectionDecision (SELECTED|WAITLISTED|REJECTED|PENDING)
- decisionReason (text), videoIds (JSON: array), reportPdfUrl
```

**8. CoachAthleteLink** (Many-to-Many)
```
- Composite key: (coachId, athleteId)
- assignedAt
```

**9. ScoutWatchlist** (Many-to-Many)
```
- Composite key: (scoutId, athleteId)
- notes (optional), addedAt
```

### 2. **Comprehensive Seed Data** (`prisma/seed.ts`)

**Generates on every run:**
- 3 management users:
  - 1 Scout (John Scout, West Coast)
  - 1 Federation Admin (National)
  - 1 Coach (Mike Coach, Midwest)

- 5 Elite Athletes with complete profiles:
  1. Alice Springer (100m sprinter, Track and Field, 178cm, 68kg, RIGHT-handed)
  2. Bob Jumper (Long Jump, 185cm, 75kg, LEFT-handed)
  3. Charlie Kicks (Soccer striker, 175cm, 70kg)
  4. Diana Throws (Javelin, 182cm, 72kg)
  5. Evan Blocks (Volleyball blocker, 195cm, 88kg, highest reach)

- 10 Videos (2 per athlete):
  - Type: TRAINING + MATCH
  - GCS URLs with realistic paths
  - Frame counts: 300-500 frames @ 30fps
  - Status: COMPLETE with processedAt timestamps
  - Random upload dates (within last 30 days)

- 10 Pose Analyses:
  - Full MediaPipe 33-keypoint series for each frame
  - Frame timestamps in milliseconds
  - Extraction duration: 2-5 seconds

- 10 Biomechanics Reports:
  - Joint angle ranges (min/max/avg):
    - Knee flexion: 35-155°
    - Hip angle: 60-120°
    - Shoulder angle: 45-170°
    - Elbow angle: 50-160°
  - Realistic velocity metrics (stride, arm swing, CoM)
  - Performance scores: 80-95 range (elite athletes)
  - Injury risk scores: 20-40 range (low risk)

- 10 Gemini Analyses:
  - Model version: gemini-2.0-pro
  - Strengths: explosiveness, kinetic chain efficiency, core stability, acceleration
  - Weaknesses: minor asymmetries, mobility improvements
  - Tactical intelligence, movement efficiency notes
  - Injury risk areas: knee/ankle flags
  - AI summaries: 3-4 sentences per athlete

- 2 Selection Reports:
  1. **Alice Springer** → SELECTED (89.5/100)
     - Decision: "Exceptional biomechanical efficiency"
  2. **Bob Jumper** → WAITLISTED (76.5/100)
     - Decision: "Strong potential, needs symmetry improvement"

- Coach-athlete links: Coach → Alice & Bob
- Scout watchlist: Scout tracking Alice & Charlie

### 3. **Package.json Scripts** (Added)
```json
"db:migrate": "prisma migrate dev --name",
"db:push": "prisma db push",
"db:seed": "ts-node prisma/seed.ts",
"db:reset": "prisma migrate reset --force",
"prisma:generate": "prisma generate"
```

### 4. **Configuration Files**

#### `.env.example` (Configuration Template)
- DATABASE_URL
- NODE_ENV, PORT
- REDIS_URL
- GCS_BUCKET_NAME, GCS_PROJECT_ID
- GEMINI_API_KEY, GEMINI_MODEL_VERSION
- CORS_ORIGIN
- JWT_SECRET, JWT_EXPIRATION

#### `DATABASE_SETUP.md` (Complete Guide)
- 60+ lines covering:
  - Schema overview with ER-like diagram
  - Detailed field specifications
  - Setup instructions for macOS/Linux/Windows
  - Migration workflows
  - JSON field specifications
  - Troubleshooting guide
  - Performance considerations

#### `QUICK_START.md` (5-Minute Setup)
- Step-by-step commands
- Command reference table
- What gets seeded
- Verification steps
- Troubleshooting quick fixes

---

## 📋 Database Lifecycle (How It Works)

```
1. Video Upload → gcsRawUrl stored
   ↓
2. Pipeline Status: QUEUED
   ↓
3. Pose Extraction → PoseAnalysis created
   Status: EXTRACTING_FRAMES → POSE_DETECTION
   ↓
4. Biomechanics Calculation → BiomechanicsReport created
   Status: BIOMECHANICS
   ↓
5. Gemini AI Analysis → GeminiAnalysis created
   Status: GEMINI_ANALYSIS
   ↓
6. Selection Report Generation → SelectionReport created (if requested)
   Status: COMPLETE
   ↓
7. Final state: selectionEligible flag checked, compositeScore weighted
```

---

## 🚀 Deployment Checklist

### Local Development
- [ ] PostgreSQL installed and running
- [ ] `.env` file created with DATABASE_URL
- [ ] `npm install` completed
- [ ] `npm run db:push` executed
- [ ] `npm run db:seed` executed (creates 5 athletes + analysis)
- [ ] `npx prisma studio` verified (can view data)

### Database Verification
```bash
# Check user count
psql -U athleteiq_user -d athleteiq_db -c "SELECT COUNT(*) FROM \"User\";"
# Expected: 8 (3 admins + 5 athletes)

# Check athlete count
psql -U athleteiq_user -d athleteiq_db -c "SELECT COUNT(*) FROM \"AthleteProfile\";"
# Expected: 5

# Check video count
psql -U athleteiq_user -d athleteiq_db -c "SELECT COUNT(*) FROM \"Video\";"
# Expected: 10

# Check biomechanics
psql -U athleteiq_user -d athleteiq_db -c "SELECT COUNT(*) FROM \"BiomechanicsReport\";"
# Expected: 10

# Check selection reports
psql -U athleteiq_user -d athleteiq_db -c "SELECT COUNT(*) FROM \"SelectionReport\";"
# Expected: 2
```

### Prisma Verification
```bash
# Validate schema syntax
npx prisma validate

# Generate client
npm run prisma:generate

# View migrations
ls -la prisma/migrations/
```

---

## 🔧 Making Changes

### Modify Schema
```bash
# 1. Edit prisma/schema.prisma
# 2. Create migration
npm run db:migrate -- "descriptive_name"
# 3. Migrations apply automatically
```

### Update Seed Data
```bash
# 1. Edit prisma/seed.ts
# 2. Run seed again
npm run db:seed
```

### Full Reset (Development Only)
```bash
npm run db:reset
# This: drops all data → runs migrations → runs seed
```

---

## 📊 Sample Query Patterns

```typescript
// Get athlete with all videos and analysis
const athlete = await prisma.athleteProfile.findUnique({
  where: { id: athleteId },
  include: {
    user: true,
    videos: {
      include: {
        poseAnalysis: true,
        biomechanicsReport: true,
        geminiAnalysis: true
      }
    }
  }
});

// Get all COMPLETE videos ready for selection report
const completedVideos = await prisma.video.findMany({
  where: { status: 'COMPLETE' },
  include: { biomechanicsReport: true, geminiAnalysis: true }
});

// Get athlete's selection reports
const reports = await prisma.selectionReport.findMany({
  where: { athleteId },
  include: { generatedBy: true }
});

// Get coach's athletes
const coachAthletes = await prisma.coachAthleteLink.findMany({
  where: { coachId },
  include: { athlete: { include: { user: true } } }
});
```

---

## 📝 Files Created/Modified

| File | Status | Purpose |
|------|--------|---------|
| `prisma/schema.prisma` | ✅ Complete | 9 models + 4 enums |
| `prisma/seed.ts` | ✅ Enhanced | 5 athletes + 10 videos + analysis |
| `backend/package.json` | ✅ Updated | Added db scripts |
| `.env.example` | ✅ Created | Configuration template |
| `DATABASE_SETUP.md` | ✅ Created | Comprehensive guide |
| `QUICK_START.md` | ✅ Created | 5-minute setup |
| `SUMMARY.md` | ✅ This file | Overview document |

---

## 🎯 Next Steps

1. **Set up local PostgreSQL** (if not already done)
2. **Run commands from QUICK_START.md** to initialize
3. **Start backend API** with `npm run dev`
4. **Build endpoints** in `src/routes/analysis.ts` to:
   - POST /videos (receive upload, create Video record)
   - GET /athletes/:id (retrieve profile + videos + analysis)
   - GET /reports/:id (retrieve SelectionReport)
   - POST /reports (generate new SelectionReport)
5. **Integrate Gemini API** for live AI analysis
6. **Connect to GCS** for video storage
7. **Build frontend** to display athlete profiles and reports

---

**Status: ✅ PostgreSQL + Prisma fully configured with production-ready schema and comprehensive seed data**
