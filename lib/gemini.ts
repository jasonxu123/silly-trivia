import { GoogleGenAI } from "@google/genai";

export const GRADER_MODEL = "gemini-3.5-flash-lite";

const SUBMIT_SCORES = {
  type: "function" as const,
  name: "submit_scores",
  description: "Report the score for every question listed in the input.",
  parameters: {
    type: "object",
    properties: {
      scores: {
        type: "array",
        description: "One entry per question, in any order.",
        items: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: 'The question id exactly as given, e.g. "q2".',
            },
            score: {
              type: "number",
              description: "One of 0, 0.25, 0.5, 0.75, or 1.",
            },
          },
          required: ["id", "score"],
        },
      },
    },
    required: ["scores"],
  },
};

let client: GoogleGenAI | undefined;

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

/**
 * Asks the model to score each question and returns whatever it reported, keyed
 * by question id. Callers must treat missing or nonsensical ids as ungraded and
 * fall back — a function call constrains the shape, not the contents.
 */
export async function llmScore(input: string) {
  const interaction = await getClient().interactions.create({
    model: GRADER_MODEL,
    input,
    tools: [SUBMIT_SCORES],
  });

  const scores = new Map<string, number>();
  for (const step of interaction.steps ?? []) {
    if (step.type !== "function_call" || step.name !== SUBMIT_SCORES.name) {
      continue;
    }
    const reported = step.arguments?.scores;
    if (!Array.isArray(reported)) {
      continue;
    }
    for (const entry of reported) {
      if (typeof entry?.id === "string" && typeof entry?.score === "number") {
        scores.set(entry.id, entry.score);
      }
    }
  }
  return scores;
}
