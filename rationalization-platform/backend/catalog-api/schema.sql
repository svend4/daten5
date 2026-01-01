-- ============================================================================
-- RATIONALIZATION PLATFORM - DATABASE SCHEMA
-- Universal Catalog for Digital Solutions
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- CORE ENTITIES
-- ============================================================================

-- Applications/Services/Libraries catalog
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL, -- 'service', 'library', 'plugin', 'application', 'api'
    source VARCHAR(50) NOT NULL, -- 'github', 'npm', 'wordpress', 'google-play', etc.
    source_url TEXT NOT NULL,
    homepage_url TEXT,
    documentation_url TEXT,
    repository_url TEXT,
    license VARCHAR(100),

    -- Metadata
    author VARCHAR(255),
    maintainers JSONB DEFAULT '[]'::jsonb,
    tags TEXT[] DEFAULT '{}',
    version VARCHAR(50),
    latest_version VARCHAR(50),

    -- Metrics
    stars INTEGER DEFAULT 0,
    downloads INTEGER DEFAULT 0,
    forks INTEGER DEFAULT 0,
    issues_count INTEGER DEFAULT 0,
    contributors_count INTEGER DEFAULT 0,

    -- Status
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    last_updated_at TIMESTAMP,
    last_commit_at TIMESTAMP,

    -- AI/ML features
    embedding vector(1536), -- OpenAI ada-002 embeddings

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Indexes
    CONSTRAINT valid_type CHECK (type IN ('service', 'library', 'plugin', 'application', 'api', 'framework', 'tool'))
);

CREATE INDEX idx_applications_slug ON applications(slug);
CREATE INDEX idx_applications_type ON applications(type);
CREATE INDEX idx_applications_source ON applications(source);
CREATE INDEX idx_applications_tags ON applications USING GIN(tags);
CREATE INDEX idx_applications_embedding ON applications USING ivfflat(embedding vector_cosine_ops);
CREATE INDEX idx_applications_name_trgm ON applications USING GIN(name gin_trgm_ops);
CREATE INDEX idx_applications_updated ON applications(updated_at DESC);

-- ============================================================================
-- CAPABILITIES - What each application can do
-- ============================================================================

CREATE TABLE capabilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(100) NOT NULL, -- 'authentication', 'payment', 'storage', etc.
    parent_id UUID REFERENCES capabilities(id),

    -- AI features
    embedding vector(1536),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_capabilities_category ON capabilities(category);
CREATE INDEX idx_capabilities_parent ON capabilities(parent_id);
CREATE INDEX idx_capabilities_embedding ON capabilities USING ivfflat(embedding vector_cosine_ops);

-- Junction table: Applications <-> Capabilities
CREATE TABLE application_capabilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    capability_id UUID NOT NULL REFERENCES capabilities(id) ON DELETE CASCADE,
    confidence FLOAT DEFAULT 1.0, -- AI confidence score (0-1)
    verified BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(application_id, capability_id)
);

CREATE INDEX idx_app_capabilities_app ON application_capabilities(application_id);
CREATE INDEX idx_app_capabilities_cap ON application_capabilities(capability_id);
CREATE INDEX idx_app_capabilities_confidence ON application_capabilities(confidence DESC);

-- ============================================================================
-- API SPECIFICATIONS
-- ============================================================================

CREATE TABLE api_endpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,

    -- Endpoint details
    method VARCHAR(10) NOT NULL, -- GET, POST, PUT, DELETE, etc.
    path TEXT NOT NULL,
    description TEXT,

    -- OpenAPI/Swagger spec
    openapi_spec JSONB,

    -- Request/Response schemas
    request_schema JSONB,
    response_schema JSONB,

    -- Authentication
    auth_type VARCHAR(50), -- 'bearer', 'api-key', 'oauth2', 'basic', etc.
    auth_required BOOLEAN DEFAULT true,

    -- Rate limiting
    rate_limit_per_minute INTEGER,
    rate_limit_per_hour INTEGER,

    -- Metadata
    is_deprecated BOOLEAN DEFAULT false,
    deprecated_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_endpoints_app ON api_endpoints(application_id);
CREATE INDEX idx_api_endpoints_method ON api_endpoints(method);

-- ============================================================================
-- DEPENDENCIES
-- ============================================================================

