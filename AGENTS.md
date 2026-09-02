# AGENTS.md — AI-Native* Durable Workflow Platform

> *Naming note: "AI-native" in the product positioning refers to the platform being able to expose
> workflow nodes as agent tools in the future. **This build does NOT implement any AI/LLM/RAG/agent
> functionality.** See "Explicitly Out of Scope" below. Do not add AI-related code, dependencies,
> or nodes unless a human explicitly re-opens that scope.

This file gives any coding agent (Claude Code, Cursor, Copilot, etc.) working in this repo the
context, constraints, and conventions it needs to make correct changes without re-deriving the
architecture from scratch. Read this before writing code. If something here conflicts with a
prompt from a user in a session, prefer this file's architectural invariants and flag the conflict.

---

## 1. What this project is

A visual workflow orchestration platform (think: workflow builder + durable execution engine),
differentiated by **durable execution, crash recovery, and execution debuggability** — not by
integration count.

**Core product invariant:** a user must be able to open any execution and answer, from durable
state alone: which workflow version ran, which node ran, what input it saw, what output it
produced, which attempt was used, which worker owned it, and what happens next.

---

## 2. Explicitly out of scope (do not build)

- LLM nodes, AI agents, tool registries, agent guardrails/step limits.
- RAG pipelines, vector stores, persistent agent memory.
- Any "agent" abstraction layered on top of the node executor.

The **Approval / Wait node** and the `WAITING` execution state **are in scope** — durable
human-in-the-loop waiting (e.g., "pause until someone clicks Approve") is a general engine
capability, not an AI feature. Do not conflate it with agent HITL.

---

## Agent Execution Rules

- Work autonomously until the current approved implementation scope is complete.
- Do not stop after planning; implement the required code.
- Do not ask for confirmation between implementation phases.
- Prioritize implementation, testing, debugging, and integration over explanations.
- Inspect the repository before creating files and reuse existing code where appropriate.
- Make reasonable implementation decisions when they are already implied by this document.
- Only stop and ask for clarification when a genuinely blocking ambiguity cannot be resolved from this document or the existing codebase.


## Output Efficiency

- Keep progress updates concise.
- Do not repeatedly restate requirements from AGENTS.md.
- Do not explain implementation details unless necessary.
- Do not generate unnecessary documentation.
- Do not create speculative abstractions or future features.
- Spend execution time primarily on code, tests, debugging, and integration.

## Code Quality and Readability

Write code as an experienced human engineer would write it for a production codebase.

### Readability

- Prefer simple, explicit logic over clever or compressed implementations.
- Code should be understandable by a developer who did not write it.
- Use descriptive variable, function, class, and type names.
- Keep functions focused on one clear responsibility.
- Prefer small functions with straightforward control flow.
- Use early returns when they make the logic easier to follow.
- Avoid deeply nested conditionals.
- Avoid unnecessary chaining and overly dense expressions.
- Avoid clever one-liners when multiple simple lines are easier to understand.
- Prefer explicit intermediate variables when they make the data flow clearer.
- Keep related logic close together.
- Separate unrelated responsibilities into separate functions or modules.

### Abstractions

- Do not create abstractions only to make the architecture look sophisticated.
- Introduce an abstraction when it removes real duplication, isolates a meaningful responsibility, or is required by the architecture.
- Prefer a small number of useful abstractions over many layers of interfaces and wrappers.
- Do not create factories, managers, helpers, adapters, or generic utilities without a concrete need.
- Avoid generic abstractions that make simple code harder to understand.
- Follow the existing project structure instead of creating new architectural patterns unnecessarily.

### Error Handling

- Handle errors explicitly.
- Use descriptive error messages that explain what failed and why.
- Preserve useful context when propagating errors.
- Do not silently swallow errors.
- Do not use empty catch blocks.
- Keep error-handling paths easy to follow.

### Async and Database Code

- Prefer straightforward async/await code.
- Avoid deeply nested promise chains.
- Keep database transactions explicit.
- Make transaction boundaries obvious.
- Keep SQL queries understandable and reasonably scoped.
- Do not hide important database operations behind excessive abstraction.

### Comments

- Write comments only when they explain WHY something is done, an important invariant, or a non-obvious tradeoff.
- Do not write comments that merely restate what the code does.
- Do not generate large blocks of explanatory comments for simple code.
- Prefer readable code over comments.

### TypeScript

- Use TypeScript's type system to make contracts clear.
- Avoid `any` unless there is a justified boundary where it is genuinely necessary.
- Prefer `unknown` when the type is not known.
- Do not over-engineer generic types.
- Keep types understandable.
- Prefer discriminated unions and explicit types when they make state transitions clearer.

