import { SelectionReadiness, VideoType } from "@prisma/client";

export const readinessToScore: Record<SelectionReadiness, number> = {
  ELITE: 100,
  NATIONAL_READY: 75,
  DEVELOPMENT: 50,
  NOT_READY: 25,
};

const readinessRegex = /\b(ELITE|NATIONAL_READY|DEVELOPMENT|NOT_READY)\b/i;

export function parseSelectionReadiness(
  rawResponse?: string | null,
  fallback: SelectionReadiness = SelectionReadiness.DEVELOPMENT
): SelectionReadiness {
  if (!rawResponse) {
    return fallback;
  }

  const match = rawResponse.match(readinessRegex);
  if (!match) {
    return fallback;
  }

  return match[1].toUpperCase() as SelectionReadiness;
}

export function videoTypeWeight(type: VideoType): number {
  return type === "MATCH" ? 1.5 : 1;
}

export function boundedScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

export function compositeDecisionFromScore(score: number) {
  if (score > 75) {
    return "SELECTED" as const;
  }
  if (score >= 55) {
    return "WAITLISTED" as const;
  }
  return "REJECTED" as const;
}
