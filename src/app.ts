import express, { type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import type { DatabaseSync } from "node:sqlite";
import type { AiClassifierProvider } from "./ai/provider";
import { incomingTicketSchema } from "./domain/schemas";
import { TriageService } from "./services/triage.service";

export function createApp(db: DatabaseSync, provider: AiClassifierProvider) {
  const app = express();
  app.use(express.json());

  const service = new TriageService(db, provider);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "t1x-ai-support-triage", provider: provider.name });
  });

  app.post("/api/tickets", async (req, res, next) => {
    try {
      const parsed = incomingTicketSchema.parse(req.body);
      const ticket = await service.ingestTicket(parsed);
      // 201 se triado pela IA; 202 se salvo em segurança para revisão manual/reprocessamento
      const statusCode = ticket.status === "TRIAGED" ? 201 : 202;
      res.status(statusCode).json({ data: ticket });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/tickets/reprocess", async (_req, res, next) => {
    try {
      const summary = await service.reprocessPendingTickets();
      res.json({ data: summary });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/tickets", (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    res.json({ data: service.listTickets(status) });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "VALIDATION_ERROR", details: err.issues });
      return;
    }
    res.status(500).json({ error: "INTERNAL_ERROR", message: "Erro interno inesperado." });
  });

  return { app, service };
}
