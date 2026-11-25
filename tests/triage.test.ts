import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { openDatabase } from "../src/db/database";
import { createApp } from "../src/app";
import { HeuristicClassifierProvider, type AiClassifierProvider } from "../src/ai/provider";
import { runEvalSuite } from "../src/evals/evaluator";

describe("T1x AI Support Triage — JSON Estruturado, Resiliência a Falhas e Evals", () => {
  let db: ReturnType<typeof openDatabase>;

  beforeEach(() => {
    db = openDatabase(":memory:");
  });

  it("classifica mensagem com JSON estruturado válido e sugere resposta para revisão humana", async () => {
    const { app } = createApp(db, new HeuristicClassifierProvider());

    const res = await request(app).post("/api/tickets").send({
      customerName: "Ana Paula",
      customerEmail: "ana@empresa.com",
      message: "Oi, veio uma cobrança duplicada na minha fatura do cartão.",
    });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("TRIAGED");
    expect(res.body.data.category).toBe("BILLING_DUPLICATE");
    expect(res.body.data.department).toBe("FINANCEIRO");
    expect(res.body.data.suggested_reply).toBeTruthy();
  });

  it("RESILIÊNCIA (API FORA DO AR): nunca perde a mensagem quando a IA cai e permite reprocessar", async () => {
    const failingProvider: AiClassifierProvider = {
      name: "failing-api",
      async classifyRaw() {
        throw new Error("HTTP 503 Service Unavailable");
      },
    };

    const { app, service } = createApp(db, failingProvider);

    const res = await request(app).post("/api/tickets").send({
      customerName: "Carlos",
      customerEmail: "carlos@cliente.com",
      message: "Quero cancelar minha assinatura agora.",
    });

    // 202 Accepted: mensagem salva em segurança mesmo com a IA fora do ar!
    expect(res.status).toBe(202);
    expect(res.body.data.status).toBe("NEEDS_MANUAL_REVIEW");
    expect(res.body.data.retry_count).toBe(1);
    expect(res.body.data.last_error).toContain("503");

    // Quando a IA volta, o reprocessamento recupera o ticket automaticamente
    service.setProvider(new HeuristicClassifierProvider());
    const reprocess = await request(app).post("/api/tickets/reprocess");
    expect(reprocess.status).toBe(200);
    expect(reprocess.body.data).toEqual({ processed: 1, succeeded: 1, failed: 0 });

    const tickets = await request(app).get("/api/tickets?status=TRIAGED");
    expect(tickets.body.data).toHaveLength(1);
    expect(tickets.body.data[0].category).toBe("CANCELLATION");
  });

  it("RESILIÊNCIA (JSON INVÁLIDO): captura alucinação/formato quebrado da IA sem derrubar o servidor", async () => {
    const brokenJsonProvider: AiClassifierProvider = {
      name: "broken-llm",
      async classifyRaw() {
        return "Desculpe, como modelo de linguagem não consegui gerar JSON...";
      },
    };

    const { app } = createApp(db, brokenJsonProvider);

    const res = await request(app).post("/api/tickets").send({
      customerName: "Beatriz",
      customerEmail: "bia@cliente.com",
      message: "Esqueci minha senha de acesso.",
    });

    expect(res.status).toBe(202);
    expect(res.body.data.status).toBe("NEEDS_MANUAL_REVIEW");
    expect(res.body.data.last_error).toContain("INVALID_AI_JSON");
  });

  it("EVALS COM DADOS: atinge >= 85% de acurácia no dataset rotulado de 15 casos reais", async () => {
    const report = await runEvalSuite(new HeuristicClassifierProvider());
    expect(report.total).toBe(15);
    expect(report.accuracy).toBeGreaterThanOrEqual(85);
  });
});
