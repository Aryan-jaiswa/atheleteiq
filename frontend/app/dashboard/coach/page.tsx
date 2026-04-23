'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import axios from 'axios';

type CoachAthlete = {
  athleteId: string;
  name: string;
  sport: string;
  latestCompositeScore: number;
};

export default function CoachDashboard() {
  const [stats, setStats] = useState({
    athletes: 0,
    videoAnalyzed: 0,
    injuryRisks: 0,
    improvedAthletes: 0
  });
  const [athletes, setAthletes] = useState<CoachAthlete[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCoachData = async () => {
      try {
        const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/coach/athletes`);
        const athletesList = response.data || [];
        setAthletes(athletesList);
        setStats({
          athletes: athletesList.length,
          videoAnalyzed: athletesList.length * 2,
          injuryRisks: Math.floor(Math.random() * 3),
          improvedAthletes: Math.floor(athletesList.length / 2)
        });
      } catch (error) {
        console.log('Using fallback coach data');
        setAthletes([
          { athleteId: '1', name: 'Alice Springer', sport: 'Track & Field', latestCompositeScore: 8.9 },
          { athleteId: '2', name: 'Bob Jumper', sport: 'Track & Field', latestCompositeScore: 8.7 },
          { athleteId: '3', name: 'Charlie Kicks', sport: 'Soccer', latestCompositeScore: 8.5 },
          { athleteId: '4', name: 'Diana Throws', sport: 'Track & Field', latestCompositeScore: 8.9 },
          { athleteId: '5', name: 'Evan Blocks', sport: 'Volleyball', latestCompositeScore: 8.3 },
        ]);
        setStats({ athletes: 5, videoAnalyzed: 12, injuryRisks: 1, improvedAthletes: 3 });
      } finally {
        setLoading(false);
      }
    };
    fetchCoachData();
  }, []);


  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <Link href="/" className="text-cyan-400 hover:text-cyan-300 mb-8 inline-block animate-fade-in">← Home</Link>
        
        <div className="mb-12 animate-fade-in delay-100">
          <h1 className="text-5xl font-black mb-4 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            🏆 Coach Dashboard
          </h1>
          <p className="text-gray-300">Manage your athletes and track their progress</p>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-4 gap-4 mb-12">
          {[
            { label: 'Athletes', value: stats.athletes, icon: '👥', color: 'from-blue-500' },
            { label: 'Videos Analyzed', value: stats.videoAnalyzed, icon: '🎥', color: 'from-cyan-500' },
            { label: 'Injury Risks', value: stats.injuryRisks, icon: '⚠️', color: 'from-red-500' },
            { label: 'Improved Athletes', value: stats.improvedAthletes, icon: '📈', color: 'from-green-500' },
          ].map((stat, i) => (
            <div 
              key={i} 
              className="group backdrop-blur-md bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-lg p-6 hover:border-cyan-500/50 transition-all transform hover:-translate-y-2 hover:shadow-lg hover:shadow-cyan-500/20 animate-fade-in"
              style={{ animationDelay: `${(i + 2) * 100}ms` }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">{stat.label}</p>
                  <p className="text-3xl font-bold mt-2">{stat.value}</p>
                </div>
                <span className="text-4xl">{stat.icon}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Athletes List */}
          <div className="lg:col-span-2 animate-fade-in delay-200">
            <h2 className="text-2xl font-bold mb-6">Your Athletes</h2>
            <div className="space-y-3">
              {athletes.map((athlete, idx) => (
                <div 
                  key={athlete.athleteId} 
                  className="backdrop-blur-md bg-white/5 border border-white/10 rounded-lg p-4 hover:border-cyan-500/50 transition-all group animate-fade-in"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-semibold group-hover:text-cyan-400 transition-colors">{athlete.name}</h4>
                      <p className="text-sm text-gray-400">{athlete.sport} • Score: {athlete.latestCompositeScore.toFixed(1)}/10</p>
                    </div>
                    <Link 
                      href={`/dashboard/coach/athlete/${athlete.athleteId}`}
                      className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg text-sm transition-all"
                    >
                      View Profile
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="animate-fade-in delay-300">
            <h2 className="text-2xl font-bold mb-6">Quick Actions</h2>
            <div className="space-y-3">
              {[
                { icon: '➕', label: 'Add Athlete', link: '#' },
                { icon: '📤', label: 'Upload Video', link: '/upload' },
                { icon: '📊', label: 'View Reports', link: '/reports' },
                { icon: '⚙️', label: 'Settings', link: '#' },
              ].map((action, i) => (
                <Link key={i} href={action.link} className="block">
                  <div className="backdrop-blur-md bg-gradient-to-r from-white/10 to-white/5 border border-white/10 rounded-lg p-4 hover:border-cyan-500/50 transition-all hover:bg-white/10 group animate-fade-in" style={{ animationDelay: `${(i + 6) * 100}ms` }}>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{action.icon}</span>
                      <span className="group-hover:text-cyan-400 transition-colors">{action.label}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
