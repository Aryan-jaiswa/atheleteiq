'use client';

import { useEffect, useState, useCallback, useContext, createContext, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Role } from '@prisma/client';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  sport?: string;
  region?: string;
  state?: string;
  createdAt: Date;
  athleteProfile?: {
    id: string;
    sport: string;
    dateOfBirth?: Date;
    height?: number;
    weight?: number;
    dominantSide?: string;
    bio?: string;
    profilePhotoUrl?: string;
    overallScore?: number;
    selectionEligible: boolean;
  };
}

export interface AuthContextType {
  user: AuthUser | null;
  role: Role | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isNewUser: boolean;
  login: (firebaseToken: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<AuthUser>) => Promise<void>;
  refetch: () => Promise<void>;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);
  const router = useRouter();

  // Fetch current user from /api/auth/me
  const fetchUser = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setIsNewUser(data.isNewUser ?? false);
      } else if (response.status === 401) {
        setUser(null);
        setIsNewUser(false);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check auth status on mount
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = useCallback(
    async (firebaseToken: string) => {
      setIsLoading(true);
      try {
        // Call backend to verify Firebase token and get JWT
        const response = await fetch('/api/auth/verify', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ idToken: firebaseToken }),
        });

        if (!response.ok) {
          throw new Error('Failed to verify token');
        }

        const data = await response.json();
        setUser(data.user);
        setIsNewUser(data.isNewUser ?? false);

        // If new user, redirect to role selection
        if (data.isNewUser) {
          router.push('/login/role-select');
        } else {
          // Redirect to dashboard
          router.push('/dashboard');
        }
      } catch (error) {
        console.error('Login error:', error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [router]
  );

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      setUser(null);
      setIsNewUser(false);

      // Clear JWT cookie (handled by httpOnly flag)
      document.cookie = 'athleteiq-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;';

      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const updateProfile = useCallback(
    async (data: Partial<AuthUser>) => {
      try {
        const response = await fetch('/api/auth/me', {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          throw new Error('Failed to update profile');
        }

        const result = await response.json();
        setUser(result.user);
        setIsNewUser(false);

        return result.user;
      } catch (error) {
        console.error('Update profile error:', error);
        throw error;
      }
    },
    []
  );

  const refetch = useCallback(async () => {
    setIsLoading(true);
    await fetchUser();
  }, [fetchUser]);

  const value: AuthContextType = {
    user,
    role: user?.role || null,
    isLoading,
    isAuthenticated: !!user,
    isNewUser,
    login,
    logout,
    updateProfile,
    refetch,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook to use auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
