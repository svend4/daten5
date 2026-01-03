// ============================================================================
// RATIONALIZATION PLATFORM - NEO4J GRAPH SCHEMA
// Application Knowledge Graph
// ============================================================================

// ============================================================================
// NODE TYPES (Labels)
// ============================================================================

// :Application - Software applications, libraries, services
// Properties:
//   - id: UUID (matches PostgreSQL)
//   - name: String
//   - type: String (service|library|plugin|application)
//   - source: String (github|npm|wordpress)
//   - stars: Integer
//   - version: String
//   - embedding: List[Float] (for ML)

// :Capability - What applications can do
// Properties:
//   - id: UUID
//   - name: String
//   - category: String
//   - description: String

// :Blueprint - Pre-configured solutions
// Properties:
//   - id: UUID
//   - name: String
//   - category: String
//   - usageCount: Integer
//   - rating: Float

// :UseCase - Problem descriptions
// Properties:
//   - id: UUID
//   - title: String
//   - category: String
//   - complexity: Integer

// :Technology - Tech stack tags (React, Python, etc.)
// Properties:
//   - name: String
//   - category: String (language|framework|platform)

// :Company - Organizations/companies
// Properties:
//   - name: String
//   - domain: String

// ============================================================================
// RELATIONSHIP TYPES
// ============================================================================

// Application relationships
// [:DEPENDS_ON] - Dependency relationship
//   Properties: versionConstraint, type (runtime|dev|peer)
//
// [:SIMILAR_TO] - Similar/alternative applications
//   Properties: similarityScore (0-1), useCase
//
// [:COMPATIBLE_WITH] - Compatibility relationship
//   Properties: compatibilityScore (0-1), tested, testDate
//
// [:INTEGRATES_WITH] - Direct integration support
//   Properties: integrationType (native|api|webhook), difficulty

// Capability relationships
// [:HAS_CAPABILITY] - Application provides capability
//   Properties: confidence (0-1), verified
//
// [:REQUIRES_CAPABILITY] - Dependency on capability
//   Properties: priority (required|optional)
//
// [:CHILD_OF] - Capability hierarchy
//   Properties: -

// Blueprint relationships
// [:USES_APPLICATION] - Blueprint includes application
//   Properties: order, configuration, required
//
// [:SOLVES_USE_CASE] - Blueprint solves problem
//   Properties: recommendationScore (0-1)

// Technology relationships
// [:BUILT_WITH] - Application uses technology
//   Properties: primary (boolean), version
//
// [:REQUIRES_TECH] - Technology dependency
//   Properties: minVersion, maxVersion

// Company relationships
// [:MAINTAINED_BY] - Ownership/maintenance
//   Properties: role (owner|maintainer|contributor)
//
// [:COMPETES_WITH] - Competitive relationship
//   Properties: marketShare

// ============================================================================
// CONSTRAINTS
// ============================================================================

// Unique constraints
CREATE CONSTRAINT application_id_unique IF NOT EXISTS
FOR (a:Application) REQUIRE a.id IS UNIQUE;

CREATE CONSTRAINT capability_id_unique IF NOT EXISTS
FOR (c:Capability) REQUIRE c.id IS UNIQUE;

CREATE CONSTRAINT blueprint_id_unique IF NOT EXISTS
FOR (b:Blueprint) REQUIRE b.id IS UNIQUE;

CREATE CONSTRAINT use_case_id_unique IF NOT EXISTS
FOR (u:UseCase) REQUIRE u.id IS UNIQUE;

CREATE CONSTRAINT technology_name_unique IF NOT EXISTS
FOR (t:Technology) REQUIRE t.name IS UNIQUE;

CREATE CONSTRAINT company_name_unique IF NOT EXISTS
FOR (c:Company) REQUIRE c.name IS UNIQUE;

// Existence constraints (require properties)
CREATE CONSTRAINT application_name_exists IF NOT EXISTS
FOR (a:Application) REQUIRE a.name IS NOT NULL;

