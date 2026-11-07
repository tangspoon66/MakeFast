# Implementation Readiness Review

**Review date:** 2026-09-27  
**Scope:** MakeFast learning platform + Agent MVP  
**Decision:** `READY WITH GATES` — PM product decisions are substantially signed off, including guest preview, child-friendly personal MVP, rewards baseline and persistent course-bound Agent conversations; implementation and child/privacy/hardware gates still block public release.

## 1. Artifact completeness

| Area | Status | Evidence / gap |
|---|---|---|
| Project context | ready | Existing stack, routes, constraints, decisions and exploratory spike are recorded. |
| Product brief | ready | User problem, value, MVP boundary, metrics and risks recorded. |
| PRD | ready with open decisions | Personal auth, guest preview boundary, project, course, workbench, hardware, Agent and rewards requirements have stable IDs. Primary-school inclusion, personal-only MVP, reward baseline, completion tiers and course kit are confirmed; physical verification and child AI/privacy policy remain open. |
| UX specification | ready | Desktop three-zone model, step-to-panel mapping, debug panel and IP interaction defined. |
| Architecture | ready with implementation gate | Existing boundaries preserved; new learner DB/session/event services defined. Migration and privacy work must precede public release. |
| Data model | ready for schema story | Personal learner model/invariants are defined; exact SQLite migrations are not yet written. Education entities are marked post-MVP only. |
| API contracts | ready for contract story | Personal routes/permissions are proposed; they are not existing APIs and must not be treated as implemented. Education routes are a future sketch only. |
| Epics/stories | ready | Stories have acceptance criteria, dependencies and traceability to requirements. |
| Sprint status | ready | Sprint 0 documents baseline; no product feature is falsely marked done. |

## 2. Current implementation truth

- Existing platform: editor, Blockly, compile, upload, serial, template/course resource and admin capabilities are present in the repository.
- Missing MVP product domains: learner auth, cloud projects, structured lesson execution, progress events, points/badges, Agent context/targets/proposals. School tenancy and teacher console are intentionally post-MVP.
- Exploratory changes: `frontend/src/pages/HomePage.tsx` has an unverified workbench spike and `frontend/src/components/AgentWidget.tsx` is a new static prototype. They have no completed CSS contract and have not been accepted as ST-401/ST-502.
- A targeted `npm run build` now passes TypeScript and Vite for the current worktree. Vite still reports an existing CSS warning (`@import` ordering in `App.css`) and large chunk warnings; these are not readiness approval for the spike UX.
- The full frontend `npm test` command currently has 4 failing test files / 10 failing tests and 5 unhandled errors, including pre-existing admin/auth test failures and a missing `AdminFirmwareList` module referenced by its test. These failures are recorded as baseline debt; ST-701 must not be marked done until the suite is green or each exception is explicitly owned.
- ST-001 reconciliation has been completed as a targeted prototype slice; the remaining workbench stories still require production implementation and acceptance.

## 3. Gates before production feature work

1. **ST-001 follow-up gate:** keep the prototype boundary covered by targeted tests while moving to the production contracts. Do not treat the prototype as the completed three-zone product.
2. **Hardware/course gate:** verify the confirmed Seeed Studio XIAO ESP32-S3 Sense (course uses external GPIO only; camera/mic/SD are not part of the lesson) + three-pin DHT11 module + recommended three-pin 3.3V active buzzer module kit, including exact buzzer model, GPIO that are not consumed by Sense peripherals, library versions, pinmap and BOM; then run a physical compile/flash/serial test.
3. **Auth/data gate:** approve learner SQLite location, backup/restore, session cookie/CSRF policy, account deletion/export and privacy retention before accepting learner data.
4. **Product reward gate:** implement and test the approved versioned score table, competency multipliers and badge conditions from `rewards-and-pilot-metrics.md`; pilot changes create a new rule version and never silently recalculate historical ledger entries.
5. **AI privacy gate:** approve which project/code diagnostics may be sent to the configured model, the explicit serial-log attachment UX, and persistent conversation retention/deletion/provider policy. The product decision is to persist complete sent course conversations; the operational retention policy is still a release gate.
6. **API compatibility gate:** add contract tests before changing existing compile/template/admin behavior.
7. **Child privacy gate:** before publicly targeting primary-school users on the personal edition, approve child-facing notice/authorization, data minimization, AI context, retention/export/deletion and incident handling. Lack of guardian/teacher UI does not remove this gate.

## 4. Known risks

- Existing user experience and old Kiro specs allow anonymous tools; the confirmed MVP intentionally changes this to read-only course preview. Rollout must gate compile/editor/downloads server-side, communicate login, and offer explicit post-login import for legacy local drafts.
- A personal-only MVP has no school account recovery channel; child account recovery and authorization language require explicit operating policy before public launch.
- Existing file-based resource stores and new relational learner data can drift unless course versions use stable IDs and immutable publish snapshots.
- The first-course hardware combination is product-confirmed but not yet physically verified; Aily-derived pinmaps are an implementation input, not electrical instructions, until the fixed course wiring is tested. The current MakeFast wiring UI is a placeholder and cannot satisfy ST-403.
- Agent UI target anchoring can fail when nested editors/portals/closed panels hide targets; fallback behavior is a release requirement.
- The existing code-to-Blockly parser may overpromise round trips; product copy must follow actual capability tests.

## 5. Architecture review outcome and recommended next action

The architecture review is complete for the first-course vertical slice. The project accepts GPL-3.0 reuse, and Aily is the primary functional reference for wiring quality. The first course will port/adapt the pure graph core and replace only its host adapters/presentation; it will not ship the current MakeFast placeholder or import Aily's Angular/Electron service unchanged. Any direct Aily inclusion still needs an attribution/source inventory before distribution. A code-level inspection found the graph service is coupled to Angular, RxJS, Electron filesystem APIs and Aily project services, while the AWS parser/types/resolver/converter are substantially more portable.

The next implementation-planning action is to lock the minimum contracts for learner identity, owned projects and the versioned course schema. Hardware verification remains a required course-publication gate, not a reason to invent placeholder GPIO values.

Start with **ST-101** and **ST-201** contracts before replacing the current editor-first route. The prototype `WorkbenchShell`/`AgentOverlay` is a tested reference boundary, not the final production workbench. Do not publish the first course or award real points until ST-303 and ST-601 are complete. Education stories ST-103/ST-204/ST-703 remain outside the MVP sprint.

## 6. Readiness conclusion

The BMAD planning package is complete enough to guide incremental implementation and user review. It is not a claim that the feature set is implemented. `ST-000` and the targeted `ST-001` prototype slice are marked `done`; the remaining product Stories require their own code, tests and acceptance evidence.
