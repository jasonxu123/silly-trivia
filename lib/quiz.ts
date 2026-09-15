// Question data shared by the page and the grading endpoint. No answers here —
// those live in lib/grading.ts so they never reach the client bundle.

export type Choice = { value: string; label: string };

export const RADIO_CHOICES: Choice[] = [
  { value: "heart", label: "❤️" },
  { value: "cry", label: "😢" },
  { value: "eyes", label: "👀" },
  { value: "thumbs-up", label: "👍" },
  { value: "wow", label: "😮" },
];

export const CHECKBOX_CHOICES: Choice[] = [
  { value: "jaguar", label: "Jaguar" },
  { value: "lion", label: "Lion" },
  { value: "tiger", label: "Tiger" },
  { value: "cougar", label: "Cougar" },
  { value: "cheetah", label: "Cheetah" },
  { value: "leopard", label: "Leopard" },
];

export const PROMPTS = {
  q1: "What emoji do I use the most?",
  q2: "What is my favorite city?",
  q3: "Which of these are officially big cats?",
  q4: "What's in this picture?",
  q5: "Who is speaking?",
};

export const AUDIO_URL =
  "https://tile.loc.gov/storage-services/public/navcc/trrs-1146/trrs-1146.mp3";

export const QUESTION_KEYS = ["q1", "q2", "q3", "q4", "q5"] as const;

export type QuestionKey = (typeof QUESTION_KEYS)[number];
export type TextQuestion = "q1" | "q2" | "q4" | "q5";

export const EMPTY_RESPONSES = {
  q1: "",
  q2: "",
  q3: [] as string[],
  q4: "",
  q5: "",
};

export type Responses = typeof EMPTY_RESPONSES;

export function labelFor(choices: Choice[], value: string) {
  return choices.find((choice) => choice.value === value)?.label ?? value;
}
