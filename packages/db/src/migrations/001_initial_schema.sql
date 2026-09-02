-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Workflows
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    current_version_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Workflow Versions (Immutable once created)
CREATE TABLE IF NOT EXISTS workflow_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    version INT NOT NULL,
    definition_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_workflow_versions_workflow_version UNIQUE (workflow_id, version)
);

-- Add foreign key from workflows.current_version_id to workflow_versions(id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_workflows_current_version'
    ) THEN
        ALTER TABLE workflows 
        ADD CONSTRAINT fk_workflows_current_version 
        FOREIGN KEY (current_version_id) 
        REFERENCES workflow_versions(id) 
        ON DELETE SET NULL;
    END IF;
END $$;

-- 4. Credentials (Encrypted at rest)
CREATE TABLE IF NOT EXISTS credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    encrypted_data TEXT NOT NULL,
    key_version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Executions (Pinned to immutable workflow_version_id)
CREATE TABLE IF NOT EXISTS executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    workflow_version_id UUID NOT NULL REFERENCES workflow_versions(id),
    trigger_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'CREATED',
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_executions_workflow_status ON executions (workflow_id, status);
CREATE INDEX IF NOT EXISTS idx_executions_version_id ON executions (workflow_version_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON executions (status);

-- 6. Task Instances
CREATE TABLE IF NOT EXISTS task_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    attempt INT NOT NULL DEFAULT 0,
    input_json JSONB,
    output_json JSONB,
    error_json JSONB,
    worker_id TEXT,
    lease_until TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_instances_execution_node ON task_instances (execution_id, node_id);
CREATE INDEX IF NOT EXISTS idx_task_instances_status_lease ON task_instances (status, lease_until);
CREATE INDEX IF NOT EXISTS idx_task_instances_worker_lease ON task_instances (worker_id, lease_until);

-- 7. Execution Events (Append-only audit trail)
CREATE TABLE IF NOT EXISTS execution_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
    sequence INT NOT NULL,
    event_type TEXT NOT NULL,
    payload_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_execution_events_execution_sequence UNIQUE (execution_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_execution_events_execution_id ON execution_events (execution_id);

-- 8. Webhook Events (Deduplication)
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    external_event_id TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    execution_id UUID REFERENCES executions(id) ON DELETE SET NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_webhook_events_workflow_external_id UNIQUE (workflow_id, external_event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_workflow_id ON webhook_events (workflow_id);

-- 9. Workflow Schedules
CREATE TABLE IF NOT EXISTS workflow_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    schedule TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'UTC',
    next_run_at TIMESTAMPTZ,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_schedules_polling ON workflow_schedules (enabled, next_run_at);

-- 10. Outbox Events (Transactional job dispatch)
CREATE TABLE IF NOT EXISTS outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    payload_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outbox_events_unpublished ON outbox_events (created_at) WHERE published_at IS NULL;

-- 11. Idempotency Keys
CREATE TABLE IF NOT EXISTS idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL,
    logical_operation_id TEXT NOT NULL,
    result_snapshot JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_idempotency_keys_unique_op UNIQUE (execution_id, node_id, logical_operation_id)
);

-- 12. Dead Letter Tasks
CREATE TABLE IF NOT EXISTS dead_letter_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_instance_id UUID NOT NULL REFERENCES task_instances(id) ON DELETE CASCADE,
    execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
    final_error JSONB NOT NULL,
    moved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    replay_status TEXT NOT NULL DEFAULT 'PENDING'
);

CREATE INDEX IF NOT EXISTS idx_dead_letter_tasks_execution ON dead_letter_tasks (execution_id);
CREATE INDEX IF NOT EXISTS idx_dead_letter_tasks_replay_status ON dead_letter_tasks (replay_status);
