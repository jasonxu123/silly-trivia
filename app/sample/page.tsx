"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

const CHOICES = ["A", "B", "C", "D", "E"];

const CHECKBOX_CHOICES = [
  { value: "alpha", label: "α" },
  { value: "beta", label: "β" },
  { value: "gamma", label: "γ" },
  { value: "delta", label: "δ" },
  { value: "epsilon", label: "ε" },
  { value: "zeta", label: "ζ" },
];

function greekLabel(value: string) {
  return CHECKBOX_CHOICES.find((choice) => choice.value === value)?.label ?? value;
}

const AUDIO_URL =
  "https://tile.loc.gov/storage-services/public/navcc/trrs-1146/trrs-1146.mp3";

const ANSWERS = {
  q1: "E",
  q2: "hello world!",
  q3: ["alpha", "gamma", "delta", "epsilon"],
  q4: "blue rectangle",
  q5: "theodore roosevelt",
};

const EMPTY_RESPONSES = {
  q1: "",
  q2: "",
  q3: [] as string[],
  q4: "",
  q5: "",
};

type Responses = typeof EMPTY_RESPONSES;
type TextQuestion = "q1" | "q2" | "q4" | "q5";
type Results = Record<keyof Responses, number>;

const QUESTION_KEYS = ["q1", "q2", "q3", "q4", "q5"] as const;

const REVEAL_CLASS = "animate-[reveal_250ms_ease-out]";
const CONCEAL_CLASS = "animate-[conceal_60ms_ease-in_forwards]";

const LIST_FORMAT = new Intl.ListFormat("en", {
  style: "long",
  type: "conjunction",
});

function unansweredQuestions(responses: Responses) {
  return QUESTION_KEYS.flatMap((key, index) => {
    const response = responses[key];
    const empty = Array.isArray(response)
      ? response.length === 0
      : response.trim() === "";
    return empty ? index + 1 : [];
  });
}

function normalize(text: string) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

const PARTIAL_LENGTH_RATIO = 0.4;

