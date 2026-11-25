import { z } from "zod";

export const TicketCategoryEnum = z.enum([
  "BILLING_DUPLICATE",
  "ACCOUNT_ACCESS",
  "CANCELLATION",
  "TECHNICAL_BUG",
  "GENERAL_QUESTION",
]);

export const DepartmentEnum = z.enum([
  "FINANCEIRO",
  "SUPORTE_CONTA",
  "RETENCAO",
  "ENGENHARIA",
  "ATENDIMENTO_GERAL",
]);

export const UrgencyEnum = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const aiTriageOutputSchema = z.object({
  category: TicketCategoryEnum,
  department: DepartmentEnum,
  urgency: UrgencyEnum,
  confidence: z.number().min(0).max(1),
  suggestedReply: z.string().min(10).max(800),
  reasoning: z.string().min(5).max(300),
});

export type AiTriageOutput = z.infer<typeof aiTriageOutputSchema>;
export type TicketCategory = z.infer<typeof TicketCategoryEnum>;
export type Department = z.infer<typeof DepartmentEnum>;

export const incomingTicketSchema = z.object({
  customerName: z.string().min(2).max(120),
  customerEmail: z.string().email(),
  message: z.string().min(5).max(2000),
});
