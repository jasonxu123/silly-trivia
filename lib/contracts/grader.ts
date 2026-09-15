import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

const gradedQuestion = z.object({
  points: z.number(),
  answer: z.string(),
});

export const graderContract = c.router({
  gradeQuiz: {
    method: "POST",
    path: "/grade",
    body: z.object({
      q1: z.string().max(100),
      q2: z.string().max(100),
      q3: z.array(z.string()).max(10),
      q4: z.string().max(100),
      q5: z.string().max(100),
    }),
    responses: {
      200: z.object({
        results: z.object({
          q1: gradedQuestion,
          q2: gradedQuestion,
          q3: gradedQuestion,
          q4: gradedQuestion,
          q5: gradedQuestion,
        }),
        summary: z.string(),
      }),
      500: z.object({
        message: z.string(),
      }),
    },
  },
});
