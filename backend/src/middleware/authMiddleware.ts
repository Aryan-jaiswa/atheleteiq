import { Request, Response, NextFunction } from 'express';
import { verifyToken, JWTPayload } from '../utils/jwt';

/**
 * Extend Express Request to include user data
 */
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

/**
 * Authentication middleware
 * Validates JWT from cookies or Authorization header
 * Attaches user data to req.user
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    let token: string | undefined;

    // Try to get token from Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // Fall back to cookies (from Next.js httpOnly cookie)
    if (!token) {
      token = req.cookies?.['athleteiq-token'];
    }

    if (!token) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'No authentication token provided',
      });
      return;
    }

    // Verify token and attach to request
    const payload = verifyToken(token);
    req.user = payload;

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        error: 'TokenExpiredError',
        message: 'Authentication token has expired',
      });
      return;
    }

    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({
        error: 'InvalidToken',
        message: 'Invalid authentication token',
      });
      return;
    }

    res.status(401).json({
      error: 'Unauthorized',
      message: error.message || 'Authentication failed',
    });
  }
}

/**
 * Optional auth middleware - doesn't fail if no token, just populates req.user if present
 */
export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (!token) {
      token = req.cookies?.['athleteiq-token'];
    }

    if (token) {
      const payload = verifyToken(token);
      req.user = payload;
    }

    next();
  } catch (error) {
    // Silently fail - user will just be undefined
    next();
  }
}
