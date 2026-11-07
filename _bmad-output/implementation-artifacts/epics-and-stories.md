# Epics & Stories — MakeFast MVP

Stories are ordered by dependency and written so each can be implemented and accepted independently. Story IDs are stable references for sprint status and tests.

## Epic E0 — BMAD foundation and safe spike handling

### ST-000 Document and baseline the product

**Status:** done (documentation baseline)  
**Covers:** project context, brief, PRD, UX, architecture, data/API contracts, readiness.

**Acceptance:** all planning links resolve; unresolved product/hardware decisions are explicitly marked; existing capabilities and non-goals are recorded; readiness identifies gates before feature implementation.

### ST-001 Reconcile exploratory workbench spike

**Status:** done (targeted prototype reconciliation)  
**Covers:** NFR-PERF, NFR-A11Y, FR-WB.

Inspect the unverified changes in `frontend/src/pages/HomePage.tsx` and `frontend/src/components/AgentWidget.tsx`; either adapt them to the approved UX contracts or revert/rewrite them before the first production workbench story. Do not add styling on top of code that has not passed build/tests.

**Acceptance:** targeted frontend build passes; no unreferenced imports/types; workbench spike is explicitly either integrated behind tested components or removed; unrelated parent-workspace changes remain untouched.

## Epic E1 — Learner identity, school tenancy and personal space

### ST-101 Implement learner registration and session

**Covers:** FR-AUTH-01..04, FR-AUTH-07..08, NFR-SEC-01/02.

Create dedicated learning DB migrations, user table, password hashing, opaque cookie sessions, CSRF token and rate limits. Keep admin auth isolated. Frontend account forms and guest/editor access transition are ST-102, so this story must not lock existing editor routes before those entry points are ready.

**Acceptance:** register/login/logout/me paths work; optional experience markers set only an initial ability estimate; fixed child expression does not require exact age; password/session secrets are not logged or returned; learner cookies are HttpOnly/SameSite and Secure in production; unsafe learner requests require CSRF; rate limits apply to registration/login; admin auth is unchanged. ST-102 adds the account UI and enforces guest/editor/download/Agent access boundaries.

### ST-102 Add account/profile UI

**Covers:** FR-AUTH-04, FR-HOME-04.

Add login/register/logout UI with parent-assistance copy and clear MVP limitation that phone/email recovery is not yet active; replace public tool access with an allowlisted read-only course preview. Profile rewards and learning data surfaces are delivered by ST-202.

**Acceptance:** keyboard-usable forms, generic credential errors, parent-assistance copy without guardian-account fields, optional/skippable experience question, fixed child-friendly copy, session restore, no misleading recovery claim; guest preview contains no source/workspace/firmware/private attachment URLs and has no Agent; editor, compile, AI generation and all source/firmware downloads require a learner session; frontend/backend tests.

### ST-103 Add school tenancy and student credential authentication (post-MVP backlog)

**Status:** deferred; not scheduled in MVP sprints  
**Covers:** future FR-EDU.

Add organization/class/membership/credential migrations and services; platform admin provisions a school/first teacher; authorized teachers create pseudonymous student accounts and one-time/rotatable credentials; students receive ordinary learner sessions after education login.

**Acceptance:** every student has an individual credential; raw secret is shown once and only hash is stored; reset revokes old secret without deleting progress; cross-school/class access is denied; suspended accounts/organizations cannot log in; student phone/email/birth date/legal name are not required; audit events exist for provisioning/reset/suspension.

## Epic E2 — Home, projects and progress

### ST-201 Create owned project and dashboard APIs

**Covers:** FR-HOME-01..03, FR-PROJ-01..06, data model.

Implement projects, dashboard continuation, local-to-account import and revision-safe saves.

**Implementation status (2026-09-27):** done. Project create/list/read/save/archive and dashboard APIs are implemented in `backend/app/learning_project_routes.py`; the workbench loads an owned project by URL ID and autosaves code, files, board, Blockly XML and current step with revision checks. The dashboard opens recent projects and explicitly imports a browser legacy draft only after confirmation. Conflict preserves local edits and offers a separate copy. Full course progress evidence and safe code/blocks round-trip remain ST-203/ST-501.

