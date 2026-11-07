# API Contracts — Proposed Learner Platform APIs

These contracts are implemented incrementally alongside existing compile, public course/template, serial, admin and firmware APIs. JSON examples omit common error envelope details. Learner identity, account UI, and guest/tool access gating are implemented; owned project and dashboard APIs are the current ST-201 work.

## Session and account

Authentication is a first-party opaque session cookie (`HttpOnly; SameSite=Lax; Secure in production`). Unsafe requests also send `X-CSRF-Token`. Password and raw session token never appear in response JSON.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/register` | public + rate limit | Create username/password learner; optionally accept display name and initial experience markers |
| `POST` | `/api/auth/session` | public + rate limit | Login; set session and return CSRF token + learner summary |
| `DELETE` | `/api/auth/session` | learner + CSRF | Revoke current session |
| `GET` | `/api/auth/me` | learner | Current learner/profile summary and CSRF token rotation if needed |
| `PATCH` | `/api/users/me` | learner + CSRF | Update display name and nullable reserved contact fields; verification cannot be self-asserted |

Registration body:

```json
{
  "username": "maker_01",
  "password": "...",
  "display_name": "小创客",
  "experience_markers": ["connected_component"]
}
```

**Implementation status (2026-09-27):** `/api/auth/register`, `/api/auth/session`, `/api/auth/me`, and `DELETE /api/auth/session` are implemented in `backend/app/learner_auth_routes.py`. Users, sessions and hashed rate-limit keys are stored in the dedicated `learning.sqlite3`; raw session and CSRF tokens are not stored. The frontend account forms and guest preview are implemented. Editor, compile, AI generation, course source/attachment download, and firmware download require a learner session. Registration/session and locked-resource boundary tests pass.

`experience_markers` is optional and limited to a fixed enum such as `none`, `recognizes_board_sensor`, `connected_component`, `compiled_or_flashed`, `used_serial_or_debugged`. It initializes guidance level and is not treated as verified achievement. Registration response must not echo password. Invalid login returns a generic message; username uniqueness conflicts may be handled on registration with rate limiting and a neutral message.

## Post-MVP school education API sketch

The routes below preserve the future education direction only. They are excluded from current MVP implementation, OpenAPI acceptance and Sprint scope until a separate education planning review.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/admin/education/organizations` | platform admin | Provision a school education space and first teacher |
| `PATCH` | `/api/admin/education/organizations/{id}` | platform admin | Suspend/reactivate an organization |
| `GET` | `/api/education/classes` | teacher | List authorized classes |
| `POST` | `/api/education/classes` | teacher + CSRF | Create a class in teacher organization |
| `POST` | `/api/education/classes/{id}/students` | authorized teacher + CSRF | Create one/batch pseudonymous student accounts and one-time credentials |
| `POST` | `/api/education/students/{id}/credentials/reset` | authorized teacher + CSRF | Revoke old credential and issue a new one-time value |
| `PATCH` | `/api/education/students/{id}` | authorized teacher + CSRF | Update nickname/status; no cross-class access |
| `POST` | `/api/education/classes/{id}/assignments` | authorized teacher + CSRF | Assign an immutable published course version |
| `GET` | `/api/education/classes/{id}/progress` | authorized teacher | Read minimal per-student and aggregate progress |

Credential creation/reset would return each raw secret once. Storage would retain only a slow/verifier-safe hash plus lifecycle metadata. Class lookup/join codes, if added, would not replace the unique student secret.

Teacher progress responses include student nickname/code, account status, current step, basic/deep completion and recent activity. They exclude raw serial, private Agent questions and full source by default.

## Courses and projects

**Project API implementation status (2026-09-27):** ST-201 is complete. Project create/list/read/save/archive and `/api/users/me/dashboard` are implemented in `backend/app/learning_project_routes.py` and use the same learning SQLite database. Writes require CSRF and project saves use optimistic revision checks. The browser workbench loads/saves by project ID and offers explicit legacy-draft import. Dashboard currently returns no points or badges until ST-601; course step rendering and verified progress events remain future stories.

