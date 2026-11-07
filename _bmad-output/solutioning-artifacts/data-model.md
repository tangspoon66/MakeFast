# Data Model — Learner, Project, Course and Rewards

This is the target logical model for the MVP. Names are conceptual until their Story defines concrete Python/SQLite types. SQLite database is separate from existing ops/course-QA databases.

## Entities

### User

- `user_id` (opaque stable ID, primary key)
- `username` (case-normalized unique, immutable or change through explicit flow)
- `password_hash`
- `display_name`
- `phone`, `phone_verified_at` (nullable, reserved)
- `email`, `email_verified_at` (nullable, reserved)
- `expression_band`: MVP default/fixed `child`; schema may reserve future values without collecting exact birth date
- `ability_level`: `starter | basic | independent`, plus bounded assessment/evidence metadata; initial self-report is recalibrated by observed actions
- `status`, `created_at`, `updated_at`, `last_login_at`

MVP registration requires username and password. At least one verified phone/email for recovery is a future account-hardening requirement; until implemented, UI must not suggest recovery is available.

### Post-MVP education extension (not in current schema Story)

The following entities preserve the agreed direction for a later school edition. They are not part of the personal MVP migrations, APIs or acceptance criteria.

#### EducationOrganization / Class / Membership

- `organization_id`, `name`, `status`, `created_at`, `created_by_admin_id`
- `class_id`, `organization_id`, `name`, optional `expression_band_default`, `status`, `created_at`, `archived_at`
- `membership_id`, `organization_id`, optional `class_id`, `user_id`, `role` (`school_admin | teacher | student`), `status`, `created_at`
- Teachers may have multiple class memberships; student membership is individually revocable. Every education query is scoped by organization plus class authorization.

#### StudentCredential

- `credential_id`, `student_user_id`, `kind` (`activation | login`), `secret_hash`, `status`
- `created_by_teacher_id`, `created_at`, `expires_at`, `used_at`, `revoked_at`, `replaced_by_id`
- Raw activation/login secret is returned only at creation/reset and never stored. A class join code may locate a class, but cannot authenticate all students as one identity.

#### CourseAssignment

- `assignment_id`, `organization_id`, `class_id`, `course_version_id`, `assigned_by_teacher_id`
- `title_override` (nullable), `starts_at`, `due_at` (nullable), `status`, `created_at`
- Student projects may reference an assignment so teacher progress views can be scoped without changing the immutable course version.

### LearnerSession

- `session_id`, `user_id`, `token_hash`, `csrf_token_hash`
- `created_at`, `expires_at`, `last_seen_at`, `revoked_at`
- session table never stores the raw cookie token.

### Course / CourseVersion

- `course_id`, stable `slug`, `title`, `status`, `created_at`
- `course_version_id`, `course_id`, semver/increment, `content_schema_version`, `content_json`, `published_at`, `created_by`
- Published content JSON contains objectives, outcomes, estimated minutes, required hardware, components/pinmap references, an optional course-owned wiring graph with manually specified target connections and verification status, ordered step definitions, prerequisites, knowledge checks, challenges, completion rules, reward rules and Agent context hints.
- CourseVersion is immutable after publish; draft updates create a new candidate version.

### Project

- `project_id`, `owner_user_id`, optional `course_id`/`course_version_id`, `title`
- `learning_mode`: `guided | assisted | autonomous`
- `editor_source`: `blocks | code`
- `board_id`, board inference metadata and confidence/source (`course | project | detected_chip | user_confirmed | inferred`)
- `project_state_json`: files or workspace XML/JSON, structured wiring graph, selected modules and project metadata. The wiring graph is the shared source for the diagram, checklist and Agent targets.
- `revision`, `created_at`, `updated_at`, `archived_at`

Course lesson project references an immutable version. Free-form projects may omit course references.

### ProjectProgress

- `project_id` (unique), `current_step_id`, `completed_step_ids_json`
- `started_at`, `last_activity_at`, `completed_at`, `course_version_id`
- `progress_revision`; current view snapshot is a projection of progress events, not proof that every required action occurred.

### LearningEvent

- `event_id`, `idempotency_key`, `user_id`, `project_id`, `course_version_id`, `step_id`
- `event_type`, `source` (`platform | user_confirmation | agent_proposal`), bounded `payload_json`, `created_at`
- unique `(user_id, idempotency_key)`; sensitive source content is excluded.
- Examples: `project_started`, `step_entered`, `step_completed`, `compile_succeeded`, `flash_succeeded`, `serial_output_observed`, `hardware_result_confirmed`, `challenge_completed`, `quiz_passed`.

