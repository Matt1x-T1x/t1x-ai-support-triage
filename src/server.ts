import { openDatabase } from "./db/database";
import { GeminiClassifierProvider, HeuristicClassifierProvider } from "./ai/provider";
import { createApp } from "./app";

const port = Number(process.env.PORT ?? 3003);
const dbPath = process.env.DATABASE_PATH ?? "./data/triage.db";
const providerMode = process.env.AI_PROVIDER ?? "heuristic";

const provider =
  providerMode === "gemini" && process.env.GEMINI_API_KEY
    ? new GeminiClassifierProvider(process.env.GEMINI_API_KEY, process.env.GEMINI_MODEL)
    : new HeuristicClassifierProvider();

const db = openDatabase(dbPath);
const { app } = createApp(db, provider);

app.listen(port, () => {
  console.log(`[t1x-ai-support-triage] rodando em http://localhost:${port} (provider=${provider.name})`);
});
