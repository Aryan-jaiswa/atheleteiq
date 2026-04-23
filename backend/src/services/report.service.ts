import {
  PrismaClient,
  SelectionDecision,
  SelectionReadiness,
  VideoType,
} from "@prisma/client";
import { createClient } from "redis";
import {
  boundedScore,
  compositeDecisionFromScore,
  parseSelectionReadiness,
  readinessToScore,
  videoTypeWeight,
} from "./selection.utils";
import { getGCS } from "../config/gcs";

const prisma = new PrismaClient();

type AnalyzedVideo = {
  id: string;
  type: VideoType;
  processedAt: Date | null;
  biomechanicsReport: {
    techniqueScore: number;
    symmetryScore: number;
    explosiveness: number;
    enduranceIndex: number;
    balanceScore: number;
  } | null;
  geminiAnalysis: {
    injuryRiskScore: number;
    selectionReadiness: SelectionReadiness;
    rawResponse: string;
    strengths: unknown;
    weaknesses: unknown;
    injuryRiskAreas: unknown;
    aiSummary: string;
    coachNotes: string;
    trainingRecommendations: unknown;
  } | null;
};

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }
  return [];
}

async function enqueueSelectionPdfJob(payload: Record<string, unknown>) {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return;
  }

  const client = createClient({ url: redisUrl });
  await client.connect();
  try {
    await client.lPush("selection-pdf-jobs", JSON.stringify(payload));
  } finally {
    await client.quit();
  }
}

function computePerVideoComposite(video: AnalyzedVideo) {
  const bio = video.biomechanicsReport;
  const gemini = video.geminiAnalysis;
  if (!bio || !gemini) {
    return null;
  }

  const readiness =
    gemini.selectionReadiness ??
    parseSelectionReadiness(gemini.rawResponse, SelectionReadiness.DEVELOPMENT);
  const readinessScore = readinessToScore[readiness];

  const techniqueScore = boundedScore(bio.techniqueScore);
  const symmetryScore = boundedScore(bio.symmetryScore);
  const explosivenessScore = boundedScore(bio.explosiveness);
  const enduranceIndex = boundedScore(bio.enduranceIndex);
  const balanceScore = boundedScore(bio.balanceScore);
  const injuryRisk = boundedScore(gemini.injuryRiskScore);

  const composite =
    techniqueScore * 0.25 +
    symmetryScore * 0.15 +
    explosivenessScore * 0.15 +
    enduranceIndex * 0.15 +
    balanceScore * 0.1 +
    (100 - injuryRisk) * 0.1 +
    readinessScore * 0.1;

  return {
    readiness,
    readinessScore,
    injuryRisk,
    techniqueScore,
    symmetryScore,
    explosivenessScore,
    enduranceIndex,
    balanceScore,
    composite: boundedScore(composite),
  };
}

function getGsObjectPath(uri: string): { bucket: string; file: string } | null {
  if (!uri.startsWith("gs://")) {
    return null;
  }
  const cleaned = uri.replace("gs://", "");
  const slashIndex = cleaned.indexOf("/");
  if (slashIndex < 0) {
    return null;
  }
  return {
    bucket: cleaned.slice(0, slashIndex),
    file: cleaned.slice(slashIndex + 1),
  };
}