### PointsLedger

- `ledger_entry_id`, `user_id`, `event_id`, `idempotency_key`, `competency_key`, `qualifying_occurrence`, `multiplier`, `points_delta`, `reason_code`, `rule_version`, `created_at`
- unique `idempotency_key`; append-only; account total derives from sum or a transactionally maintained aggregate.
- The same project retry/replayed event never increments `qualifying_occurrence`; only a new course attempt or explicit challenge can qualify. Rule changes do not silently rewrite historical entries.

### Badge / UserBadge

- `badge_id`, stable `key`, `name`, `description`, `icon_key`, `criteria_json`, `criteria_version`, `enabled`
- `user_badge_id`, `user_id`, `badge_id`, `earned_at`, `source_event_id`
- unique `(user_id, badge_id)` for one-time badges; repeatable milestone badges require a separately designed level model.

### AgentProposal

- `proposal_id`, `user_id`, `project_id`, `base_project_revision`, `course_version_id`
- `proposal_kind`: `blocks | code_patch | module`
- `proposal_json`: files/workspace delta, assumptions, hardware/pin references, dependencies, roundtrip support report
- `status`: `preview | applied | rejected | stale | failed`
- `created_at`, `resolved_at`, `applied_revision`
- AgentProposal does not duplicate the conversation transcript. The full transcript belongs to AgentConversation/AgentMessage and is persisted there; a proposal stores only the bounded proposal context needed for preview/apply and retention.

### AgentConversation / AgentMessage

- `conversation_id`, `user_id`, `project_id`, `course_version_id`, optional `step_id`, `title`, `status` (`active | archived | deleted`), `created_at`, `updated_at`, `last_message_at`
- `message_id`, `conversation_id`, `sequence_no`, `role` (`user | agent | system_event`), `content_json`, `target_id` (nullable), `state` (nullable), `attachments_json` (bounded, explicit only), `created_at`
- A conversation is always scoped to one owner, one project and one immutable course version. It may move between steps within that project while retaining the original course binding.
- `content_json` stores rendered message content and structured fact/confirmation/inference labels. It must not silently include raw serial, full source or private account fields.
- User-created conversations can be named, reopened, archived and deleted. Message sequence is append-only for an active conversation; corrections are represented as new messages or a new conversation.

## Relationship sketch

```text
User 1 ── * Project * ── 0..1 CourseVersion
Project 1 ── 1 ProjectProgress
User 1 ── * LearningEvent * ── 0..1 Project
LearningEvent 1 ── 0..1 PointsLedger
User * ── * Badge (via UserBadge)
Project 1 ── * AgentProposal
Project 1 ── * AgentConversation 1 ── * AgentMessage
Course 1 ── * immutable CourseVersion
```

## Invariants

- Session owner and project owner are checked server-side on every private API call.
- Every event/project/course reference must agree on the project’s pinned course version.
- Navigation event alone cannot satisfy action completion conditions.
- User-confirmed hardware state is stored separately from serial/compiler facts.
- Points and badge grant are idempotent; event and reward mutation commit/rollback together.
- Competency novelty is evaluated server-side: first/second/third qualifying occurrences use 1.0/0.5/0.25; later identical practice uses 0 unless a distinct competency/challenge rule applies.
- Project writes use revision match; conflict responses never overwrite the newest revision.
- Course content JSON is validated against its `content_schema_version`; admin cannot publish invalid step/anchor/hardware references.
- A course-owned wiring graph may override generic pinmap routing for the supported kit; publication requires an explicit verification state and source/provenance for each required connection.
- Raw serial streams are not included in persistence entities by default.
- Full sent Agent conversations are persisted as user-owned learning records; unsent browser drafts are not persistence entities.
- Conversation attachments are explicit, bounded and labeled; raw serial/full code/full logs are excluded unless the user selects them for a specific message.
- Child expression adaptation does not require exact birth date, school or family information.

## Migration and retention

- Use a `schema_migrations` table; each migration is numbered, transactional where SQLite permits, restart-safe and covered by upgrade tests.
- Do not migrate the legacy editor’s 24-hour local draft automatically into cloud without user account/consent. Offer explicit import on sign-up.
- Define account deletion/export and learning-event retention in a privacy story before launch; no analytics should retain source code or raw serial data.
- Before a future education pilot, extend this model with reviewed school offboarding, teacher access removal, student export/deletion, credential revocation and project retention rules.
- Conversation history must be included in user export; define retention, deletion/restore behavior, provider-side retention and backup purge timing before launch.