CREATE CONSTRAINT capability_name_exists IF NOT EXISTS
FOR (c:Capability) REQUIRE c.name IS NOT NULL;

// ============================================================================
// INDEXES
// ============================================================================

// Full-text search indexes
CREATE FULLTEXT INDEX applicationNameSearch IF NOT EXISTS
FOR (a:Application) ON EACH [a.name, a.description];

CREATE FULLTEXT INDEX capabilitySearch IF NOT EXISTS
FOR (c:Capability) ON EACH [c.name, c.description];

CREATE FULLTEXT INDEX blueprintSearch IF NOT EXISTS
FOR (b:Blueprint) ON EACH [b.name, b.description];

// Property indexes for common queries
CREATE INDEX application_type IF NOT EXISTS
FOR (a:Application) ON (a.type);

CREATE INDEX application_source IF NOT EXISTS
FOR (a:Application) ON (a.source);

CREATE INDEX application_stars IF NOT EXISTS
FOR (a:Application) ON (a.stars);

CREATE INDEX capability_category IF NOT EXISTS
FOR (c:Capability) ON (c.category);

CREATE INDEX blueprint_rating IF NOT EXISTS
FOR (b:Blueprint) ON (b.rating);

// ============================================================================
// SAMPLE DATA - Example graph structure
// ============================================================================

// Create sample applications
CREATE (stripe:Application {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Stripe',
    type: 'service',
    source: 'api',
    description: 'Payment processing platform',
    stars: 5000,
    version: '2023.1'
})

CREATE (react:Application {
    id: '550e8400-e29b-41d4-a716-446655440002',
    name: 'React',
    type: 'library',
    source: 'github',
    description: 'JavaScript library for building user interfaces',
    stars: 200000,
    version: '18.2.0'
})

CREATE (nextjs:Application {
    id: '550e8400-e29b-41d4-a716-446655440003',
    name: 'Next.js',
    type: 'framework',
    source: 'github',
    description: 'React framework for production',
    stars: 100000,
    version: '14.0.0'
})

CREATE (postgresql:Application {
    id: '550e8400-e29b-41d4-a716-446655440004',
    name: 'PostgreSQL',
    type: 'database',
    source: 'github',
    description: 'Powerful, open source object-relational database',
    stars: 50000,
    version: '15.0'
})

CREATE (vercel:Application {
    id: '550e8400-e29b-41d4-a716-446655440005',
    name: 'Vercel',
    type: 'service',
    source: 'platform',
    description: 'Cloud platform for static sites and serverless functions',
    stars: 30000,
    version: '1.0'
});

// Create capabilities
CREATE (payment:Capability {
    id: '650e8400-e29b-41d4-a716-446655440001',
    name: 'Payment Processing',
    category: 'payment',
    description: 'Accept and process online payments'
})

CREATE (ui:Capability {
    id: '650e8400-e29b-41d4-a716-446655440002',
    name: 'UI Rendering',
    category: 'frontend',
    description: 'Render user interfaces'
})

CREATE (storage:Capability {
    id: '650e8400-e29b-41d4-a716-446655440003',
    name: 'Data Storage',
    category: 'storage',
    description: 'Store and retrieve data'
})

CREATE (hosting:Capability {
    id: '650e8400-e29b-41d4-a716-446655440004',
    name: 'Web Hosting',
    category: 'infrastructure',
    description: 'Host web applications'
});

// Create technologies
CREATE (javascript:Technology {
    name: 'JavaScript',
    category: 'language'
})

CREATE (typescript:Technology {
    name: 'TypeScript',
    category: 'language'
})

CREATE (python:Technology {
    name: 'Python',
    category: 'language'
});

// Create companies
CREATE (meta:Company {
    name: 'Meta',
    domain: 'facebook.com'
})

CREATE (vercelInc:Company {
    name: 'Vercel Inc',
    domain: 'vercel.com'
});

