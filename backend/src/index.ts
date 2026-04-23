import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { testFirebaseConnection } from './config/firebase';
import { initializeGCS } from './config/gcs';
import { initializeRedis, initializeQueues } from './config/queue';
import authRouter from './routes/auth';
import analysisRouter from './routes/analysis';
import videosRouter from './routes/videos';
import internalRouter from './routes/internal';
import reportsRouter from './routes/reports';
import coachRouter from './routes/coach';
import scoutRouter from './routes/scout';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(
  cors({
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/analysis', analysisRouter);
app.use('/api/videos', videosRouter);
app.use('/api/internal', internalRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/coach', coachRouter);
app.use('/api/scout', scoutRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'athleteiq-backend' });
});

async function start() {
  try {
    // Test Firebase connection
    const firebaseReady = await testFirebaseConnection();
    if (!firebaseReady) {
      console.warn('⚠️  Warning: Firebase may not be properly configured');
    }

    // Initialize Google Cloud Storage
    try {
      initializeGCS();
      console.log('✅ Google Cloud Storage initialized');
    } catch (error) {
      console.warn('⚠️  Warning: Google Cloud Storage failed to initialize:', error);
    }

    // Initialize Redis and Bull queues
    try {
      initializeRedis();
      const { videoProcessingQueue, poseDetectionQueue } = initializeQueues();
      if (videoProcessingQueue && poseDetectionQueue) {
        console.log('✅ Redis and Bull queues initialized');
      } else {
        console.warn('⚠️  Warning: Bull queues not fully initialized (Redis may be unavailable)');
      }
    } catch (error) {
      console.warn('⚠️  Warning: Queue initialization failed (non-critical):', error);
    }

    app.listen(port, () => {
      console.log(`✅ Backend API running on port ${port}`);
      console.log(`📝 Auth routes available at /api/auth`);
      console.log(`📹 Video routes available at /api/videos`);
      console.log(`📊 Reports routes available at /api/reports`);
      console.log(`👨‍🏫 Coach routes available at /api/coach`);
      console.log(`🔍 Scout routes available at /api/scout`);
      console.log(`🔧 Internal routes available at /api/internal`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

start();
