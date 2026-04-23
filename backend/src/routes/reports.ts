import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import { requireRole } from "../middleware/roleMiddleware";
import { reportService } from "../services/report.service";

const router = Router();

/**
 * POST /api/reports/generate
 * Generate selection report for athlete
 * Body: { athleteId, requestedBy: userId }
 * Requires: FEDERATION or ADMIN role
 */
router.post(
  "/generate",
  authMiddleware,
  requireRole("FEDERATION", "ADMIN"),
  async (req: Request, res: Response) => {
    try {
      const { athleteId, requestedBy } = req.body;
      const userId = requestedBy || req.user?.userId;

      if (!athleteId || !userId) {
        return res.status(400).json({ error: "athleteId and requestedBy are required" });
      }

      const report = await reportService.generateReport(athleteId, userId);
      res.json({
        message: "Selection report generation queued",
        report,
      });
    } catch (error: any) {
      console.error("Error generating report:", error);
      res
        .status(500)
        .json({
          error: error.message || "Failed to generate selection report",
        });
    }
  }
);

/**
 * GET /api/reports/:athleteId
 * Get latest selection report for athlete
 */
router.get(
  "/:athleteId",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { athleteId } = req.params;
      const report = await reportService.getAthleteReport(athleteId);

      if (!report) {
        return res.status(404).json({ error: "No selection report found" });
      }

      res.json(report);
    } catch (error: any) {
      console.error("Error fetching report:", error);
      res.status(500).json({ error: "Failed to fetch report" });
    }
  }
);

/**
 * GET /api/reports
 * Get all athletes with latest reports (for federation dashboard)
 * Query: sport, region, selectionDecision, minScore
 */
router.get(
  "/",
  authMiddleware,
  requireRole("FEDERATION", "ADMIN"),
  async (req: Request, res: Response) => {
    try {
      const { sport, region, selectionDecision, minScore } = req.query;

      const athletes = await reportService.getAllAthletesWithReports({
        sport: sport as string,
        region: region as string,
        selectionDecision: selectionDecision as any,
        minScore: minScore ? Number(minScore) : undefined,
      });

      res.json(athletes);
    } catch (error: any) {
      console.error("Error fetching athletes:", error);
      res.status(500).json({ error: "Failed to fetch athletes" });
    }
  }
);

/**
 * GET /api/reports/:id/pdf
 * Get signed GCS URL for report PDF
 */
router.get(
  "/:id/pdf",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const url = await reportService.getReportPdfDownloadUrl(id);
      if (!url) {
        return res
          .status(404)
          .json({ error: "PDF not yet generated for this report" });
      }

      res.json({ url });
    } catch (error: any) {
      console.error("Error fetching PDF URL:", error);
      res.status(500).json({ error: "Failed to fetch PDF URL" });
    }
  }
);

/**
 * PATCH /api/reports/:id/decision
 * Override selection decision (federation only)
 * Body: { decision: SELECTED | REJECTED, reason: string }
 */
router.patch(
  "/:id/decision",
  authMiddleware,
  requireRole("FEDERATION", "ADMIN"),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { decision, decisionReason } = req.body;

      if (!decision || !decisionReason) {
        return res
          .status(400)
          .json({ error: "decision and decisionReason are required" });
      }

      if (!["SELECTED", "REJECTED"].includes(decision)) {
        return res.status(400).json({ error: "Invalid decision value" });
      }

      const updated = await reportService.overrideDecision(id, decision, decisionReason);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating decision:", error);
      res.status(500).json({ error: "Failed to update decision" });
    }
  }
);

export default router;
