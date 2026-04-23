'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import axios from 'axios';

export default function ScoutDashboard() {
  const [stats, setStats] = useState({
    watchlist: 12,
    evaluated: 45,
    prospects: 8,
    reports: 23
  });
  const [athletes, setAthletes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchScoutData = async () => {
      try {
        const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/scout`);
        const athletesList = response.data || [];
        setAthletes(athletesList.slice(0, 4));
      } catch (error) {
        console.log('Using fallback scout data');
        setAthletes([
          { id: '1', name: 'Alice Springer', sport: 'Track & Field', compositeScore: 9.2 },
          { id: '2', name: 'Diana Throws', sport: 'Track & Field', compositeScore: 8.9 },
          { id: '3', name: 'Bob Jumper', sport: 'Track & Field', compositeScore: 8.7 },
          { id: '4', name: 'Charlie Kicks', sport: 'Soccer', compositeScore: 8.5 },
        ]);
      } finally {
        setLoading(false);
      }
    };
    fetchScoutData();
  }, []);


  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <Link href="/" className="text-cyan-400 hover:text-cyan-300 mb-8 inline-block animate-fade-in">← Home</Link>
        
        <div className="mb-12 animate-fade-in delay-100">
          <h1 className="text-5xl font-black mb-4 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            🔍 Scout Dashboard
          </h1>
          <p className="text-gray-300">Discover and evaluate top talent</p>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-4 mb-12">
          {[
            { label: 'Watchlist Athletes', value: stats.watchlist, icon: '⭐' },
            { label: 'Evaluated', value: stats.evaluated, icon: '✅' },
            { label: 'Top Prospects', value: stats.prospects, icon: '🏅' },
            { label: 'Saved Reports', value: stats.reports, icon: '💾' },
          ].map((stat, i) => (
            <div 
              key={i} 
              className="backdrop-blur-md bg-white/5 border border-white/10 rounded-lg p-6 hover:border-cyan-500/50 transition-all animate-fade-in"
              style={{ animationDelay: `${(i + 2) * 100}ms` }}
            >
              <p className="text-gray-400 text-sm">{stat.label}</p>
              <p className="text-3xl font-bold mt-2">{stat.value}</p>
              <span className="text-2xl mt-2 block">{stat.icon}</span>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Featured Athletes */}
          <div className="lg:col-span-2 animate-fade-in delay-200">
            <h2 className="text-2xl font-bold mb-6">Featured Athletes</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {athletes.map((athlete, i) => (
                <div 
                  key={athlete.id} 
                  className="backdrop-blur-md bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-lg p-4 hover:border-cyan-500/50 transition-all group hover:-translate-y-2 animate-fade-in"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <h4 className="font-semibold group-hover:text-cyan-400 transition-colors mb-3">{athlete.name} - {athlete.compositeScore}/10</h4>
                  <div className="space-y-2 text-sm">
                    <p className="text-gray-400">Sport: {athlete.sport}</p>
                    <p className="text-gray-400">Status: Recommended</p>
                    <button className="w-full mt-3 px-3 py-2 bg-cyan-500 hover:bg-cyan-600 rounded text-sm transition-all">
                      Add to Watchlist
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Scout Tools */}
          <div className="animate-fade-in delay-300">
            <h2 className="text-2xl font-bold mb-6">Scout Tools</h2>
            <div className="space-y-3">
              {[
                { icon: '🔎', label: 'Advanced Search', desc: 'Find athletes by criteria' },
                { icon: '📈', label: 'Analytics', desc: 'Performance insights' },
                { icon: '🎯', label: 'Recommendations', desc: 'AI-powered picks' },
                { icon: '💬', label: 'Communications', desc: 'Contact athletes' },
              ].map((tool, i) => (
                <div 
                  key={i} 
                  className="backdrop-blur-md bg-white/5 border border-white/10 rounded-lg p-4 hover:border-cyan-500/50 transition-all hover:bg-white/10 group animate-fade-in"
                  style={{ animationDelay: `${(i + 4) * 100}ms` }}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{tool.icon}</span>
                    <div>
                      <h4 className="font-semibold group-hover:text-cyan-400 transition-colors">{tool.label}</h4>
                      <p className="text-sm text-gray-400">{tool.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

