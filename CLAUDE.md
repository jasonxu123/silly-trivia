@AGENTS.md

## Setup future reference doc

`setup_future_reference.md` (repo root) tracks the high-level steps used to get this project to its current state, for redoing the setup 2+ years from now. It is NOT a full commit log — only infra/tooling/account setup steps (new repo, hosting, package manager, framework scaffolding), not routine code/content changes.

Format: top-level steps are flat `1.` items (Markdown auto-numbers these regardless of source order); sub-steps are `a.` items indented under them. This lets steps be reordered or inserted later without renumbering by hand. Each item is one short, imperative, just-enough-to-redo-it sentence — no rationale, no fluff.

Whenever the user asks to "update future setup doc with ..." (or close variants), edit `setup_future_reference.md`:
- Insert the new step in its correct chronological position (don't just append at the end) using `1.`/`a.` markers per the format above.
- Match the existing terseness — trim the user's wording down to the essential step if needed.
- Don't add explanatory commentary in the doc itself.
