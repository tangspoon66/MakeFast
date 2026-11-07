# MakeFast AI Review Guide

## Snapshot provenance
This is a sanitized single-commit export of the local MakeFast checkout at f158e3a, prepared for external AI review. It deliberately excludes local Git history, credentials, runtime databases, learner records, logs, dependencies, build outputs and historical screenshots. The original checkout and history were not changed. Some historical documentation may still reference omitted screenshots or earlier designs. Design documents are context, not proof that a feature is implemented.

## Structure
- `frontend/`: React/TypeScript learner experience, course articles, creative workbench, Agent UI and administrator pages.
- `backend/`: Python API, authentication, course/Agent services, persistence and tests.
- `_bmad-new/`: product brief, PRD, UX, architecture, API/data contracts and planning/acceptance documents. Several documents are historical drafts; reconcile them with executable code.
- `scripts/`: local startup and checks.
- `frontend/public/`: hardware and course media, mascot assets and third-party media notices.

## Local setup
Consult README.md, backend documentation and `scripts/dev.sh` for required runtimes and dependencies. Install frontend and backend dependencies before starting:

```sh
bash scripts/dev.sh
```

Use `backend/.env.example` as the configuration template; supply credentials locally and never commit them. Generate administrator credentials using the documented seed script; no local administrator account/database is included. Live model calls can incur charges and are not required for an initial review.

## Review priorities
1. Agent observation → evidence-based diagnosis → minimal hint/action → verification: distinguish implemented behavior from product aspirations; check false stall detection and anchors for code lines/blocks/buttons.
2. Assess learning by specific knowledge/skills and observable independence. Audit assumptions based on answer speed, small quizzes or age; age should affect language rather than imply ability.
3. Course-scoped and free-creation assistance, prompt injection, unsupported claims, privacy and safe hardware guidance.
4. Authentication, authorization, admin uploads/publishing, resource access, confirmation/undo, and server-side validation of client-supplied state.
5. Course article → guided workbench versus free creation; coherent progress, age-specific wording and resource handling.
6. API contracts, persistence, error handling, accessibility, mobile/viewport behavior and test coverage.

## Evidence limitations
Test counts/results in historical delivery documents describe earlier local runs, not a fresh verification of this export. No full fresh suite, live paid API evaluation or physical-board verification is implied by publication. Simulator compilation/flashing/serial output do not establish real hardware correctness. USB permissions, browser support, physical wiring, power and actual flashing need separate validation.

## Privacy and assets
Test email addresses use example domains where adapted. Phone-like strings in safety tests are synthetic fixtures, not learner contact records. Password literals inside isolated tests are synthetic test inputs, not a provisioned production account. Do not deploy test credentials.

Review `frontend/public/THIRD_PARTY_MEDIA.md`, bundled dependency licenses and hardware/media provenance before redistribution. Publication for review does not assert ownership or unrestricted rights to every bundled mascot, photograph or third-party reference asset. No blanket new project license is granted by this guide.

## Checks performed for this export
All 103 exported Python files passed AST syntax parsing; 22 JSON files parsed as strict JSON. The two TypeScript configuration files use JSON-with-comments and were not treated as strict JSON. No full build/test suite was rerun. Baseline whitespace warnings were observed and left unchanged. Secret-pattern scanning was performed but is not a guarantee that all possible sensitive information has been detected. Environment template secret fields are blank and must be configured locally.
