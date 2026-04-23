import { Request, Response } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import { auth } from '../config/firebase';
import { generateToken } from '../utils/jwt';

const prisma = new PrismaClient();

/**
 * POST /api/auth/verify
 * Verifies Firebase ID token and creates/fetches User in database
 * Returns signed JWT with user data
 */
export async function verifyAuth(req: Request, res: Response): Promise<void> {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'idToken is required',
      });
      return;
    }

    // Verify Firebase ID token
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(idToken);
    } catch (error: any) {
      res.status(401).json({
        error: 'InvalidToken',
        message: 'Firebase token verification failed: ' + error.message,
      });
      return;
    }

    const firebaseUid = decodedToken.uid;
    const phoneNumber = decodedToken.phone_number || '';
    const email = decodedToken.email || `${firebaseUid}@firebase.com`;

    // Find or create user in database
    let user = await prisma.user.findUnique({
      where: { email },
      include: { athleteProfile: true },
    });

    if (!user) {
      // First-time user: create with default role and pending status
      user = await prisma.user.create({
        data: {
          name: decodedToken.name || 'New User',
          email,
          phone: phoneNumber,
          role: Role.ATHLETE, // Default role, will be updated via PUT /api/auth/me
          sport: undefined,
          region: undefined,
          state: undefined,
        },
        include: { athleteProfile: true },
      });
    }

    // Generate JWT token
    const jwtToken = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      sport: user.sport || undefined,
      region: user.region || undefined,
    });

    // Return token and user data
    res.cookie("athleteiq-token", jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    res.json({
      success: true,
      token: jwtToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        sport: user.sport,
        region: user.region,
        state: user.state,
        createdAt: user.createdAt,
        athleteProfile: user.athleteProfile,
      },
      isNewUser: !user.athleteProfile, // True if athlete profile not yet created
    });
  } catch (error: any) {
    console.error('Auth verification error:', error);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Authentication failed: ' + error.message,
    });
  }
}

/**
 * GET /api/auth/me
 * Returns authenticated user's full profile
 * If role is ATHLETE, includes athleteProfile
 */
export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Not authenticated',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        athleteProfile: req.user.role === Role.ATHLETE ? true : false,
      },
    });

    if (!user) {
      res.status(404).json({
        error: 'NotFound',
        message: 'User not found',
      });
      return;
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        sport: user.sport,
        region: user.region,
        state: user.state,
        createdAt: user.createdAt,
        athleteProfile: 'athleteProfile' in user ? user.athleteProfile : undefined,
      },
    });
  } catch (error: any) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to fetch profile: ' + error.message,
    });
  }
}

/**
 * PUT /api/auth/me
 * Updates user profile
 * First-time users: create athleteProfile, set role + sport + region
 * Existing users: update name, sport, region, state
 */
export async function updateMe(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Not authenticated',
      });
      return;
    }

    const {
      name,
      sport,
      region,
      state,
      role,
      dateOfBirth,
      height,
      weight,
      dominantSide,
      bio,
      profilePhotoUrl,
    } = req.body;

    // Validate role if provided (only ADMIN can change roles)
    if (role && req.user.role !== 'ADMIN' && req.user.role !== role) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Only admins can change user roles',
      });
      return;
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        ...(name && { name }),
        ...(sport && { sport }),
        ...(region && { region }),
        ...(state && { state }),
        ...(role && { role }),
      },
      include: { athleteProfile: true },
    });

    // For ATHLETE role, update or create athlete profile
    if (updatedUser.role === 'ATHLETE') {
      const athleteProfile = await prisma.athleteProfile.upsert({
        where: { userId: updatedUser.id },
        update: {
          ...(sport && { sport }),
          ...(region && { region }),
          ...(state && { state }),
          ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
          ...(height && { height }),
          ...(weight && { weight }),
          ...(dominantSide && { dominantSide }),
          ...(bio && { bio }),
          ...(profilePhotoUrl && { profilePhotoUrl }),
        },
        create: {
          sport: sport || 'Unknown',
          region: region,
          state: state,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
          height,
          weight,
          dominantSide,
          bio,
          profilePhotoUrl,
        },
      });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          phone: updatedUser.phone,
          role: updatedUser.role,
          sport: updatedUser.sport,
          region: updatedUser.region,
          state: updatedUser.state,
          athleteProfile,
        },
      });
    } else {
      res.json({
        success: true,
        message: 'Profile updated successfully',
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          phone: updatedUser.phone,
          role: updatedUser.role,
          sport: updatedUser.sport,
          region: updatedUser.region,
          state: updatedUser.state,
        },
      });
    }
  } catch (error: any) {
    console.error('Error updating user profile:', error);
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Failed to update profile: ' + error.message,
    });
  }
}

/**
 * POST /api/auth/logout
 * Optional: for frontend to signal logout (JWT is stateless, no DB cleanup needed)
 */
export async function logout(req: Request, res: Response): Promise<void> {
  try {
    res.clearCookie("athleteiq-token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
    });

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Logout failed: ' + error.message,
    });
  }
}
