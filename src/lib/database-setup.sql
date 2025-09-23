-- Tabela para chaves API
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    key VARCHAR(255) UNIQUE NOT NULL,
    permissions TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used TIMESTAMP WITH TIME ZONE,
    active BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    rate_limit INTEGER DEFAULT 1000,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Tabela para logs de uso da API
CREATE TABLE IF NOT EXISTS api_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    response_status INTEGER,
    response_time INTEGER,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    request_body JSONB,
    response_body JSONB
);

-- Tabela para conexões ERP
CREATE TABLE IF NOT EXISTS erp_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- SAP, Oracle, Protheus, Senior, etc
    endpoint VARCHAR(500) NOT NULL,
    username VARCHAR(255),
    password_encrypted TEXT,
    status VARCHAR(20) DEFAULT 'disconnected', -- connected, disconnected, error
    last_sync TIMESTAMP WITH TIME ZONE,
    modules TEXT[] DEFAULT '{}',
    active BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Tabela para logs de sincronização ERP
CREATE TABLE IF NOT EXISTS erp_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES erp_connections(id) ON DELETE CASCADE,
    module VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL, -- success, error, running
    records_synced INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    error_details JSONB,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER
);

-- Tabela para workflows automatizados
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(50) NOT NULL, -- schedule, webhook, event, manual
    trigger_config JSONB DEFAULT '{}',
    steps JSONB NOT NULL DEFAULT '[]',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    last_run TIMESTAMP WITH TIME ZONE,
    run_count INTEGER DEFAULT 0
);

-- Tabela para execuções de workflow
CREATE TABLE IF NOT EXISTS workflow_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL, -- running, completed, failed, cancelled
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    steps_executed JSONB DEFAULT '[]'
);

-- Tabela para chat interno
CREATE TABLE IF NOT EXISTS chat_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(20) DEFAULT 'group', -- group, direct, announcement
    private BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para membros do chat
CREATE TABLE IF NOT EXISTS chat_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES chat_channels(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member', -- admin, moderator, member
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(channel_id, user_id)
);

-- Tabela para mensagens do chat
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES chat_channels(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text', -- text, image, file, system
    attachments JSONB DEFAULT '[]',
    reply_to UUID REFERENCES chat_messages(id) ON DELETE SET NULL,
    edited_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para relatórios PDF
CREATE TABLE IF NOT EXISTS pdf_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- individual, departmental, executive
    template JSONB NOT NULL,
    parameters JSONB DEFAULT '{}',
    file_path VARCHAR(500),
    status VARCHAR(20) DEFAULT 'pending', -- pending, generating, completed, failed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    file_size INTEGER,
    download_count INTEGER DEFAULT 0
);

-- Tabela para métricas de avaliação
CREATE TABLE IF NOT EXISTS evaluation_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    department VARCHAR(100),
    position VARCHAR(100),
    overall_score DECIMAL(3,2),
    metrics JSONB NOT NULL DEFAULT '{}',
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, period_start, period_end)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key);
CREATE INDEX IF NOT EXISTS idx_api_usage_api_key_id ON api_usage(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_timestamp ON api_usage(timestamp);
CREATE INDEX IF NOT EXISTS idx_erp_connections_active ON erp_connections(active);
CREATE INDEX IF NOT EXISTS idx_erp_sync_logs_connection_id ON erp_sync_logs(connection_id);
CREATE INDEX IF NOT EXISTS idx_workflows_active ON workflows(active);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_id ON chat_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_members_user_id ON chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_pdf_reports_created_by ON pdf_reports(created_by);
CREATE INDEX IF NOT EXISTS idx_evaluation_metrics_user_id ON evaluation_metrics(user_id);

-- RLS Policies
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_metrics ENABLE ROW LEVEL SECURITY;

-- Políticas RLS básicas (admins podem ver tudo)
CREATE POLICY "Admins can manage API keys" ON api_keys FOR ALL USING (
    EXISTS (
        SELECT 1 FROM users_unified 
        WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER')
    )
);

CREATE POLICY "Users can see their own API keys" ON api_keys FOR SELECT USING (
    user_id = auth.uid()
);

-- Políticas similares para outras tabelas
CREATE POLICY "Admins can manage ERP connections" ON erp_connections FOR ALL USING (
    EXISTS (
        SELECT 1 FROM users_unified 
        WHERE id = auth.uid() AND role = 'ADMIN'
    )
);

CREATE POLICY "Users can see chat channels they're members of" ON chat_channels FOR SELECT USING (
    id IN (
        SELECT channel_id FROM chat_members WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can see messages in their channels" ON chat_messages FOR SELECT USING (
    channel_id IN (
        SELECT channel_id FROM chat_members WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert messages in their channels" ON chat_messages FOR INSERT WITH CHECK (
    channel_id IN (
        SELECT channel_id FROM chat_members WHERE user_id = auth.uid()
    ) AND user_id = auth.uid()
);

-- Funções para triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para atualizar updated_at
CREATE TRIGGER update_erp_connections_updated_at BEFORE UPDATE ON erp_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_channels_updated_at BEFORE UPDATE ON chat_channels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
