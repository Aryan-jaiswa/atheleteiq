export function scoreBand(score: number) {
  if (score >= 75) return "excellent";
  if (score >= 55) return "watch";
  return "risk";
}

export function scoreColor(score: number) {
  const band = scoreBand(score);
  if (band === "excellent") return "text-emerald-500";
  if (band === "watch") return "text-amber-500";
  return "text-rose-500";
}

export function decisionBadge(decision?: string | null) {
  switch (decision) {
    case "SELECTED":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "WAITLISTED":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "REJECTED":
      return "bg-rose-100 text-rose-700 border-rose-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

export function injuryBadge(score: number) {
  if (score > 70) return "bg-rose-100 text-rose-700 border-rose-200";
  if (score > 40) return "bg-amber-100 text-amber-700 border-amber-200";
  return "bg-emerald-100 text-emerald-700 border-emerald-200";
}

export function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
