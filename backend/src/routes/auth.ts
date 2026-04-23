import { Router } from 'express';
import { verifyAuth, getMe, updateMe, logout } from './auth.controller';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

/**
 * Auth Routes
 */

/**
 * POST /api/auth/verify
 * Verify Firebase ID token and get JWT
 * Body: { idToken: string }
 */
router.post('/verify', verifyAuth);

/**
 * GET /api/auth/me
 * Get authenticated user profile
 * Protected: requires valid JWT
 */
router.get('/me', authMiddleware, getMe);

/**
 * PUT /api/auth/me
 * Update user profile
 * Protected: requires valid JWT
 * Body: { name?, sport?, region?, state?, role?, dateOfBirth?, height?, weight?, ... }
 */
router.put('/me', authMiddleware, updateMe);

/**
 * POST /api/auth/logout
 * Logout (optional - JWT is stateless)
 * Protected: requires valid JWT
 */
router.post('/logout', authMiddleware, logout);

export default router;
