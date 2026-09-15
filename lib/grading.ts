import { isNil } from "lodash";
import type { Grade } from "@/lib/contracts/grader";
import { GRADER_MODEL, llmScore } from "@/lib/gemini";
import { totalHints } from "@/lib/hints";
import {
  QUESTIONS,
  type Attachment,
  type Question,
  type Responses,
} from "@/lib/quiz";

// Server-only. Nothing in this file may be imported by a client component: the
// solutions below are the half of a question the user must not be able to read
// before submitting.

type Solution = {
  /**
   * Accepted answers. Choice questions list choice values; text questions list
   * the answers worth full credit, most canonical first.
   */
  answers: string[];
  /**
   * How the model should score a free-text answer. Scores are always in
   * quarters. Without one, a text question is graded by substring matching.
   */
  rubric?: string;
  /** Shown in place of the question's attachments once the answer is revealed. */
  revealAttachments?: Attachment[];
};

const SOLUTIONS: Record<string, Solution> = {
  q1: { answers: ["wow"] },
  q2: {
    answers: ["San Diego", "La Jolla"],
    rubric: `The answer is San Diego.
"San Diego" scores 1, in any capitalisation and with or without ", CA".
"La Jolla" also scores 1 — it is a neighbourhood of San Diego.
Ignore minor misspellings of up to one letter; grade them as if spelled correctly.
Any other city or place scores 0.`,
  },
  q3: { answers: ["jaguar", "lion", "tiger", "leopard"] },
  q4: {
    answers: ["King of Diamonds"],
    rubric: `The answer is the King of Diamonds. Scoring is all or nothing: 1 or 0, never a partial score.
Both halves must be right. Naming only the rank ("king") or only the suit ("diamonds") scores 0.
"King of Diamonds" scores 1 in any capitalisation.
Readable shorthand also scores 1, in either order, with or without "of", and with the suit singular or plural: "K of diamonds", "K diamond", "king diamonds", "diamond king", "KD".
Any other card scores 0.`,
    revealAttachments: [
      {
        url: "https://aibnr2rvln5mpgsf.public.blob.vercel-storage.com/q4/ef502366-84bd-4e75-80db-495fc9dba3f9.jpg",
        type: "image",
      },
    ],
  },
  q5: {
    answers: ["Theodore Roosevelt"],
    rubric: `The speaker is Theodore Roosevelt.
"Theodore", "Teddy", or a similar form of the first name scores 1, with or without the surname.
"Roosevelt" alone scores 0.5.
Any other Roosevelt — "Franklin Roosevelt", "FDR", "Eleanor" — scores 0, because it names the wrong person.
Ignore minor misspellings of up to two letters; grade them as if spelled correctly.`,
  },
};

const PARTIAL_LENGTH_RATIO = 0.4;

function normalize(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function round(points: number) {
  return Math.round(points * 100) / 100;
}

/** Text questions hold a single answer; anything past the first is ignored. */
function textResponse(responses: Responses, id: string) {
  return responses[id]?.[0] ?? "";
}

/**
 * Cases a rule settles without the model: a blank answer, or an exact match
 * against an accepted answer. Undefined when neither rule applies.
 */
function ruleBasedScore(response: string, answers: string[]) {
  const given = normalize(response);
  if (given === "") {
    return 0;
  }
  if (answers.some((answer) => normalize(answer) === given)) {
    return 1;
  }
  return undefined;
}

/**
 * A score the model reported, made usable — or undefined if it reported nothing
 * usable. A function call constrains the shape, not the contents, so an
 * out-of-range number is snapped and a missing or nonsensical one is rejected.
 */
function cleanUpScore(score: number | undefined) {
  if (isNil(score) || !Number.isFinite(score)) {
    return undefined;
  }
  return Math.round(Math.min(1, Math.max(0, score)) * 4) / 4;
}

/** Substring grader, used whenever the model can't be trusted or isn't asked. */
function defaultScore(response: string, answers: string[]) {
  const given = normalize(response);
  const scores = answers.map((answer) => {
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
  });
  return Math.max(0, ...scores);
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

function buildInput(pending: Question[], responses: Responses) {
  const blocks = pending.map((question) => {
    const solution = SOLUTIONS[question.id];
    return [
      `Question id: ${question.id}`,
      `Question: ${question.label}`,
      `Expected answer: ${solution.answers.join(" / ")}`,
      `Rubric:\n${solution.rubric}`,
      `Student answer: ${textResponse(responses, question.id)}`,
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

export async function gradeQuiz(responses: Responses) {
  // Fraction of the question's points earned, keyed by question id.
  const fractions: Record<string, number> = {};

  // Only free-text answers need the model, and only those no rule settles.
  const pending: Question[] = [];
  for (const question of QUESTIONS) {
    const { answers, rubric } = SOLUTIONS[question.id];

    if (question.type !== "text") {
      fractions[question.id] = gradeChoices(
        responses[question.id] ?? [],
        answers,
      );
      continue;
    }

    const response = textResponse(responses, question.id);
    const ruled = ruleBasedScore(response, answers);
    if (!isNil(ruled)) {
      fractions[question.id] = ruled;
    } else if (isNil(rubric)) {
      fractions[question.id] = defaultScore(response, answers);
    } else {
      pending.push(question);
    }
  }

  let summary: string;
  if (pending.length === 0) {
    summary = "Graded without the model — every answer was blank or exact.";
  } else {
    let reported = new Map<string, number>();
    let failed = false;
    try {
      reported = await llmScore(buildInput(pending, responses));
    } catch {
      failed = true;
    }

    const fellBack: string[] = [];
    for (const question of pending) {
      const score = cleanUpScore(reported.get(question.id));
      if (isNil(score)) {
        fellBack.push(question.id);
        fractions[question.id] = defaultScore(
          textResponse(responses, question.id),
          SOLUTIONS[question.id].answers,
        );
      } else {
        fractions[question.id] = score;
      }
    }

    const graded = pending
      .map((question) => question.id)
      .filter((id) => !fellBack.includes(id));
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

  const grades: Record<string, Grade> = Object.fromEntries(
    QUESTIONS.map((question) => {
      const solution = SOLUTIONS[question.id];
      const grade: Grade = {
        correctAnswer: solution.answers,
        pointsEarned: round(fractions[question.id] * question.pointsWorth),
        totalHints: totalHints(question.id),
        attachments: solution.revealAttachments,
      };
      return [question.id, grade];
    }),
  );

  return { grades, summary };
}
