# Trivia Website — Engineering Solutions (V0)

Constraints that drive every decision here: **zero cost**, **a few dozen concurrent users at most**, **real-time team collaboration**, **no user accounts**, and **a single creator who edits data directly** (spreadsheets/files, no admin UI). At this scale, nearly every serious platform's free tier is more than enough — the real differentiator is which one gives you real-time sync and presence with the least code.

---

## Recommended stack (summary)

| Layer | Recommendation | Why |
|---|---|---|
| Frontend | Next.js + React + TypeScript + Tailwind CSS | Matches team experience; API routes double as the serverless layer for grading and admin actions |
| Hosting | Vercel Hobby tier (free) | Native Next.js hosting, free SSL, instant GitHub deploys; non-commercial use only, which this qualifies as |
| Data + realtime | Supabase (free tier) or Firebase Firestore (free tier) | Database, live subscriptions, and presence in one service; no server to run |
| Exam authoring | Google Sheets → export CSV/JSON → upload/import script | Creator edits a spreadsheet; a small script parses it into the DB |
| LLM grading | Google Gemini API free tier (or Groq free tier); Claude Haiku via a paid Console account if "no cost" is soft | Gemini/Groq are the only genuinely free options; Haiku costs pennies per event but requires separate API billing (not included in Claude Pro) |
| Attachments | Any free public host (Google Drive public links, GitHub, Imgur, Supabase Storage) | Requirements only need public URLs |
| Creator "UI" | Supabase Studio / Firebase Console + a secret admin token in the app | Dashboards double as the admin data viewer for free |

---

## Frontend

**Next.js + React + TypeScript + Tailwind CSS**, deployed on Vercel's free Hobby tier. The app doesn't need server-side rendering (all exam pages are client-rendered against live data), but Next.js earns its place anyway:

- **API routes replace a separate serverless setup.** Grading (which must run server-side to keep the LLM API key secret), admin-secret verification, and the exam import endpoint all live as Next.js API routes in the same repo and deployment.
- Session identity: generate a user ID on first visit, store in `localStorage`. Returning users are recognized automatically — satisfies "no login, persistent identity per browser."
- Random display names: a small word-list generator (adjective + animal, Jackbox-style).
- Routing: `/exam/[examId]`, `/join/[teamCode]`, `/admin`.
- Tailwind for all styling — no design system needed at this scale.

(A plain React + Vite SPA would also work — Vite is just a build tool / dev server, the modern Create React App replacement — but it would push grading into a separate serverless function elsewhere. Next.js keeps everything in one deployment.)

**Hosting:** Vercel Hobby tier is the natural home for Next.js. Note it's licensed for non-commercial use only, which a private trivia site satisfies. Cloudflare Pages and Netlify also run Next.js free if Vercel is ever a problem.

---

## Data + Realtime (the key decision)

