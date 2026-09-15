<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Agent instruction files

`AGENTS.md` and `CLAUDE.md` must have identical content. Any edit to one is made to the other in the same change.

## Text elements

Use `<div>` for blocks of text. No `<p>` or `<h1>`–`<h6>` — size, weight, and spacing all come from Tailwind classes, so the tag carries no formatting worth keeping.

`<span>` stays available for inline runs inside a line of text (a bolded word, a colored number) — a `<div>` would break the line. Don't reach for it as a block wrapper; that's a `<div>`.

Elements picked for behavior rather than text stay as they are: `<label>`, `<button>`, `<input>`, `<form>`, and list structure.

## Package manager

This project uses Yarn (see `packageManager` in `package.json`). Use Yarn for every package operation unless it is genuinely impossible:

- `yarn add` / `yarn remove`, never `npm install`.
- `yarn dlx <cli>` to run a one-off CLI, never `npx`.
- `yarn <script>` to run package scripts.

## Setup future reference doc

`setup_future_reference.md` (repo root) tracks the high-level steps used to get this project to its current state, for redoing the setup 2+ years from now. It is NOT a full commit log — only infra/tooling/account setup steps (new repo, hosting, package manager, framework scaffolding), not routine code/content changes.

Format: every item is a `1.` — top-level steps flat, sub-steps indented under them (Markdown auto-numbers both regardless of source order). This lets steps be reordered or inserted later without renumbering by hand. Each item is one short, imperative, just-enough-to-redo-it sentence — no rationale, no fluff.

Whenever the user asks to "update future setup doc with ..." (or close variants), edit `setup_future_reference.md`:

- Insert the new step in its correct chronological position (don't just append at the end) using `1.`/`a.` markers per the format above.
- Match the existing terseness — trim the user's wording down to the essential step if needed.
- Don't add explanatory commentary in the doc itself.