CREATE TABLE dependencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    depends_on_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,

    -- Dependency details
    version_constraint VARCHAR(100), -- e.g., "^1.2.0", ">=2.0.0"
    dependency_type VARCHAR(50) NOT NULL, -- 'runtime', 'dev', 'peer', 'optional'
    is_required BOOLEAN DEFAULT true,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(application_id, depends_on_id),
    CONSTRAINT no_self_dependency CHECK (application_id != depends_on_id)
);

CREATE INDEX idx_dependencies_app ON dependencies(application_id);
CREATE INDEX idx_dependencies_depends ON dependencies(depends_on_id);
CREATE INDEX idx_dependencies_type ON dependencies(dependency_type);

-- ============================================================================
-- ALTERNATIVES - Competing/similar solutions
-- ============================================================================

CREATE TABLE alternatives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    alternative_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,

    -- Similarity metrics
    similarity_score FLOAT DEFAULT 0.5, -- 0-1, calculated by AI
    use_case_overlap FLOAT, -- 0-1
    feature_overlap FLOAT, -- 0-1

    -- Comparison metadata
    comparison_notes TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(application_id, alternative_id),
    CONSTRAINT no_self_alternative CHECK (application_id != alternative_id)
);

CREATE INDEX idx_alternatives_app ON alternatives(application_id);
CREATE INDEX idx_alternatives_alt ON alternatives(alternative_id);
CREATE INDEX idx_alternatives_score ON alternatives(similarity_score DESC);

-- ============================================================================
-- COMPATIBILITY MATRIX
-- ============================================================================

CREATE TABLE compatibility (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_a_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    application_b_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,

    -- Compatibility status
    status VARCHAR(50) NOT NULL, -- 'compatible', 'incompatible', 'unknown', 'partially'
    compatibility_score FLOAT, -- 0-1

    -- Test results
    tested_at TIMESTAMP,
    test_passed BOOLEAN,
    test_results JSONB,

    -- Issues
    known_issues TEXT[],
    workarounds TEXT[],

    -- Versions tested
    version_a VARCHAR(50),
    version_b VARCHAR(50),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_status CHECK (status IN ('compatible', 'incompatible', 'unknown', 'partially', 'untested')),
    CONSTRAINT ordered_pair CHECK (application_a_id < application_b_id) -- Ensure unique unordered pairs
);

CREATE INDEX idx_compatibility_a ON compatibility(application_a_id);
CREATE INDEX idx_compatibility_b ON compatibility(application_b_id);
CREATE INDEX idx_compatibility_status ON compatibility(status);
CREATE INDEX idx_compatibility_score ON compatibility(compatibility_score DESC);

-- ============================================================================
-- BLUEPRINTS - Pre-configured solutions
-- ============================================================================

CREATE TABLE blueprints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,

    -- Use case
    use_case VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    tags TEXT[] DEFAULT '{}',

    -- Configuration
    components JSONB NOT NULL, -- Array of application IDs with configs
    workflow JSONB, -- Step-by-step execution plan

    -- Metadata
    author_id UUID, -- User who created
    is_public BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,

    -- Metrics
    usage_count INTEGER DEFAULT 0,
    success_rate FLOAT, -- 0-1
    average_setup_time INTEGER, -- in minutes

    -- Ratings
    rating_average FLOAT, -- 1-5
    rating_count INTEGER DEFAULT 0,

    -- Cost estimate
    estimated_cost_monthly DECIMAL(10, 2),

    -- Requirements
    required_skills TEXT[],
    difficulty_level VARCHAR(20), -- 'beginner', 'intermediate', 'advanced'

    -- AI features
    embedding vector(1536),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_difficulty CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced', 'expert'))
);

CREATE INDEX idx_blueprints_slug ON blueprints(slug);
CREATE INDEX idx_blueprints_category ON blueprints(category);
CREATE INDEX idx_blueprints_tags ON blueprints USING GIN(tags);
CREATE INDEX idx_blueprints_rating ON blueprints(rating_average DESC);
CREATE INDEX idx_blueprints_usage ON blueprints(usage_count DESC);
CREATE INDEX idx_blueprints_embedding ON blueprints USING ivfflat(embedding vector_cosine_ops);

-- Junction table: Blueprints <-> Applications
CREATE TABLE blueprint_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,

    -- Configuration for this specific component
    configuration JSONB,
    execution_order INTEGER NOT NULL,
    is_required BOOLEAN DEFAULT true,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(blueprint_id, application_id)
);

