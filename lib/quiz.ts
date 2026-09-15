// The question model shared by the page and the grading endpoint. Everything in
// this file ships in the client bundle, so it must never hold correct answers,
// rubrics, or hint text — those live in lib/grading.ts and only reach the client
// as a Grade, after the quiz has been submitted.

import type { Grade } from "@/lib/contracts/grader";

export type Choice = { value: string; label: string };

export type Attachment = { url: string; type: "image" | "audio" };

type BaseQuestion = {
  id: string;
  label: string;
  pointsWorth: number;
  /** Whether another hint can still be revealed. The hint text stays server-side. */
  hasHint: boolean;
  /** Points the question can no longer earn per hint taken. */
  hintPenalty?: number;
  /** The most recently revealed hint, once one has been asked for. */
  hintLabel?: string;
  attachments?: Attachment[];
};

export type Question =
  | (BaseQuestion & { type: "text" })
  | (BaseQuestion & { type: "single"; choices: Choice[] })
  | (BaseQuestion & { type: "multiple"; choices: Choice[] });

/** A question once its grade has come back from the server. */
export type GradedQuestion = Question & Grade;

export type Responses = Record<string, string[]>;

/**
 * How many points a question can still earn, given the hints taken for it. The
 * server grades out of the full value; the penalty is applied here.
 */
export function maxPoints(question: Question, hintsUsed: number) {
  const penalty = hintsUsed * (question.hintPenalty ?? 0);
  return Math.max(0, question.pointsWorth - penalty);
}

/** Points actually earned: the graded fraction, scaled to what hints left available. */
export function pointsAfterHints(question: GradedQuestion, hintsUsed: number) {
  const fraction =
    question.pointsWorth > 0 ? question.pointsEarned / question.pointsWorth : 0;
  return fraction * maxPoints(question, hintsUsed);
}

export const QUESTIONS: Question[] = [
  {
    id: "q1",
    type: "single",
    label: "What emoji do I use the most?",
    pointsWorth: 1,
    hasHint: false,
    choices: [
      { value: "heart", label: "❤️" },
      { value: "cry", label: "😢" },
      { value: "eyes", label: "👀" },
      { value: "thumbs-up", label: "👍" },
      { value: "wow", label: "😮" },
    ],
  },
  {
    id: "q2",
    type: "text",
    label: "What is my favorite city?",
    pointsWorth: 1,
    hasHint: false,
  },
  {
    id: "q3",
    type: "multiple",
    label: "Which of these are officially big cats?",
    pointsWorth: 1,
    hasHint: false,
    choices: [
      { value: "jaguar", label: "Jaguar" },
      { value: "lion", label: "Lion" },
      { value: "tiger", label: "Tiger" },
      { value: "cougar", label: "Cougar" },
      { value: "cheetah", label: "Cheetah" },
      { value: "leopard", label: "Leopard" },
    ],
  },
  {
    id: "q4",
    type: "text",
    label: "What card is this, suit and number?",
    pointsWorth: 1,
    hasHint: true,
    hintPenalty: 0.2,
    attachments: [{ url: "https://aibnr2rvln5mpgsf.public.blob.vercel-storage.com/q4/0e33e7b5-ad64-46df-939d-0032cf20b03f.png", type: "image" }],
  },
  {
    id: "q5",
    type: "text",
    label: "Who is speaking?",
    pointsWorth: 1,
    hasHint: true,
    hintPenalty: 0.25,
    attachments: [{ url: "https://aibnr2rvln5mpgsf.public.blob.vercel-storage.com/q5/e9e1a206-7ba2-4633-8841-94f36d370414.mov", type: "audio" }],
  },
];

export const TOTAL_POINTS = QUESTIONS.reduce(
  (sum, question) => sum + question.pointsWorth,
  0,
);

export const EMPTY_RESPONSES: Responses = Object.fromEntries(
  QUESTIONS.map((question) => [question.id, []]),
);

export function questionById(id: string) {
  return QUESTIONS.find((question) => question.id === id);
}

/**
 * Turns stored answer values into display text. Choice questions store choice
 * values, so they go through the question's own choices; text questions store
 * what should be shown as-is.
 */
export function answerLabels(question: Question, values: string[]) {
  if (question.type === "text") {
    return values;
  }
  return values.map(
    (value) =>
      question.choices.find((choice) => choice.value === value)?.label ?? value,
  );
}
