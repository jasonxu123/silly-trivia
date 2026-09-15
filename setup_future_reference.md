# Setup — future reference

High-level steps used to get this project to its current state. Use `1.` for all Markdown steps and substeps.

1. Create a new GitHub repo (`jasonxu123/silly-trivia`), initialized with a README, a `.gitignore` (Node template), and an MIT LICENSE.
1. Clone it locally over SSH.
1. Install Node.js, then enable Yarn via Corepack (assuming a machine with no Node/npm yet; this machine uses `nvm`):
   1. Install `nvm`, then `nvm install 24 && nvm use 24` (or whatever current LTS is by then).
   1. `corepack enable` — required; Corepack is opt-in and does nothing until this runs, so plain `yarn` won't be a recognized command otherwise. (Bundled with Node up to v24; Node 25+ dropped it, so on newer Node run `npm install -g corepack` first.)
   1. No separate "install yarn 4.18.0" step needed — once inside the project folder, Corepack reads `packageManager` from `package.json` and `yarn --version` auto-fetches/reports whatever's pinned there.
1. Run `yarn create next-app` inside the cloned repo folder, accepting the prompt to continue in a non-empty directory (README/LICENSE/.gitignore already exist). This scaffolds essentially everything: `package.json`, `README.md`, `.gitignore`, `tsconfig.json`, `eslint.config.mjs`, Tailwind config, `node_modules`, and (this Next.js version) `AGENTS.md`/`CLAUDE.md`.
   1. `next dev` re-adds the `AGENTS.md`/`CLAUDE.md` "read the vendored docs before coding" block if it's ever removed — keep it.
1. A few hand-edits made after scaffolding:
   1. Pin `packageManager` in `package.json` to `yarn@4.18.0`, then run `yarn install`.
   1. Add `.yarnrc.yml` with `nodeLinker: node-modules` — Yarn Berry defaults to the PnP linker, which doesn't play well with Next.js tooling — then rerun `yarn install` to regenerate `yarn.lock` under node_modules.
   1. When ESLint 10 landed, `eslint-plugin-react`'s React-version auto-detection broke (calls a removed API). Fixed in `eslint.config.mjs` by hardcoding `settings.react.version` instead of relying on `"detect"`.
1. Make a new Vercel project and connect it to the GitHub repo:
   1. vercel.com → "Add New… → Project → Import Git Repository" → select the repo.
   1. Confirm Framework Preset auto-detects as Next.js and Root Directory is `.` (repo root, not a monorepo).
   1. Deploy once to confirm the pipeline; every push to `main` (and PR branches) auto-deploys from then on.
1. Add shared request/response types across routes with ts-rest + zod:
   1. Install `@ts-rest/core`, `@ts-rest/serverless`, and `zod` — but pin `zod` to v3 (`yarn add zod@3`), not v4: `@ts-rest/core`'s type inference reads zod's internal `ZodObject` generic shape, which changed in v4, so under v4 every route silently degrades to `any` instead of erroring loudly.
   1. App Router adapter: one catch-all route at `app/api/[...ts-rest]/route.ts`. Contract route paths are relative to that folder (e.g. `path: "/time"` for the URL `/api/time`), and `createNextHandler(...)` needs a `basePath: "/api"` option to strip that prefix before matching.
   1. `createNextHandler(...)` returns a single function, not one per HTTP method — assign it once and re-export it for every verb (`export { handler as GET, handler as POST, ... }`); destructuring `{ GET, POST } = createNextHandler(...)` silently makes every export `undefined`.
1. Add shadcn/ui: `yarn dlx shadcn@latest init -d -y`, then `yarn dlx shadcn@latest add input label radio-group checkbox` (init also writes `components/ui/button.tsx` and `lib/utils.ts`).
   1. Init rewrites `app/globals.css` wholesale — back up any custom `@keyframes` or `body` rules first and re-add them after. It also switches dark mode from `prefers-color-scheme` to a class-based `.dark`, so nothing goes dark until that class is set.
   1. Its "Updating fonts" step leaves `--font-sans: var(--font-sans)` in `@theme inline`, a circular reference that resolves to nothing and drops all text to the browser's default serif. Point it at the real font variable (e.g. `var(--font-geist-sans)`).
   1. This version generates Base UI (`@base-ui/react`) components, not Radix — props are `onValueChange`/`onCheckedChange`, not Radix's. `cn` comes from a standalone `cn` package, and `shadcn` itself becomes a runtime dependency because `globals.css` does `@import "shadcn/tailwind.css"`.
   1. Edits to files under `components/ui/` are overwritten by re-running `shadcn add` for that component.
1. Add Gemini for LLM-backed grading:
   1. Create an API key at aistudio.google.com/apikey; put it in `.env` (gitignored) as `GEMINI_API_KEY`.
   1. Add the same `GEMINI_API_KEY` under the Vercel project's Settings → Environment Variables — `.env` is gitignored, so deploys have no key otherwise.
   1. `yarn add @google/genai`.
   1. For output whose shape must be guaranteed, use function calling: `client.interactions.create({ model, input, tools: [fn] })`, then read `interaction.steps` for entries with `type: "function_call"` and take `step.arguments`. The older `models.generateContent` + `responseSchema`/`responseMimeType` route is deprecated in favor of `response_format`.
   1. A function call constrains the shape only, never the values — validate the returned numbers and keep a deterministic fallback grader for anything missing or out of range.
1. Host quiz media (images, audio) in a Vercel Blob store instead of the repo or Google Drive:
   1. Vercel dashboard → Storage → Create Database → Blob, then connect it to the project.
   1. Upload each file with public access; Vercel appends a random suffix, so the returned URL is unguessable.
   1. Copy those URLs into the code — public-but-unguessable is what keeps unrevealed hint media unreachable, so hint URLs must live server-side only and never ship in the client bundle.
   1. Google Drive share links don't work for this: `/file/d/<id>/view` serves a viewer page, and the `uc?export=download` form sends `Content-Disposition: attachment`, so media elements download the file instead of playing it.
