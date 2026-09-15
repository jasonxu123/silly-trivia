import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

const attachment = z.object({
  url: z.string(),
  type: z.enum(["image", "audio"]),
});

// What a question gains once it has been graded. The client merges this onto the
// Question it already has, so nothing here is duplicated from lib/quiz.ts.
const grade = z.object({
  /** Choice values for choice questions, display text for text questions. */
  correctAnswer: z.array(z.string()),
  pointsEarned: z.number(),
  /** Hints that were available for this question, 0 if none. */
  totalHints: z.number().int().min(0),
  /** Replaces what the question is showing, to reveal the full media. */
  attachments: z.array(attachment).optional(),
});

export type Grade = z.infer<typeof grade>;

// One revealed hint. Merged onto the Question the same way a Grade is, so
// whatever it carries replaces what the question is currently showing.
const hint = z.object({
  hintLabel: z.string().optional(),
  attachments: z.array(attachment).optional(),
  /** Whether a further hint remains after this one. */
  hasHint: z.boolean(),
});

export type Hint = z.infer<typeof hint>;

export const graderContract = c.router({
  gradeQuiz: {
    method: "POST",
    path: "/grade",
    body: z.object({
      responses: z.record(z.string(), z.array(z.string().max(100)).max(10)),
    }),
    responses: {
      200: z.object({
        grades: z.record(z.string(), grade),
        summary: z.string(),
      }),
      500: z.object({
        message: z.string(),
      }),
    },
  },

  getHint: {
    method: "POST",
    path: "/hint",
    body: z.object({
      questionId: z.string(),
      /** Zero-based index of the hint being asked for. */
      hintIndex: z.number().int().min(0),
    }),
    responses: {
      200: hint,
      404: z.object({
        message: z.string(),
      }),
    },
  },
});
