"use client";

import { useState } from "react";
import { CircleQuestionMarkIcon, LoaderCircleIcon } from "lucide-react";
import { isNil } from "lodash";
import pluralize from "pluralize";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Grade, Hint } from "@/lib/contracts/grader";
import {
  answerLabels,
  EMPTY_RESPONSES,
  maxPoints,
  pointsAfterHints,
  QUESTIONS,
  TOTAL_POINTS,
  type Attachment,
  type GradedQuestion,
  type Question,
  type Responses,
} from "@/lib/quiz";

const GRADING_TIMEOUT_MS = 10_000;

const REVEAL_CLASS = "animate-[reveal_250ms_ease-out]";
const CONCEAL_CLASS = "animate-[conceal_60ms_ease-in_forwards]";

const AND_LIST = new Intl.ListFormat("en", {
  style: "long",
  type: "conjunction",
});

const OR_LIST = new Intl.ListFormat("en", {
  style: "long",
  type: "disjunction",
});

function round(points: number) {
  return Math.round(points * 100) / 100;
}

function unansweredQuestions(responses: Responses) {
  return QUESTIONS.flatMap((question, index) =>
    responses[question.id].length === 0 ? index + 1 : [],
  );
}

function isGraded(question: Question | GradedQuestion): question is GradedQuestion {
  return "pointsEarned" in question;
}

function QuestionRow({
  number,
  children,
}: {
  number: number;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <div className="w-5 shrink-0 font-semibold">{number}.</div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">{children}</div>
    </li>
  );
}

function Attachments({ attachments }: { attachments: Attachment[] }) {
  return attachments.map((attachment) =>
    attachment.type === "audio" ? (
      <audio
        key={attachment.url}
        controls
        controlsList="nodownload"
        src={attachment.url}
        className="w-full max-w-80"
      />
    ) : (
      // Attachment URLs are arbitrary, so they can't be declared in next/image's remote patterns.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={attachment.url}
        src={attachment.url}
        alt=""
        className="w-full max-w-80"
      />
    ),
  );
}

/** Correct choices are tinted once the grade is in, so the answer is visible in place. */
function choiceClass(question: Question | GradedQuestion, value: string) {
  if (!isGraded(question) || !question.correctAnswer.includes(value)) {
    return undefined;
  }
  return "text-green-700";
}

function Answer({
  question,
  response,
  onChange,
}: {
  question: Question | GradedQuestion;
  response: string[];
  onChange: (response: string[]) => void;
}) {
  const disabled = isGraded(question);

  if (question.type === "text") {
    return (
      <Input
        id={question.id}
        name={question.id}
        type="text"
        aria-label={question.label}
        maxLength={100}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        value={response[0] ?? ""}
        disabled={disabled}
        onChange={(event) => onChange([event.target.value])}
      />
    );
  }

  if (question.type === "single") {
    return (
      <RadioGroup
        name={question.id}
        value={response[0] ?? ""}
        disabled={disabled}
        onValueChange={(value) => onChange([String(value)])}
      >
        {question.choices.map(({ value, label }) => (
          <Label
            key={value}
            className={cn("cursor-pointer", choiceClass(question, value))}
          >
            <RadioGroupItem value={value} />
            {label}
          </Label>
        ))}
      </RadioGroup>
    );
  }

  const toggle = (value: string) =>
    onChange(
      response.includes(value)
        ? response.filter((other) => other !== value)
        : [...response, value],
    );

  return (
    <div className="grid grid-flow-col grid-cols-2 grid-rows-3 gap-x-8 gap-y-2">
      {question.choices.map(({ value, label }) => (
        <Label
          key={value}
          className={cn("cursor-pointer", choiceClass(question, value))}
        >
          <Checkbox
            name={question.id}
            value={value}
            checked={response.includes(value)}
            disabled={disabled}
            onCheckedChange={() => toggle(value)}
          />
          {label}
        </Label>
      ))}
    </div>
  );
}

/**
 * Asks for the next hint. The question's own hasHint decides whether it shows,
 * so it disappears by itself once the last hint has been taken.
 */
