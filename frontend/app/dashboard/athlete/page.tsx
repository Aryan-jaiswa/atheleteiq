'use client';

import Link from 'next/link';

export default function AthleteDashboard() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <Link href="/" className="text-cyan-400 hover:text-cyan-300 mb-8 inline-block animate-fade-in">← Home</Link>
        
        <div className="mb-12 animate-fade-in delay-100">
          <h1 className="text-5xl font-black mb-4 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            🏃 Athlete Dashboard
          </h1>
          <p className="text-gray-300">Track your performance and improve your game</p>
        </div>

        {/* Profile Card */}
        <div className="backdrop-blur-md bg-gradient-to-r from-white/10 to-white/5 border border-white/10 rounded-xl p-8 mb-12 animate-fade-in delay-200">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-3xl font-bold">Alex Runner</h2>
              <p className="text-gray-300">Track & Field • Sprint</p>
            </div>
            <div className="text-center">
              <div className="text-lg text-gray-400">Overall Score</div>
              <div className="text-5xl font-bold text-cyan-400">8.9/10</div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Performance Metrics */}
          <div className="lg:col-span-2 animate-fade-in delay-300">
            <h2 className="text-2xl font-bold mb-6">Performance Metrics</h2>
            <div className="space-y-4">
              {[
                { label: 'Speed', value: 92 },
                { label: 'Endurance', value: 85 },
                { label: 'Agility', value: 88 },
                { label: 'Power', value: 90 },
              ].map((metric, i) => (
                <div key={i}>
                  <div className="flex justify-between mb-2">
                    <span className="font-semibold">{metric.label}</span>
                    <span className="text-cyan-400">{metric.value}/100</span>
                  </div>
                  <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all"
                      style={{ width: `${metric.value}%`, animationDelay: `${i * 100}ms` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activities */}
          <div className="animate-fade-in delay-400">
            <h2 className="text-2xl font-bold mb-6">Recent Activity</h2>
            <div className="space-y-3">
              {[
                { date: 'Today', action: 'Uploaded training video', icon: '📤' },
                { date: 'Yesterday', action: 'Completed biomechanics analysis', icon: '✅' },
                { date: '2 days ago', action: 'Injury risk report', icon: '⚠️' },
              ].map((activity, i) => (
                <div 
                  key={i} 
                  className="backdrop-blur-md bg-white/5 border border-white/10 rounded-lg p-3 hover:border-cyan-500/50 transition-all animate-fade-in"
                  style={{ animationDelay: `${(i + 5) * 100}ms` }}
                >
                  <div className="flex items-start gap-2">
                    <span>{activity.icon}</span>
                    <div>
                      <p className="font-semibold text-sm">{activity.action}</p>
                      <p className="text-xs text-gray-400">{activity.date}</p>
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
                <p className="text-gray-800 font-semibold">{user?.region || 'Not specified'}</p>
              </div>
              {user?.athleteProfile?.overallScore && (
                <div>
                  <p className="text-gray-600 text-sm">Overall Score</p>
                  <p className="text-gray-800 font-semibold">
                    {user.athleteProfile.overallScore.toFixed(1)}/100
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Link href="/dashboard/athlete/upload">
              <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer">
                <div className="text-3xl mb-3">📹</div>
                <h3 className="text-lg font-bold text-gray-800">Upload Video</h3>
                <p className="text-gray-600 text-sm mt-2">Submit new training or match footage for analysis</p>
              </div>
            </Link>

            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="text-3xl mb-3">📊</div>
              <h3 className="text-lg font-bold text-gray-800">View Analysis</h3>
              <p className="text-gray-600 text-sm mt-2">Check your biomechanics and AI-powered insights</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="text-3xl mb-3">📈</div>
              <h3 className="text-lg font-bold text-gray-800">Track Progress</h3>
              <p className="text-gray-600 text-sm mt-2">Monitor your performance metrics over time</p>
            </div>
          </div>

          {/* Recent Videos */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Recent Videos</h2>
            <div className="text-center py-8 text-gray-500">
              <p>No videos uploaded yet</p>
              <Link href="/dashboard/athlete/upload">
                <button className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                  Upload Your First Video
                </button>
              </Link>
            </div>
          </div>
        </main>
      </div>
    </RoleGuard>
  );
}
