# AthleteIQ Database Setup Guide

## Overview

AthleteIQ uses **PostgreSQL** with **Prisma ORM** to manage the complete athlete video analysis lifecycle. The database stores raw video uploads, pose extraction data, biomechanics calculations, Gemini AI insights, and selection reports.

## Database Schema

### Core Data Model

```
User (Scouts, Coaches, Federation Admins, Athletes)
  ├── AthleteProfile (extends User, sport-specific data)
  │   ├── Video (multiple videos per athlete)
  │   │   ├── PoseAnalysis (MediaPipe 33-keypoint extraction)
  │   │   ├── BiomechanicsReport (joint angles, velocities, performance metrics)
  │   │   └── GeminiAnalysis (AI-powered insights)
  │   ├── SelectionReport (composite evaluation)
  │   ├── CoachAthleteLink (coach assignments)
  │   └── ScoutWatchlist (scout tracking)
```

### Models

#### 1. **User**
- `id`: UUID (primary key)
- `name`, `email` (unique), `phone`, `role` (ATHLETE | COACH | SCOUT | FEDERATION | ADMIN)
- `sport`, `region`, `state`
- `createdAt`: timestamp

#### 2. **AthleteProfile**
- `id`: UUID
- `userId`: foreign key → User (one-to-one)
- `sport`, `dateOfBirth`, `height` (cm), `weight` (kg)
- `dominantSide` (LEFT | RIGHT)
- `bio`, `profilePhotoUrl`
- `overallScore`: 0-100 (AI-computed composite)
- `selectionEligible`: boolean

#### 3. **Video**
- `id`: UUID
- `athleteId`: foreign key → AthleteProfile
- `uploadedAt`: timestamp
- `gcsRawUrl`: GCS path
- `type` (TRAINING | MATCH), `sport`
- `durationSeconds`, `frameCount`
- `status`: QUEUED → EXTRACTING_FRAMES → POSE_DETECTION → BIOMECHANICS → GEMINI_ANALYSIS → COMPLETE (or FAILED)
- `errorMessage`, `processedAt`

#### 4. **PoseAnalysis**
- `id`: UUID
- `videoId`: foreign key → Video (one-to-one)
- `frameTimestamps`: JSON array (milliseconds per frame)
- `keypointSeries`: JSON (MediaPipe 33-keypoint data per frame)
  - 33 keypoints: nose, eyes, ears, mouth, shoulders, elbows, wrists, fingers, hips, knees, ankles
  - Each: [x, y, confidence]
- `extractionDurationMs`: processing time

#### 5. **BiomechanicsReport**
- `id`: UUID
- `videoId`, `athleteId`: foreign keys (one report per video)
- **jointAngles** (JSON):
  - knee_flexion_left/right: {min, max, avg}
  - hip_angle, shoulder_angle, elbow_angle
- **velocityMetrics** (JSON):
  - stride_velocity, arm_swing_velocity, center_of_mass_velocity
- **accelerationMetrics** (JSON):
  - peak_acceleration, deceleration_patterns
- **Performance Scores** (0-100):
  - symmetryScore, balanceScore, explosiveness, enduranceIndex, techniqueScore
- `reactionTime` (ms), `sport`
- `createdAt`

#### 6. **GeminiAnalysis**
- `id`: UUID
- `videoId`, `athleteId`: foreign keys (one per video)
- `modelVersion`: "gemini-2.0-pro"
- `rawPrompt`, `rawResponse`: full API interaction log
- **strengths**, **weaknesses**: JSON string arrays
- `tacticalIntelligence`, `movementEfficiency`, `coachNotes`: text fields
- `injuryRiskScore` (0-100), `injuryRiskAreas`: JSON string array
- `aiSummary`: 3-4 sentence plain English summary
- `createdAt`

#### 7. **SelectionReport**
- `id`: UUID
- `athleteId`: foreign key → AthleteProfile
- `generatedById`: foreign key → User (federation/scout)
- `compositeScore` (0-100): weighted average of biomechanics + Gemini + history
- `selectionDecision` (SELECTED | WAITLISTED | REJECTED | PENDING)
- `decisionReason`: justification text
- `videoIds`: JSON array of analyzed video IDs
- `reportPdfUrl`: GCS path
- `generatedAt`, `createdAt`

#### 8. **CoachAthleteLink**
- Composite key: (coachId, athleteId)
- `assignedAt`: timestamp

#### 9. **ScoutWatchlist**
- Composite key: (scoutId, athleteId)
- `notes`: optional text
- `addedAt`: timestamp

---

## Setup Instructions

### Step 1: Install PostgreSQL

