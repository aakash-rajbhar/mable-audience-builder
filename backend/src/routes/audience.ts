import { Router, Request, Response } from "express";
import { audiencePreviewSchema } from "../schemas/audience.js";
import { evaluateAudience } from "../services/audienceService.js";
import { Db } from "../db/database.js";

/**
 * Initializes the audience router with an injected Db instance.
 */
export function createAudienceRouter(db: Db): Router {
  const router = Router();

  router.post("/audiences/preview", (req: Request, res: Response) => {
    const parseResult = audiencePreviewSchema.safeParse(req.body);

    if (!parseResult.success) {
      const details = parseResult.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));

      console.warn("Audience preview validation failed:", JSON.stringify(details));

      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid audience definition",
          details,
        },
      });
      return;
    }

    const result = evaluateAudience(db, parseResult.data);
    console.log(`Audience preview "${result.name}" → ${result.total} member(s)`);
    res.json(result);
  });

  return router;
}