**Acceptance:** user sees only own projects; create/rename/archive/list/read/save with revision conflict; dashboard returns continuation and rewards summary; pre-MVP anonymous local drafts can be explicitly imported after login, while new guest editing/compile is unavailable.

### ST-202 Build learning overview and profile rewards surfaces

**Covers:** FR-HOME-01..05, FR-REWARD-06.

Replace post-login editor-first navigation with overview: continue, starter course, recent projects, progress, points, badges and personal project list.

**Acceptance:** authenticated landing is overview; empty state offers starter/autonomous paths; refresh/logout/login restores server data; inaccessible data is not rendered.

### ST-203 Add progress event projection

**Covers:** FR-PROJ-04/05, FR-REWARD-01/02.

Record typed idempotent project events and compute current/completed steps from course rules and evidence.

**Acceptance:** navigation alone cannot complete protected steps; replay is safe; system facts and user confirmations are separately shown; prerequisite errors are stable.

### ST-204 Build teacher class, assignment and progress console (post-MVP backlog)

**Status:** deferred; not scheduled in MVP sprints  
**Covers:** future FR-EDU.

Create the teacher education dashboard for classes, student account/credential lifecycle, published-course assignment and minimal per-student/aggregate progress. Route student sessions to assigned learning overview and teachers to the console.

**Acceptance:** teacher can create/archive class, provision/reset/disable students, assign a published course and see current/basic/deep completion; teacher cannot access another organization/class or view raw serial/private Agent dialog/full code by default; no public ranking; student work survives credential reset.

## Epic E3 — Structured courses and admin authoring

### ST-301 Define and validate course step schema

**Covers:** FR-COURSE-01/03/04/05, FR-ADMIN-02/03.

Add schema validator and version representation for intro/materials/wiring/blocks/code/compile/flash/verify/challenge/quiz/completion steps, prerequisites, anchors, completion and reward rules.

**Acceptance:** valid draft round-trips through API; invalid board/component/anchor/rule is rejected with actionable field errors; publish freezes immutable version; course IDs remain stable. Finished-work and per-material media records include source/license, exact kit or part variant, alt text and verification status. Accurate technical renders may replace photos when their variant and physical-pin match is documented; missing images stay visibly incomplete, never replaced with generated lookalikes.

### ST-302 Build admin course step editor and publish flow

**Covers:** FR-COURSE-02/06, FR-ADMIN-02/03.

Extend existing admin content tools to author structured steps, preview desktop workbench, validate and publish.

**Acceptance:** draft/unpublished isolation, ordered steps, preview, validation, publish version; existing template/resource functionality remains compatible.

### ST-303 Author and hardware-verify the first ESP32 course

**Covers:** FR-COURSE-05, FR-HW-03/04.

Confirm actual board variant, sensor/indicator BOM, libraries, pinmaps, wiring graph and success observations; create course version and hardware test checklist.

**Acceptance:** a human can follow the course with the specified kit; compile/flash/serial output and challenge are verified; no unverified pin claim is shown; content records exact assumptions. The finished-work and each material image show the actual selected kit/variant, or an explicitly labeled technical render matched to it, with usage rights recorded; the board, DHT11 and buzzer pin positions in the wiring view match the physical parts and a tested assembly.

## Epic E4 — Workbench shell and device debug

### ST-401 Implement data-driven three-zone workbench shell

**Covers:** FR-WB-01..08, UX sections 2–5.

Create `WorkbenchShell`, course navigation, step renderer placeholder, semantic anchor registry, responsive desktop layout and persisted UI collapse state.

**Acceptance:** each step renders the correct center type; left navigation preview/lock behavior works; material cards show accurate photos or verified technical renders, quantity and purpose, each click toggles only that item's user-confirmed state, confirmation survives refresh in the owned project, and the next practice action unlocks only when all four material groups are confirmed; preview remains possible. Right panel auto-open rules and manual pin work; editor state survives navigation; child-readable typography is checked on desktop and narrow viewports; keyboard and reduced motion checks pass. A checkbox is never presented as automatic hardware detection.

### ST-402 Integrate compile/flash/serial into debug panel

**Covers:** FR-HW-05..08, existing compile/upload APIs.

Move/compose current SerialToolbar and execution feedback into the right debug zone without breaking existing operations; add explicit board inference/confidence labels.

