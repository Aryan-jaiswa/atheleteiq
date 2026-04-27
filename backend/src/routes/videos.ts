import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import * as videosController from './videos.controller';

const router = Router();

/**
 * GET /api/videos
 * Get videos for the authenticated athlete
 */
router.get(
  '/',
  authMiddleware,
  videosController.getMyVideos
);

/**
 * POST /api/videos/upload-url
 * Create upload session and return signed URL
 * Auth: ATHLETE role required
 */
router.post(
  '/upload-url',
  authMiddleware,
  requireRole('ATHLETE'),
  videosController.createUploadUrl
);

/**
 * POST /api/videos/:id/confirm
 * Confirm upload and queue for processing
 * Auth: ATHLETE role required
 */
router.post(
  '/:id/confirm',
  authMiddleware,
  requireRole('ATHLETE'),
  videosController.confirmUpload
);

/**
 * GET /api/videos/:id/status
 * Get video processing status
 * Auth: Can be called by anyone (frontend polling)
 */
router.get(
  '/:id/status',
  videosController.getVideoStatus
);

/**
 * GET /api/videos/athlete/:athleteId
 * Get all videos for an athlete
 * Auth: ATHLETE (own videos), COACH, SCOUT, ADMIN
 */
router.get(
  '/athlete/:athleteId',
  authMiddleware,
  videosController.getAthleteVideos
);

/**
 * DELETE /api/videos/:id
 * Delete a video
 * Auth: ATHLETE (own videos), ADMIN
 */
router.delete(
  '/:id',
  authMiddleware,
  requireRole('ATHLETE', 'ADMIN'),
  videosController.deleteVideo
);

export default router;
