import Queue from 'bull';
import Redis from 'redis';

// Job types
export type VideoProcessingJob = {
  videoId: string;
  gcsUrl: string;
  sport: string;
  athleteId: string;
  durationSeconds: number;
};

export type PoseDetectionJob = {
  videoId: string;
  framesFolderGcsPath: string;
  frameCount: number;
  sport: string;
  athleteId: string;
};

// Redis client for general use
let redisClient: any;
let redisConnected = false;

// Bull queues
let videoProcessingQueue: Queue.Queue<VideoProcessingJob>;
let poseDetectionQueue: Queue.Queue<PoseDetectionJob>;

export function initializeRedis(): Redis.RedisClient | null {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  
  try {
    // Check if Redis.createClient exists (v3 API)
    if (typeof Redis.createClient === 'function') {
      redisClient = Redis.createClient({
        url: redisUrl,
      } as any);

      redisClient.on?.('error', (err: any) => {
        console.error('Redis connection error:', err);
        redisConnected = false;
      });

      redisClient.on?.('connect', () => {
        console.log('✅ Redis connected');
        redisConnected = true;
      });

      return redisClient;
    } else {
      // Redis v4+ or module not properly loaded
      console.warn('⚠️  Redis client not available - using mock Redis for queues');
      redisConnected = false;
      return null;
    }
  } catch (error) {
    console.warn('⚠️  Failed to initialize Redis:', error);
    redisConnected = false;
    return null;
  }
}

export function getRedisClient(): Redis.RedisClient | null {
  if (!redisClient) {
    initializeRedis();
  }
  return redisClient;
}

export function initializeQueues(): {
  videoProcessingQueue: Queue.Queue<VideoProcessingJob> | null;
  poseDetectionQueue: Queue.Queue<PoseDetectionJob> | null;
} {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  try {
    // Video processing queue - for frame extraction
    videoProcessingQueue = new Queue<VideoProcessingJob>('video-processing', {
      redis: redisUrl,
      settings: {
        maxStalledCount: 2,
        lockDuration: 30000, // 30 seconds
        lockRenewTime: 15000, // 15 seconds
        maxRetriesPerJob: 3,
        retryProcessDelay: 5000, // 5 seconds between retries
      },
    });

    // Pose detection queue - for pose analysis
    poseDetectionQueue = new Queue<PoseDetectionJob>('pose-detection', {
      redis: redisUrl,
      settings: {
        maxStalledCount: 2,
        lockDuration: 60000, // 60 seconds
        lockRenewTime: 30000, // 30 seconds
        maxRetriesPerJob: 2,
        retryProcessDelay: 10000, // 10 seconds between retries
      },
    });

    // Event listeners
    videoProcessingQueue.on('error', (err) => {
      console.error('Video processing queue error:', err);
    });

    videoProcessingQueue.on('failed', (job, err) => {
      console.error(`Video processing job ${job.id} failed:`, err.message);
    });

    poseDetectionQueue.on('error', (err) => {
      console.error('Pose detection queue error:', err);
    });

    poseDetectionQueue.on('failed', (job, err) => {
      console.error(`Pose detection job ${job.id} failed:`, err.message);
    });

    console.log('✅ Bull queues initialized');
    return { videoProcessingQueue, poseDetectionQueue };
  } catch (error) {
    console.warn('⚠️  Failed to initialize Bull queues:', error);
    return { videoProcessingQueue: null, poseDetectionQueue: null };
  }
}

export function getVideoProcessingQueue(): Queue.Queue<VideoProcessingJob> {
  if (!videoProcessingQueue) {
    const { videoProcessingQueue: vpq } = initializeQueues();
    videoProcessingQueue = vpq;
  }
  return videoProcessingQueue;
}

export function getPoseDetectionQueue(): Queue.Queue<PoseDetectionJob> {
  if (!poseDetectionQueue) {
    const { poseDetectionQueue: pdq } = initializeQueues();
    poseDetectionQueue = pdq;
  }
  return poseDetectionQueue;
}

export async function addVideoProcessingJob(
  job: VideoProcessingJob,
  priority?: number
): Promise<void> {
  const queue = getVideoProcessingQueue();
  await queue.add(job, {
    priority: priority || 1,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 3600, // Remove after 1 hour
    },
    removeOnFail: false, // Keep failed jobs for debugging
  });
}

export async function addPoseDetectionJob(
  job: PoseDetectionJob,
  priority?: number
): Promise<void> {
  const queue = getPoseDetectionQueue();
  await queue.add(job, {
    priority: priority || 1,
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
    removeOnComplete: {
      age: 3600, // Remove after 1 hour
    },
    removeOnFail: false, // Keep failed jobs for debugging
  });
}

export async function getJobStatus(
  queueName: 'video-processing' | 'pose-detection',
  jobId: string
): Promise<{
  state: string;
  progress: number;
  attempts: number;
  failedReason?: string;
} | null> {
  const queue = queueName === 'video-processing' 
    ? getVideoProcessingQueue() 
    : getPoseDetectionQueue();
  
  const job = await queue.getJob(jobId);
  
  if (!job) {
    return null;
  }

  const state = await job.getState();
  const progress = job.progress();

  return {
    state,
    progress: typeof progress === 'number' ? progress : 0,
    attempts: job.attemptsMade,
    failedReason: job.failedReason,
  };
}

export async function closeQueues(): Promise<void> {
  if (videoProcessingQueue) {
    await videoProcessingQueue.close();
  }
  if (poseDetectionQueue) {
    await poseDetectionQueue.close();
  }
  if (redisClient) {
    redisClient.quit();
  }
}
