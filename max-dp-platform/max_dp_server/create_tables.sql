-- Create MAXDP workspace and flow tables

-- Create enum types
CREATE TYPE IF NOT EXISTS ownertype AS ENUM ('user', 'group');
CREATE TYPE IF NOT EXISTS flowstatus AS ENUM ('draft', 'active', 'inactive', 'archived');
CREATE TYPE IF NOT EXISTS executionstatus AS ENUM ('pending', 'running', 'success', 'failed', 'cancelled');

-- Create maxdp_workspaces table
CREATE TABLE IF NOT EXISTS maxdp_workspaces (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_type ownertype NOT NULL,
    owner_user_id UUID REFERENCES users(id),
    owner_group_id INTEGER, -- REFERENCES groups(id) - groups table might not exist
    is_active BOOLEAN DEFAULT TRUE,
    is_public BOOLEAN DEFAULT FALSE,
    settings TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL REFERENCES users(id)
);

-- Create index for maxdp_workspaces
CREATE INDEX IF NOT EXISTS ix_maxdp_workspaces_id ON maxdp_workspaces(id);

-- Create maxdp_flows table
CREATE TABLE IF NOT EXISTS maxdp_flows (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    workspace_id INTEGER NOT NULL REFERENCES maxdp_workspaces(id),
    owner_type ownertype NOT NULL,
    owner_user_id UUID REFERENCES users(id),
    owner_group_id INTEGER, -- REFERENCES groups(id) - groups table might not exist
    status flowstatus DEFAULT 'draft',
    is_public BOOLEAN DEFAULT FALSE,
    tags JSONB,
    current_version INTEGER DEFAULT 1,
    latest_version INTEGER DEFAULT 1,
    is_scheduled BOOLEAN DEFAULT FALSE,
    schedule_config JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL REFERENCES users(id)
);

-- Create index for maxdp_flows
CREATE INDEX IF NOT EXISTS ix_maxdp_flows_id ON maxdp_flows(id);

-- Create maxdp_flow_versions table
CREATE TABLE IF NOT EXISTS maxdp_flow_versions (
    id SERIAL PRIMARY KEY,
    flow_id INTEGER NOT NULL REFERENCES maxdp_flows(id),
    version_number INTEGER NOT NULL,
    version_name VARCHAR(100),
    description TEXT,
    changelog TEXT,
    flow_definition JSONB NOT NULL,
    components JSONB,
    is_active BOOLEAN DEFAULT FALSE,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL REFERENCES users(id)
);

-- Create index for maxdp_flow_versions
CREATE INDEX IF NOT EXISTS ix_maxdp_flow_versions_id ON maxdp_flow_versions(id);

-- Create maxdp_flow_executions table
CREATE TABLE IF NOT EXISTS maxdp_flow_executions (
    id SERIAL PRIMARY KEY,
    flow_id INTEGER NOT NULL REFERENCES maxdp_flows(id),
    version_id INTEGER REFERENCES maxdp_flow_versions(id),
    status executionstatus DEFAULT 'pending',
    execution_id VARCHAR(100) UNIQUE NOT NULL,
    trigger_type VARCHAR(50) NOT NULL,
    trigger_user_id UUID REFERENCES users(id),
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    duration_seconds INTEGER,
    logs TEXT,
    error_message TEXT,
    result_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for maxdp_flow_executions
CREATE INDEX IF NOT EXISTS ix_maxdp_flow_executions_id ON maxdp_flow_executions(id);

-- Create maxdp_workspace_permissions table
CREATE TABLE IF NOT EXISTS maxdp_workspace_permissions (
    id SERIAL PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES maxdp_workspaces(id),
    user_id UUID NOT NULL REFERENCES users(id),
    can_read BOOLEAN DEFAULT TRUE,
    can_write BOOLEAN DEFAULT FALSE,
    can_execute BOOLEAN DEFAULT FALSE,
    can_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL REFERENCES users(id)
);

-- Create index for maxdp_workspace_permissions
CREATE INDEX IF NOT EXISTS ix_maxdp_workspace_permissions_id ON maxdp_workspace_permissions(id);

-- Create maxdp_workspace_activities table
CREATE TABLE IF NOT EXISTS maxdp_workspace_activities (
    id SERIAL PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES maxdp_workspaces(id),
    user_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    description TEXT,
    activity_metadata TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for maxdp_workspace_activities
CREATE INDEX IF NOT EXISTS ix_maxdp_workspace_activities_id ON maxdp_workspace_activities(id);

-- Insert sample workspace for testing
INSERT INTO maxdp_workspaces (name, description, owner_type, owner_user_id, created_by)
SELECT 
    '기본 워크스페이스',
    'MAXDP 기본 워크스페이스입니다.',
    'user',
    u.id,
    u.id
FROM users u 
WHERE u.email = 'admin@test.com'
AND NOT EXISTS (SELECT 1 FROM maxdp_workspaces WHERE name = '기본 워크스페이스');

-- Create a sample flow
INSERT INTO maxdp_flows (name, description, workspace_id, owner_type, owner_user_id, created_by, status)
SELECT 
    '샘플 데이터 플로우',
    '데이터 처리를 위한 샘플 플로우입니다.',
    w.id,
    'user',
    u.id,
    u.id,
    'draft'
FROM users u, maxdp_workspaces w 
WHERE u.email = 'admin@test.com' 
AND w.name = '기본 워크스페이스'
AND NOT EXISTS (SELECT 1 FROM maxdp_flows WHERE name = '샘플 데이터 플로우');