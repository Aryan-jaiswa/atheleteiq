'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/reports`);
        setReports(response.data || [
          {
            id: 1,
            athleteName: 'Alice Springer',
            decision: 'SELECTED',
            confidence: 92,
            date: '2026-04-20',
            sport: 'Track & Field'
          },
          {
            id: 2,
            athleteName: 'Bob Jumper',
            decision: 'WAITLISTED',
            confidence: 75,
            date: '2026-04-19',
            sport: 'Basketball'
          }
        ]);
      } catch (error) {
        setReports([
          {
            id: 1,
            athleteName: 'Alice Springer',
            decision: 'SELECTED',
            confidence: 92,
            date: '2026-04-20',
            sport: 'Track & Field'
          },
          {
            id: 2,
            athleteName: 'Bob Jumper',
            decision: 'WAITLISTED',
            confidence: 75,
            date: '2026-04-19',
            sport: 'Basketball'
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <Link href="/" className="text-cyan-400 hover:text-cyan-300 mb-8 inline-block">← Back</Link>
        
        <div className="mb-12">
          <h1 className="text-5xl font-black mb-4 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Selection Reports
          </h1>
          <p className="text-gray-300 text-lg">View athlete evaluations and selection decisions</p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin">⚙️</div>
            <p className="mt-4 text-gray-400">Loading reports...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report: any) => (
              <div key={report.id} className="backdrop-blur-md bg-gradient-to-r from-white/10 to-white/5 border border-white/10 rounded-lg p-6 hover:border-cyan-500/50 transition-all group hover:shadow-xl hover:shadow-cyan-500/20">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-2xl font-bold group-hover:text-cyan-400 transition-colors">{report.athleteName}</h3>
                    <p className="text-gray-400">{report.sport}</p>
                  </div>
                  <div className={`px-4 py-2 rounded-lg font-bold text-lg ${report.decision === 'SELECTED' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {report.decision}
                  </div>
                </div>

                <div className="grid md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-gray-400 text-sm">Confidence</p>
                    <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all"
                        style={{ width: `${report.confidence}%` }}
                      ></div>
                    </div>
                    <p className="text-cyan-400 font-bold mt-1">{report.confidence}%</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Date</p>
                    <p className="font-semibold mt-2">{report.date}</p>
                  </div>
                  <div className="md:col-span-2">
                    <button className="w-full px-4 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg transition-all group-hover:shadow-lg group-hover:shadow-cyan-500/50">
                      View Full Report
                    </button>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-black/30 rounded p-3">
                    <p className="text-gray-400">Biomechanics Score</p>
                    <p className="text-cyan-400 font-bold text-lg mt-1">8.7/10</p>
                  </div>
                  <div className="bg-black/30 rounded p-3">
                    <p className="text-gray-400">Injury Risk</p>
                    <p className="text-yellow-400 font-bold text-lg mt-1">Low</p>
                  </div>
                  <div className="bg-black/30 rounded p-3">
                    <p className="text-gray-400">Potential Score</p>
                    <p className="text-green-400 font-bold text-lg mt-1">9.2/10</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
