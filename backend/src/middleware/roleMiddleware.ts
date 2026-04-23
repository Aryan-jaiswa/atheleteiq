import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';

/**
 * Role-based access control middleware factory
 * Usage: app.get('/protected', requireRole('ADMIN', 'FEDERATION'), handler)
 */
export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Check if user is authenticated (authMiddleware should be applied first)
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    // Check if user role is in allowed roles
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `This action requires one of these roles: ${allowedRoles.join(', ')}. Your role is: ${req.user.role}`,
        requiredRoles: allowedRoles,
        userRole: req.user.role,
      });
      return;
    }

    // User is authenticated and has required role
    next();
  };
}

/**
 * Check if user is owner of resource
 * Usage: app.put('/athletes/:id', authMiddleware, requireOwnership('athleteId'), handler)
 */
export function requireOwnership(paramName: string = 'id') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const resourceId = req.params[paramName];

    // Allow ADMIN to access anything
    if (req.user.role === 'ADMIN') {
      return next();
    }

    // For other roles, check if they own the resource
    if (req.user.userId !== resourceId) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to access this resource',
      });
      return;
    }

    next();
  };
}

/**
 * Convenience middleware combining auth + role check
 */
export function requireAuth(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: `This action requires one of these roles: ${allowedRoles.join(', ')}`,
      });
      return;
    }

    next();
  };
}