function HintButton({
  question,
  hintsUsed,
  pending,
  onAskForHint,
}: {
  question: Question;
  hintsUsed: number;
  pending: boolean;
  onAskForHint: () => void;
}) {
  const penalty = question.hintPenalty ?? 0;
  const remaining = maxPoints(question, hintsUsed);

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={onAskForHint}
      >
        {hintsUsed === 0 ? "Get hint" : "Get another hint"}
        {pending && <LoaderCircleIcon className="animate-spin" />}
      </Button>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label="How hints affect your score"
              className="text-muted-foreground hover:text-foreground"
            />
          }
        >
          <CircleQuestionMarkIcon className="size-4" />
        </TooltipTrigger>
        <TooltipContent>
          Each hint you ask for lowers the points this question can earn, by{" "}
          {penalty}. It is currently worth up to {round(remaining)} of{" "}
          {question.pointsWorth}.
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function Feedback({
  question,
  hintsUsed,
  resetting,
}: {
  question: GradedQuestion;
  hintsUsed: number;
  resetting: boolean;
}) {
  const { pointsEarned, pointsWorth } = question;
  // Correct/partial/incorrect describes the answer, so it reads the graded
  // fraction; the points shown are what the hints taken left it worth.
  const fraction = pointsWorth > 0 ? pointsEarned / pointsWorth : 0;
  const earned = round(pointsAfterHints(question, hintsUsed));
  const full = fraction >= 1;
  const partial = fraction > 0 && !full;

  // Choice answers read as a set; text answers as alternatives that all score full marks.
  const labels = answerLabels(question, question.correctAnswer);
  const answer =
    question.type === "text" ? OR_LIST.format(labels) : AND_LIST.format(labels);

  return (
    <div
      className={cn(
        "grid grid-rows-[1fr]",
        resetting ? CONCEAL_CLASS : REVEAL_CLASS,
      )}
    >
      <div className="overflow-hidden">
        <div
          className={cn(
            "font-semibold",
            full
              ? "text-green-700"
              : partial
                ? "text-amber-600"
                : "text-red-700",
          )}
        >
          {full
            ? `✓ Correct! ${earned} / ${pointsWorth}`
            : partial
              ? `◐ Partial: ${earned} / ${pointsWorth}`
              : `✗ Incorrect: ${earned} / ${pointsWorth}`}
          <div>answer: {answer}</div>
          {hintsUsed > 0 && (
            <div className="font-normal text-muted-foreground">
              {hintsUsed} {pluralize("hint", hintsUsed)} used of{" "}
              {question.totalHints}, capping this question at{" "}
              {round(maxPoints(question, hintsUsed))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Sample() {
  const [responses, setResponses] = useState<Responses>(EMPTY_RESPONSES);
  const [grades, setGrades] = useState<Record<string, Grade> | null>(null);
  // Hints revealed so far, keyed by question id. Client-only for now, so the
  // penalty is only as honest as the browser — server-side state replaces this.
  const [hints, setHints] = useState<Record<string, Hint>>({});
  const [hintsUsed, setHintsUsed] = useState<Record<string, number>>({});
  const [hintPending, setHintPending] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const setResponse = (id: string, response: string[]) => {
    setResponses((current) => ({ ...current, [id]: response }));
  };

  const onAskForHint = async (id: string) => {
    setHintPending(id);
    const outcome = await apiClient
      .getHint({ body: { questionId: id, hintIndex: hintsUsed[id] ?? 0 } })
      .catch(() => "failed" as const);
    setHintPending(null);

    if (outcome === "failed" || outcome.status !== 200) {
      return;
    }

    setHints((current) => ({ ...current, [id]: outcome.body }));
    setHintsUsed((current) => ({ ...current, [id]: (current[id] ?? 0) + 1 }));
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const unanswered = unansweredQuestions(responses);
    if (unanswered.length > 0) {
      const noun = pluralize("question", unanswered.length);
      const list = AND_LIST.format(unanswered.map(String));
      if (
        !window.confirm(
          `Are you sure you want to submit empty answers for ${noun} ${list}?`,
        )
      ) {
        return;
      }
    }

    setPending(true);
    setFailed(false);

    // Promise.race drops the loser's value, so a response arriving after the
    // timeout is discarded rather than landing on a page that moved on.
    const call = apiClient
      .gradeQuiz({ body: { responses } })
      .catch(() => "failed" as const);
    const timeout = new Promise<"failed">((resolve) =>
      setTimeout(() => resolve("failed"), GRADING_TIMEOUT_MS),
    );
    const outcome = await Promise.race([call, timeout]);

    setPending(false);

    if (outcome === "failed" || outcome.status !== 200) {
      setFailed(true);
      return;
    }

    setGrades(outcome.body.grades);
  };

  // The fade-out has to finish before React unmounts the feedback, so clearing
  // is deferred to the end of the conceal animation.
  const onReset = () => setResetting(true);

  const onConcealed = () => {
    setResponses(EMPTY_RESPONSES);
    setGrades(null);
    setHints({});
    setHintsUsed({});
    setResetting(false);
    setFailed(false);
  };

  // A question, the last hint taken for it, and its grade are one object. Each
  // layer replaces what the one before it was showing, so the newest attachments
  // and the current hasHint always win.
  const questions: (Question | GradedQuestion)[] = QUESTIONS.map((question) => {
    const hint = hints[question.id];
    const grade = grades?.[question.id];
    const merged = isNil(hint) ? question : { ...question, ...hint };
    if (isNil(grade)) {
      return merged;
    }
    // A reveal without its own attachments leaves the hinted ones in place.
    return {
      ...merged,
      ...grade,
      attachments: grade.attachments ?? merged.attachments,
    };
  });

  const graded = !isNil(grades);
  const total = graded
    ? round(
        questions.reduce(
          (sum, question) =>
            isGraded(question)
              ? sum + pointsAfterHints(question, hintsUsed[question.id] ?? 0)
              : sum,
          0,
        ),
      )
    : 0;

  return (
    <main className="mx-auto flex w-full max-w-304 flex-col gap-8 p-8 font-sans">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-1">
          <div className="text-2xl font-semibold">Sample quiz</div>
          {graded && (
            <div
              className={cn(
                "text-xl font-semibold text-indigo-800",
                resetting ? CONCEAL_CLASS : REVEAL_CLASS,
              )}
              onAnimationEnd={resetting ? onConcealed : undefined}
            >
              Score: {total} / {TOTAL_POINTS}
            </div>
          )}
        </div>

        {failed && (
          <div className={cn("font-semibold text-red-700", REVEAL_CLASS)}>
            Error grading answers :(
          </div>
        )}
      </div>

      <form className="flex flex-col gap-8" onSubmit={onSubmit}>
        <ol className="grid grid-cols-[repeat(auto-fit,minmax(22rem,1fr))] gap-8">
          {questions.map((question, index) => (
            <QuestionRow key={question.id} number={index + 1}>
              <div>{question.label}</div>
              {question.attachments && (
                <Attachments attachments={question.attachments} />
              )}
              <Answer
                question={question}
                response={responses[question.id]}
                onChange={(response) => setResponse(question.id, response)}
              />
              {question.hintLabel && (
                <div className="text-muted-foreground">
                  hint: {question.hintLabel}
                </div>
              )}
              {question.hasHint && !graded && (
                <HintButton
                  question={question}
                  hintsUsed={hintsUsed[question.id] ?? 0}
                  pending={hintPending === question.id}
                  onAskForHint={() => onAskForHint(question.id)}
                />
              )}
              {isGraded(question) && (
                <Feedback
                  question={question}
                  hintsUsed={hintsUsed[question.id] ?? 0}
                  resetting={resetting}
                />
              )}
            </QuestionRow>
          ))}
        </ol>

        {graded ? (
          <Button
            key="reset"
            type="button"
            variant="outline"
            className="ml-8 self-start"
            onClick={onReset}
          >
            Reset
          </Button>
        ) : (
          <Button
            key="submit"
            type="submit"
            className="ml-8 self-start"
            disabled={pending}
          >
            {pending ? "Grading..." : "Submit"}
            {pending && <LoaderCircleIcon className="animate-spin" />}
          </Button>
        )}
      </form>
    </main>
  );
}
