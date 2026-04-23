"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { RoleGuard } from "@/components/RoleGuard";
import { apiFetch } from "@/lib/api";
import { decisionBadge, formatDate } from "@/lib/format";

type PublicProfile = {
  athleteId: string;
  name: string;
  sport: string;
  region: string;
  photo: string | null;
  compositeScore: number;
  selectionReadiness: string;
  strengths: string[];
  weaknesses: string[];
  injuryRiskAreas: string[];
  videos: Array<{
    id: string;
    type: string;
    processedAt: string | null;
    thumbnailUrl: string | null;
    biomechanics: {
      techniqueScore: number;
      symmetryScore: number;
      explosiveness: number;
      enduranceIndex: number;
      balanceScore: number;
    } | null;
  }>;
};

const METRICS = [
  { key: "techniqueScore", label: "Technique" },
  { key: "symmetryScore", label: "Symmetry" },
  { key: "explosiveness", label: "Explosive" },
  { key: "enduranceIndex", label: "Endurance" },
  { key: "balanceScore", label: "Balance" },
] as const;

export default function PublicAthleteProfilePage() {
  const params = useParams<{ id: string }>();
  const athleteId = params.id;
  const [profile, setProfile] = useState<PublicProfile | null>(null);

  useEffect(() => {
    if (!athleteId) return;
    apiFetch<PublicProfile>(`/api/scout/athletes/${athleteId}`).then(setProfile);
  }, [athleteId]);

  const radarData = useMemo(() => {
    const latest = profile?.videos[0]?.biomechanics;
    if (!latest) return [];
    return METRICS.map((metric) => ({
      metric: metric.label,
      score: latest[metric.key] ?? 0,
    }));
  }, [profile]);

  async function addToWatchlist() {
    if (!profile) return;
    await apiFetch(`/api/scout/watchlist/${profile.athleteId}`, {
      method: "POST",
      body: JSON.stringify({ notes: "Added from athlete public profile" }),
    });
  }

  return (
    <RoleGuard allowedRoles={["SCOUT", "FEDERATION", "COACH", "ADMIN"]}>
      <div className="min-h-screen p-6 lg:p-10">
        {!profile ? (
          <div className="mx-auto max-w-6xl rounded-2xl card-glass p-6">Loading athlete profile...</div>
        ) : (
          <div className="mx-auto max-w-6xl space-y-6">
            <section className="card-glass rounded-2xl p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  {profile.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.photo} alt={profile.name} className="h-20 w-20 rounded-2xl object-cover" />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-cyan-100 text-2xl font-black text-cyan-700">
                      {profile.name[0]}
                    </div>
                  )}
                  <div>
                    <h1 className="text-3xl font-bold">{profile.name}</h1>
                    <p className="text-slate-600">{profile.sport} · {profile.region}</p>
                    <span className={`mt-2 inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${decisionBadge(profile.selectionReadiness)}`}>
                      {profile.selectionReadiness}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-widest text-slate-500">Composite score</p>
                  <p className="text-4xl font-black">{profile.compositeScore.toFixed(1)}</p>
                  <button onClick={addToWatchlist} className="mt-2 rounded-lg bg-cyan-700 px-4 py-2 text-sm text-white">
                    Add to watchlist
                  </button>
                </div>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <article className="card-glass rounded-2xl p-5">
                <h2 className="text-lg font-semibold">Biomechanics Radar</h2>
                <div className="mt-3 h-72 rounded-xl bg-white p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="metric" />
                      <PolarRadiusAxis domain={[0, 100]} />
                      <Radar dataKey="score" fill="#0ea5e9" fillOpacity={0.25} stroke="#0ea5e9" />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </article>

              <article className="card-glass rounded-2xl p-5">
                <h2 className="text-lg font-semibold">Gemini Insights</h2>
                <div className="mt-3 grid gap-3 text-sm">
                  <div className="rounded-lg bg-white p-4">
                    <p className="font-semibold text-emerald-700">Strengths</p>
                    <ul className="mt-2 space-y-1">{profile.strengths.map((item) => <li key={item}>• {item}</li>)}</ul>
                  </div>
                  <div className="rounded-lg bg-white p-4">
                    <p className="font-semibold text-rose-700">Weaknesses</p>
                    <ul className="mt-2 space-y-1">{profile.weaknesses.map((item) => <li key={item}>• {item}</li>)}</ul>
                  </div>
                  <div className="rounded-lg bg-white p-4">
                    <p className="font-semibold text-amber-700">Injury Risk Areas</p>
                    <ul className="mt-2 space-y-1">{profile.injuryRiskAreas.map((item) => <li key={item}>• {item}</li>)}</ul>
                  </div>
                </div>
              </article>
            </section>

            <section className="card-glass rounded-2xl p-5">
              <h2 className="text-lg font-semibold">Analyzed Videos</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {profile.videos.map((video) => (
                  <article key={video.id} className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-xs uppercase tracking-wider text-slate-500">{video.type}</p>
                    <p className="text-sm text-slate-600">{formatDate(video.processedAt)}</p>
                    {video.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={video.thumbnailUrl} alt="Video thumbnail" className="mt-2 h-28 w-full rounded-md object-cover" />
                    ) : (
                      <div className="mt-2 flex h-28 items-center justify-center rounded-md bg-slate-100 text-sm text-slate-500">
                        No thumbnail
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