export const reportService = {
  async generateReport(athleteId: string, generatedById: string) {
    const athlete = await prisma.athleteProfile.findUnique({
      where: { id: athleteId },
      include: { user: true },
    });

    if (!athlete) {
      throw new Error("Athlete not found");
    }

    const videos = await prisma.video.findMany({
      where: {
        athleteId,
        status: "COMPLETE",
        biomechanicsReport: { isNot: null },
        geminiAnalysis: { isNot: null },
      },
      include: {
        biomechanicsReport: true,
        geminiAnalysis: true,
      },
      orderBy: { processedAt: "desc" },
    });

    if (videos.length === 0) {
      throw new Error("No complete analyzed videos found for this athlete");
    }

    const weighted: Array<{
      weight: number;
      metrics: NonNullable<ReturnType<typeof computePerVideoComposite>>;
      video: typeof videos[number];
    }> = [];

    for (const video of videos) {
      const metrics = computePerVideoComposite(video as unknown as AnalyzedVideo);
      if (!metrics) {
        continue;
      }

      weighted.push({
        weight: videoTypeWeight(video.type),
        metrics,
        video,
      });
    }

    if (weighted.length === 0) {
      throw new Error("No videos with full biomechanics + Gemini analysis");
    }

    const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
    const weightedAvg = (selector: (item: typeof weighted[number]) => number) =>
      totalWeight === 0
        ? 0
        : weighted.reduce((sum, item) => sum + selector(item) * item.weight, 0) /
          totalWeight;

    const compositeScore = boundedScore(weightedAvg((item) => item.metrics.composite));
    const decision = compositeDecisionFromScore(compositeScore);

    const scoreBreakdown = {
      techniqueScore: weightedAvg((item) => item.metrics.techniqueScore),
      symmetryScore: weightedAvg((item) => item.metrics.symmetryScore),
      explosivenessScore: weightedAvg((item) => item.metrics.explosivenessScore),
      enduranceIndex: weightedAvg((item) => item.metrics.enduranceIndex),
      balanceScore: weightedAvg((item) => item.metrics.balanceScore),
      injuryRisk: weightedAvg((item) => item.metrics.injuryRisk),
      readinessScore: weightedAvg((item) => item.metrics.readinessScore),
    };

    const report = await prisma.selectionReport.create({
      data: {
        athleteId,
        generatedById,
        compositeScore,
        selectionDecision: decision as SelectionDecision,
        videoIds: weighted.map((item) => item.video.id),
        scoreBreakdown,
      },
    });

    await enqueueSelectionPdfJob({
      reportId: report.id,
      athleteId,
      requestedBy: generatedById,
    });

    return report;
  },

  async getAthleteReport(athleteId: string) {
    const latest = await prisma.selectionReport.findFirst({
      where: { athleteId },
      include: {
        generatedBy: {
          select: { id: true, name: true, email: true, role: true },
        },
        athlete: {
          include: {
            user: {
              select: { id: true, name: true, email: true, sport: true, region: true },
            },
            coachNotes: {
              orderBy: { createdAt: "desc" },
              take: 20,
            },
          },
        },
      },
      orderBy: { generatedAt: "desc" },
    });

    if (!latest) {
      return null;
    }

    const videoIds = Array.isArray(latest.videoIds)
      ? (latest.videoIds as string[])
      : [];
    const videos = await prisma.video.findMany({
      where: { id: { in: videoIds } },
      include: {
        biomechanicsReport: true,
        geminiAnalysis: true,
      },
      orderBy: { processedAt: "asc" },
    });

    const timeline = videos.map((video) => {
      const metrics = computePerVideoComposite(video as unknown as AnalyzedVideo);
      return {
        id: video.id,
        type: video.type,
        processedAt: video.processedAt,
        thumbnailUrl:
          video.status === "COMPLETE"
            ? `https://storage.googleapis.com/${
                process.env.GCS_BUCKET_NAME ?? "athleteiq-videos"
              }/frames/${video.id}/frame_0001.jpg`
            : null,
        compositeScore: metrics?.composite ?? null,
        biomechanics: video.biomechanicsReport,
        gemini: video.geminiAnalysis
          ? {
              ...video.geminiAnalysis,
              strengths: asStringArray(video.geminiAnalysis.strengths),
              weaknesses: asStringArray(video.geminiAnalysis.weaknesses),
              injuryRiskAreas: asStringArray(video.geminiAnalysis.injuryRiskAreas),
              trainingRecommendations: asStringArray(
                video.geminiAnalysis.trainingRecommendations
              ),
              selectionReadiness:
                video.geminiAnalysis.selectionReadiness ??
                parseSelectionReadiness(video.geminiAnalysis.rawResponse),
            }
          : null,
      };
    });

    return {
      ...latest,
      videos: timeline,
    };
  },

  async getAllAthletesWithReports(filters: {
    sport?: string;
    region?: string;
    selectionDecision?: SelectionDecision;
    minScore?: number;
  }) {
    const athletes = await prisma.athleteProfile.findMany({
      where: {
        ...(filters.sport ? { sport: filters.sport } : {}),
        ...(filters.region ? { region: filters.region } : {}),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, sport: true, region: true },
        },
        videos: {
          where: { status: "COMPLETE" },
          orderBy: { processedAt: "desc" },
          take: 1,
        },
        selectionReports: {
          orderBy: { generatedAt: "desc" },
          take: 1,
        },
      },
    });

    return athletes
      .map((athlete) => ({
        athleteId: athlete.id,
        name: athlete.user.name,
        sport: athlete.sport,
        region: athlete.region,
        state: athlete.state,
        profilePhotoUrl: athlete.profilePhotoUrl,
        latestReport: athlete.selectionReports[0] ?? null,
        compositeScore: athlete.selectionReports[0]?.compositeScore ?? 0,
        selectionDecision: athlete.selectionReports[0]?.selectionDecision ?? "PENDING",
        lastAnalyzedDate: athlete.videos[0]?.processedAt ?? null,
      }))
      .filter(
        (row) =>
          (!filters.selectionDecision ||
            row.selectionDecision === filters.selectionDecision) &&
          (!filters.minScore || row.compositeScore >= filters.minScore)
      )
      .sort((a, b) => b.compositeScore - a.compositeScore);
  },

  async overrideDecision(
    reportId: string,
    newDecision: SelectionDecision,
    reason: string
  ) {
    return prisma.selectionReport.update({
      where: { id: reportId },
      data: {
        selectionDecision: newDecision,
        decisionReason: reason,
      },
    });
  },

  async getReport(reportId: string) {
    const report = await prisma.selectionReport.findUniqueOrThrow({
      where: { id: reportId },
      include: {
        athlete: {
          include: {
            user: true,
          },
        },
        generatedBy: true,
      },
    });

    const videoIds = Array.isArray(report.videoIds) ? (report.videoIds as string[]) : [];
    const videos = await prisma.video.findMany({
      where: { id: { in: videoIds } },
      include: {
        biomechanicsReport: true,
        geminiAnalysis: true,
      },
    });

    return { ...report, videos };
  },

  async getReportPdfDownloadUrl(reportId: string) {
    const report = await prisma.selectionReport.findUniqueOrThrow({
      where: { id: reportId },
    });

    if (!report.reportPdfUrl) {
      return null;
    }

    const gs = getGsObjectPath(report.reportPdfUrl);
    if (!gs) {
      return report.reportPdfUrl;
    }

    const [signedUrl] = await getGCS()
      .bucket(gs.bucket)
      .file(gs.file)
      .getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + 15 * 60 * 1000,
      });

    return signedUrl;
  },
};
