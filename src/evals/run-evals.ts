import { GeminiClassifierProvider, HeuristicClassifierProvider } from "../ai/provider";
import { runEvalSuite } from "./evaluator";

const MIN_ACCURACY = 80;

async function main() {
  const provider =
    process.env.AI_PROVIDER === "gemini" && process.env.GEMINI_API_KEY
      ? new GeminiClassifierProvider(process.env.GEMINI_API_KEY, process.env.GEMINI_MODEL)
      : new HeuristicClassifierProvider();

  const report = await runEvalSuite(provider);
  console.log(JSON.stringify(report, null, 2));

  if (report.accuracy < MIN_ACCURACY) {
    console.error(`Acurácia (${report.accuracy}%) abaixo do mínimo exigido (${MIN_ACCURACY}%).`);
    process.exit(1);
  }
}

main();
