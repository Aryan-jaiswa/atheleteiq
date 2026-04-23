"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { RoleGuard } from "@/components/RoleGuard";
import { apiFetch } from "@/lib/api";
import { decisionBadge, formatDate } from "@/lib/format";

type ReportPayload = {
  id: string;
  compositeScore: number;
  selectionDecision: string;
  decisionReason: string | null;
  scoreBreakdown?: {
    techniqueScore: number;
    symmetryScore: number;
    explosivenessScore: number;
    enduranceIndex: number;
    balanceScore: number;
    injuryRisk: number;
    readinessScore: number;
  };
  athlete: {
    id: string;
    sport: string;
    region: string;
    profilePhotoUrl: string | null;
    user: { name: string };
  };
  videos: Array<{
    id: string;
    type: string;
    processedAt: string | null;
    thumbnailUrl: string | null;
    compositeScore: number | null;
    biomechanics: {
      techniqueScore: number;
      symmetryScore: number;
      explosiveness: number;
      enduranceIndex: number;
      balanceScore: number;
    } | null;
    gemini: {
      strengths: string[];
      weaknesses: string[];
      injuryRiskAreas: string[];
      aiSummary: string;
      coachNotes: string;
    } | null;
  }>;
};

const METRIC_COLORS = ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#6366f1", "#14b8a6"];

export default function FederationAthleteReportPage() {
  const params = useParams<{ id: string }>();
  const athleteId = params.id;
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [decision, setDecision] = useState("SELECTED");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const payload = await apiFetch<ReportPayload>(`/api/reports/${athleteId}`);
    setReport(payload);
    setDecision(payload.selectionDecision === "REJECTED" ? "REJECTED" : "SELECTED");
  }

  useEffect(() => {
    if (athleteId) {
      load();
    }
  }, [athleteId]);

  const barData = useMemo(() => {
    if (!report?.scoreBreakdown) return [];
    return [
      { key: "Technique", value: report.scoreBreakdown.techniqueScore },
      { key: "Symmetry", value: report.scoreBreakdown.symmetryScore },
      { key: "Explosiveness", value: report.scoreBreakdown.explosivenessScore },
      { key: "Endurance", value: report.scoreBreakdown.enduranceIndex },
      { key: "Balance", value: report.scoreBreakdown.balanceScore },
      { key: "Readiness", value: report.scoreBreakdown.readinessScore },
    ];
  }, [report]);

  const ringData = report
    ? [
        { name: "Score", value: report.compositeScore },
        { name: "Remaining", value: 100 - report.compositeScore },
      ]
    : [];

  async function overrideDecision() {
    if (!report || !reason.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/api/reports/${report.id}/decision`, {
        method: "PATCH",
        body: JSON.stringify({
          decision,
          decisionReason: reason.trim(),
        }),
      });
      await load();
      setReason("");
    } finally {
      setSaving(false);
    }
  }

  async function downloadPdf() {
    if (!report) return;
    const response = await apiFetch<{ url: string }>(`/api/reports/${report.id}/pdf`);
    window.open(response.url, "_blank");
  }

  return (
    <RoleGuard allowedRoles={["FEDERATION", "ADMIN"]}>
      <div className="min-h-screen p-6 lg:p-10">
        {!report ? (
          <div className="mx-auto max-w-7xl rounded-2xl card-glass p-6">Loading report...</div>
        ) : (
          <div className="mx-auto max-w-7xl space-y-6">
            <section className="card-glass rounded-2xl p-6">
              <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-cyan-700">Selection report</p>
                  <h1 className="mt-1 text-3xl font-bold">{report.athlete.user.name}</h1>
                  <p className="text-slate-600">{report.athlete.sport} · {report.athlete.region}</p>
                  <span className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${decisionBadge(report.selectionDecision)}`}>
                    {report.selectionDecision}
                  </span>
                </div>
                <div className="h-56 rounded-xl bg-white p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={ringData} dataKey="value" innerRadius={56} outerRadius={86}>
                        <Cell fill="#0e7490" />
                        <Cell fill="#dbeafe" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <p className="-mt-28 text-center text-4xl font-black">{report.compositeScore.toFixed(1)}</p>
                  <p className="text-center text-xs uppercase tracking-widest text-slate-500">Composite</p>
                </div>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="card-glass rounded-2xl p-5">
                <h2 className="text-lg font-semibold">Biomechanics Breakdown</h2>
                <div className="mt-3 h-72 rounded-xl bg-white p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData}>
                      <XAxis dataKey="key" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Bar dataKey="value">
                        {barData.map((item, index) => (
                          <Cell key={item.key} fill={METRIC_COLORS[index % METRIC_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card-glass rounded-2xl p-5">
                <h2 className="text-lg font-semibold">AI Insights</h2>
                <div className="mt-3 grid gap-4 text-sm">
                  <div className="rounded-lg bg-white p-4">
                    <p className="font-semibold text-emerald-700">Strengths</p>
                    <ul className="mt-2 space-y-1 text-slate-700">
                      {(report.videos[0]?.gemini?.strengths ?? []).map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-lg bg-white p-4">
                    <p className="font-semibold text-rose-700">Weaknesses</p>
                    <ul className="mt-2 space-y-1 text-slate-700">
                      {(report.videos[0]?.gemini?.weaknesses ?? []).map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            <section className="card-glass rounded-2xl p-5">
              <h2 className="text-lg font-semibold">Video Timeline</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {report.videos.map((video) => (
                  <article key={video.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-widest text-slate-500">{video.type}</p>
                    <p className="text-sm text-slate-600">{formatDate(video.processedAt)}</p>
                    <p className="mt-2 text-sm font-medium">Video Score: {video.compositeScore?.toFixed(1) ?? "-"}</p>
                    {video.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={video.thumbnailUrl} alt="Video thumbnail" className="mt-3 h-28 w-full rounded-md object-cover" />
                    ) : null}
                  </article>
                ))}
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="card-glass rounded-2xl p-5">
                <h2 className="text-lg font-semibold">Decision Override</h2>
                <div className="mt-4 space-y-3">
                  <select value={decision} onChange={(e) => setDecision(e.target.value)} className="w-full rounded-lg border p-2">
                    <option value="SELECTED">SELECTED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                  <textarea
                    className="min-h-28 w-full rounded-lg border p-2"
                    placeholder="Decision reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <button onClick={overrideDecision} disabled={saving || reason.trim().length < 8} className="rounded-lg bg-cyan-700 px-4 py-2 text-white disabled:opacity-40">
                    {saving ? "Updating..." : "Confirm Override"}
                  </button>
                </div>
              </div>

              <div className="card-glass rounded-2xl p-5">
                <h2 className="text-lg font-semibold">Report Artifacts</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Selection rationale: {report.decisionReason || "AI decision based on aggregated biomechanics and readiness trends."}
                </p>
                <button onClick={downloadPdf} className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-white">
                  Download PDF
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
