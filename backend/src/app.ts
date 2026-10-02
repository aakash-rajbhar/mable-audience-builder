import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import { Db } from "./db/database.js";
import healthRouter from "./routes/health.js";
import { createAudienceRouter } from "./routes/audience.js";

/**
 * Factory for building the Express app instance.
 * Accepts a Db connection dependency to enable isolated in-memory testing.
 */
export function createApp(db: Db): Application {
  const app = express();

  const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5173";
  app.use(cors({ origin: corsOrigin }));

  app.use(express.json());

  // Request logger (omits payload details to avoid leaking raw event data)
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.on("finish", () => {
      console.log(`${_req.method} ${_req.path} → ${res.statusCode}`);
    });
    next();
  });

  app.use("/", healthRouter);
  app.use("/v1", createAudienceRouter(db));

  // Fallback 404 handler for unknown routes
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "The requested endpoint does not exist",
      },
    });
  });

  // Global error handling middleware for malformed JSON and uncaught exceptions
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof SyntaxError && "status" in err && (err as { status: number }).status === 400) {
      res.status(400).json({
        error: {
          code: "INVALID_JSON",
          message: "Request body contains invalid JSON",
        },
      });
      return;
    }

    console.error("Unhandled error:", err.message);
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
    });
  });

  return app;
}
