# Notebook workspace upgrade

Visual target: the combined design approved in this task, `exec-4cebc452-08d0-43d7-865c-643fb01404b5.png`.

## Acceptance plan

- [x] Unified sidebar and responsive three-column workspace; existing navigation and editing preserved.
- [x] ID-based internal links, backlink context, preview, renamed/deleted target behavior.
- [x] Quick opening, full-text snippets/highlights and basic tag/path filters.
- [x] Persistent tabs, reading positions and optional reference split.
- [x] Paper/experiment/concept/project templates and note properties round-trip through publishing.
- [x] Local snapshots, reversible restore, portable backup, Markdown plus attachment export.
- [x] Daily notes, local graph and user-confirmed AI relationship suggestions.
- [x] Model/publishing regression tests, browser interaction checks, responsive and visual QA.

No deployment is included. Existing cloud authentication is retained. AI uses the configured cloud service and published content; local drafts are not silently sent to a model.

Baseline on 2026-09-18: 11 existing test files fail before edits, largely source-string/layout assertions. Detailed results are in `.notebook-cache/upgrade/baseline.json`. Compare failures after work, and keep behavioral coverage for changed contracts.

Implementation and acceptance completed locally on 2026-09-18. See `design-qa.md` for evidence and remaining baseline failures. AI relationship suggestions require publishing the updated Worker together with the frontend; no production deployment or live model call was made during acceptance.
