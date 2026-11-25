import crypto from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { AiClassifierProvider } from "../ai/provider";
import { aiTriageOutputSchema, type AiTriageOutput } from "../domain/schemas";

export interface TicketRecord {
  id: string;
  customer_name: string;
  customer_email: string;
  message: string;
  status: "RECEIVED" | "TRIAGED" | "NEEDS_MANUAL_REVIEW";
  category: string | null;
  department: string | null;
  urgency: string | null;
  confidence: number | null;
  suggested_reply: string | null;
  reasoning: string | null;
  retry_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export function parseAndValidateAiResponse(raw: string): AiTriageOutput {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("INVALID_AI_JSON: saída da IA não é um JSON válido.");
  }
  const parsed = aiTriageOutputSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `INVALID_AI_SCHEMA: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`
    );
  }
  return parsed.data;
}

export class TriageService {
  constructor(
    private readonly db: DatabaseSync,
    private provider: AiClassifierProvider
  ) {}

  setProvider(provider: AiClassifierProvider): void {
    this.provider = provider;
  }

  /**
   * 1. Salva a mensagem do cliente IMEDIATAMENTE (zero perda de dados).
   * 2. Chama a IA e valida a saída JSON com Zod.
   * 3. Se a IA falhar ou devolver lixo, marca como NEEDS_MANUAL_REVIEW para reprocessamento.
   */
  async ingestTicket(input: {
    customerName: string;
    customerEmail: string;
    message: string;
  }): Promise<TicketRecord> {
    const id = crypto.randomUUID();
    this.db
      .prepare(
        `INSERT INTO tickets (id, customer_name, customer_email, message, status)
         VALUES (?, ?, ?, ?, 'RECEIVED')`
      )
      .run(id, input.customerName.trim(), input.customerEmail.toLowerCase(), input.message.trim());

    return this.classifyAndUpdate(id, input.message.trim());
  }

  async classifyAndUpdate(ticketId: string, message: string): Promise<TicketRecord> {
    try {
      const raw = await this.provider.classifyRaw(message);
      const output = parseAndValidateAiResponse(raw);

      this.db
        .prepare(
          `UPDATE tickets
           SET status = 'TRIAGED',
               category = ?,
               department = ?,
               urgency = ?,
               confidence = ?,
               suggested_reply = ?,
               reasoning = ?,
               last_error = NULL,
               updated_at = datetime('now')
           WHERE id = ?`
        )
        .run(
          output.category,
          output.department,
          output.urgency,
          output.confidence,
          output.suggestedReply,
          output.reasoning,
          ticketId
        );
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido na IA";
      this.db
        .prepare(
          `UPDATE tickets
           SET status = 'NEEDS_MANUAL_REVIEW',
               retry_count = retry_count + 1,
               last_error = ?,
               updated_at = datetime('now')
           WHERE id = ?`
        )
        .run(errorMsg, ticketId);
    }

    return this.getTicket(ticketId)!;
  }

  async reprocessPendingTickets(): Promise<{ processed: number; succeeded: number; failed: number }> {
    const pending = this.db
      .prepare("SELECT id, message FROM tickets WHERE status = 'NEEDS_MANUAL_REVIEW'")
      .all() as unknown as { id: string; message: string }[];

    let succeeded = 0;
    let failed = 0;

    for (const row of pending) {
      const updated = await this.classifyAndUpdate(row.id, row.message);
      if (updated.status === "TRIAGED") succeeded++;
      else failed++;
    }

    return { processed: pending.length, succeeded, failed };
  }

  getTicket(id: string): TicketRecord | undefined {
    return this.db
      .prepare("SELECT * FROM tickets WHERE id = ?")
      .get(id) as unknown as TicketRecord | undefined;
  }

  listTickets(status?: string): TicketRecord[] {
    if (status) {
      return this.db
        .prepare("SELECT * FROM tickets WHERE status = ? ORDER BY created_at DESC")
        .all(status) as unknown as TicketRecord[];
    }
    return this.db
      .prepare("SELECT * FROM tickets ORDER BY created_at DESC")
      .all() as unknown as TicketRecord[];
  }
}
