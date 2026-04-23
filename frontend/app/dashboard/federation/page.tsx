"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RoleGuard } from "@/components/RoleGuard";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch, q } from "@/lib/api";
import { decisionBadge, formatDate, scoreColor } from "@/lib/format";

type FederationRow = {
  athleteId: string;
  name: string;
  sport: string;
  region: string;
  state: string;
  compositeScore: number;
  selectionDecision: string;
  lastAnalyzedDate: string | null;
};

export default function FederationDashboardPage() {
  const { user, logout } = useAuth();
  const [rows, setRows] = useState<FederationRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    sport: "",
    region: "",
    selectionDecision: "",
    minScore: "",
  });

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const map = {
        sport: q(filters.sport),
        region: q(filters.region),
        selectionDecision: q(filters.selectionDecision),
        minScore: q(filters.minScore),
      };
      for (const [key, value] of Object.entries(map)) {
        if (value) {
          params.set(key, value);
        }
      }

      const result = await apiFetch<FederationRow[]>(
        `/api/reports${params.toString() ? `?${params}` : ""}`
      );
      setRows(result);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function generate(athleteId: string) {
    if (!user) return;
    setBusyIds((prev) => [...prev, athleteId]);
    try {
      await apiFetch("/api/reports/generate", {
        method: "POST",
        body: JSON.stringify({ athleteId, requestedBy: user.id }),
      });
      await load();
    } finally {
      setBusyIds((prev) => prev.filter((id) => id !== athleteId));
    }
  }

  async function generateBatch() {
    if (!user || selected.length === 0) return;
    setBusyIds((prev) => [...prev, ...selected]);
    try {
      await Promise.all(
        selected.map((athleteId) =>
          apiFetch("/api/reports/generate", {
            method: "POST",
            body: JSON.stringify({ athleteId, requestedBy: user.id }),
          })
        )
      );
      setSelected([]);
      await load();
    } finally {
      setBusyIds([]);
    }
  }

  const sports = useMemo(() => Array.from(new Set(rows.map((row) => row.sport))).sort(), [rows]);
  const regions = useMemo(() => Array.from(new Set(rows.map((row) => row.region))).sort(), [rows]);

  return (
    <RoleGuard allowedRoles={["FEDERATION", "ADMIN"]}>
      <div className="min-h-screen p-6 lg:p-10">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="card-glass rounded-2xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-700">Federation Console</p>
                <h1 className="text-3xl font-bold">Selection Pipeline</h1>
                <p className="text-slate-600">Composite rankings, report generation, and final decisions.</p>
              </div>
              <button
                onClick={logout}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-5 card-glass rounded-2xl p-4">
            <select className="rounded-lg border p-2" value={filters.sport} onChange={(e) => setFilters((f) => ({ ...f, sport: e.target.value }))}>
              <option value="">All sports</option>
              {sports.map((sport) => (
                <option key={sport} value={sport}>{sport}</option>
              ))}
            </select>
            <select className="rounded-lg border p-2" value={filters.region} onChange={(e) => setFilters((f) => ({ ...f, region: e.target.value }))}>
              <option value="">All regions</option>
              {regions.map((region) => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
            <select className="rounded-lg border p-2" value={filters.selectionDecision} onChange={(e) => setFilters((f) => ({ ...f, selectionDecision: e.target.value }))}>
              <option value="">All decisions</option>
              <option value="SELECTED">Selected</option>
              <option value="WAITLISTED">Waitlisted</option>
              <option value="REJECTED">Rejected</option>
              <option value="PENDING">Pending</option>
            </select>
            <input
              className="rounded-lg border p-2"
              placeholder="Min score"
              value={filters.minScore}
              onChange={(e) => setFilters((f) => ({ ...f, minScore: e.target.value }))}
              type="number"
              min={0}
              max={100}
            />
            <button className="rounded-lg bg-cyan-700 px-4 py-2 font-medium text-white hover:bg-cyan-800" onClick={load}>
              Apply
            </button>
          </div>

          <div className="card-glass rounded-2xl p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600">{rows.length} athletes</p>
              <button
                onClick={generateBatch}
                disabled={selected.length === 0}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                Generate reports for selected athletes ({selected.length})
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="p-2">Pick</th>
                    <th className="p-2">Athlete</th>
                    <th className="p-2">Sport</th>
                    <th className="p-2">Region</th>
                    <th className="p-2">Composite</th>
                    <th className="p-2">Decision</th>
                    <th className="p-2">Last analyzed</th>
                    <th className="p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td className="p-4 text-slate-500" colSpan={8}>Loading...</td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td className="p-4 text-slate-500" colSpan={8}>No athletes found</td></tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.athleteId} className="border-t border-slate-200">
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={selected.includes(row.athleteId)}
                            onChange={(e) =>
                              setSelected((prev) =>
                                e.target.checked
                                  ? [...prev, row.athleteId]
                                  : prev.filter((id) => id !== row.athleteId)
                              )
                            }
                          />
                        </td>
                        <td className="p-2 font-medium">
                          <Link className="hover:underline" href={`/dashboard/federation/athlete/${row.athleteId}`}>
                            {row.name}
                          </Link>
                        </td>
                        <td className="p-2">{row.sport}</td>
                        <td className="p-2">{row.region}</td>
                        <td className={`p-2 font-bold ${scoreColor(row.compositeScore)}`}>{row.compositeScore.toFixed(1)}</td>
                        <td className="p-2">
                          <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${decisionBadge(row.selectionDecision)}`}>
                            {row.selectionDecision}
                          </span>
                        </td>
                        <td className="p-2">{formatDate(row.lastAnalyzedDate)}</td>
                        <td className="p-2">
                          <button
                            onClick={() => generate(row.athleteId)}
                            disabled={busyIds.includes(row.athleteId)}
                            className="rounded-md border border-slate-300 px-3 py-1 text-xs hover:bg-slate-100 disabled:opacity-50"
                          >
                            {busyIds.includes(row.athleteId) ? "Generating..." : "Generate"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
