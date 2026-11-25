export interface AiClassifierProvider {
  readonly name: string;
  classifyRaw(message: string): Promise<string>;
}

/**
 * Classificador determinístico local para demos offline, testes e baseline de evals.
 * Retorna JSON estruturado compatível com aiTriageOutputSchema.
 */
export class HeuristicClassifierProvider implements AiClassifierProvider {
  readonly name = "heuristic-baseline-v1";

  async classifyRaw(message: string): Promise<string> {
    const text = message.toLowerCase();

    if (
      text.includes("cobrança duplicada") ||
      text.includes("cobrado duas vezes") ||
      text.includes("cobranca duplicada") ||
      text.includes("fatura") ||
      text.includes("estorno") ||
      text.includes("pix")
    ) {
      return JSON.stringify({
        category: "BILLING_DUPLICATE",
        department: "FINANCEIRO",
        urgency: "HIGH",
        confidence: 0.92,
        suggestedReply:
          "Olá! Recebemos seu relato sobre cobrança e já encaminhamos com prioridade ao time Financeiro para verificar e estornar qualquer duplicidade.",
        reasoning: "Menção explícita a cobrança duplicada, fatura ou estorno.",
      });
    }

    if (
      text.includes("cancelar") ||
      text.includes("cancelamento") ||
      text.includes("encerrar assinatura") ||
      text.includes("não quero mais")
    ) {
      return JSON.stringify({
        category: "CANCELLATION",
        department: "RETENCAO",
        urgency: "MEDIUM",
        confidence: 0.9,
        suggestedReply:
          "Olá! Sentimos muito que esteja considerando cancelar. Nosso time de Retenção vai te atender rapidamente para resolver da melhor forma.",
        reasoning: "Intenção explícita de cancelamento de plano ou assinatura.",
      });
    }

    if (
      text.includes("senha") ||
      text.includes("login") ||
      text.includes("entrar na conta") ||
      text.includes("acesso") ||
      text.includes("bloqueada") ||
      text.includes("código de verificação")
    ) {
      return JSON.stringify({
        category: "ACCOUNT_ACCESS",
        department: "SUPORTE_CONTA",
        urgency: "HIGH",
        confidence: 0.89,
        suggestedReply:
          "Olá! Encaminhamos seu chamado ao Suporte de Conta para restaurar seu acesso com segurança o quanto antes.",
        reasoning: "Relato de dificuldade de login, senha ou bloqueio de conta.",
      });
    }

    if (
      text.includes("erro 500") ||
      text.includes("travando") ||
      text.includes("bug") ||
      text.includes("não carrega") ||
      text.includes("tela branca") ||
      text.includes("crash")
    ) {
      return JSON.stringify({
        category: "TECHNICAL_BUG",
        department: "ENGENHARIA",
        urgency: "HIGH",
        confidence: 0.87,
        suggestedReply:
          "Olá! Obrigado por reportar o problema técnico. Nosso time de Engenharia já recebeu os detalhes para investigar e corrigir.",
        reasoning: "Descrição de falha técnica, erro ou travamento na aplicação.",
      });
    }

    return JSON.stringify({
      category: "GENERAL_QUESTION",
      department: "ATENDIMENTO_GERAL",
      urgency: "LOW",
      confidence: 0.78,
      suggestedReply:
        "Olá! Obrigado pelo contato. Nossa equipe de Atendimento Geral vai responder sua dúvida em breve.",
      reasoning: "Mensagem informativa ou dúvida geral sem sinais de urgência.",
    });
  }
}

/**
 * Provedor real usando Gemini REST API com saída JSON estruturada.
 */
export class GeminiClassifierProvider implements AiClassifierProvider {
  readonly name: string;

  constructor(
    private readonly apiKey: string,
    private readonly model = "gemini-2.5-flash"
  ) {
    this.name = `gemini:${model}`;
  }

  async classifyRaw(message: string): Promise<string> {
    const prompt = `Classifique a mensagem de suporte abaixo e retorne APENAS um JSON válido com as chaves:
- category: "BILLING_DUPLICATE" | "ACCOUNT_ACCESS" | "CANCELLATION" | "TECHNICAL_BUG" | "GENERAL_QUESTION"
- department: "FINANCEIRO" | "SUPORTE_CONTA" | "RETENCAO" | "ENGENHARIA" | "ATENDIMENTO_GERAL"
- urgency: "LOW" | "MEDIUM" | "HIGH"
- confidence: número entre 0 e 1
- suggestedReply: rascunho educado em PT-BR para revisão humana
- reasoning: justificativa curta em PT-BR

Mensagem do cliente: "${message}"`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
      }),
    });

    if (!res.ok) {
      throw new Error(`Gemini API HTTP ${res.status}`);
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Resposta vazia da Gemini API");
    }
    return text;
  }
}