// ============================================================================
// RELATIONSHIPS - Connect the nodes
// ============================================================================

// Dependencies
MATCH (a:Application {name: 'Next.js'}), (b:Application {name: 'React'})
CREATE (a)-[:DEPENDS_ON {versionConstraint: '>=18.0.0', type: 'runtime'}]->(b);

// Capabilities
MATCH (a:Application {name: 'Stripe'}), (c:Capability {name: 'Payment Processing'})
CREATE (a)-[:HAS_CAPABILITY {confidence: 1.0, verified: true}]->(c);

MATCH (a:Application {name: 'React'}), (c:Capability {name: 'UI Rendering'})
CREATE (a)-[:HAS_CAPABILITY {confidence: 1.0, verified: true}]->(c);

MATCH (a:Application {name: 'PostgreSQL'}), (c:Capability {name: 'Data Storage'})
CREATE (a)-[:HAS_CAPABILITY {confidence: 1.0, verified: true}]->(c);

MATCH (a:Application {name: 'Vercel'}), (c:Capability {name: 'Web Hosting'})
CREATE (a)-[:HAS_CAPABILITY {confidence: 1.0, verified: true}]->(c);

// Technologies
MATCH (a:Application {name: 'React'}), (t:Technology {name: 'JavaScript'})
CREATE (a)-[:BUILT_WITH {primary: true}]->(t);

MATCH (a:Application {name: 'Next.js'}), (t:Technology {name: 'TypeScript'})
CREATE (a)-[:BUILT_WITH {primary: true}]->(t);

// Maintainers
MATCH (a:Application {name: 'React'}), (c:Company {name: 'Meta'})
CREATE (c)-[:MAINTAINS {role: 'owner'}]->(a);

MATCH (a:Application {name: 'Next.js'}), (c:Company {name: 'Vercel Inc'})
CREATE (c)-[:MAINTAINS {role: 'owner'}]->(a);

MATCH (a:Application {name: 'Vercel'}), (c:Company {name: 'Vercel Inc'})
CREATE (c)-[:MAINTAINS {role: 'owner'}]->(a);

// Compatibility
MATCH (a:Application {name: 'Next.js'}), (b:Application {name: 'Vercel'})
CREATE (a)-[:COMPATIBLE_WITH {compatibilityScore: 1.0, tested: true}]->(b);

MATCH (a:Application {name: 'Next.js'}), (b:Application {name: 'PostgreSQL'})
CREATE (a)-[:COMPATIBLE_WITH {compatibilityScore: 0.95, tested: true}]->(b);

// Integrations
MATCH (a:Application {name: 'Stripe'}), (b:Application {name: 'React'})
CREATE (a)-[:INTEGRATES_WITH {integrationType: 'api', difficulty: 'easy'}]->(b);

// ============================================================================
// USEFUL QUERIES - Common patterns
// ============================================================================

// Query 1: Find all dependencies of an application (recursive)
// MATCH path = (app:Application {name: 'Next.js'})-[:DEPENDS_ON*]->(dep:Application)
// RETURN app.name, collect(dep.name) as dependencies;

// Query 2: Find applications by capability
// MATCH (app:Application)-[:HAS_CAPABILITY]->(cap:Capability {name: 'Payment Processing'})
// RETURN app.name, app.description, app.stars
// ORDER BY app.stars DESC;

// Query 3: Find similar applications (alternatives)
// MATCH (app:Application {name: 'Stripe'})-[:SIMILAR_TO]->(alt:Application)
// RETURN alt.name, alt.description
// ORDER BY alt.stars DESC;

// Query 4: Find complete stack for a use case
// MATCH (uc:UseCase {title: 'E-commerce'})<-[:SOLVES_USE_CASE]-(bp:Blueprint)
// MATCH (bp)-[:USES_APPLICATION]->(app:Application)
// RETURN bp.name, collect(app.name) as stack;