The live-collaboration requirement (teammates see each other's answers, hint reveals, and positions in real time) is the hardest part. Three realistic approaches:

### Option A — Supabase (recommended)
Free tier includes a Postgres database, **Realtime** (live change subscriptions on tables, plus Presence and Broadcast channels), storage, and an auto-generated REST API.

- Answers/hints: write question attempts to Postgres; teammates subscribe to changes on their team's attempt rows. Last-write-wins per question field is an acceptable conflict strategy at this scale (a team rarely edits the same text box simultaneously; if they do, per-question "soft locks" via Presence can be added later).
- Presence ("who is on question 4"): Supabase Realtime Presence channels, one channel per team attempt.
- Creator visibility: Supabase Studio dashboard *is* the admin view — browse tables, edit points manually, flip `published` flags. Zero admin UI to build.
- Free tier caveat: projects pause after ~1 week of inactivity and must be manually unpaused. Fine for periodic trivia nights.

### Option B — Firebase (Firestore)
Firestore's free tier gives live document listeners out of the box, which maps naturally to "everyone on a team listens to the team's attempt document." Slightly less pleasant for the creator (Firestore console is clunkier than a SQL dashboard, and relational queries like "all attempts with users and grades" are more awkward). Choose this if you already know Firebase.

### Option C — Google Sheets as the database
Appealing because the creator lives in spreadsheets anyway, but **not recommended as the runtime store**: no push updates (clients must poll), tight API rate quotas that a real-time app would hit quickly, and painful concurrent-write handling. The right role for Sheets is **authoring only**: creator writes exams in a Sheet, exports CSV (or the import script reads the Sheet API once), and the data lands in Supabase/Firestore. Attempt/grade data can optionally be *exported back* to a Sheet for the creator to browse, but the live system shouldn't depend on it.

### Option D — Your own server (Python/Node + WebSockets)
A small FastAPI or Node server with WebSockets and SQLite would work technically, but free always-on hosting is the problem: Render/Fly free tiers sleep or have been cut back, and a sleeping server breaks "user comes back a month later." Only choose this if you want the learning experience; otherwise the BaaS options remove the whole category of problems.

---

## Exam authoring pipeline

1. Creator defines questions in a Google Sheet (or local CSV): one row per question, with columns for text, type, choices, hints, points rules, explanation, attachments.
2. A small import script (Node or Python, run locally) parses the sheet/CSV, validates it, and upserts rows into the database. Question IDs in the sheet make the "republish preserves unchanged questions" behavior possible: on republish, diff question IDs/content and invalidate only changed ones.
3. Publish/unpublish and start time are just columns on the exam row — flip them in the dashboard, or via a tiny admin page gated by a secret key. Clients subscribed to the exam row react immediately (mid-attempt users get interrupted when `published` flips to false; waiting users unlock when `start_time` passes).

Complex points definitions (the OR/AND rules, per-hint deductions) fit best as a JSON column per question rather than trying to encode them in spreadsheet cells — the sheet can hold a JSON string in one cell, or simple cases use shorthand columns the import script expands.

---

## Grading

Hybrid rules + LLM, run when an attempt is submitted:

1. **Rules first**: exact match, normalized match (case/whitespace/accents), choice correctness, numeric ranges. Cheap, deterministic, covers most questions.
2. **LLM for the fuzzy cases**: send the question, the points definition, and the submitted answer; ask for a JSON verdict `{points, reasoning}`. The reasoning doubles as the explanation shown to players (or the creator's authored explanation is shown instead).
3. Creator can override any `points_awarded` directly in the dashboard.

**Where the grading code runs:** a Next.js API route (a Vercel serverless function under the hood, free tier) triggered on submission. Never call the LLM from the browser — that would expose the API key.

**LLM options** (the one place "zero cost" is tight):
- **Google Gemini API** — genuinely free tier with rate limits far above what a few dozen users grading a quiz would need. The default choice for strict zero cost.
- **Groq** — free tier serving open models (Llama), very fast, fine for grading judgments.
- **Claude Haiku** — the cheapest Anthropic model, more than capable of the grading task. Important caveat: **a Claude Pro subscription does not include API access or an API key**; the API is billed separately through a Claude Console account (console.anthropic.com) on pay-as-you-go credits. If a few dollars of credits is acceptable, a trivia night's grading (a few hundred short calls) costs pennies. Only worth it if "no cost" is soft.

Grading a whole team's exam is a handful of LLM calls at submit time — well within any free tier.

---

## Attachments

Requirements only demand public URLs, so no infrastructure is needed: host images/audio/video on Google Drive (public share links), Supabase Storage (1 GB free), or GitHub. For progressive audio hints ("each hint reveals more of the song"), pre-cut the clips into separate files (10s, 30s, full) and attach each URL to its hint — far simpler than dynamic audio trimming.

---

## Creator auth

One admin, no auth system: a long random secret stored as an environment variable. The admin page (if any) requires it as a query param or entered once and kept in localStorage; serverless functions check it before allowing publish/grade-override actions. Most creator work happens directly in the Supabase/Firebase dashboard, which has its own login.

---

## What V0 deliberately punts on

- Operational-transform / CRDT-style merging: last-write-wins per question is fine for teams of 2–6.
- Link permanence beyond ~a month (free-tier project pausing makes this natural).
- Multiple admins, leaderboards across teams, team size limits.
- Scalability of any kind — every choice above tops out comfortably above "a few dozen users."

## Suggested build order

1. Next.js + Tailwind app on Vercel + localStorage identity + random names.
2. Supabase schema (users, teams, exams, questions, attempts) + team join codes.
3. Exam rendering from DB + answer writes + realtime subscription for teammates.
4. Presence (who's on which question) + hint reveal sync.
5. Submit thresholds, timer with auto-submit, cancel/retry logic.
6. Sheet/CSV import script + publish/unpublish/start-time controls.
7. Grading function (rules, then LLM) + results view.