Write production-quality TypeScript that is Production code written for human maintainability.

Prioritize simple, explicit, readable logic over cleverness or abstraction.

Use descriptive names, small focused functions, straightforward control flow, and explicit state transitions.

Do not over-engineer the code.
Do not create abstractions without a concrete need.
Do not optimize for fewer lines of code.

A developer should be able to read the implementation and understand the logic without reverse-engineering the architecture.

### Important

Before continuing implementation, revise the project naming conventions.

The current generated structure uses overly verbose TypeScript filenames such as:
- execution-status.enum.ts
- task-status.enum.ts
- node.interface.ts
- node-result.interface.ts
- workflow.dto.ts
- workflow.repository.ts

Do not use TypeScript type suffixes such as:
.enum.ts
.interface.ts
.dto.ts
.repository.ts
.service.ts
.controller.ts

Use the directory to communicate the responsibility instead.

Examples:
- enums/execution-status.ts
- enums/task-status.ts
- nodes/node.ts
- nodes/node-result.ts
- workflows/workflow.ts
- repositories/workflow.ts
- controllers/workflows.ts
- services/workflows.ts

Use kebab-case for multi-word filenames.

Apply this convention consistently across the entire planned project structure.

### General Rule

When there are two implementations that satisfy the requirements, prefer the implementation that is:

1. Easier for a human to understand
2. Easier to debug
3. Easier to test
4. Easier to modify
5. Simpler

Do not optimize for cleverness, abstraction density, or minimum lines of code.
Optimize for correctness and human readability.

### Workflow Engine Readability

The workflow execution engine is a critical part of the system and must favor explicit state transitions.

- Make execution state transitions visible in the code.
- Prefer explicit state-machine logic over implicit behavior.
- Keep task scheduling logic separate from task execution logic.
- Keep retry logic separate from node execution logic.
- Keep lease management separate from business logic.
- Keep checkpoint persistence explicit.
- Make recovery behavior easy to trace from the code.
- Do not hide execution state changes behind deeply nested abstractions.
- A developer should be able to follow a task from READY → RUNNING → SUCCEEDED/FAILED/WAITING by reading the relevant code directly.


## 3. Tech stack (locked decisions — do not swap without discussion)

| Layer | Choice | Notes |
|---|---|---|
| Backend | Node.js + Express + TypeScript | Three separate processes: API service, Worker service, Scheduler service — plain Express apps, no framework-imposed module system |
| Durable state | PostgreSQL | Source of truth. JSONB for flexible payloads, normal columns for anything queried/filtered/indexed |
| Job distribution | Redis + BullMQ | Transport only — never durable truth |
| Frontend | React + React Flow | Canvas, node config panels, execution debugger, approval UI |
| Observability | OpenTelemetry → Prometheus → Grafana | Traces, metrics, structured logs |
| Load testing | k6 or Locust | Used to validate scaling claims, not just for show |
| Local dev | Docker Compose | Postgres + Redis + API + Worker + Scheduler, reproducible |

**Do not use:** Next.js (this is not an SSR/full-stack-framework app — API and web are separate
processes), NestJS, Fastify, or FastAPI. Backend is plain Node.js + Express only.

### 3.1 Express app conventions

Express gives you no structure by default, so impose one consistently rather than letting each
route file invent its own pattern:

```
apps/api/src/
  routes/         thin route definitions only — no business logic
  controllers/    parse/validate request, call a service, shape response
  services/       business logic, orchestrates repositories
  repositories/   all SQL/Postgres access lives here — nowhere else
  middleware/     auth, request validation, error handling
  errors/         typed error classes + a single centralized error-handling middleware
```

- Validate all inbound request bodies/params with a schema library (e.g. `zod`) in
  `middleware/` or `controllers/` — never trust raw `req.body` past the controller boundary.
- One centralized error-handling middleware (`app.use((err, req, res, next) => ...)`) converts
  typed errors to HTTP responses. Controllers/services throw typed errors; they don't format
  HTTP responses themselves.
- The **worker** and **scheduler** processes are plain Node.js — they do not need an Express
  server at all, except optionally a minimal health-check endpoint for orchestration/liveness
  probes. Don't route BullMQ job processing through Express handlers.
- Keep route handlers free of direct `pg`/query-builder calls — that violates the
  repository boundary and makes the data-access layer untestable in isolation.

---

## 4. Non-negotiable architecture principles

Treat these as lint rules for architecture. A PR that violates one of these needs a very good
reason in its description.

1. **PostgreSQL is the durable source of truth. Redis is transport, never truth.** If a fact
   can't be reconstructed after Redis is wiped, it's a bug.
