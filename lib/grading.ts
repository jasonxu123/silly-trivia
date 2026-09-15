import { askForScores, GRADER_MODEL } from "@/lib/gemini";
import {
  CHECKBOX_CHOICES,
  labelFor,
  PROMPTS,
  RADIO_CHOICES,
  type Responses,
  type QuestionKey,
  type TextQuestion,
} from "@/lib/quiz";

const ANSWERS = {
  q1: "wow",
  q2: "San Diego",
  q3: ["jaguar", "lion", "tiger", "leopard"],
  q4: "blue rectangle",
  q5: "theodore roosevelt",
};

// Sent to the model alongside each answer. Scores are always in quarters.
const RUBRICS: Record<Exclude<TextQuestion, "q1">, string> = {
  q2: `The answer is San Diego.
"San Diego" scores 1, in any capitalisation and with or without ", CA".
"La Jolla" also scores 1 — it is a neighbourhood of San Diego.
Any other city or place scores 0.`,
  q4: `The picture is a cyan rectangle. The answer has two halves worth 0.5 each: the colour and the shape.
Colour: "blue", "cyan", or any other shade of blue earns its 0.5.
Shape: "rectangle" earns its 0.5; "square" earns 0.25 instead.
Add the halves together, so "blue rectangle" is 1 and "cyan square" is 0.75.`,
  q5: `The speaker is Theodore Roosevelt.
"Theodore", "Theo", "Teddy", or a similar form of the first name scores 1, with or without the surname.
"Roosevelt" alone scores 0.5.
Any other Roosevelt — "Franklin Roosevelt", "FDR", "Eleanor" — scores 0, because it names the wrong person.
Ignore minor misspellings of up to two letters; grade them as if spelled correctly.`,
};

const GRADED_BY_MODEL = ["q2", "q4", "q5"] as const;

const PARTIAL_LENGTH_RATIO = 0.4;

function normalize(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Deterministic substring grader, used whenever the model can't be trusted. */
function fallbackScore(response: string, answer: string) {
  const given = normalize(response);
  const expected = normalize(answer);
  if (given === expected) {
    return 1;
  }
  if (
    given.length >= expected.length * PARTIAL_LENGTH_RATIO &&
    expected.includes(given)
  ) {
    return 0.5;
  }
  return 0;
}

function gradeChoices(response: string[], answers: string[]) {
  const expected = new Set(answers.map(normalize));
  const chosen = new Set(response.map(normalize));
  let points = 0;
  for (const choice of chosen) {
    points += expected.has(choice) ? 1 : -1;
  }
  return Math.max(0, points / expected.size);
}

/** Scores the model may report; anything else is snapped or rejected. */
function cleanScore(score: number | undefined) {
  if (score === undefined || !Number.isFinite(score)) {
    return undefined;
  }
  const snapped = Math.round(Math.min(1, Math.max(0, score)) * 4) / 4;
  return snapped;
}

/** Cases settled without the model: blank answers and exact matches. */
function shortcutScore(response: string, answer: string) {
  const given = normalize(response);
  if (given === "") {
    return 0;
  }
  if (given === normalize(answer)) {
    return 1;
  }
  return undefined;
}

function buildInput(pending: TextQuestion[], responses: Responses) {
  const blocks = pending.map((key) => {
    const answer = ANSWERS[key];
    const rubric = RUBRICS[key as Exclude<TextQuestion, "q1">];
    return [
      `Question id: ${key}`,
      `Question: ${PROMPTS[key]}`,
      `Expected answer: ${answer}`,
      `Rubric:\n${rubric}`,
      `Student answer: ${responses[key]}`,
    ].join("\n");
  });

  return [
    "You are grading short free-text quiz answers.",
    "Apply each rubric exactly as written and report a score for every question id via submit_scores.",
    "Scores must be one of 0, 0.25, 0.5, 0.75, or 1.",
    "",
    blocks.join("\n\n"),
  ].join("\n");
}

export type GradedQuestion = { points: number; answer: string };

export async function gradeQuiz(responses: Responses) {
  const scores: Record<QuestionKey, number> = {
    q1: fallbackScore(responses.q1, ANSWERS.q1),
    q2: 0,
    q3: gradeChoices(responses.q3, ANSWERS.q3),
    q4: 0,
    q5: 0,
  };

  // Only the answers no shortcut could settle are worth a model call.
  const pending: TextQuestion[] = [];
  for (const key of GRADED_BY_MODEL) {
    const shortcut = shortcutScore(responses[key], ANSWERS[key]);
    if (shortcut === undefined) {
      pending.push(key);
    } else {
      scores[key] = shortcut;
    }
  }

  let summary: string;
  if (pending.length === 0) {
    summary = "Graded without the model — every answer was blank or exact.";
  } else {
    let reported = new Map<string, number>();
    let failed = false;
    try {
      reported = await askForScores(buildInput(pending, responses));
    } catch {
      failed = true;
    }

    const fellBack: string[] = [];
    for (const key of pending) {
      const score = cleanScore(reported.get(key));
      if (score === undefined) {
        fellBack.push(key);
        scores[key] = fallbackScore(responses[key], ANSWERS[key]);
      } else {
        scores[key] = score;
      }
    }

    const graded = pending.filter((key) => !fellBack.includes(key));
    summary = [
      graded.length > 0
        ? `${GRADER_MODEL} graded ${graded.join(", ")}.`
        : `${GRADER_MODEL} returned no usable scores.`,
      fellBack.length > 0
        ? `Fell back to substring matching for ${fellBack.join(", ")}${
            failed ? " (model call failed)" : ""
          }.`
        : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  const results: Record<QuestionKey, GradedQuestion> = {
    q1: { points: scores.q1, answer: labelFor(RADIO_CHOICES, ANSWERS.q1) },
    q2: { points: scores.q2, answer: `${ANSWERS.q2} (or La Jolla)` },
    q3: {
      points: scores.q3,
      answer: ANSWERS.q3.map((v) => labelFor(CHECKBOX_CHOICES, v)).join(", "),
    },
    q4: { points: scores.q4, answer: ANSWERS.q4 },
    q5: { points: scores.q5, answer: ANSWERS.q5 },
  };

  return { results, summary };
}
