import fs from "node:fs";
import path from "node:path";
import type { AiClassifierProvider } from "../ai/provider";
import { parseAndValidateAiResponse } from "../services/triage.service";

export interface EvalCase {
  id: string;
  message: string;
  expectedCategory: string;
  expectedDepartment: string;
}

export interface EvalReport {
  provider: string;
  total: number;
  passed: number;
  failed: number;
  accuracy: number;
  failures: { id: string; expected: string; got: string }[];
}

export async function runEvalSuite(provider: AiClassifierProvider): Promise<EvalReport> {
  const datasetPath = path.join(__dirname, "dataset.json");
  const cases = JSON.parse(fs.readFileSync(datasetPath, "utf-8")) as EvalCase[];

  let passed = 0;
  const failures: { id: string; expected: string; got: string }[] = [];

  for (const item of cases) {
    try {
      const raw = await provider.classifyRaw(item.message);
      const parsed = parseAndValidateAiResponse(raw);
      if (
        parsed.category === item.expectedCategory &&
        parsed.department === item.expectedDepartment
      ) {
        passed++;
      } else {
        failures.push({
          id: item.id,
          expected: `${item.expectedCategory}/${item.expectedDepartment}`,
          got: `${parsed.category}/${parsed.department}`,
        });
      }
    } catch (err: unknown) {
      failures.push({
        id: item.id,
        expected: `${item.expectedCategory}/${item.expectedDepartment}`,
        got: `ERROR: ${err instanceof Error ? err.message : "unknown"}`,
      });
    }
  }

  return {
    provider: provider.name,
    total: cases.length,
    passed,
    failed: cases.length - passed,
    accuracy: Number(((passed / cases.length) * 100).toFixed(1)),
    failures,
  };
}
