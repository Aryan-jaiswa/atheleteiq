import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { generateSignedUrl } from '../config/gcs';
import { enqueueVideoProcessing } from '../config/queue';

const prisma = new PrismaClient();

export interface CreateVideoUploadRequest {
  athleteId: string;
  sport: string;
  type: 'TRAINING' | 'MATCH';
  durationSeconds: number;
}

export interface VideoUploadResponse {
  videoId: string;
  signedUploadUrl: string;
  gcsPath: string;
}

export interface ConfirmUploadRequest {
  videoId: string;
}

export interface VideoStatusResponse {
  videoId: string;
  status: string;
  progress: number;
  errorMessage: string | null;
  frameCount: number | null;
}

export interface VideoListResponse {
  id: string;
  sport: string;
  type: string;
  status: string;
  uploadedAt: string;
  durationSeconds: number;
  thumbnailUrl: string | null;
}

/**
 * Create upload session and generate signed URL
 */
export async function createVideoUploadSession(
  req: CreateVideoUploadRequest
): Promise<VideoUploadResponse> {
  const { athleteId, sport, type, durationSeconds } = req;

  // Validate athlete exists
  const athlete = await prisma.athleteProfile.findUnique({
    where: { id: athleteId },
  });

  if (!athlete) {
    throw new Error('Athlete not found');
  }

  // Generate unique video ID
  const videoId = uuidv4();
  
  // Generate GCS path: videos/{athleteId}/{videoId}/{timestamp}.mp4
  const gcsPath = `videos/${athleteId}/${videoId}/${Date.now()}.mp4`;
  const bucketName = process.env.GCS_BUCKET_NAME || 'athleteiq-videos';

  // Generate signed URL for upload (15 minutes expiry)
  const signedUploadUrl = await generateSignedUrl(bucketName, gcsPath, 15);

  // Create Video record in database with QUEUED status
  await prisma.video.create({
    data: {
      id: videoId,
      athleteId,
      sport,
      type: type as any,
      durationSeconds,
      gcsRawUrl: `gs://${bucketName}/${gcsPath}`,
      status: 'QUEUED',
    },
  });

  return {
    videoId,
    signedUploadUrl,
    gcsPath: `gs://${bucketName}/${gcsPath}`,
  };
}

/**
 * Confirm upload completion and queue processing job
 */
export async function confirmUpload(req: ConfirmUploadRequest): Promise<{
  videoId: string;
  status: string;
  jobId: string;
  queued: boolean;
  reason?: string;
}> {
  const { videoId } = req;

  // Get video record
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    include: { athlete: true },
  });

  if (!video) {
    throw new Error('Video not found');
  }

  if (video.status !== 'QUEUED') {
    throw new Error(`Cannot confirm upload for video with status: ${video.status}`);
  }

  const queueResult = await enqueueVideoProcessing(
    videoId,
    {
      videoId,
      gcsUrl: video.gcsRawUrl,
      sport: video.sport,
      athleteId: video.athleteId,
      durationSeconds: video.durationSeconds,
    },
    1 // normal priority
  );

  const updatedVideo = await prisma.video.update({
    where: { id: videoId },
    data: {
      status: queueResult.queued ? 'EXTRACTING_FRAMES' : video.status,
      errorMessage: queueResult.queued ? null : queueResult.reason || 'Redis unavailable',
    },
  });

  return {
    videoId,
    status: updatedVideo.status,
    jobId: videoId, // Using videoId as job tracking identifier
    queued: queueResult.queued,
    ...(queueResult.reason ? { reason: queueResult.reason } : {}),
  };
}

/**
 * Get video status and progress
 */
export async function getVideoStatus(videoId: string): Promise<VideoStatusResponse> {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
  });

  if (!video) {
    throw new Error('Video not found');
  }

  // Calculate progress based on status
  let progress = 0;
  const statusProgressMap: { [key: string]: number } = {
    QUEUED: 0,
    EXTRACTING_FRAMES: 33,
    POSE_DETECTION: 66,
    BIOMECHANICS: 80,
    GEMINI_ANALYSIS: 90,
    COMPLETE: 100,
    FAILED: 0,
  };
  progress = statusProgressMap[video.status] || 0;

  return {
    videoId,
    status: video.status,
    progress,
    errorMessage: video.errorMessage,
    frameCount: video.frameCount,
  };
}

/**
 * Get all videos for an athlete
 */
export async function getAthleteVideos(
  athleteId: string
): Promise<VideoListResponse[]> {
  const videos = await prisma.video.findMany({
    where: { athleteId },
    orderBy: { uploadedAt: 'desc' },
    take: 50,
  });

  return videos.map((video) => {
    // Generate thumbnail URL (first frame from frames folder)
    const thumbnailUrl = video.status === 'COMPLETE' 
      ? `https://storage.googleapis.com/${process.env.GCS_BUCKET_NAME || 'athleteiq-videos'}/frames/${video.id}/frame_0001.jpg`
      : null;

    return {
      id: video.id,
      sport: video.sport,
      type: video.type,
      status: video.status,
      uploadedAt: video.uploadedAt.toISOString(),
      durationSeconds: video.durationSeconds,
      thumbnailUrl,
    };
  });
}

/**
 * Update video status (called by motion service)
 * Internal endpoint - should be called only by authorized services
 */
export async function updateVideoStatus(
  videoId: string,
  data: {
    status?: string;
    frameCount?: number;
    errorMessage?: string;
    processedAt?: Date;
  }
): Promise<{ videoId: string; status: string }> {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
  });

  if (!video) {
    throw new Error('Video not found');
  }

  const updatedVideo = await prisma.video.update({
    where: { id: videoId },
    data: {
      status: data.status || video.status,
      frameCount: data.frameCount !== undefined ? data.frameCount : video.frameCount,
      errorMessage: data.errorMessage !== undefined ? data.errorMessage : video.errorMessage,
      processedAt: data.processedAt !== undefined ? data.processedAt : video.processedAt,
    },
  });

  return {
    videoId: updatedVideo.id,
    status: updatedVideo.status,
  };
}

/**
 * Handle video processing error
 */
export async function handleVideoError(
  videoId: string,
  errorMessage: string
): Promise<void> {
  await prisma.video.update({
    where: { id: videoId },
    data: {
      status: 'FAILED',
      errorMessage,
    },
  });
}

/**
 * Get video record with all related data
 */
export async function getVideoDetails(videoId: string) {
  return await prisma.video.findUnique({
    where: { id: videoId },
    include: {
      athlete: true,
      poseAnalysis: true,
      biomechanicsReport: true,
      geminiAnalysis: true,
    },
  });
}

/**
 * Delete video and all associated data from GCS
 */
export async function deleteVideo(videoId: string): Promise<void> {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
  });

  if (!video) {
    throw new Error('Video not found');
  }

  // Note: GCS deletion would go here if needed
  // For now, just delete from database

  await prisma.video.delete({
    where: { id: videoId },
  });
}
