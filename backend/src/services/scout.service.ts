import { PrismaClient, SelectionReadiness } from "@prisma/client";
import { parseSelectionReadiness } from "./selection.utils";

const prisma = new PrismaClient();

type SearchFilters = {
  sport?: string;
  region?: string;
  state?: string;
  minCompositeScore?: number;
  maxInjuryRisk?: number;
  selectionReadiness?: SelectionReadiness;
  ageMin?: number;
  ageMax?: number;
  page?: number;
  limit?: number;
};

function ageInYears(dob?: Date | null): number | null {
  if (!dob) {
    return null;
  }
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - dob.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }
  return age;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export const scoutService = {
  async searchAthletes(filters: SearchFilters) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));

    const athletes = await prisma.athleteProfile.findMany({
      where: {
        selectionEligible: true,
        ...(filters.sport ? { sport: filters.sport } : {}),
        ...(filters.region ? { region: filters.region } : {}),
        ...(filters.state ? { state: filters.state } : {}),
      },
      include: {
        user: {
          select: { id: true, name: true },
        },
        selectionReports: {
          orderBy: { generatedAt: "desc" },
          take: 1,
        },
        videos: {
          where: {
            status: "COMPLETE",
            geminiAnalysis: { isNot: null },
          },
          orderBy: { processedAt: "desc" },
          take: 1,
          include: {
            geminiAnalysis: true,
            biomechanicsReport: true,
          },
        },
      },
    });

    const filtered = athletes
      .map((athlete) => {
        const latestVideo = athlete.videos[0];
        const latestGemini = latestVideo?.geminiAnalysis;
        const latestReport = athlete.selectionReports[0];
        const inferredReadiness =
          latestGemini?.selectionReadiness ??
          parseSelectionReadiness(latestGemini?.rawResponse);
        const age = ageInYears(athlete.dateOfBirth);

        return {
          id: athlete.id,
          name: athlete.user.name,
          sport: athlete.sport,
          region: athlete.region,
          state: athlete.state,
          age,
          profilePhotoUrl: athlete.profilePhotoUrl,
          compositeScore: latestReport?.compositeScore ?? 0,
          selectionDecision: latestReport?.selectionDecision ?? "PENDING",
          selectionReadiness: inferredReadiness,
          injuryRisk: latestGemini?.injuryRiskScore ?? 0,
          strengths: asStringArray(latestGemini?.strengths).slice(0, 2),
          updatedAt: latestReport?.generatedAt ?? athlete.createdAt,
        };
      })
      .filter((athlete) => {
        if (
          filters.minCompositeScore !== undefined &&
          athlete.compositeScore < filters.minCompositeScore
        ) {
          return false;
        }
        if (
          filters.maxInjuryRisk !== undefined &&
          athlete.injuryRisk > filters.maxInjuryRisk
        ) {
          return false;
        }
        if (
          filters.selectionReadiness &&
          athlete.selectionReadiness !== filters.selectionReadiness
        ) {
          return false;
        }
        if (filters.ageMin !== undefined && (athlete.age === null || athlete.age < filters.ageMin)) {
          return false;
        }
        if (filters.ageMax !== undefined && (athlete.age === null || athlete.age > filters.ageMax)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.compositeScore - a.compositeScore);

    const total = filtered.length;
    const start = (page - 1) * limit;
    const data = filtered.slice(start, start + limit);

    return {
      data,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  },

  async addToWatchlist(scoutId: string, athleteId: string, notes: string) {
    return prisma.scoutWatchlist.upsert({
      where: {
        scoutId_athleteId: {
          scoutId,
          athleteId,
        },
      },
      update: { notes },
      create: {
        scoutId,
        athleteId,
        notes,
      },
    });
  },

  async getWatchlist(scoutId: string) {
    const watchlist = await prisma.scoutWatchlist.findMany({
      where: { scoutId },
      include: {
        athlete: {
          include: {
            user: {
              select: { name: true },
            },
            selectionReports: {
              orderBy: { generatedAt: "desc" },
              take: 1,
            },
            videos: {
              where: { status: "COMPLETE", geminiAnalysis: { isNot: null } },
              orderBy: { processedAt: "desc" },
              take: 1,
              include: { geminiAnalysis: true },
            },
          },
        },
      },
      orderBy: { addedAt: "desc" },
    });

    return watchlist.map((entry) => ({
      athleteId: entry.athleteId,
      name: entry.athlete.user.name,
      sport: entry.athlete.sport,
      region: entry.athlete.region,
      state: entry.athlete.state,
      compositeScore: entry.athlete.selectionReports[0]?.compositeScore ?? 0,
      injuryRisk: entry.athlete.videos[0]?.geminiAnalysis?.injuryRiskScore ?? 0,
      notes: entry.notes,
      addedAt: entry.addedAt,
    }));
  },

  async removeFromWatchlist(scoutId: string, athleteId: string) {
    return prisma.scoutWatchlist.delete({
      where: {
        scoutId_athleteId: { scoutId, athleteId },
      },
    });
  },

  async getPublicAthleteProfile(athleteId: string) {
    const athlete = await prisma.athleteProfile.findUniqueOrThrow({
      where: { id: athleteId },
      include: {
        user: {
          select: { id: true, name: true },
        },
        selectionReports: {
          orderBy: { generatedAt: "desc" },
          take: 1,
        },
        videos: {
          where: { status: "COMPLETE" },
          orderBy: { processedAt: "desc" },
          include: {
            biomechanicsReport: true,
            geminiAnalysis: true,
          },
        },
      },
    });

    const latestGemini = athlete.videos[0]?.geminiAnalysis;
    return {
      athleteId: athlete.id,
      name: athlete.user.name,
      sport: athlete.sport,
      region: athlete.region,
      state: athlete.state,
      photo: athlete.profilePhotoUrl,
      compositeScore: athlete.selectionReports[0]?.compositeScore ?? 0,
      selectionDecision: athlete.selectionReports[0]?.selectionDecision ?? "PENDING",
      selectionReadiness:
        latestGemini?.selectionReadiness ??
        parseSelectionReadiness(latestGemini?.rawResponse),
      strengths: asStringArray(latestGemini?.strengths),
      weaknesses: asStringArray(latestGemini?.weaknesses),
      injuryRiskAreas: asStringArray(latestGemini?.injuryRiskAreas),
      injuryRisk: latestGemini?.injuryRiskScore ?? 0,
      videos: athlete.videos.map((video) => ({
        id: video.id,
        type: video.type,
        processedAt: video.processedAt,
        thumbnailUrl: `https://storage.googleapis.com/${
          process.env.GCS_BUCKET_NAME ?? "athleteiq-videos"
        }/frames/${video.id}/frame_0001.jpg`,
        biomechanics: video.biomechanicsReport,
        gemini: video.geminiAnalysis,
      })),
    };
  },
};
