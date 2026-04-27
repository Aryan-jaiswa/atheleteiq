import Queue from 'bull';
import Redis from 'redis';

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

let redisClient: any;
export let queueAvailable = false;

let videoProcessingQueue: Queue.Queue<VideoProcessingJob> | null = null;
let poseDetectionQueue: Queue.Queue<PoseDetectionJob> | null = null;

function markQueueUnavailable() {
  queueAvailable = false;
  console.warn('⚠️  Redis unavailable — video processing queue disabled');
}

export function initializeRedis(): Redis.RedisClient | null {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  try {
    if (typeof Redis.createClient !== 'function') {
      markQueueUnavailable();
      return null;
    }

    redisClient = Redis.createClient({
      url: redisUrl,
    } as any);

    redisClient.on?.('error', () => {
      markQueueUnavailable();
    });

    return redisClient;
  } catch (error) {
    markQueueUnavailable();
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
  if (videoProcessingQueue && poseDetectionQueue) {
    return { videoProcessingQueue, poseDetectionQueue };
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  try {
    if (!getRedisClient()) {
      markQueueUnavailable();
      return { videoProcessingQueue: null, poseDetectionQueue: null };
    }

    videoProcessingQueue = new Queue<VideoProcessingJob>('video-processing', {
      redis: redisUrl,
      settings: {
        maxStalledCount: 2,
        lockDuration: 30000,
        lockRenewTime: 15000,
        maxRetriesPerJob: 3,
        retryProcessDelay: 5000,
      },
    });

    poseDetectionQueue = new Queue<PoseDetectionJob>('pose-detection', {
      redis: redisUrl,
      settings: {
        maxStalledCount: 2,
        lockDuration: 60000,
        lockRenewTime: 30000,
        maxRetriesPerJob: 2,
        retryProcessDelay: 10000,
      },
    });

    videoProcessingQueue.on('error', () => {
      markQueueUnavailable();
    });
    poseDetectionQueue.on('error', () => {
      markQueueUnavailable();
    });

    videoProcessingQueue.on('failed', (job, err) => {
      console.error(`Video processing job ${job.id} failed:`, err.message);
    });
    poseDetectionQueue.on('failed', (job, err) => {
      console.error(`Pose detection job ${job.id} failed:`, err.message);
    });

    queueAvailable = true;
    return { videoProcessingQueue, poseDetectionQueue };
  } catch (error) {
    videoProcessingQueue = null;
    poseDetectionQueue = null;
    markQueueUnavailable();
    return { videoProcessingQueue: null, poseDetectionQueue: null };
  }
}

export function getVideoProcessingQueue(): Queue.Queue<VideoProcessingJob> | null {
  if (!videoProcessingQueue) {
    videoProcessingQueue = initializeQueues().videoProcessingQueue;
  }
  return videoProcessingQueue;
}

export function getPoseDetectionQueue(): Queue.Queue<PoseDetectionJob> | null {
  if (!poseDetectionQueue) {
    poseDetectionQueue = initializeQueues().poseDetectionQueue;
  }
  return poseDetectionQueue;
}

export async function enqueueVideoProcessing(
  videoId: string,
  job?: VideoProcessingJob,
  priority = 1
): Promise<{ queued: boolean; reason?: string }> {
  if (!queueAvailable) {
    console.warn(`Queue unavailable — video ${videoId} will not be processed`);
    return { queued: false, reason: 'Redis unavailable' };
  }

  const queue = getVideoProcessingQueue();
  if (!queue || !job) {
    console.warn(`Queue unavailable — video ${videoId} will not be processed`);
    return { queued: false, reason: 'Redis unavailable' };
  }

  try {
    await queue.add(job, {
      priority,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: {
        age: 3600,
      },
      removeOnFail: false,
    });

    return { queued: true };
  } catch (error) {
    markQueueUnavailable();
    console.warn(`Queue unavailable — video ${videoId} will not be processed`);
    return { queued: false, reason: 'Redis unavailable' };
  }
}

export async function addVideoProcessingJob(
  job: VideoProcessingJob,
  priority?: number
): Promise<void> {
  const result = await enqueueVideoProcessing(job.videoId, job, priority);
  if (!result.queued) {
    throw new Error(result.reason || 'Redis unavailable');
  }
}

export async function addPoseDetectionJob(
  job: PoseDetectionJob,
  priority?: number
): Promise<void> {
  const queue = getPoseDetectionQueue();
  if (!queueAvailable || !queue) {
    throw new Error('Redis unavailable');
  }

  await queue.add(job, {
    priority: priority || 1,
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 10000,
    },
    removeOnComplete: {
      age: 3600,
    },
    removeOnFail: false,
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
  const queue = queueName === 'video-processing' ? getVideoProcessingQueue() : getPoseDetectionQueue();

  if (!queue) {
    return null;
  }

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
