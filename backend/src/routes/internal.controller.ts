import { Request, Response } from 'express';
import * as videoService from '../services/video.service';
import { getPoseDetectionQueue, addPoseDetectionJob } from '../config/queue';
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * PATCH /api/internal/videos/:id
 * Update video status (called by motion service)
 * Internal use only - requires internal auth token
 */
export async function updateVideoStatus(req: Request, res: Response) {
  try {
    const { id: videoId } = req.params;
    const { status, frameCount, errorMessage, enqueueNextJob } = req.body;

    if (!videoId) {
      return res.status(400).json({
        success: false,
        message: 'Video ID is required',
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required',
      });
    }

    // Valid status values
    const validStatuses = [
      'QUEUED',
      'EXTRACTING_FRAMES',
      'POSE_DETECTION',
      'BIOMECHANICS',
      'GEMINI_ANALYSIS',
      'COMPLETE',
      'FAILED',
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    // Update video status
    const result = await videoService.updateVideoStatus(videoId, {
      status,
      frameCount,
      errorMessage,
      processedAt: status === 'COMPLETE' ? new Date() : undefined,
    });

    // If requested, enqueue next job in pipeline
    if (enqueueNextJob && status === 'EXTRACTING_FRAMES') {
      // Next job: pose detection
      const video = await videoService.getVideoDetails(videoId);
      if (video && frameCount) {
        await addPoseDetectionJob(
          {
            videoId,
            framesFolderGcsPath: `gs://${process.env.GCS_BUCKET_NAME || 'athleteiq-videos'}/frames/${videoId}/`,
            frameCount,
            sport: video.sport,
            athleteId: video.athleteId,
          },
          1
        );
      }
    }

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error updating video status:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update video status',
    });
  }
}

/**
 * GET /api/internal/videos/:id/details
 * Get full video details (called by motion service)
 * Internal use only
 */
export async function getVideoDetails(req: Request, res: Response) {
  try {
    const { id: videoId } = req.params;

    if (!videoId) {
      return res.status(400).json({
        success: false,
        message: 'Video ID is required',
      });
    }

    const video = await videoService.getVideoDetails(videoId);

    if (!video) {
      return res.status(404).json({
        success: false,
        message: 'Video not found',
      });
    }

    res.status(200).json({
      success: true,
      data: video,
    });
  } catch (error: any) {
    console.error('Error getting video details:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get video details',
    });
  }
}

/**
 * POST /api/internal/videos/:id/error
 * Handle video processing error (called by motion service)
 * Internal use only
 */
export async function handleVideoError(req: Request, res: Response) {
  try {
    const { id: videoId } = req.params;
    const { errorMessage } = req.body;

    if (!videoId) {
      return res.status(400).json({
        success: false,
        message: 'Video ID is required',
      });
    }

    if (!errorMessage) {
      return res.status(400).json({
        success: false,
        message: 'Error message is required',
      });
    }

    await videoService.handleVideoError(videoId, errorMessage);

    res.status(200).json({
      success: true,
      message: 'Error recorded',
    });
  } catch (error: any) {
    console.error('Error handling video error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to record error',
    });
  }
}

/**
 * GET /api/internal/queue/status
 * Get queue statistics
 * Internal use only
 */
export async function getQueueStatus(req: Request, res: Response) {
  try {
    const videoQueue = getPoseDetectionQueue();

    const stats = {
      waiting: await videoQueue.getWaitingCount(),
      active: await videoQueue.getActiveCount(),
      completed: await videoQueue.getCompletedCount(),
      failed: await videoQueue.getFailedCount(),
      delayed: await videoQueue.getDelayedCount(),
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('Error getting queue status:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get queue status',
    });
  }
}

/**
 * PATCH /api/internal/reports/:id/pdf
 * Update report PDF URL from worker
 */
export async function updateReportPdfUrl(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { reportPdfUrl } = req.body;

    if (!reportPdfUrl) {
      return res.status(400).json({
        success: false,
        message: "reportPdfUrl is required",
      });
    }

    const updated = await prisma.selectionReport.update({
      where: { id },
      data: { reportPdfUrl },
    });

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    console.error("Error updating report PDF URL:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update report PDF URL",
    });
  }
}

/**
 * GET /api/internal/reports/:id/details
 * Fetch report payload for PDF generation
 */
export async function getReportDetails(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const report = await prisma.selectionReport.findUnique({
      where: { id },
      include: {
        athlete: {
          include: {
            user: true,
            videos: {
              where: {
                status: "COMPLETE",
              },
              include: {
                biomechanicsReport: true,
                geminiAnalysis: true,
              },
            },
          },
        },
      },
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    console.error("Error fetching report details:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch report details",
    });
  }
}
