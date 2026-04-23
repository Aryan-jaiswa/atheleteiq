import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const coachService = {
  async getCoachAthletes(coachId: string) {
    const athletes = await prisma.athleteProfile.findMany({
      where: {
        coaches: {
          some: { coachId },
        },
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        selectionReports: {
          orderBy: { generatedAt: "desc" },
          take: 2,
        },
        videos: {
          where: { status: "COMPLETE" },
          orderBy: { processedAt: "desc" },
          take: 1,
          include: {
            geminiAnalysis: {
              select: { injuryRiskScore: true },
            },
          },
        },
      },
    });

    return athletes
      .map((athlete) => {
        const [latest, previous] = athlete.selectionReports;
        const trendDelta = latest && previous ? latest.compositeScore - previous.compositeScore : 0;
        const trend =
          trendDelta > 5 ? "UP" : trendDelta < -5 ? "DOWN" : "STABLE";

        return {
          athleteId: athlete.id,
          name: athlete.user.name,
          sport: athlete.sport,
          region: athlete.region,
          state: athlete.state,
          latestCompositeScore: latest?.compositeScore ?? 0,
          injuryRiskScore: athlete.videos[0]?.geminiAnalysis?.injuryRiskScore ?? 0,
          lastVideoAnalyzedDate: athlete.videos[0]?.processedAt ?? null,
          trend,
        };
      })
      .sort((a, b) => b.latestCompositeScore - a.latestCompositeScore);
  },

  async getAthleteTimeline(athleteId: string) {
    const athlete = await prisma.athleteProfile.findUniqueOrThrow({
      where: { id: athleteId },
      include: {
        user: { select: { name: true, email: true } },
        selectionReports: {
          orderBy: { generatedAt: "asc" },
        },
        videos: {
          where: { status: "COMPLETE" },
          orderBy: { processedAt: "asc" },
          include: {
            biomechanicsReport: true,
            geminiAnalysis: true,
          },
        },
        coachNotes: {
          orderBy: { createdAt: "desc" },
          include: {
            coach: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    return {
      athlete: {
        id: athlete.id,
        name: athlete.user.name,
        sport: athlete.sport,
        region: athlete.region,
        profilePhotoUrl: athlete.profilePhotoUrl,
      },
      selectionReports: athlete.selectionReports,
      biomechanicsReports: athlete.videos
        .filter((video) => video.biomechanicsReport)
        .map((video) => ({
          videoId: video.id,
          processedAt: video.processedAt,
          type: video.type,
          report: video.biomechanicsReport,
          gemini: video.geminiAnalysis,
        })),
      notes: athlete.coachNotes,
    };
  },

  async compareAthletes(athleteIds: string[]) {
    if (athleteIds.length === 0) {
      return [];
    }
    if (athleteIds.length > 4) {
      throw new Error("Can only compare up to 4 athletes");
    }

    const athletes = await prisma.athleteProfile.findMany({
      where: { id: { in: athleteIds } },
      include: {
        user: { select: { name: true } },
        videos: {
          where: { status: "COMPLETE" },
          orderBy: { processedAt: "desc" },
          take: 1,
          include: {
            biomechanicsReport: true,
          },
        },
        selectionReports: {
          orderBy: { generatedAt: "desc" },
          take: 1,
        },
      },
    });

    return athletes.map((athlete) => ({
      athleteId: athlete.id,
      name: athlete.user.name,
      sport: athlete.sport,
      region: athlete.region,
      latestCompositeScore: athlete.selectionReports[0]?.compositeScore ?? 0,
      biomechanics: athlete.videos[0]?.biomechanicsReport ?? null,
    }));
  },

  async addAthleteNote(coachId: string, athleteId: string, note: string) {
    return prisma.coachNote.create({
      data: {
        coachId,
        athleteId,
        note,
      },
      include: {
        coach: {
          select: { id: true, name: true },
        },
      },
    });
  },

  async getAthleteNotes(athleteId: string) {
    return prisma.coachNote.findMany({
      where: { athleteId },
      include: {
        coach: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async getAlerts(coachId: string) {
    const athletes = await prisma.athleteProfile.findMany({
      where: {
        coaches: { some: { coachId } },
      },
      include: {
        user: { select: { name: true } },
        videos: {
          where: {
            status: "COMPLETE",
            biomechanicsReport: { isNot: null },
            geminiAnalysis: { isNot: null },
          },
          orderBy: { processedAt: "desc" },
          take: 2,
          include: {
            biomechanicsReport: true,
            geminiAnalysis: true,
          },
        },
      },
    });

    const alerts: Array<Record<string, unknown>> = [];

    for (const athlete of athletes) {
      const latest = athlete.videos[0];
      const previous = athlete.videos[1];

      if (latest?.geminiAnalysis && latest.geminiAnalysis.injuryRiskScore > 70) {
        alerts.push({
          athleteId: athlete.id,
          athleteName: athlete.user.name,
          type: "HIGH_INJURY_RISK",
          value: latest.geminiAnalysis.injuryRiskScore,
          at: latest.processedAt ?? latest.uploadedAt,
        });
      }

      if (
        latest?.biomechanicsReport &&
        previous?.biomechanicsReport &&
        previous.biomechanicsReport.enduranceIndex - latest.biomechanicsReport.enduranceIndex > 20
      ) {
        alerts.push({
          athleteId: athlete.id,
          athleteName: athlete.user.name,
          type: "ENDURANCE_DROP",
          value:
            previous.biomechanicsReport.enduranceIndex -
            latest.biomechanicsReport.enduranceIndex,
          at: latest.processedAt ?? latest.uploadedAt,
        });
      }
    }

    return alerts;
  },
};
