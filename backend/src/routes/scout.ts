import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import { requireRole } from "../middleware/roleMiddleware";
import { scoutService } from "../services/scout.service";

const router = Router();

/**
 * GET /api/scout/search
 * Search athletes with filters
 * Query: sport, region, state, minCompositeScore, maxInjuryRisk, selectionReadiness, ageMin, ageMax, page, limit
 */
router.get(
  "/search",
  authMiddleware,
  requireRole("SCOUT"),
  async (req: Request, res: Response) => {
    try {
      const {
        sport,
        region,
        state,
        minCompositeScore,
        maxInjuryRisk,
        selectionReadiness,
        ageMin,
        ageMax,
        page,
        limit,
      } = req.query;

      const result = await scoutService.searchAthletes({
        sport: sport as string,
        region: region as string,
        state: state as string,
        minCompositeScore: minCompositeScore ? Number(minCompositeScore) : undefined,
        maxInjuryRisk: maxInjuryRisk ? Number(maxInjuryRisk) : undefined,
        selectionReadiness: selectionReadiness as any,
        ageMin: ageMin ? Number(ageMin) : undefined,
        ageMax: ageMax ? Number(ageMax) : undefined,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
      });

      res.json(result);
    } catch (error: any) {
      console.error("Error searching athletes:", error);
      res.status(500).json({ error: "Failed to search athletes" });
    }
  }
);

/**
 * POST /api/scout/watchlist/:athleteId
 * Add athlete to watchlist
 * Body: { notes: string }
 */
router.post(
  "/watchlist/:athleteId",
  authMiddleware,
  requireRole("SCOUT"),
  async (req: Request, res: Response) => {
    try {
      const { athleteId } = req.params;
      const { notes } = req.body;
      const scoutId = req.user?.userId;
      if (!scoutId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const result = await scoutService.addToWatchlist(
        scoutId,
        athleteId,
        notes || ""
      );
      res.json(result);
    } catch (error: any) {
      console.error("Error adding to watchlist:", error);
      res.status(500).json({ error: "Failed to add to watchlist" });
    }
  }
);

/**
 * GET /api/scout/watchlist
 * Get scout's watchlist
 */
router.get(
  "/watchlist",
  authMiddleware,
  requireRole("SCOUT"),
  async (req: Request, res: Response) => {
    try {
      const scoutId = req.user?.userId;
      if (!scoutId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const watchlist = await scoutService.getWatchlist(scoutId);
      res.json(watchlist);
    } catch (error: any) {
      console.error("Error fetching watchlist:", error);
      res.status(500).json({ error: "Failed to fetch watchlist" });
    }
  }
);

/**
 * DELETE /api/scout/watchlist/:athleteId
 * Remove athlete from watchlist
 */
router.delete(
  "/watchlist/:athleteId",
  authMiddleware,
  requireRole("SCOUT"),
  async (req: Request, res: Response) => {
    try {
      const { athleteId } = req.params;
      const scoutId = req.user?.userId;
      if (!scoutId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      await scoutService.removeFromWatchlist(scoutId, athleteId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error removing from watchlist:", error);
      res.status(500).json({ error: "Failed to remove from watchlist" });
    }
  }
);

/**
 * GET /api/scout/athletes/:athleteId
 * Get public athlete profile
 */
router.get(
  "/athletes/:athleteId",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { athleteId } = req.params;
      const profile = await scoutService.getPublicAthleteProfile(athleteId);
      res.json(profile);
    } catch (error: any) {
      console.error("Error fetching athlete profile:", error);
      res.status(500).json({ error: "Failed to fetch athlete profile" });
    }
  }
);

export default router;