2. **Every execution is pinned to an immutable `workflow_versions` row.** Publishing a new
   version must never change the behavior of an in-flight execution.
3. **At-least-once delivery, not exactly-once.** Don't write code or docs that claim
   exactly-once semantics. Side-effecting nodes must be idempotent via an explicit key, not by
   assumption.
4. **Never occupy a worker while waiting.** Approvals, delays, and external events persist
   `WAITING` state and release the worker; a continuation job re-enqueues on event/deadline.
5. **No arbitrary `eval` in the expression engine.** Expressions go through
   parser → AST → allow-listed variables/functions → safe evaluator. If a requested expression
   feature can't be expressed in the allow-listed grammar, it's rejected, not eval'd.
6. **Custom/user-supplied code never runs in the API process.** It runs in an isolated execution
   boundary with CPU/memory/timeout/filesystem/network limits. Treat the sandbox library as one
   layer of defense, not a guarantee — don't remove other layers because "the sandbox handles it."
7. **No premature microservices.** Stay at API + Worker + Scheduler + Postgres + Redis until
   queue depth or measured latency justifies a split. Don't add Kafka/K8s for résumé reasons.
8. **API replicas are stateless.** Any request-scoped state belongs in Postgres or Redis, not
   in-process memory, or horizontal scaling breaks.
9. **Credentials are encrypted at rest, decrypted only inside the worker process**, injected into
   the node, and redacted from logs/output. Master keys live outside the database (KMS or
   equivalent), never in an env var checked into anything.

---

## 5. Execution & task state machines

Implement these as actual enums with an explicit, enforced transition table — don't let status
become a loose string field.

**Execution status:** `CREATED → QUEUED → RUNNING → {WAITING | RETRYING} → RUNNING → COMPLETED`
Terminal: `COMPLETED`, `FAILED`, `CANCELLED`, `TIMED_OUT`.

**Task status:** `PENDING → READY → RUNNING → {WAITING | RETRYING} → SUCCEEDED`
Alternative terminals: `FAILED`, `SKIPPED`, `CANCELLED`.

A node moving to `WAITING` must release its worker lease immediately — assert this in tests, not
just in code review.

---

## 6. Node abstraction

All node types — HTTP, Postgres, Slack, Approval/Wait, Delay, Transform, IF — implement one
interface. Do not hard-code per-integration branches into the execution engine itself.

```ts
interface WorkflowNode<TInput = unknown, TOutput = unknown> {
  type: string;
  validate(input: TInput): void;
  execute(input: TInput, context: ExecutionContext): Promise<NodeResult<TOutput>>;
}
```

New node types = new implementations of this interface + registration, never new `if (type ===
...)` branches inside the engine's core loop.

---

## 7. Data model (PostgreSQL)

| Table | Purpose |
|---|---|
| `users` | id, email, password_hash, role |
| `workflows` | id, owner_id, name, active, current_version_id |
| `workflow_versions` | id, workflow_id, version, definition_json, created_at — **immutable once created** |
| `credentials` | id, owner_id, provider, encrypted_data, key_version |
| `executions` | id, workflow_id, **workflow_version_id**, trigger_type, status, timestamps |
| `task_instances` | id, execution_id, node_id, status, attempt, input/output, error, worker_id, lease_until |
| `execution_events` | id, execution_id, sequence, event_type, payload, created_at — append-only audit trail |
| `webhook_events` | workflow_id, external_event_id, payload_hash, execution_id — dedupe key |
| `workflow_schedules` | workflow_id, schedule, timezone, next_run_at, enabled |
| `outbox_events` | aggregate_id, event_type, payload, published_at |
| `idempotency_keys` *(gap in original spec, add explicitly)* | execution_id, node_id, logical_operation_id (unique), result_snapshot |
| `dead_letter_tasks` *(gap in original spec, add explicitly)* | task_instance_id, execution_id, final_error, moved_at, replay status |

**Rules:**
- `executions.workflow_version_id` is a hard foreign key to an immutable row. Never resolve a
  running execution's node definitions from `workflows.current_version_id`.
- `UNIQUE(workflow_id, external_event_id)` on `webhook_events` — repeated webhook delivery must
  not create duplicate executions.
- Index `(enabled, next_run_at)` on `workflow_schedules` for scheduler polling.
- Idempotency key format: `execution_id + node_id + logical_operation_id`. Check-then-write must
  be a single unique constraint, not an application-level race-prone check.

---

## 8. Reliability mechanisms

