"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  Line,
  LineChart,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RoleGuard } from "@/components/RoleGuard";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";

type TimelinePayload = {
  athlete: { id: string; name: string; sport: string; region: string };
  selectionReports: Array<{
    id: string;
    generatedAt: string;
    compositeScore: number;
    reportPdfUrl: string | null;
  }>;
  biomechanicsReports: Array<{
    videoId: string;
    processedAt: string | null;
    report: {
      symmetryScore: number;
      enduranceIndex: number;
      techniqueScore: number;
      explosiveness: number;
      balanceScore: number;
    };
    gemini: { injuryRiskScore: number; aiSummary: string } | null;
  }>;
  notes: Array<{ id: string; note: string; coach: { name: string }; createdAt: string }>;
};

export default function CoachAthleteDetailPage() {
  const params = useParams<{ id: string }>();
  const athleteId = params.id;
  const [payload, setPayload] = useState<TimelinePayload | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const response = await apiFetch<TimelinePayload>(`/api/coach/athletes/${athleteId}/timeline`);
    setPayload(response);
  }

  useEffect(() => {
    if (athleteId) {
      load();
    }
  }, [athleteId]);

  const timelineData = useMemo(() => {
    if (!payload) return [];
    return payload.selectionReports.map((report) => {
      const match = payload.biomechanicsReports.find(
        (entry) => formatDate(entry.processedAt) === formatDate(report.generatedAt)
      );
      return {
        label: formatDate(report.generatedAt),
        compositeScore: report.compositeScore,
        symmetryScore: match?.report.symmetryScore ?? 0,
        enduranceIndex: match?.report.enduranceIndex ?? 0,
        injuryRisk: match?.gemini?.injuryRiskScore ?? 0,
      };
    });
  }, [payload]);

  const radarData = useMemo(() => {
    const latest = payload?.biomechanicsReports[payload.biomechanicsReports.length - 1]?.report;
    if (!latest) return [];
    return [
      { metric: "Technique", score: latest.techniqueScore },
      { metric: "Symmetry", score: latest.symmetryScore },
      { metric: "Explosive", score: latest.explosiveness },
      { metric: "Endurance", score: latest.enduranceIndex },
      { metric: "Balance", score: latest.balanceScore },
      { metric: "Injury Safe", score: 100 - (payload?.biomechanicsReports[payload.biomechanicsReports.length - 1]?.gemini?.injuryRiskScore ?? 0) },
    ];
  }, [payload]);

  async function addNote() {
    if (!note.trim()) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/coach/athletes/${athleteId}/note`, {
        method: "POST",
        body: JSON.stringify({ note: note.trim() }),
      });
      setNote("");
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <RoleGuard allowedRoles={["COACH"]}>
      <div className="min-h-screen p-6 lg:p-10">
        {!payload ? (
          <div className="mx-auto max-w-7xl rounded-2xl card-glass p-6">Loading athlete timeline...</div>
        ) : (
          <div className="mx-auto max-w-7xl space-y-6">
            <section className="card-glass rounded-2xl p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-700">Athlete Progress</p>
              <h1 className="text-3xl font-bold">{payload.athlete.name}</h1>
              <p className="text-slate-600">{payload.athlete.sport} · {payload.athlete.region}</p>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <article className="card-glass rounded-2xl p-5">
                <h2 className="text-lg font-semibold">Performance Timeline</h2>
                <div className="mt-3 h-72 rounded-xl bg-white p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timelineData}>
                      <XAxis dataKey="label" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Line type="monotone" dataKey="compositeScore" stroke="#0e7490" strokeWidth={2} />
                      <Line type="monotone" dataKey="symmetryScore" stroke="#f97316" strokeWidth={2} />
                      <Line type="monotone" dataKey="enduranceIndex" stroke="#22c55e" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </article>

              <article className="card-glass rounded-2xl p-5">
                <h2 className="text-lg font-semibold">Biomechanics Radar</h2>
                <div className="mt-3 h-72 rounded-xl bg-white p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="metric" />
                      <PolarRadiusAxis domain={[0, 100]} />
                      <Radar dataKey="score" fill="#0891b2" fillOpacity={0.3} stroke="#0891b2" />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </article>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <article className="card-glass rounded-2xl p-5">
                <h2 className="text-lg font-semibold">Gemini Summaries</h2>
                <div className="mt-3 space-y-3">
                  {payload.biomechanicsReports.map((entry) => (
                    <div key={entry.videoId} className="rounded-lg bg-white p-4">
                      <p className="text-xs uppercase tracking-wider text-slate-500">{formatDate(entry.processedAt)}</p>
                      <p className="mt-1 text-sm text-slate-700">{entry.gemini?.aiSummary || "No summary available."}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="card-glass rounded-2xl p-5">
                <h2 className="text-lg font-semibold">Injury Risk History</h2>
                <div className="mt-3 h-72 rounded-xl bg-white p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timelineData}>
                      <XAxis dataKey="label" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Line type="monotone" dataKey="injuryRisk" stroke="#dc2626" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </article>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <article className="card-glass rounded-2xl p-5">
                <h2 className="text-lg font-semibold">Coach Notes</h2>
                <textarea
                  className="mt-3 min-h-24 w-full rounded-lg border p-2"
                  placeholder="Add coaching note..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <button
                  onClick={addNote}
                  disabled={submitting || note.trim().length < 4}
                  className="mt-2 rounded-lg bg-cyan-700 px-4 py-2 text-white disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Add note"}
                </button>
                <div className="mt-4 space-y-2">
                  {payload.notes.map((entry) => (
                    <div key={entry.id} className="rounded-md bg-white p-3 text-sm">
                      <p>{entry.note}</p>
                      <p className="mt-1 text-xs text-slate-500">{entry.coach.name} · {formatDate(entry.createdAt)}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="card-glass rounded-2xl p-5">
                <h2 className="text-lg font-semibold">Selection Reports</h2>
                <div className="mt-3 space-y-3">
                  {payload.selectionReports.map((report) => (
                    <div key={report.id} className="rounded-lg bg-white p-4">
                      <p className="text-sm font-semibold">Composite {report.compositeScore.toFixed(1)}</p>
                      <p className="text-xs text-slate-500">{formatDate(report.generatedAt)}</p>
                      {report.reportPdfUrl ? (
                        <a className="mt-2 inline-block text-sm font-semibold text-cyan-700 hover:underline" href={report.reportPdfUrl} target="_blank" rel="noreferrer">
                          Open SelectionReport PDF
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              </article>
            </section>
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
