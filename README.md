# 🤖 T1x AI Support Triage

> **Projeto 3 da Trilha de Engenharia Matt1x** — Sistema inteligente de classificação e encaminhamento de atendimento ao cliente focado em **saídas estruturadas (JSON + Zod), resiliência a falhas de IA (zero perda de dados + reprocessamento), avaliação objetiva com dados (*Evals*), Docker e CI**.

## 🎯 Problema Resolvido

Integrar IA em produção é diferente de chamar um chat: APIs de LLM podem cair, dar timeout ou retornar texto fora do formato esperado.

Este projeto demonstra como integrar uma tecnologia externa imprevisível com **engenharia resiliente**:
- **Persistência antes da IA (Zero Data Loss):** toda mensagem do cliente é gravada no banco (`RECEIVED`) antes de qualquer chamada externa.
- **Saída Estruturada & Validada (`Zod`):** a IA precisa retornar JSON estrito (`category`, `department`, `urgency`, `confidence`, `suggestedReply`, `reasoning`).
- **Fallback & Reprocessamento:** se a API retornar erro 503 ou JSON quebrado, o chamado vai para `NEEDS_MANUAL_REVIEW` com log do erro e pode ser reprocessado via `POST /api/tickets/reprocess`.
- **Avaliação com Dados (*Evals*):** script `npm run eval` mede a acurácia real em um dataset rotulado (`src/evals/dataset.json`) antes de aprovar mudanças de prompt ou modelo.

## 🛠️ Stack

- **Node.js 24 + TypeScript** (`node:sqlite`)
- **Express + Zod** (validação de entrada e de saída da IA)
- **Provedor Plugável:** `GeminiClassifierProvider` (produção com `GEMINI_API_KEY`) ou `HeuristicClassifierProvider` (baseline local offline)
- **Vitest + Supertest + Eval Runner**
- **Docker Compose + GitHub Actions CI** (roda testes **e** evals automaticamente)

## 🚀 Como Rodar

```bash
cp .env.example .env
npm ci
npm run dev
```

Ou via Docker:
```bash
docker compose up --build
```

## 🧪 Como Rodar Testes & Evals

```bash
# Testes automatizados (caminho feliz + API 503 + JSON quebrado + reprocessamento)
npm test

# Avaliação de acurácia no dataset rotulado (15 casos)
npm run eval
```

## ⚠️ Limitações Conhecidas

- **Reprocessamento manual via endpoint:** em produção com alto volume de chamados, o reprocessamento seria disparado automaticamente por uma fila assíncrona com *exponential backoff* e *Dead Letter Queue* (ex.: BullMQ + Redis).
- **Dataset de evals enxuto (15 casos):** serve como prova de conceito de avaliação contínua; em operação real, o dataset deve crescer continuamente a partir de correções feitas por atendentes humanos.
- **Sem detecção de PII (LGPD):** em produção, dados sensíveis (CPF, cartão) devem ser mascarados antes de enviar o texto para provedores de IA externos.

---

*Construído por **Matheus Machado · Matt1x** como **AI Product Builder** — unindo arquitetura resiliente, avaliação baseada em dados e transparência no desenvolvimento assistido por IA.*
