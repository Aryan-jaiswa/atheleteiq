'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function HomePage() {
  const [stats, setStats] = useState({ athletes: 0, videos: 0, reports: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await axios.get(`${API_URL}/health`);
        if (response.data) {
          setStats({
            athletes: 5,
            videos: 10,
            reports: 2
          });
        }
      } catch (error) {
        console.log('Using default stats');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const features = [
    {
      title: '🎥 Upload Videos',
      description: 'Upload athlete videos for real-time biomechanical analysis',
      link: '/upload',
      delay: 0
    },
    {
      title: '📊 View Reports',
      description: 'Access detailed selection reports and performance metrics',
      link: '/reports',
      delay: 100
    },
    {
      title: '🔍 Scout Athletes',
      description: 'Discover top talent with our AI-powered scouting tools',
      link: '/scouts',
      delay: 200
    },
    {
      title: '👨‍🏫 Coach Dashboard',
      description: 'Manage your athletes and track their progress',
      link: '/dashboard/coach',
      delay: 300
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full mix-blend-multiply filter blur-3xl animate-pulse"></div>
        <div className="absolute top-20 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-2000"></div>
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-cyan-500/10 rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Navigation */}
      <nav className="relative backdrop-blur-md bg-black/20 border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              ⚡ AthleteIQ
            </div>
          </div>
          <div className="flex gap-4">
            <Link href="/login" className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all">
              Login
            </Link>
            <Link href="/dashboard/admin" className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 transition-all font-medium">
              Admin
            </Link>
          </div>
        </div>
      </nav>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Hero Section */}
        <div className="text-center mb-20 animate-fade-in">
          <h1 className="text-5xl md:text-7xl font-black mb-6 bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
            Next-Gen Athlete Performance
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            AI-powered biomechanics analysis, injury prediction, and talent scouting platform
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/upload" className="px-8 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 transition-all transform hover:scale-105 font-semibold">
              Get Started
            </Link>
            <Link href="/dashboard/coach" className="px-8 py-3 rounded-lg border border-cyan-500 hover:bg-cyan-500/20 transition-all">
              View Dashboard
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {[
            { label: 'Athletes', value: stats.athletes, icon: '👥' },
            { label: 'Videos Analyzed', value: stats.videos, icon: '🎥' },
            { label: 'Reports', value: stats.reports, icon: '📊' }
          ].map((stat, i) => (
            <div key={i} className="backdrop-blur-md bg-white/5 border border-white/10 rounded-lg p-6 hover:border-cyan-500/50 transition-all transform hover:scale-105 group animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="text-4xl mb-2">{stat.icon}</div>
              <div className="text-3xl font-bold text-cyan-400 group-hover:text-cyan-300">{stat.value}</div>
              <div className="text-gray-400 text-sm">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {features.map((feature, i) => (
            <Link key={i} href={feature.link}>
              <div className="group h-full backdrop-blur-md bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-xl p-6 hover:border-cyan-500/50 transition-all duration-300 transform hover:-translate-y-2 hover:bg-gradient-to-br hover:from-white/20 hover:to-white/10 cursor-pointer animate-fade-in" style={{ animationDelay: `${feature.delay}ms` }}>
                <div className="text-3xl mb-3">{feature.title.split(' ')[0]}</div>
                <h3 className="text-xl font-semibold mb-3 group-hover:text-cyan-400 transition-colors">{feature.title}</h3>
                <p className="text-gray-300 text-sm">{feature.description}</p>
                <div className="mt-4 flex items-center text-cyan-400 group-hover:translate-x-2 transition-transform">
                  <span>Explore →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="backdrop-blur-md bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-cyan-500/30 rounded-xl p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to Transform Athlete Selection?</h2>
          <p className="text-gray-300 mb-6">Join thousands of coaches and scouts using AthleteIQ</p>
          <button className="px-8 py-3 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 transition-all transform hover:scale-105 font-semibold">
            Start Free Trial
          </button>
        </div>
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
