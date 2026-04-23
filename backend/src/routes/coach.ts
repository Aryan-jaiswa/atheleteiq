import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import { requireRole } from "../middleware/roleMiddleware";
import { coachService } from "../services/coach.service";

const router = Router();

/**
 * GET /api/coach/athletes
 * Get all athletes linked to coach with latest scores and trends
 */
router.get(
  "/athletes",
  authMiddleware,
  requireRole("COACH"),
  async (req: Request, res: Response) => {
    try {
      const coachId = req.user?.userId;
      if (!coachId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const athletes = await coachService.getCoachAthletes(coachId);
      res.json(athletes);
    } catch (error: any) {
      console.error("Error fetching coach athletes:", error);
      res.status(500).json({ error: "Failed to fetch athletes" });
    }
  }
);

/**
 * GET /api/coach/athletes/:id/timeline
 * Get chronological timeline of reports for athlete
 */
router.get(
  "/athletes/:id/timeline",
  authMiddleware,
  requireRole("COACH"),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const timeline = await coachService.getAthleteTimeline(id);
      res.json(timeline);
    } catch (error: any) {
      console.error("Error fetching timeline:", error);
      res.status(500).json({ error: "Failed to fetch timeline" });
    }
  }
);

router.get(
  "/athletes/:id/notes",
  authMiddleware,
  requireRole("COACH"),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const notes = await coachService.getAthleteNotes(id);
      res.json(notes);
    } catch (error: any) {
      console.error("Error fetching notes:", error);
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  }
);

/**
 * GET /api/coach/compare?athleteIds=1,2,3
 * Compare up to 4 athletes side-by-side
 */
router.get(
  "/compare",
  authMiddleware,
  requireRole("COACH"),
  async (req: Request, res: Response) => {
    try {
      const { athleteIds } = req.query;

      if (!athleteIds || typeof athleteIds !== "string") {
        return res.status(400).json({ error: "athleteIds query param required" });
      }

      const ids = athleteIds.split(",");
      const comparison = await coachService.compareAthletes(ids);
      res.json(comparison);
    } catch (error: any) {
      console.error("Error comparing athletes:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to compare athletes" });
    }
  }
);

/**
 * POST /api/coach/athletes/:id/note
 * Add a note to athlete profile
 * Body: { note: string }
 */
router.post(
  "/athletes/:id/note",
  authMiddleware,
  requireRole("COACH"),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { note } = req.body;
      const coachId = req.user?.userId;

      if (!note || !coachId) {
        return res.status(400).json({ error: "note is required" });
      }

      const updated = await coachService.addAthleteNote(coachId, id, note);
      res.json(updated);
    } catch (error: any) {
      console.error("Error adding note:", error);
      res.status(500).json({ error: "Failed to add note" });
    }
  }
);

/**
 * GET /api/coach/alerts
 * Get athletes with high injury risk or declining performance
 */
router.get(
  "/alerts",
  authMiddleware,
  requireRole("COACH"),
  async (req: Request, res: Response) => {
    try {
      const coachId = req.user?.userId;
      if (!coachId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const alerts = await coachService.getAlerts(coachId);
      res.json(alerts);
    } catch (error: any) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  }
);

export default router;