CREATE INDEX idx_blueprint_apps_blueprint ON blueprint_applications(blueprint_id);
CREATE INDEX idx_blueprint_apps_app ON blueprint_applications(application_id);
CREATE INDEX idx_blueprint_apps_order ON blueprint_applications(execution_order);

-- ============================================================================
-- USE CASES - Problem descriptions
-- ============================================================================

CREATE TABLE use_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT NOT NULL,

    -- Classification
    category VARCHAR(100),
    industry VARCHAR(100),

    -- Complexity
    complexity_score INTEGER, -- 1-10

    -- AI features
    embedding vector(1536),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_use_cases_slug ON use_cases(slug);
CREATE INDEX idx_use_cases_category ON use_cases(category);
CREATE INDEX idx_use_cases_embedding ON use_cases USING ivfflat(embedding vector_cosine_ops);

-- Junction: Use Cases <-> Blueprints (one use case can have multiple solutions)
CREATE TABLE use_case_blueprints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    use_case_id UUID NOT NULL REFERENCES use_cases(id) ON DELETE CASCADE,
    blueprint_id UUID NOT NULL REFERENCES blueprints(id) ON DELETE CASCADE,

    -- Ranking
    recommendation_score FLOAT DEFAULT 0.5, -- AI-calculated

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(use_case_id, blueprint_id)
);

CREATE INDEX idx_use_case_blueprints_case ON use_case_blueprints(use_case_id);
CREATE INDEX idx_use_case_blueprints_blueprint ON use_case_blueprints(blueprint_id);

-- ============================================================================
-- REVIEWS & RATINGS
-- ============================================================================

CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Review target (polymorphic)
    target_type VARCHAR(50) NOT NULL, -- 'application', 'blueprint'
    target_id UUID NOT NULL,

    -- Review content
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title VARCHAR(255),
    content TEXT,

    -- Metadata
    author_id UUID, -- User ID
    author_name VARCHAR(255),

    -- Helpful votes
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,

    -- Verification
    is_verified_purchase BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_target_type CHECK (target_type IN ('application', 'blueprint'))
);

CREATE INDEX idx_reviews_target ON reviews(target_type, target_id);
CREATE INDEX idx_reviews_rating ON reviews(rating DESC);
CREATE INDEX idx_reviews_created ON reviews(created_at DESC);

-- ============================================================================
-- SEARCH HISTORY & ANALYTICS
-- ============================================================================

CREATE TABLE search_queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query TEXT NOT NULL,

    -- Context
    user_id UUID,
    session_id VARCHAR(255),

    -- Results
    results_count INTEGER,
    results_clicked UUID[], -- Application/Blueprint IDs

    -- AI processing
    processed_query TEXT, -- After NLP processing
    intent VARCHAR(100), -- 'find-application', 'compare', 'get-blueprint', etc.
    extracted_capabilities UUID[], -- Capability IDs

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_search_queries_query ON search_queries USING GIN(to_tsvector('english', query));
CREATE INDEX idx_search_queries_created ON search_queries(created_at DESC);

-- ============================================================================
-- CRAWLER METADATA
-- ============================================================================

CREATE TABLE crawler_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Crawler info
    source VARCHAR(50) NOT NULL, -- 'github', 'npm', etc.
    status VARCHAR(50) NOT NULL, -- 'running', 'completed', 'failed'

    -- Statistics
    items_discovered INTEGER DEFAULT 0,
    items_processed INTEGER DEFAULT 0,
    items_updated INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,

    -- Timing
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    duration_seconds INTEGER,

    -- Error tracking
    errors JSONB,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_crawler_status CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled'))
);