**Acceptance:** a labeled “连接设备” action and connection status are visible in the top bar; secondary port/board settings have a readable “设备设置” entry rather than an unexplained gear alone. Compile is a distinct action; flash requires successful firmware/port; serial output and logs remain in the collapsible right debug area, opening/pausing/clearing as expected; logs remain local by default; browser compatibility state is clear; existing regression tests pass.

### ST-403 Implement structured wiring viewer and validation

**Implementation status (2026-09-27):** in progress. `CoursePin` carries normalized image coordinates, aliases and pin kind; component/media/pinmap/connection verification gates are modeled; deterministic power/ground and signal-pin conflict validation exists. The React viewer renders the same connection records as SVG and Chinese checklist and suppresses wires/pin markers unless the exact media, pinmap and connection are all verified. No actual DHT11/buzzer media or physical pin coordinates are available yet, so this is not hardware-accepted.

**Covers:** FR-HW-03/04, FR-COURSE.

Port/adapt the Aily connection-graph behavior for the supported course path: load reviewed board/component pinmaps, parse or import structured wiring, resolve semantic pins, render the graph, and validate known conflicts. The implementation may reuse GPL-compatible Aily core code or reimplement its behavior behind MakeFast adapters; it must not fall back to the current placeholder diagram.

**Acceptance:** Aily-compatible graph fixtures and AWS/JSON examples parse and round-trip; no SVG is generated directly by AI; pinmaps are loaded through a reviewed repository; graph JSON is validated; the course may manually specify target pins for its supported kit; the same graph renders the diagram, Chinese/English checklist and Agent targets; same component can be represented as named instance; VCC-GND short, pin conflict, missing power/GND, UART direction and bus semantics have actionable messages; conflict, unsupported variant and unknown states are explicit; wire color never affects validation. The viewer depicts recognizable real board/component imagery with wires starting and ending at verified physical pin coordinates; a real-kit fixture and hardware smoke test verify those endpoints. No placeholder lines or unverified connection are shown as instructions.

## Epic E5 — Editor source boundaries and Agent IP

### ST-501 Make editor source authoritative and conversion-safe

**Implementation status (2026-09-28):** review. Existing Blockly parser is used as a strict gate: any warning prevents switching, keeps source code, and reports unsupported statements with parser-provided line numbers. Automated tests plus a real local workbench path cover supported switching and an unsupported global declaration; the browser visibly keeps the original code and explains that it can still be burned from code programming. Full project version/undo and broader fidelity corpus remain outside this review evidence.

**Covers:** FR-EDIT-01..05, Aily reference boundary.

Persist `blocks`/`code` source, add conversion capability result, preview warning, undo/version point and no silent partial overwrite.

**Acceptance:** supported round trip tests pass; unsupported code retains original; warning includes location and limitation; source changes remain after reload; parser never silently corrupts project.

### ST-502 Add static Agent IP states and semantic target overlay

**Implementation status (2026-09-28):** review. Semantic target positioning is implemented and the user-provided character sheet is split into per-state static assets wired into the avatar. PNG alpha channels and a real guided workbench path have been checked; final source/license recording remains, so this Story stays in review until the asset provenance gate is explicit.

**Covers:** FR-AI-02..07, UX Agent sections.

Implement top avatar, static state assets/placeholder, target bubble, anchor resolver, guided/autonomous trigger policy and accessible status copy.

**Acceptance:** the user's eight-state character reference is converted into usable static assets with transparent backgrounds; all 8 states render with separate HTML text, never with the entire reference collage or text baked into the image. Avatar summon targets correct visible semantic control; missing/collapsed target falls back safely; close/suppression works; no fixed assistant rail or duplicate legacy AI chat is visible in the workbench; serial/log functions survive the chat removal; reduced-motion and keyboard tests pass.

### ST-503 Add contextual Agent ask

**Covers:** FR-AI-01..05/09/10.

Build allowlisted context assembler, persistent project/course-bound conversations and `/api/agent/ask`; UI supports creating, naming, switching, reopening and deleting conversations, “继续问” in target bubble, and facts vs confirmation vs inference.

