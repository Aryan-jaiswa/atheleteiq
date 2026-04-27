import { Request, Response } from 'express';
import * as videoService from '../services/video.service';
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function getAthleteProfileIdFromUser(userId?: string) {
  if (!userId) {
    return null;
  }
  const athlete = await prisma.athleteProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  return athlete?.id ?? null;
}

/**
 * GET /api/videos
 * Get videos for the authenticated athlete
 */
export async function getMyVideos(req: Request, res: Response) {
  try {
    const athleteId = await getAthleteProfileIdFromUser(req.user?.userId);

    if (!athleteId) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    const result = await videoService.getAthleteVideos(athleteId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error getting current athlete videos:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get videos',
    });
  }
}

/**
 * POST /api/videos/upload-url
 * Create upload session and return signed URL
 */
export async function createUploadUrl(req: Request, res: Response) {
  try {
    const { sport, type, durationSeconds } = req.body;
    const athleteId = await getAthleteProfileIdFromUser(req.user?.userId);

    // Validation
    if (!athleteId) {
      return res.status(401).json({
        success: false,
        message: 'Only athletes can upload videos',
      });
    }

    if (!sport || !type || !durationSeconds) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: sport, type, durationSeconds',
      });
    }

    if (!['TRAINING', 'MATCH'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid type. Must be TRAINING or MATCH',
      });
    }

    if (durationSeconds <= 0 || durationSeconds > 600) {
      return res.status(400).json({
        success: false,
        message: 'Video duration must be between 0 and 600 seconds',
      });
    }

    const result = await videoService.createVideoUploadSession({
      athleteId,
      sport,
      type,
      durationSeconds,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error creating upload URL:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create upload URL',
    });
  }
}

/**
 * POST /api/videos/:id/confirm
 * Confirm upload and queue for processing
 */
export async function confirmUpload(req: Request, res: Response) {
  try {
    const { id: videoId } = req.params;
    const athleteId = await getAthleteProfileIdFromUser(req.user?.userId);

    if (!videoId) {
      return res.status(400).json({
        success: false,
        message: 'Video ID is required',
      });
    }

    // Verify the video belongs to the authenticated athlete
    const video = await videoService.getVideoDetails(videoId);
    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found',
      });
    }

    if (video.athleteId !== athleteId) {
      return res.status(403).json({
        success: false,
        message: 'Cannot confirm upload for video belonging to another athlete',
      });
    }

    const result = await videoService.confirmUpload({ videoId });

    res.status(200).json({
      success: true,
      data: result,
      queued: result.queued,
    });
  } catch (error: any) {
    console.error('Error confirming upload:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to confirm upload',
    });
  }
}

/**
 * GET /api/videos/:id/status
 * Get video processing status
 */
export async function getVideoStatus(req: Request, res: Response) {
  try {
    const { id: videoId } = req.params;

    if (!videoId) {
      return res.status(400).json({
        success: false,
        message: 'Video ID is required',
      });
    }

    const result = await videoService.getVideoStatus(videoId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error getting video status:', error);
    res.status(404).json({
      success: false,
      message: error.message || 'Video not found',
    });
  }
}

/**
 * GET /api/videos/athlete/:athleteId
 * Get all videos for an athlete
 */
export async function getAthleteVideos(req: Request, res: Response) {
  try {
    const { athleteId } = req.params;
    const authenticatedAthleteId = await getAthleteProfileIdFromUser(req.user?.userId);
    const userRole = req.user?.role;

    if (!athleteId) {
      return res.status(400).json({
        success: false,
        message: 'Athlete ID is required',
      });
    }

    // Only allow athletes to see their own videos, or coaches/scouts to see athletes they manage/watch
    if (athleteId !== authenticatedAthleteId && userRole === 'ATHLETE') {
      return res.status(403).json({
        success: false,
        message: 'Cannot view videos for another athlete',
      });
    }

    const result = await videoService.getAthleteVideos(athleteId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error getting athlete videos:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get videos',
    });
  }
}

/**
 * DELETE /api/videos/:id
 * Delete a video
 */
export async function deleteVideo(req: Request, res: Response) {
  try {
    const { id: videoId } = req.params;
    const athleteId = await getAthleteProfileIdFromUser(req.user?.userId);

    if (!videoId) {
      return res.status(400).json({
        success: false,
        message: 'Video ID is required',
      });
    }

    // Verify ownership
    const video = await videoService.getVideoDetails(videoId);
    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found',
      });
    }

    if (video.athleteId !== athleteId) {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete video belonging to another athlete',
      });
    }

    await videoService.deleteVideo(videoId);

    res.status(200).json({
      success: true,
      message: 'Video deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting video:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete video',
    });
  }
}