**Course schema status (2026-09-27):** ST-301 provides validated draft/publish/version APIs in `backend/app/learning_course_routes.py`. Published versions are immutable and newly created projects record the current published version. No first-course draft has been published: real media, exact kit variants, pinmaps and wiring evidence remain ST-303/ST-403 work. The workbench will consume these definitions in ST-401.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/learning/courses` | public | List public course preview metadata |
| `GET` | `/api/learning/courses/{slug}/preview` | public | Read scrubbed public text/image preview and step outline only |
| `GET` | `/api/learning/courses/{slug}` | learner | Read authenticated course content and executable step definitions |
| `POST` | `/api/learning/projects` | learner + CSRF | Create owned course or free-form project |
| `GET` | `/api/learning/projects` | learner | List own projects and current progress summary |
| `GET` | `/api/learning/projects/{project_id}` | owner | Read project and revision |
| `PUT` | `/api/learning/projects/{project_id}` | owner + CSRF | Save project using `If-Match` revision |
| `POST` | `/api/learning/projects/{project_id}/archive` | owner + CSRF | Archive project; no hard delete in initial UI |
| `GET` | `/api/learning/projects/{project_id}/progress` | owner | Current step, completed steps and evidence labels |
| `POST` | `/api/learning/projects/{project_id}/events` | owner + CSRF | Append typed idempotent event, validate prerequisites, update progress/rewards |
| `GET` | `/api/users/me/dashboard` | learner | Continue project, recent projects, points total and badge summary |
| `GET` | `/api/users/me/rewards` | learner | Points ledger and badges/progress |
| `GET` | `/api/learning/projects/{project_id}/conversations` | owner | List conversations bound to this project/course |
| `POST` | `/api/learning/projects/{project_id}/conversations` | owner + CSRF | Create a named Agent conversation |
| `GET` | `/api/learning/conversations/{conversation_id}` | owner | Read conversation metadata and messages |
| `PATCH` | `/api/learning/conversations/{conversation_id}` | owner + CSRF | Rename, archive or restore a conversation |
| `DELETE` | `/api/learning/conversations/{conversation_id}` | owner + CSRF | Request deletion of a conversation and messages |

Current ST-201 project save body:

```json
{
  "revision": 4,
  "title": "温湿度提醒器",
  "learning_mode": "guided",
  "editor_source": "blocks",
  "board_id": "xiao-esp32-s3",
  "project_state": {
    "code": "void setup() {}",
    "projectFiles": [{ "id": "main", "name": "main.ino", "content": "void setup() {}" }],
    "blocksXml": "<xml>...</xml>"
  },
  "current_step_id": "code",
  "completed_step_ids": []
}
```

Response returns a new revision. When revision is stale, `409 revision_conflict` leaves local edits intact; the workbench offers a separate copy instead of overwriting the newer version. `blocksXml` is omitted or null for code-only projects. Course wiring graph and source-conversion capability become structured fields in later stories.

Public preview serializers use an allowlist and never include source/workspace payloads, firmware/resource download URLs, private attachments, completion answers, Agent hints or executable step configuration. Protected resource/download routes require a learner session. In the MVP access policy, compile, editor/workbench and AI/Agent operations also require authentication.

Event body:

```json
{
  "idempotency_key": "client-generated-stable-key",
  "type": "hardware_result_confirmed",
  "step_id": "verify-output",
  "source": "user_confirmation",
  "payload": { "result": "sensor_and_indicator_observed" }
}
```

Response returns accepted/replayed, progress projection, newly earned point delta and badge summaries. Do not accept arbitrary points from client.

## Agent

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/agent/ask` | learner + CSRF | Contextual answer and optional semantic target |
| `POST` | `/api/agent/proposals` | learner + CSRF | Generate immutable project modification preview |
| `POST` | `/api/agent/proposals/{proposal_id}/apply` | owner + CSRF | Apply reviewed proposal if base revision still matches |
| `POST` | `/api/agent/proposals/{proposal_id}/reject` | owner + CSRF | Dismiss preview |

Question request includes conversation ID, project ID, step ID, question, learning mode, editor source and explicitly selected diagnostics. Server loads canonical course/project state and the authorized conversation history; it does not trust client-provided owner, reward, or arbitrary system prompt. Serial lines only arrive when user explicitly opts in and are limited/redacted. A new conversation may be created when no conversation ID is supplied, but it is still bound to the authenticated project and immutable course version.

Ask response:

```json
{
  "message": "先检查传感器的数据脚是否与课程接线图一致。",
  "state": "guide",
  "target_id": "wiring-diagram",
  "facts": [{ "kind": "platform", "label": "当前项目课程版本", "value": "..." }],
  "proposal_id": null,
  "conversation_id": "conv_...",
  "message_id": "msg_..."
}
```

Proposal response includes `proposal_id`, base revision, kind, preview diff, hardware assumptions, dependencies, roundtrip status and no-write-before-apply guarantee. Apply endpoint only records user-confirmed application and returns revision; it never compiles/flashes.

## Admin course authoring

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/admin/learning/courses` | existing admin auth | Create draft course |
| `PUT` | `/api/admin/learning/courses/{id}/draft` | existing admin auth | Update draft content/steps |
| `POST` | `/api/admin/learning/courses/{id}/validate` | existing admin auth | Check schema, references, pins, completion and reward rules |
| `POST` | `/api/admin/learning/courses/{id}/publish` | existing admin auth | Freeze a new immutable version |
| `GET` | `/api/admin/learning/courses/{id}/versions` | existing admin auth | List revisions and usage counts |

Existing admin domain stays separately protected. Draft editing must not expose hidden unpublished course content through public API.

## Error contract

New MVP routes should use the project’s standard error shape and stable code: `validation_error`, `invalid_credentials`, `session_expired`, `csrf_failed`, `not_found`, `forbidden`, `revision_conflict`, `course_version_conflict`, `prerequisite_not_met`, `proposal_stale`, `rate_limited`, `agent_unavailable`, `storage_unavailable`. Never include stack traces, secrets, raw prompts or private resource existence in learner-facing errors. Future education routes will define credential/organization errors in their own review.

## API acceptance / compatibility

- OpenAPI output includes new schema and auth details when API docs are enabled.
- Contract tests cover missing/expired session, CSRF, cross-user ownership, replayed idempotency key, invalid event type and stale proposal.
- Conversation contract tests cover project/course binding, cross-user denial, archive/delete behavior, ordered message persistence, explicit attachment limits and reopening a prior conversation.
- Existing `/api/compile`, `/api/boards`, `/api/ai/generate`, template, firmware and admin endpoints keep prior payload schemas where retained. The confirmed MVP intentionally adds authentication to compile/editor/private downloads/AI; contract tests treat unauthenticated `401/403` as the new access policy rather than accidental breakage.