function gradeText(response: string, answer: string) {
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

function grade(responses: Responses): Results {
  return {
    q1: gradeText(responses.q1, ANSWERS.q1),
    q2: gradeText(responses.q2, ANSWERS.q2),
    q3: gradeChoices(responses.q3, ANSWERS.q3),
    q4: gradeText(responses.q4, ANSWERS.q4),
    q5: gradeText(responses.q5, ANSWERS.q5),
  };
}

function Question({
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

function TextAnswer({
  id,
  label,
  value,
  disabled,
  onChange,
}: {
  id: TextQuestion;
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <>
      <div>{label}</div>
      <Input
        id={id}
        name={id}
        type="text"
        aria-label={label}
        maxLength={100}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </>
  );
}

function Reveal({
  resetting,
  children,
}: {
  resetting: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid grid-rows-[1fr]",
        resetting ? CONCEAL_CLASS : REVEAL_CLASS,
      )}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

function Feedback({ points, answer }: { points: number; answer: string }) {
  const rounded = Math.round(points * 100) / 100;
  if (points === 1) {
    return <div className="font-semibold text-green-700">✓ Correct! 1 / 1</div>;
  }
  const partial = points > 0;
  return (
    <div
      className={cn(
        "font-semibold",
        partial ? "text-amber-600" : "text-red-700",
      )}
    >
      {partial
        ? `◐ Partial points ${rounded} / 1`
        : `✗ Incorrect 😭 ${rounded} / 1`}
      <div>answer: {answer}</div>
    </div>
  );
}

export default function Sample() {
  const [responses, setResponses] = useState<Responses>(EMPTY_RESPONSES);
  const [results, setResults] = useState<Results | null>(null);
  const [resetting, setResetting] = useState(false);

  const setText = (question: TextQuestion, value: string) => {
    setResponses((current) => ({ ...current, [question]: value }));
  };

  const toggleChoice = (choice: string) => {
    setResponses((current) => ({
      ...current,
      q3: current.q3.includes(choice)
        ? current.q3.filter((other) => other !== choice)
        : [...current.q3, choice],
    }));
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const unanswered = unansweredQuestions(responses);
    if (unanswered.length > 0) {
      const noun = unanswered.length > 1 ? "questions" : "question";
      const list = LIST_FORMAT.format(unanswered.map(String));
      if (
        !window.confirm(
          `Are you sure you want to submit empty answers for ${noun} ${list}?`,
        )
      ) {
        return;
      }
    }

    setResults(grade(responses));
  };

  // The fade-out has to finish before React unmounts the feedback, so clearing
  // is deferred to the end of the conceal animation.
  const onReset = () => setResetting(true);

  const onConcealed = () => {
    setResponses(EMPTY_RESPONSES);
    setResults(null);
    setResetting(false);
  };

  const graded = results !== null;
  const total = results
    ? Math.round(Object.values(results).reduce((sum, n) => sum + n, 0) * 100) /
      100
    : 0;

  return (
    <main className="mx-auto flex w-full max-w-304 flex-col gap-8 p-8 font-sans">
      <div className="flex flex-wrap items-baseline gap-x-8 gap-y-1">
        <div className="text-2xl font-semibold">Sample quiz</div>
        {results && (
          <div
            className={cn(
              "text-xl font-semibold text-indigo-800",
              resetting ? CONCEAL_CLASS : REVEAL_CLASS,
            )}
            onAnimationEnd={resetting ? onConcealed : undefined}
          >
            Score: {total} / 5
          </div>
        )}
      </div>

      <form className="flex flex-col gap-8" onSubmit={onSubmit}>
        <ol className="grid grid-cols-[repeat(auto-fit,minmax(22rem,1fr))] gap-8">
          <Question number={1}>
            <div>Here is the first question.</div>
            <RadioGroup
              name="q1"
              value={responses.q1}
              disabled={graded}
              onValueChange={(value) => setText("q1", String(value))}
            >
              {CHOICES.map((choice) => (
                <Label key={choice} className="cursor-pointer">
                  <RadioGroupItem value={choice} />
                  {choice}
                </Label>
              ))}
            </RadioGroup>
            {results && (
              <Reveal resetting={resetting}>
                <Feedback points={results.q1} answer={ANSWERS.q1} />
              </Reveal>
            )}
          </Question>

          <Question number={2}>
            <TextAnswer
              id="q2"
              label="Put in a short answer here."
              value={responses.q2}
              disabled={graded}
              onChange={(value) => setText("q2", value)}
            />
            {results && (
              <Reveal resetting={resetting}>
                <Feedback points={results.q2} answer={ANSWERS.q2} />
              </Reveal>
            )}
          </Question>

          <Question number={3}>
            <div>Choose as many as you want.</div>
            <div className="grid grid-flow-col grid-cols-2 grid-rows-3 gap-x-8 gap-y-2">
              {CHECKBOX_CHOICES.map(({ value, label }) => (
                <Label key={value} className="cursor-pointer">
                  <Checkbox
                    name="q3"
                    value={value}
                    checked={responses.q3.includes(value)}
                    disabled={graded}
                    onCheckedChange={() => toggleChoice(value)}
                  />
                  {label}
                </Label>
              ))}
            </div>
            {results && (
              <Reveal resetting={resetting}>
                <Feedback
                  points={results.q3}
                  answer={ANSWERS.q3.map(greekLabel).join(", ")}
                />
              </Reveal>
            )}
          </Question>

          <Question number={4}>
            <div className="h-48 w-full max-w-80 bg-cyan-400" />
            <TextAnswer
              id="q4"
              label="What's in this picture?"
              value={responses.q4}
              disabled={graded}
              onChange={(value) => setText("q4", value)}
            />
            {results && (
              <Reveal resetting={resetting}>
                <Feedback points={results.q4} answer={ANSWERS.q4} />
              </Reveal>
            )}
          </Question>

          <Question number={5}>
            <audio
              controls
              controlsList="nodownload"
              src={AUDIO_URL}
              className="w-full max-w-80"
            />
            <TextAnswer
              id="q5"
              label="Who is speaking?"
              value={responses.q5}
              disabled={graded}
              onChange={(value) => setText("q5", value)}
            />
            {results && (
              <Reveal resetting={resetting}>
                <Feedback points={results.q5} answer={ANSWERS.q5} />
              </Reveal>
            )}
          </Question>
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
          <Button key="submit" type="submit" className="ml-8 self-start">
            Submit
          </Button>
        )}
      </form>
    </main>
  );
}
