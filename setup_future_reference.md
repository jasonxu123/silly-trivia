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