// Query 5: Find shortest integration path between two applications
// MATCH path = shortestPath(
//   (a:Application {name: 'React'})-[*]-(b:Application {name: 'PostgreSQL'})
// )
// RETURN path;

// Query 6: Find most popular technology stack
// MATCH (app:Application)-[:BUILT_WITH]->(tech:Technology)
// WITH tech, count(app) as usage_count
// RETURN tech.name, usage_count
// ORDER BY usage_count DESC
// LIMIT 10;

// Query 7: Find compatibility clusters
// MATCH (a:Application)-[c:COMPATIBLE_WITH]-(b:Application)
// WHERE c.compatibilityScore > 0.9
// RETURN a.name, collect(b.name) as compatible_apps;

// Query 8: Recommend applications based on current stack
// MATCH (current:Application {name: 'React'})
// MATCH (current)-[:DEPENDS_ON|COMPATIBLE_WITH|INTEGRATES_WITH*1..2]-(recommended:Application)
// WHERE NOT (current)-[:DEPENDS_ON]->(recommended) // Exclude already used
// RETURN DISTINCT recommended.name, recommended.description, recommended.stars
// ORDER BY recommended.stars DESC
// LIMIT 5;

// Query 9: Find capability gaps in a blueprint
// MATCH (bp:Blueprint {name: 'E-commerce Starter'})-[:USES_APPLICATION]->(app:Application)
// MATCH (app)-[:HAS_CAPABILITY]->(cap:Capability)
// WITH bp, collect(DISTINCT cap) as covered_caps
// MATCH (all_caps:Capability {category: 'payment'})
// WHERE NOT all_caps IN covered_caps
// RETURN all_caps.name as missing_capability;

// Query 10: Analyze technology ecosystem
// MATCH (tech:Technology {name: 'JavaScript'})<-[:BUILT_WITH]-(app:Application)
// MATCH (app)-[:HAS_CAPABILITY]->(cap:Capability)
// RETURN cap.category, count(DISTINCT app) as app_count
// ORDER BY app_count DESC;

// ============================================================================
// GRAPH ALGORITHMS - Advanced analytics
// ============================================================================

// PageRank - Find most influential applications
// CALL gds.pageRank.stream('myGraph')
// YIELD nodeId, score
// RETURN gds.util.asNode(nodeId).name AS name, score
// ORDER BY score DESC;

// Community Detection - Find application clusters
// CALL gds.louvain.stream('myGraph')
// YIELD nodeId, communityId
// RETURN gds.util.asNode(nodeId).name AS name, communityId
// ORDER BY communityId;

// Node Similarity - Find similar applications by relationships
// CALL gds.nodeSimilarity.stream('myGraph')
// YIELD node1, node2, similarity
// RETURN gds.util.asNode(node1).name AS app1,
//        gds.util.asNode(node2).name AS app2,
//        similarity
// ORDER BY similarity DESC;

// ============================================================================
// STORED PROCEDURES - Custom functions
// ============================================================================

// Procedure: Find complete solution for use case
// CALL db.labels() YIELD label
// RETURN label;

// ============================================================================
// MAINTENANCE QUERIES
// ============================================================================

// Count all nodes by type
// MATCH (n)
// RETURN labels(n) as type, count(*) as count
// ORDER BY count DESC;

// Count all relationships by type
// MATCH ()-[r]->()
// RETURN type(r) as relationship, count(*) as count
// ORDER BY count DESC;

// Find orphaned nodes (no relationships)
// MATCH (n)
// WHERE NOT (n)--()
// RETURN labels(n), n.name, n.id;

// Delete all data (use with caution!)
// MATCH (n) DETACH DELETE n;

// ============================================================================
// EXPORT COMMANDS
// ============================================================================

// Export to JSON
// CALL apoc.export.json.all("export.json", {useTypes:true})

// Export specific subgraph
// CALL apoc.export.json.query(
//   "MATCH (a:Application)-[r]->(b) RETURN a,r,b",
//   "applications.json"
// )
