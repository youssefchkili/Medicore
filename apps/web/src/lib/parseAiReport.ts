// Always shown for AI-generated reports, even if the AI's own JSON output
// omits or mangles its disclaimer field — this notice must never disappear.
export const DEFAULT_AI_DISCLAIMER =
  "This is an AI-assisted pre-screening, not a medical diagnosis. It does not replace professional medical advice — always consult a doctor.";

export type ParsedAiReport = {
  symptomsSummary?: string;
  recommendations?: string;
  disclaimer?: string;
  raw: string;
};

/**
 * The AI service stores its raw structured output as a JSON string in `rawReport`.
 * Older or malformed records may not be valid JSON, so this always falls back
 * to returning the raw text untouched rather than throwing.
 */
export function parseAiReport(rawReport: string): ParsedAiReport {
  try {
    const obj = JSON.parse(rawReport) as Record<string, unknown>;
    return {
      symptomsSummary: typeof obj.symptoms_summary === "string" ? obj.symptoms_summary : undefined,
      recommendations: typeof obj.recommendations === "string" ? obj.recommendations : undefined,
      disclaimer: typeof obj.disclaimer === "string" ? obj.disclaimer : undefined,
      raw: rawReport,
    };
  } catch {
    return { raw: rawReport };
  }
}
