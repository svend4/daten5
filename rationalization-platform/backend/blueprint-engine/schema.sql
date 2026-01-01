-- Blueprint Executions tracking

CREATE TABLE IF NOT EXISTS blueprint_executions (
    id UUID PRIMARY KEY,
    blueprint_id UUID NOT NULL,
    status VARCHAR(50) NOT NULL,

    -- Progress tracking
    current_step INTEGER DEFAULT 0,
    total_steps INTEGER DEFAULT 0,
    current_step_name VARCHAR(255),
    progress INTEGER DEFAULT 0, -- 0-100

    -- Timing
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    duration_seconds INTEGER,

    -- Data
    parameters JSONB,
    result JSONB,
    error TEXT,

    -- Metadata
    user_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_status CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'))
);

CREATE INDEX idx_blueprint_executions_blueprint ON blueprint_executions(blueprint_id);
CREATE INDEX idx_blueprint_executions_status ON blueprint_executions(status);
CREATE INDEX idx_blueprint_executions_started ON blueprint_executions(started_at DESC);
