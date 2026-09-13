# Setup — future reference

High-level steps used to get this project to its current state, for redoing this 2+ years from now. All top-level steps use `1.` and sub-steps use `a.` on purpose — Markdown auto-numbers `1.` items regardless of source order, so lines can be reordered/inserted without renumbering everything by hand.

1. Create a new GitHub repo (`jasonxu123/silly-trivia`), initialized with a README, a `.gitignore` (Node template), and an MIT LICENSE.
1. Clone it locally over SSH.
1. Install Node.js, then enable Yarn via Corepack (assuming a machine with no Node/npm yet; this machine uses `nvm`):
   a. Install `nvm`, then `nvm install 24 && nvm use 24` (or whatever current LTS is by then).
   a. `corepack enable` — required; Corepack is opt-in and does nothing until this runs, so plain `yarn` won't be a recognized command otherwise. (Bundled with Node up to v24; Node 25+ dropped it, so on newer Node run `npm install -g corepack` first.)
   a. No separate "install yarn 4.18.0" step needed — once inside the project folder, Corepack reads `packageManager` from `package.json` and `yarn --version` auto-fetches/reports whatever's pinned there.
1. Run `yarn create next-app` inside the cloned repo folder, accepting the prompt to continue in a non-empty directory (README/LICENSE/.gitignore already exist). This scaffolds essentially everything: `package.json`, `README.md`, `.gitignore`, `tsconfig.json`, `eslint.config.mjs`, Tailwind config, `node_modules`, and (this Next.js version) `AGENTS.md`/`CLAUDE.md`.
   a. `next dev` re-adds the `AGENTS.md`/`CLAUDE.md` "read the vendored docs before coding" block if it's ever removed — keep it.
1. A few hand-edits made after scaffolding:
   a. Pin `packageManager` in `package.json` to `yarn@4.18.0`, then run `yarn install`.
   a. Add `.yarnrc.yml` with `nodeLinker: node-modules` — Yarn Berry defaults to the PnP linker, which doesn't play well with Next.js tooling — then rerun `yarn install` to regenerate `yarn.lock` under node_modules.
   a. When ESLint 10 landed, `eslint-plugin-react`'s React-version auto-detection broke (calls a removed API). Fixed in `eslint.config.mjs` by hardcoding `settings.react.version` instead of relying on `"detect"`.
1. Make a new Vercel project and connect it to the GitHub repo:
   a. vercel.com → "Add New… → Project → Import Git Repository" → select the repo.
   a. Confirm Framework Preset auto-detects as Next.js and Root Directory is `.` (repo root, not a monorepo).
   a. Deploy once to confirm the pipeline; every push to `main` (and PR branches) auto-deploys from then on.
