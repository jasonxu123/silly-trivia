import { createNextHandler } from "@ts-rest/serverless/next";
import { timeContract } from "@/lib/contracts/time";
import { graderContract } from "@/lib/contracts/grader";
import { gradeQuiz } from "@/lib/grading";
import { getHint } from "@/lib/hints";
import type { Responses } from "@/lib/quiz";

const contract = { ...timeContract, ...graderContract };

const router = {
  getTime: async () => {
    const now = new Date();
    return {
      status: 200 as const,
      body: {
        iso: now.toISOString(),
        timestamp: now.getTime(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };
  },

  gradeQuiz: async ({ body }: { body: { responses: Responses } }) => {
    try {
      return { status: 200 as const, body: await gradeQuiz(body.responses) };
    } catch (error) {
      return {
        status: 500 as const,
        body: { message: error instanceof Error ? error.message : "failed" },
      };
    }
  },

  getHint: async ({
    body,
  }: {
    body: { questionId: string; hintIndex: number };
  }) => {
    const hint = getHint(body.questionId, body.hintIndex);
    if (!hint) {
      return { status: 404 as const, body: { message: "no such hint" } };
    }
    return { status: 200 as const, body: hint };
  },
};

const handler = createNextHandler(contract, router, {
  basePath: "/api",
  handlerType: "app-router",
});

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
