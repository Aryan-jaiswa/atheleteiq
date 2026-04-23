'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function ScoutsPage() {
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ sport: 'all', minScore: 0 });

  useEffect(() => {
    const fetchAthletes = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/scout`);
        setAthletes(response.data || getDefaultAthletes());
      } catch (error) {
        setAthletes(getDefaultAthletes());
      } finally {
        setLoading(false);
      }
    };

    fetchAthletes();
  }, []);

  const getDefaultAthletes = () => [
    { id: 1, name: 'Alice Springer', sport: 'Track & Field', score: 9.2, image: '👩‍🦂', bio: 'Elite sprinter with exceptional technique' },
    { id: 2, name: 'Bob Jumper', sport: 'Basketball', score: 8.7, image: '🏀', bio: 'High-flying athlete with great vertical' },
    { id: 3, name: 'Charlie Kicks', sport: 'Soccer', score: 8.5, image: '⚽', bio: 'Technical footballer with precision' },
    { id: 4, name: 'Diana Throws', sport: 'Track & Field', score: 8.9, image: '🥎', bio: 'Power athlete with consistent form' },
    { id: 5, name: 'Evan Blocks', sport: 'Volleyball', score: 8.3, image: '🏐', bio: 'Defensive specialist with quick reflexes' },
  ];

  const filteredAthletes = athletes.filter(a => 
    (filters.sport === 'all' || a.sport === filters.sport) &&
    a.score >= filters.minScore
  );

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <Link href="/" className="text-cyan-400 hover:text-cyan-300 mb-8 inline-block">← Back</Link>
        
        <div className="mb-12">
          <h1 className="text-5xl font-black mb-4 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Talent Scouting
          </h1>
          <p className="text-gray-300 text-lg">Discover top athletes using AI-powered analytics</p>
        </div>

        {/* Filters */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Sport</label>
            <select
              value={filters.sport}
              onChange={(e) => setFilters({ ...filters, sport: e.target.value })}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:border-cyan-500 outline-none transition-all"
            >
              <option value="all">All Sports</option>
              <option value="Track & Field">Track & Field</option>
              <option value="Basketball">Basketball</option>
              <option value="Soccer">Soccer</option>
              <option value="Volleyball">Volleyball</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">Min Score: {filters.minScore.toFixed(1)}</label>
            <input
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={filters.minScore}
              onChange={(e) => setFilters({ ...filters, minScore: parseFloat(e.target.value) })}
              className="w-full accent-cyan-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin text-3xl">🔍</div>
            <p className="mt-4 text-gray-400">Finding top talent...</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAthletes.map((athlete: any, idx) => (
              <div
                key={athlete.id}
                className="group backdrop-blur-md bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-cyan-500/50 transition-all transform hover:-translate-y-2 hover:shadow-xl hover:shadow-cyan-500/20 cursor-pointer animate-fade-in"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                {/* Header Image */}
                <div className="h-40 bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-6xl group-hover:scale-110 transition-transform">
                  {athlete.image}
                </div>

                {/* Content */}
                <div className="p-6">
                  <h3 className="text-2xl font-bold mb-2 group-hover:text-cyan-400 transition-colors">{athlete.name}</h3>
                  <p className="text-gray-400 mb-4">{athlete.sport}</p>
                  
                  {/* Score */}
                  <div className="mb-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-gray-400">Overall Score</span>
                      <span className="font-bold text-cyan-400">{athlete.score}/10</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all"
                        style={{ width: `${(athlete.score / 10) * 100}%` }}
                      ></div>
                    </div>
                  </div>

                  <p className="text-gray-300 text-sm mb-4">{athlete.bio}</p>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="bg-black/30 rounded p-2 text-center">
                      <p className="text-gray-400 text-xs">Videos</p>
                      <p className="font-bold">2</p>
                    </div>
                    <div className="bg-black/30 rounded p-2 text-center">
                      <p className="text-gray-400 text-xs">Reports</p>
                      <p className="font-bold">1</p>
                    </div>
                  </div>

                  <button className="w-full px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 rounded-lg transition-all group-hover:shadow-lg group-hover:shadow-cyan-500/50 font-semibold">
                    View Profile
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in {
          animation: fade-in 0.6s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    </main>
  );
}
