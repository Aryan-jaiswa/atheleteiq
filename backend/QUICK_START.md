# AthleteIQ Database - Quick Start

## Prerequisites
- PostgreSQL 13+ installed and running
- Node.js 18+ with npm

## 5-Minute Setup

```bash
# 1. Navigate to backend
cd backend

# 2. Install dependencies (if not already done)
npm install

# 3. Copy environment template
cp .env.example .env

# 4. Edit .env with your PostgreSQL credentials
# DATABASE_URL="postgresql://athleteiq_user:password@localhost:5432/athleteiq_db"

# 5. Create PostgreSQL database and user
psql -U postgres -c "CREATE USER athleteiq_user WITH PASSWORD 'secure_password';"
psql -U postgres -c "CREATE DATABASE athleteiq_db OWNER athleteiq_user;"

# 6. Initialize Prisma and database
npm run db:push

# 7. Seed with sample data (5 athletes + videos + analysis)
npm run db:seed

# 8. View data (optional - opens Prisma Studio web UI)
npx prisma studio
```

## Database Commands Reference

| Command | Purpose |
|---------|---------|
| `npm run db:push` | Create/update database from schema (first time) |
| `npm run db:migrate -- "name"` | Create a migration with a descriptive name |
| `npm run db:seed` | Populate database with 5 sample athletes |
| `npm run db:reset` | ⚠️ DESTRUCTIVE: Drop all data and reseed |
| `npm run prisma:generate` | Generate Prisma Client |
| `npx prisma studio` | Open web UI to browse/edit data |
| `npx prisma validate` | Check schema syntax |

## What Gets Seeded

✅ **3 Users**: Scout, Federation Admin, Coach
✅ **5 Athletes**: Full profiles with dateOfBirth, dimensions, bios
✅ **10 Videos**: 2 per athlete (training + match)
✅ **10 Pose Analyses**: MediaPipe 33-keypoint data series
✅ **10 Biomechanics Reports**: Joint angles, velocities, performance scores
✅ **10 Gemini Analyses**: AI insights, injury risk, strengths/weaknesses
✅ **2 Selection Reports**: SELECTED and WAITLISTED decisions
✅ **4 Coach-Athlete Links**: Coach assigned to athletes
✅ **2 Scout Watchlist Entries**: Athletes on scout radar

## Database Schema Files

- `prisma/schema.prisma` - Main schema definition (9 models, 4 enums)
- `prisma/seed.ts` - Seed data generator
- `prisma/migrations/` - Migration history (auto-generated)
- `.env.example` - Configuration template
- `DATABASE_SETUP.md` - Detailed setup documentation

## Verify Installation

```bash
# Check Prisma is working
npx prisma validate

# Connect to database
psql -U athleteiq_user -d athleteiq_db

# Count records
SELECT COUNT(*) FROM "User";
SELECT COUNT(*) FROM "AthleteProfile";
SELECT COUNT(*) FROM "Video";

# Exit psql
\q
```

## Troubleshooting

**"Database connection refused"**
```bash
# Check PostgreSQL is running
# macOS: brew services list
# Linux: sudo systemctl status postgresql

# Restart if needed
# macOS: brew services restart postgresql@15
# Linux: sudo systemctl restart postgresql
```

**"Role does not exist"**
```bash
# Recreate user
psql -U postgres -c "DROP USER IF EXISTS athleteiq_user;"
psql -U postgres -c "CREATE USER athleteiq_user WITH PASSWORD 'secure_password';"
psql -U postgres -c "CREATE DATABASE athleteiq_db OWNER athleteiq_user;"
npm run db:push
```

**"Module not found"**
```bash
npm install
npm run prisma:generate
```

## Development Workflow

1. **Modify schema**: Edit `prisma/schema.prisma`
2. **Create migration**: `npm run db:migrate -- "feature_name"`
3. **Apply changes**: Migrations run automatically
4. **View changes**: `npx prisma studio`
5. **Reseed if needed**: `npm run db:reset` (development only)

## Production Deployment

```bash
# Generate client for production
npm run prisma:generate

# Run pending migrations
npx prisma migrate deploy

# DO NOT run db:seed in production
```

## Data Access in Backend Code

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Example queries
const athletes = await prisma.athleteProfile.findMany({
  include: { videos: true }
});

const report = await prisma.selectionReport.findUnique({
  where: { id: reportId },
  include: { athlete: true, generatedBy: true }
});
```

---

For detailed documentation, see `DATABASE_SETUP.md`