CREATE INDEX idx_crawler_runs_source ON crawler_runs(source);
CREATE INDEX idx_crawler_runs_status ON crawler_runs(status);
CREATE INDEX idx_crawler_runs_started ON crawler_runs(started_at DESC);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables with updated_at
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_capabilities_updated_at BEFORE UPDATE ON capabilities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blueprints_updated_at BEFORE UPDATE ON blueprints
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_use_cases_updated_at BEFORE UPDATE ON use_cases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Semantic search function using vector embeddings
CREATE OR REPLACE FUNCTION semantic_search_applications(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.7,
    max_results int DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    name VARCHAR(255),
    description TEXT,
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.name,
        a.description,
        1 - (a.embedding <=> query_embedding) as similarity
    FROM applications a
    WHERE 1 - (a.embedding <=> query_embedding) > match_threshold
    ORDER BY a.embedding <=> query_embedding
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SEED DATA - Initial capabilities taxonomy
-- ============================================================================

-- Core capability categories
INSERT INTO capabilities (name, slug, description, category) VALUES
-- Authentication & Authorization
('User Authentication', 'user-authentication', 'User login and identity verification', 'authentication'),
('OAuth Integration', 'oauth-integration', 'OAuth 2.0 authentication provider', 'authentication'),
('Multi-Factor Authentication', 'mfa', 'Two-factor and multi-factor authentication', 'authentication'),
('Role-Based Access Control', 'rbac', 'Permission and role management', 'authentication'),

-- Payment Processing
('Payment Processing', 'payment-processing', 'Accept and process payments', 'payment'),
('Subscription Management', 'subscription-management', 'Recurring payment handling', 'payment'),
('Invoice Generation', 'invoice-generation', 'Create and manage invoices', 'payment'),

-- Data Storage
('Database', 'database', 'Data persistence and storage', 'storage'),
('File Storage', 'file-storage', 'Upload and store files', 'storage'),
('Caching', 'caching', 'Data caching for performance', 'storage'),

-- Communication
('Email Sending', 'email-sending', 'Send transactional and marketing emails', 'communication'),
('SMS Messaging', 'sms-messaging', 'Send SMS notifications', 'communication'),
('Push Notifications', 'push-notifications', 'Mobile and web push notifications', 'communication'),
('Real-Time Chat', 'real-time-chat', 'Live chat functionality', 'communication'),

-- Analytics
('Web Analytics', 'web-analytics', 'Track website traffic and user behavior', 'analytics'),
('Event Tracking', 'event-tracking', 'Custom event tracking', 'analytics'),
('A/B Testing', 'ab-testing', 'Experiment and variant testing', 'analytics'),

-- API & Integration
('REST API', 'rest-api', 'RESTful API interface', 'api'),
('GraphQL API', 'graphql-api', 'GraphQL query interface', 'api'),
('Webhook Support', 'webhook-support', 'Event-driven webhooks', 'api'),

-- Search
('Full-Text Search', 'full-text-search', 'Advanced text search capabilities', 'search'),
('Semantic Search', 'semantic-search', 'AI-powered semantic search', 'search'),
('Autocomplete', 'autocomplete', 'Search suggestions and autocomplete', 'search'),

-- Media
('Image Processing', 'image-processing', 'Resize, crop, and transform images', 'media'),
('Video Processing', 'video-processing', 'Video encoding and streaming', 'media'),
('PDF Generation', 'pdf-generation', 'Create PDF documents', 'media');

-- ============================================================================
-- VIEWS - Useful queries
-- ============================================================================

-- Popular applications view
CREATE VIEW popular_applications AS
SELECT
    a.*,
    COUNT(DISTINCT ac.capability_id) as capabilities_count,
    COUNT(DISTINCT d.depends_on_id) as dependencies_count,
    AVG(r.rating) as average_rating,
    COUNT(DISTINCT r.id) as review_count
FROM applications a
LEFT JOIN application_capabilities ac ON a.id = ac.application_id
LEFT JOIN dependencies d ON a.id = d.application_id
LEFT JOIN reviews r ON r.target_type = 'application' AND r.target_id = a.id
GROUP BY a.id
ORDER BY a.stars DESC, a.downloads DESC;

-- Blueprint recommendations view
CREATE VIEW blueprint_recommendations AS
SELECT
    b.*,
    COUNT(DISTINCT ba.application_id) as component_count,
    AVG(r.rating) as average_rating,
    COUNT(DISTINCT r.id) as review_count
FROM blueprints b
LEFT JOIN blueprint_applications ba ON b.id = ba.blueprint_id
LEFT JOIN reviews r ON r.target_type = 'blueprint' AND r.target_id = b.id
WHERE b.is_public = true
GROUP BY b.id
ORDER BY b.rating_average DESC, b.usage_count DESC;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE applications IS 'Universal catalog of all digital solutions';
COMMENT ON TABLE capabilities IS 'Hierarchical taxonomy of functionalities';
COMMENT ON TABLE blueprints IS 'Pre-configured solution templates';
COMMENT ON TABLE compatibility IS 'Compatibility matrix between applications';
COMMENT ON TABLE api_endpoints IS 'API endpoint specifications';

-- ============================================================================
-- GRANTS (adjust based on your user roles)
-- ============================================================================

-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
