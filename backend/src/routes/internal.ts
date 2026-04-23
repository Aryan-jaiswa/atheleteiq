import { Router, Request, Response, NextFunction } from 'express';
import * as internalController from './internal.controller';

const router = Router();

/**
 * Middleware to verify internal service token
 * Used to secure internal endpoints that should only be called by motion service
 */
function internalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const internalToken = req.headers['x-internal-token'];
  const expectedToken = process.env.INTERNAL_SERVICE_TOKEN;

  if (!expectedToken) {
    console.warn('INTERNAL_SERVICE_TOKEN not set - internal endpoints require this for security');
  }

  if (expectedToken && internalToken !== expectedToken) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized - invalid internal token',
    });
  }

  next();
}

/**
 * PATCH /api/internal/videos/:id
 * Update video status
 */
router.patch(
  '/videos/:id',
  internalAuthMiddleware,
  internalController.updateVideoStatus
);

/**
 * GET /api/internal/videos/:id/details
 * Get video details
 */
router.get(
  '/videos/:id/details',
  internalAuthMiddleware,
  internalController.getVideoDetails
);

/**
 * POST /api/internal/videos/:id/error
 * Report video processing error
 */
router.post(
  '/videos/:id/error',
  internalAuthMiddleware,
  internalController.handleVideoError
);

/**
 * GET /api/internal/queue/status
 * Get queue statistics
 */
router.get(
  '/queue/status',
  internalAuthMiddleware,
  internalController.getQueueStatus
);

/**
 * PATCH /api/internal/reports/:id/pdf
 * Update selection report PDF URL after worker upload
 */
router.patch(
  '/reports/:id/pdf',
  internalAuthMiddleware,
  internalController.updateReportPdfUrl
);

/**
 * GET /api/internal/reports/:id/details
 * Report and linked analysis payload for PDF generation
 */
router.get(
  '/reports/:id/details',
  internalAuthMiddleware,
  internalController.getReportDetails
);

export default router;
