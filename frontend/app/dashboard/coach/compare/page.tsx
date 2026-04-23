"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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

type AthleteRef = { athleteId: string; name: string };
type CompareResult = {
  athleteId: string;
  name: string;
  sport: string;
  latestCompositeScore: number;
  biomechanics: {
    techniqueScore: number;
    symmetryScore: number;
    explosiveness: number;
    enduranceIndex: number;
    balanceScore: number;
  } | null;
};

const METRICS = [
  { key: "techniqueScore", label: "Technique" },
  { key: "symmetryScore", label: "Symmetry" },
  { key: "explosiveness", label: "Explosive" },
  { key: "enduranceIndex", label: "Endurance" },
  { key: "balanceScore", label: "Balance" },
] as const;

export default function CoachComparePage() {
  const searchParams = useSearchParams();
  const [roster, setRoster] = useState<AthleteRef[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [comparison, setComparison] = useState<CompareResult[]>([]);

  useEffect(() => {
    apiFetch<Array<{ athleteId: string; name: string }>>("/api/coach/athletes").then((data) => {
      setRoster(data);
    });
  }, []);

  useEffect(() => {
    const param = searchParams.get("athleteIds");
    if (param) {
      setSelected(param.split(",").slice(0, 4));
    }
  }, [searchParams]);

  async function runComparison(ids: string[]) {
    if (ids.length === 0) {
      setComparison([]);
      return;
    }
    const query = new URLSearchParams({ athleteIds: ids.join(",") });
    const data = await apiFetch<CompareResult[]>(`/api/coach/compare?${query}`);
    setComparison(data);
  }

  useEffect(() => {
    runComparison(selected);
  }, [selected]);

  const tableRows = useMemo(() => {
    return METRICS.map((metric) => ({
      metric: metric.label,
      values: comparison.map((entry) => entry.biomechanics?.[metric.key] ?? 0),
    }));
  }, [comparison]);

  return (
    <RoleGuard allowedRoles={["COACH"]}>
      <div className="min-h-screen p-6 lg:p-10">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="card-glass rounded-2xl p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-700">Coach Compare</p>
            <h1 className="text-3xl font-bold">Side-by-Side Biomechanics</h1>
            <p className="text-slate-600">Select up to 4 athletes to compare readiness vectors.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {roster.map((athlete) => {
                const isSelected = selected.includes(athlete.athleteId);
                return (
                  <button
                    key={athlete.athleteId}
                    className={`rounded-lg border px-3 py-2 text-left ${isSelected ? "border-cyan-600 bg-cyan-50" : "border-slate-300 bg-white"}`}
                    onClick={() =>
                      setSelected((prev) => {
                        if (isSelected) return prev.filter((id) => id !== athlete.athleteId);
                        if (prev.length >= 4) return prev;
                        return [...prev, athlete.athleteId];
                      })
                    }
                  >
                    <p className="text-sm font-semibold">{athlete.name}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {comparison.map((entry) => {
              const radarData = METRICS.map((metric) => ({
                metric: metric.label,
                score: entry.biomechanics?.[metric.key] ?? 0,
              }));

              return (
                <article key={entry.athleteId} className="card-glass rounded-2xl p-4">
                  <p className="text-sm text-slate-500">{entry.sport}</p>
                  <h2 className="text-lg font-bold">{entry.name}</h2>
                  <p className="text-sm font-semibold text-cyan-700">Composite {entry.latestCompositeScore.toFixed(1)}</p>
                  <div className="mt-2 h-52 rounded-lg bg-white p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="metric" />
                        <PolarRadiusAxis domain={[0, 100]} />
                        <Radar dataKey="score" stroke="#0e7490" fill="#0e7490" fillOpacity={0.25} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </article>
              );
            })}
          </section>

          <section className="card-glass rounded-2xl p-5">
            <h2 className="text-lg font-semibold">Metric Table</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="p-2">Metric</th>
                    {comparison.map((entry) => (
                      <th key={entry.athleteId} className="p-2">{entry.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => (
                    <tr key={row.metric} className="border-t border-slate-200">
                      <td className="p-2 font-medium">{row.metric}</td>
                      {row.values.map((value, idx) => (
                        <td
                          key={`${row.metric}-${idx}`}
                          className={`p-2 ${
                            value < 55 ? "bg-rose-50 text-rose-700" : value < 70 ? "bg-amber-50 text-amber-700" : ""
                          }`}
                        >
                          {value.toFixed(1)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </RoleGuard>
  );
}