| Mechanism | Implementation note |
|---|---|
| Leases | `worker_id + lease_until` on `task_instances`. Reclaim on expiry. |
| Heartbeats | Renew lease at ~50% of TTL for long-running nodes; don't let short TTLs falsely reclaim slow-but-alive tasks. |
| Retries + backoff | Exponential with jitter — never synchronized retry storms. |
| DLQ | Persist to `dead_letter_tasks` after max attempts, not just BullMQ's internal failed list — the debugger UI needs to query this. |
| Per-node concurrency | Cap so one integration can't starve the worker pool. |
| Per-workflow concurrency | Cap noisy-neighbor workflows. |
| Provider throttling | Redis token bucket keyed by `provider + credential_id`. |
| Timeouts | Every node execution has a deadline; runaway nodes get killed, not left hanging. |
| Cancellation | User-triggered; must be observable mid-execution, not just pre-queue. |

**Recovery statement to keep true in code, not just docs:** "At-least-once execution. Checkpoints,
leases, and idempotency keys make recovery safe where the external integration supports
idempotent operations — this is not a universal exactly-once guarantee."

---

## 9. Reference request flow

```
Frontend → API → Postgres transaction (INSERT execution + INSERT outbox_event) → COMMIT
        → Outbox publisher → Redis/BullMQ → Worker → Workflow Engine → Postgres → Debugger
```

Never publish to Redis inside the same step as the Postgres write without the outbox pattern —
a Postgres commit succeeding while the Redis publish fails (or vice versa) is the exact bug this
guards against.

---

## 10. Observability & debugger requirements

The debugger must show, per execution: graph with per-node status, node input/output/error,
attempt count, queue-wait + execution-duration timeline, checkpoint/lease history, and a Resume
action — with logs redacted of secrets.

Minimum metrics: webhook ack latency, queue depth/wait time, node/workflow execution duration,
retry/failure rate, worker utilization, expired-lease/recovery count, workflow throughput.

---

## 11. Roadmap (AI phases removed)

| Phase | Build | Exit condition |
|---|---|---|
| 1. Canvas | React Flow, nodes, edges, save/load | Visual workflow works |
| 2. Engine | Trigger, HTTP, Transform, IF, dependency graph | Deterministic flow executes |
| 3. Workers | Redis/BullMQ, API → worker | Async execution works |
| 4. Durable state | Executions, tasks, checkpoints, versions | Crash recovery works |
| 5. Reliability | Leases, heartbeats, retries, idempotency, DLQ, cancel | Failure cases are demonstrable |
| 6. Events | Webhooks, dedupe, scheduler, outbox | Reliable event ingestion |
| 7. Debugger | Graph status, payloads, timeline, resume | Excellent run visibility |
| 8. Durable waiting | Approval/Wait node, `WAITING` state | Worker-free waiting works |
| 9. Observability | Tracing, metrics, load tests, Docker Compose | Measured performance story |
| 10. Later | More integrations, stronger sandbox hardening | Expansion after core stability |

**MVP:** `Webhook → HTTP → Transform → IF → Approval → Slack`, plus versions, checkpoints,
retries, leases, idempotency, debugger, and metrics. No AI step.

**Depth over breadth:** a small set of node types backed by a genuinely durable engine beats many
integrations with weak failure handling. Don't add a new node type until the reliability layer
around existing ones is solid.

---

## 12. Engineering questions any change should still be able to answer

- What happens if a worker dies mid-node?
- How is a successful external side effect prevented from being duplicated on retry?
- Why is Postgres the source of truth while Redis isn't?
- How does workflow versioning protect an in-flight execution from a concurrent publish?
- How does an approval resume a workflow without holding a worker the whole time?
- How are webhook deliveries deduplicated?
- What happens if 10,000 webhooks arrive at once?
- How are third-party rate limits respected?

If a proposed change makes any of these harder to answer clearly, reconsider it.

---

## 13. Suggested repo layout (monorepo)

```
apps/
  api/          Express control plane: auth, workflow CRUD, webhook ingestion
  worker/       Node.js worker process: engine, node executors, sandbox (no HTTP server needed)
  scheduler/    Node.js scheduler process: due-schedule polling, next_run_at advancement
  web/          React + React Flow: canvas, debugger, approval UI
packages/
  db/           Postgres schema, migrations, generated types
  shared/       Shared types: node contracts, execution/task enums, DTOs
infra/
  docker-compose.yml
```

## 14. Commands (fill in / keep current as the repo is scaffolded)

```bash
pnpm install
pnpm dev            # runs api + worker + scheduler + web via turbo/nx, or docker compose up
pnpm db:migrate
pnpm test
pnpm lint
pnpm build
```

> Update this section the moment real scripts exist — a stale commands block is worse than none,
> since an agent will trust and run it.
