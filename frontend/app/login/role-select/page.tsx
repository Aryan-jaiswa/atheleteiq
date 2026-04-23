'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Role } from '@prisma/client';
import { useAuth } from '@/hooks/useAuth';

const ROLE_DESCRIPTIONS: Record<Role, { title: string; description: string; icon: string }> = {
  ATHLETE: {
    title: 'Athlete',
    description: 'Upload your videos, track your biomechanics, and receive AI-powered analysis',
    icon: '🏃',
  },
  COACH: {
    title: 'Coach',
    description: 'Manage your athletes, compare performance metrics, and guide improvement',
    icon: '👨‍🏫',
  },
  SCOUT: {
    title: 'Scout',
    description: 'Search athlete database, track prospects, and build watchlists',
    icon: '🔍',
  },
  FEDERATION: {
    title: 'Federation',
    description: 'Generate selection reports, make final decisions, manage elite athletes',
    icon: '🏛️',
  },
  ADMIN: {
    title: 'Administrator',
    description: 'Full platform access and management capabilities',
    icon: '⚙️',
  },
};

const SPORTS = [
  'Track and Field',
  'Soccer',
  'Basketball',
  'Volleyball',
  'Tennis',
  'Swimming',
  'Gymnastics',
  'Weightlifting',
  'American Football',
  'Baseball',
];

const REGIONS = [
  'North America',
  'South America',
  'Europe',
  'Africa',
  'Asia',
  'Oceania',
];

const ATHLETE_ROLES = [Role.ATHLETE, Role.COACH, Role.SCOUT, Role.FEDERATION];

export default function RoleSelectPage() {
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedSport, setSelectedSport] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { updateProfile } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedRole || !selectedRegion) {
      setError('Please select a role and region');
      return;
    }

    if (selectedRole === 'ATHLETE' && !selectedSport) {
      setError('Athletes must select a sport');
      return;
    }

    setLoading(true);

    try {
      await updateProfile({
        role: selectedRole,
        sport: selectedRole === 'ATHLETE' ? selectedSport : undefined,
        region: selectedRegion,
      } as any);

      router.push('/dashboard');
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError(err.message || 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-blue-700 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Welcome to AthleteIQ</h1>
          <p className="text-blue-100">Please select your role to get started</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Role Selection */}
          <div className="bg-white rounded-lg shadow-xl p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Select Your Role</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ATHLETE_ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setSelectedRole(role)}
                  className={`p-6 rounded-lg border-2 transition-all text-left ${
                    selectedRole === role
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-3xl mb-2">{ROLE_DESCRIPTIONS[role].icon}</div>
                  <h3 className="text-lg font-bold text-gray-800">
                    {ROLE_DESCRIPTIONS[role].title}
                  </h3>
                  <p className="text-sm text-gray-600 mt-2">
                    {ROLE_DESCRIPTIONS[role].description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Sport Selection (for athletes) */}
          {selectedRole === 'ATHLETE' && (
            <div className="bg-white rounded-lg shadow-xl p-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Select Your Sport</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {SPORTS.map((sport) => (
                  <button
                    key={sport}
                    type="button"
                    onClick={() => setSelectedSport(sport)}
                    className={`py-3 px-4 rounded-lg border-2 transition-all font-medium ${
                      selectedSport === sport
                        ? 'border-blue-600 bg-blue-50 text-blue-600'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {sport}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Region Selection */}
          <div className="bg-white rounded-lg shadow-xl p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Select Your Region</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {REGIONS.map((region) => (
                <button
                  key={region}
                  type="button"
                  onClick={() => setSelectedRegion(region)}
                  className={`py-3 px-4 rounded-lg border-2 transition-all font-medium ${
                    selectedRegion === region
                      ? 'border-blue-600 bg-blue-50 text-blue-600'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {region}
                </button>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-6 py-4 rounded-lg">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold rounded-lg transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading || !selectedRole || !selectedRegion}
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Setting up profile...' : 'Continue to Dashboard'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
