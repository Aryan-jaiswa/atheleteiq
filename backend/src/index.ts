import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { testFirebaseConnection } from './config/firebase';
import { initializeGCS } from './config/gcs';
import { initializeRedis, initializeQueues, queueAvailable } from './config/queue';
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

app.use(
  cors({
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'backend',
    timestamp: new Date().toISOString(),
    database: 'connected',
    redis: queueAvailable,
  });
});

app.use('/api/auth', authRouter);
app.use('/api/analysis', analysisRouter);
app.use('/api/videos', videosRouter);
app.use('/api/internal', internalRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/coach', coachRouter);
app.use('/api/scout', scoutRouter);

async function start() {
  try {
    const firebaseReady = await testFirebaseConnection();
    if (!firebaseReady) {
      console.warn('Firebase may not be properly configured');
    }
  } catch (error) {
    console.warn('Firebase startup check failed:', error);
  }

  try {
    initializeGCS();
    console.log('Google Cloud Storage initialized');
  } catch (error) {
    console.warn('Google Cloud Storage failed to initialize:', error);
  }

  try {
    initializeRedis();
    initializeQueues();
  } catch (error) {
    console.warn('Redis startup failed, continuing without queues:', error);
  }

  app.listen(port, () => {
    console.log(`Backend API running on port ${port}`);
  });
}

start();
