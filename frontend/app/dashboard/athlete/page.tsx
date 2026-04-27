'use client';

import Link from 'next/link';
import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type VideoItem = {
  id: string;
  title: string;
  createdAt: string;
  status: string;
};

function statusClasses(status: string) {
  switch (status) {
    case 'COMPLETE':
      return 'bg-green-500/15 text-green-300 border-green-500/30';
    case 'FAILED':
      return 'bg-red-500/15 text-red-300 border-red-500/30';
    default:
      return 'bg-yellow-500/15 text-yellow-200 border-yellow-500/30';
  }
}

export default function AthleteDashboardPage() {
  const router = useRouter();
  const { user, isLoading, getToken } = useAuth();
  const [pageLoading, setPageLoading] = useState(true);
  const [analysisSummary, setAnalysisSummary] = useState<any | null>(null);
  const [videos, setVideos] = useState<VideoItem[]>([]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!user) {
      router.push('/login');
      return;
    }

    let active = true;

    const loadDashboard = async () => {
      setPageLoading(true);
      const token = (await getToken()) ?? 'dev-bypass-token';
      const headers = { Authorization: `Bearer ${token}` };

      const [analysisResult, videosResult] = await Promise.allSettled([
        axios.get(`${API_URL}/api/analysis/athlete/${user.id}`, { headers }),
        axios.get(`${API_URL}/api/videos`, { headers }),
      ]);

      if (!active) {
        return;
      }

      if (analysisResult.status === 'fulfilled') {
        setAnalysisSummary(analysisResult.value.data?.data ?? analysisResult.value.data ?? null);
      } else {
        setAnalysisSummary(null);
      }

      if (videosResult.status === 'fulfilled') {
        const apiVideos = Array.isArray(videosResult.value.data?.data)
          ? videosResult.value.data.data
          : [];
        setVideos(
          apiVideos.map((video: any) => ({
            id: video.id,
            title: video.title ?? `${video.type ?? 'Video'} ${video.sport ?? ''}`.trim(),
            createdAt: video.createdAt ?? video.uploadedAt ?? '',
            status: video.status ?? 'UNKNOWN',
          }))
        );
      } else {
        setVideos([]);
      }

      setPageLoading(false);
    };

    loadDashboard();

    return () => {
      active = false;
    };
  }, [getToken, isLoading, router, user]);

  const stats = useMemo(() => {
    const latestVideo = videos[0];
    const latestRiskScore =
      analysisSummary?.latestRiskScore ??
      analysisSummary?.injuryRisk?.riskScore ??
      analysisSummary?.injury_risk?.risk_score ??
      null;
    const avgSymmetryScore =
      analysisSummary?.avgSymmetryScore ??
      analysisSummary?.symmetryScore ??
      analysisSummary?.biomechanics?.metrics?.symmetry_score ??
      null;

    return [
      { label: 'Total Videos', value: String(videos.length) },
      { label: 'Latest Risk Score', value: latestRiskScore ?? '--' },
      { label: 'Avg Symmetry Score', value: avgSymmetryScore ?? '--' },
      { label: 'Analysis Status', value: latestVideo?.status ?? '--' },
    ];
  }, [analysisSummary, videos]);

  if (isLoading || pageLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center">
        <div className="h-14 w-14 animate-spin rounded-full border-4 border-white/10 border-t-cyan-400"></div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-cyan-300">Athlete Dashboard</p>
            <h1 className="mt-2 text-4xl font-black bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Welcome back, {user.displayName || user.name || 'Athlete'}
            </h1>
          </div>
          <span className="inline-flex w-fit items-center rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-200">
            ATHLETE
          </span>
        </div>

        <div className="mb-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-white/10 bg-white/5 p-5 backdrop-blur-md"
            >
              <p className="text-sm text-gray-400">{stat.label}</p>
              <p className="mt-3 text-3xl font-bold">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_320px]">
          <section className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-md">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Recent Videos</h2>
              <span className="text-sm text-gray-400">{videos.length} total</span>
            </div>

            {videos.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/10 px-4 py-10 text-center text-gray-400">
                No videos yet
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead className="text-sm text-gray-400">
                    <tr className="border-b border-white/10">
                      <th className="pb-3 pr-4 font-medium">Video Name</th>
                      <th className="pb-3 pr-4 font-medium">Upload Date</th>
                      <th className="pb-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {videos.map((video) => (
                      <tr key={video.id} className="border-b border-white/5 last:border-b-0">
                        <td className="py-4 pr-4 font-medium">{video.title || '--'}</td>
                        <td className="py-4 pr-4 text-sm text-gray-300">
                          {video.createdAt ? new Date(video.createdAt).toLocaleString() : '--'}
                        </td>
                        <td className="py-4">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(
                              video.status
                            )}`}
                          >
                            {video.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <aside className="rounded-lg border border-white/10 bg-white/5 p-6 backdrop-blur-md">
            <h2 className="text-2xl font-bold">Quick Actions</h2>
            <div className="mt-6 space-y-3">
              <Link
                href="/upload"
                className="flex items-center justify-center rounded-lg bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400"
              >
                Upload New Video
              </Link>
              <Link
                href="/reports"
                className="flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 py-3 font-semibold text-white transition hover:border-cyan-400/40 hover:bg-white/10"
              >
                View Reports
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