**Acceptance:** ask uses the authorized conversation plus current course/project state; full sent messages survive refresh and can be reopened; conversations cannot cross users/projects/course versions; raw serial/full source excluded unless explicit; unsent browser draft is best-effort only; deletion/archive removes the conversation from default context; failure preserves question; mode policy differs for guided/autonomous; no arbitrary DOM or tool execution accepted from model output.

### ST-504 Add Agent proposal preview/apply/undo

**Covers:** FR-AI-06/08, FR-EDIT-06.

Generate validated code/block proposals, show diff/dependencies/hardware assumptions/roundtrip status, apply with revision check and undo snapshot.

**Acceptance:** cancel has no project mutation; stale proposal returns conflict; apply is explicit and auditable; compile/flash/install remain separate; unsupported code is marked code-only.

## Epic E6 — Rewards and learning motivation

### ST-601 Implement idempotent points ledger and badge evaluator

**Implementation status (2026-09-27):** in progress. Server ledger awards configured first-time points, decays repeated practice, enforces per-user idempotency, evaluates initial badges and feeds dashboard totals. API tests cover login, CSRF, duplicate event and dashboard projection. Remaining: prevent arbitrary client event claims with server-side project/course evidence and complete concurrency/rule-version coverage.

**Covers:** FR-REWARD-01..05, NFR-DATA-01.

Create event/reward transaction, configurable first-course score table, competency novelty multipliers (100%/50%/25%/0%), initial badges, replay protection and user reward API.

**Acceptance:** each qualifying event adds intended delta once; retry/replay within one project never increments occurrence; new qualifying practice applies the correct multiplier; historical ledger retains original rule version; failed transaction adds neither event projection nor points; badge unlock unique; tests cover concurrent/replayed requests.

### ST-602 Surface rewards in flow and profile

**Implementation status (2026-09-27):** in progress. Dashboard displays current points, earned badges and recent ledger events; materials/compile/flash/serial events are wired from the workbench. Challenge/quiz/course completion, readable event names/reasons and locked badge criteria remain.

**Covers:** FR-HOME-03/04, FR-REWARD-05/06.

Show earned reason after completion, points history and badge wall; do not celebrate unverified hardware facts as confirmed.

**Acceptance:** reward copy explains source action; profile totals agree with ledger; no duplicate visual grant on refresh; user can see locked badge criteria.

## Epic E7 — Quality, privacy and rollout

### ST-701 Add contract/E2E/accessibility regression suite

**Covers:** all NFR and readiness gates.

Test guest-preview/auth boundary, auth→project→course→persistent conversation→compile/serial mock→reward path, existing API schema compatibility with intentional auth gating, semantic anchors, source conversion, privacy defaults, keyboard and reduced motion.

**Acceptance:** CI/verification commands documented; existing test suites remain green or failures have approved owner; hardware smoke checklist exists.

### ST-702 Pilot gate and migration/rollback runbook

**Covers:** release safety.

Document schema migration, backup/restore, feature flags, course publish rollback, anonymous import, Agent disable fallback and support diagnostics.

**Acceptance:** rollback can disable new surfaces without losing legacy editor; database backup restore tested; pilot telemetry has privacy review and alert thresholds.

### ST-703 Education privacy and school pilot gate (post-MVP backlog)

**Status:** deferred; required before a future school pilot  
**Covers:** future education release safety.

Define school verification, teacher authorization, school/platform data responsibilities, child-facing notice, retention/export/deletion/offboarding and incident response; conduct a controlled teacher/student pilot and security review of credential distribution.

**Acceptance:** reviewed operating agreement and notices exist for the launch region; school offboarding and student export/deletion are tested; credential sheets do not expose reusable class-wide secrets; teacher visibility follows data minimization; education feature flag can be disabled without affecting personal users or losing student work.

## Dependency order

`ST-000 → ST-001 → ST-101 → ST-201 → ST-301 → ST-401 → ST-402 → ST-501 → ST-502 → ST-503 → ST-203/ST-601 → ST-102/ST-202/ST-302 → ST-303 → ST-504/ST-602 → ST-701 → ST-702`

Some stories can run in parallel after their prerequisite contracts exist, but no implementation story is considered ready until its referenced schema/API and UX behavior are stable. ST-103/ST-204/ST-703 preserve the future education line and are intentionally absent from the MVP sprint file.
