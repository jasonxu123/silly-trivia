import type { Hint } from "@/lib/contracts/grader";
import { questionById, type Attachment } from "@/lib/quiz";

// Server-only, and the security boundary for hint media: these URLs are
// unguessable and appear nowhere in the client bundle, so the only way to reach
// a hint file is to ask getHint for it. Never import this from a client
// component, and never fold these URLs into QUESTIONS.

type HintStep = {
  hintLabel?: string;
  /**
   * The complete attachment list once this hint is revealed, not a delta — it
   * replaces what the question is showing. A question that swaps one image for
   * a wider crop lists one; a question that adds a clip lists all of them.
   */
  attachments?: Attachment[];
};

/** The attachments a question starts with, for hints that add rather than replace. */
function initialAttachments(id: string): Attachment[] {
  return questionById(id)?.attachments ?? [];
}

const HINTS: Record<string, HintStep[]> = {
  q4: [
    {
      attachments: [
        {
          url: "https://aibnr2rvln5mpgsf.public.blob.vercel-storage.com/q4/0d62c4b3-ca11-46ae-a943-eb809ae9b9a6.png",
          type: "image",
        },
      ],
    },
    {
      attachments: [
        {
          url: "https://aibnr2rvln5mpgsf.public.blob.vercel-storage.com/q4/ad2a99b0-0034-4709-aa8b-6f8e60a2e143.png",
          type: "image",
        },
      ],
    },
  ],
  q5: [
    {
      attachments: [
        ...initialAttachments("q5"),
        {
          url: "https://aibnr2rvln5mpgsf.public.blob.vercel-storage.com/q5/1580a077-9541-45c5-ba48-730247e22822.mov",
          type: "audio",
        },
      ],
    },
  ],
};

export function totalHints(questionId: string) {
  return HINTS[questionId]?.length ?? 0;
}

/** The hint at `index`, or undefined when the question has no such hint. */
export function getHint(questionId: string, index: number): Hint | undefined {
  const steps = HINTS[questionId];
  const step = steps?.[index];
  if (!step) {
    return undefined;
  }
  return { ...step, hasHint: index + 1 < steps.length };
}