**macOS (Homebrew):**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
- Download from [postgresql.org](https://www.postgresql.org/download/windows/)
- Use the installer
- Note: pgAdmin is included for GUI access

### Step 2: Create Database and User

```bash
# Connect to PostgreSQL as superuser
psql -U postgres

# Inside psql:
CREATE USER athleteiq_user WITH PASSWORD 'secure_password';
CREATE DATABASE athleteiq_db OWNER athleteiq_user;
GRANT ALL PRIVILEGES ON DATABASE athleteiq_db TO athleteiq_user;
\q
```

### Step 3: Configure Environment

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Update `.env` with your database credentials:
```
DATABASE_URL="postgresql://athleteiq_user:secure_password@localhost:5432/athleteiq_db"
```

### Step 4: Generate Prisma Client

```bash
cd backend
npm run prisma:generate
```

### Step 5: Run Migrations

**Option A: Create migration from schema (recommended for first setup):**
```bash
npm run db:push
```

**Option B: Create named migration:**
```bash
npm run db:migrate -- "initial_schema"
```

### Step 6: Seed Database with Sample Data

```bash
npm run db:seed
```

This creates:
- 5 athletes with complete profiles
- 10 videos (2 per athlete) with various sports
- Pose analysis data (MediaPipe 33-keypoint series)
- Biomechanics reports with joint angles, velocity, acceleration
- Gemini AI analysis with strengths, weaknesses, injury risk
- 2 selection reports (SELECTED and WAITLISTED)
- Coach-athlete links and scout watchlist entries

### Step 7: Verify Setup

```bash
# Open Prisma Studio to view data in UI
npx prisma studio

# Or connect with psql:
psql -U athleteiq_user -d athleteiq_db -c "SELECT COUNT(*) FROM users;"
```

---

## Database Operations

### View Schema
```bash
npx prisma studio
```

### Generate Updated Client
```bash
npm run prisma:generate
```

### Create Migration After Schema Changes
```bash
npm run db:migrate -- "descriptive_name"
```

### Reset Database (⚠️ destructive)
```bash
npm run db:reset
```

### View Migration History
```bash
ls prisma/migrations/
```

### Connect via psql
```bash
psql -U athleteiq_user -d athleteiq_db
# List tables: \dt
# View schema: \d+ <table_name>
# Exit: \q
```

---

## JSON Field Specifications

### PoseAnalysis.frameTimestamps
```json
[0, 33.33, 66.67, 100.0, ...]  // milliseconds
```

### PoseAnalysis.keypointSeries
```json
[
  {
    "nose": [320.5, 240.2, 0.95],
    "left_shoulder": [280.1, 310.3, 0.93],
    "left_knee": [290.5, 450.1, 0.91],
    ...
  },
  { /* frame 2 */ }
]
```

### BiomechanicsReport.jointAngles
```json
{
  "knee_flexion_left": { "min": 35, "max": 150, "avg": 92 },
  "knee_flexion_right": { "min": 32, "max": 155, "avg": 94 },
  "hip_angle": { "min": 60, "max": 120, "avg": 95 },
  "shoulder_angle": { "min": 45, "max": 170, "avg": 110 },
  "elbow_angle": { "min": 50, "max": 160, "avg": 115 }
}
```

### GeminiAnalysis.strengths / weaknesses
```json
[
  "Excellent explosiveness and power generation",
  "Good kinetic chain efficiency",
  "Strong core stability"
]
```

### SelectionReport.videoIds
```json
["uuid-1", "uuid-2", "uuid-3"]
```

---

## Common Issues

### "Connection refused" error
- Check PostgreSQL is running: `brew services list` (macOS) or `sudo systemctl status postgresql` (Linux)
- Verify DATABASE_URL in .env
- Test connection: `psql -U athleteiq_user -d athleteiq_db`

### "role 'athleteiq_user' does not exist"
```bash
psql -U postgres -c "CREATE USER athleteiq_user WITH PASSWORD 'secure_password';"
```

### "Cannot find module '@prisma/client'"
```bash
npm install
npm run prisma:generate
```

### Migration failed
```bash
# Reset and start fresh:
npm run db:reset
npm run db:seed
```

---

## Performance Considerations

- **JSON fields**: Consider indexing frequently-queried JSON fields:
  ```sql
  CREATE INDEX idx_biomechanics_symmetry ON "BiomechanicsReport" USING GIN (symmetryScore);
  ```
- **Video status filtering**: Add index on `Video(status)` for efficient pipeline monitoring
- **Athlete lookup**: Email and userId queries are already indexed
- **Pagination**: Implement cursor-based pagination for large video/report queries

---

## Next Steps

1. ✅ Database schema created with Prisma
2. ✅ Migrations ready to deploy
3. ✅ Sample data seeded
4. 🚀 Build API endpoints in `/src/routes/`
5. 🚀 Integrate Gemini API for AI analysis
6. 🚀 Build frontend to display reports
7. 🚀 Connect to GCS for video storage

---

## Support

For Prisma documentation: https://www.prisma.io/docs/
For PostgreSQL docs: https://www.postgresql.org/docs/
