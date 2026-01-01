/**
 * GraphQL Schema Definition
 * Defines all types, queries, and mutations for the Catalog API
 */

import gql from 'graphql-tag';

export const typeDefs = gql`
  # ============================================================================
  # SCALAR TYPES
  # ============================================================================

  scalar DateTime
  scalar JSON
  scalar UUID

  # ============================================================================
  # ENUMS
  # ============================================================================

  enum ApplicationType {
    SERVICE
    LIBRARY
    PLUGIN
    APPLICATION
    API
    FRAMEWORK
    TOOL
  }

  enum ApplicationSource {
    GITHUB
    NPM
    WORDPRESS
    GOOGLE_PLAY
    MAVEN
    PYPI
    API
  }

  enum DependencyType {
    RUNTIME
    DEV
    PEER
    OPTIONAL
  }

  enum CompatibilityStatus {
    COMPATIBLE
    INCOMPATIBLE
    UNKNOWN
    PARTIALLY
    UNTESTED
  }

  enum DifficultyLevel {
    BEGINNER
    INTERMEDIATE
    ADVANCED
    EXPERT
  }

  # ============================================================================
  # CORE TYPES
  # ============================================================================

  """
  Application represents any software solution: service, library, plugin, etc.
  """
  type Application {
    id: UUID!
    name: String!
    slug: String!
    description: String
    type: ApplicationType!
    source: ApplicationSource!
    sourceUrl: String!
    homepageUrl: String
    documentationUrl: String
    repositoryUrl: String
    license: String

    # Metadata
    author: String
    maintainers: [String!]!
    tags: [String!]!
    version: String
    latestVersion: String

    # Metrics
    stars: Int!
    downloads: Int!
    forks: Int!
    issuesCount: Int!
    contributorsCount: Int!

    # Status
    isActive: Boolean!
    isVerified: Boolean!
    lastUpdatedAt: DateTime
    lastCommitAt: DateTime

    # Timestamps
    createdAt: DateTime!
    updatedAt: DateTime!

    # Relationships (lazy loaded)
    capabilities: [Capability!]!
    dependencies: [Dependency!]!
    dependents: [Application!]!
    alternatives: [Alternative!]!
    compatibility: [CompatibilityResult!]!
    apiEndpoints: [ApiEndpoint!]!
    blueprints: [Blueprint!]!
  }

  """
  Capability represents a functionality or feature that applications can provide
  """
  type Capability {
    id: UUID!
    name: String!
    slug: String!
    description: String
    category: String!
    parent: Capability

    createdAt: DateTime!
    updatedAt: DateTime!

    # Relationships
    applications: [Application!]!
    children: [Capability!]!
  }

  """
  Dependency represents a relationship where one application depends on another
  """
  type Dependency {
    id: UUID!
    application: Application!
    dependsOn: Application!
    versionConstraint: String
    dependencyType: DependencyType!
    isRequired: Boolean!
    createdAt: DateTime!
  }

  """
  Alternative represents similar/competing applications
  """
  type Alternative {
    id: UUID!
    application: Application!
    alternative: Application!
    similarityScore: Float!
    useCaseOverlap: Float
    featureOverlap: Float
    comparisonNotes: String
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  """
  CompatibilityResult shows if two applications work well together
  """
  type CompatibilityResult {
    id: UUID!
    applicationA: Application!
    applicationB: Application!
    status: CompatibilityStatus!
    compatibilityScore: Float
    testedAt: DateTime
    testPassed: Boolean
    testResults: JSON
    knownIssues: [String!]!
    workarounds: [String!]!
    versionA: String
    versionB: String
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  """
  ApiEndpoint represents a single API endpoint of an application
  """
  type ApiEndpoint {
    id: UUID!
    application: Application!
    method: String!
    path: String!
    description: String
    openapiSpec: JSON
    requestSchema: JSON
    responseSchema: JSON
    authType: String
    authRequired: Boolean!
    rateLimitPerMinute: Int
    rateLimitPerHour: Int
    isDeprecated: Boolean!
    deprecatedAt: DateTime
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  """
  Blueprint is a pre-configured solution template
  """
  type Blueprint {
    id: UUID!
    name: String!
    slug: String!
    description: String
    useCase: String!
    category: String
    tags: [String!]!

    # Configuration
    components: JSON!
    workflow: JSON

    # Metadata
    isPublic: Boolean!
    isVerified: Boolean!

    # Metrics
    usageCount: Int!
    successRate: Float
    averageSetupTime: Int

    # Ratings
    ratingAverage: Float
    ratingCount: Int!

    # Cost
    estimatedCostMonthly: Float

    # Requirements
    requiredSkills: [String!]!
    difficultyLevel: DifficultyLevel

    createdAt: DateTime!
    updatedAt: DateTime!

    # Relationships
    applications: [Application!]!
    useCases: [UseCase!]!
    reviews: [Review!]!
  }

  """
  UseCase represents a problem or goal that can be solved
  """
  type UseCase {
    id: UUID!
    title: String!
    slug: String!
    description: String!
    category: String
    industry: String
    complexityScore: Int
    createdAt: DateTime!
    updatedAt: DateTime!

    # Relationships
    blueprints: [Blueprint!]!
  }

  """
  Review for applications or blueprints
  """
  type Review {
    id: UUID!
    targetType: String!
    targetId: UUID!
    rating: Int!
    title: String
    content: String
    authorName: String
    helpfulCount: Int!
    notHelpfulCount: Int!
    isVerifiedPurchase: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  # ============================================================================
  # INPUT TYPES
  # ============================================================================

  input CreateApplicationInput {
    name: String!
    slug: String!
    description: String
    type: ApplicationType!
    source: ApplicationSource!
    sourceUrl: String!
    homepageUrl: String
    documentationUrl: String
    repositoryUrl: String
    license: String
    author: String
    tags: [String!]
    version: String
  }

  input UpdateApplicationInput {
    name: String
    description: String
    homepageUrl: String
    documentationUrl: String
    license: String
    tags: [String!]
    version: String
    isActive: Boolean
  }

  input SearchFilter {
    type: [ApplicationType!]
    source: [ApplicationSource!]
    tags: [String!]
    capabilities: [UUID!]
    minStars: Int
    isVerified: Boolean
  }

  input CreateBlueprintInput {
    name: String!
    slug: String!
    description: String
    useCase: String!
    category: String
    tags: [String!]
    components: JSON!
    workflow: JSON
    requiredSkills: [String!]
    difficultyLevel: DifficultyLevel
    estimatedCostMonthly: Float
  }

  # ============================================================================
  # PAGINATION
  # ============================================================================

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
    totalCount: Int!
  }

  type ApplicationConnection {
    edges: [ApplicationEdge!]!
    pageInfo: PageInfo!
  }

  type ApplicationEdge {
    cursor: String!
    node: Application!
  }

  # ============================================================================
  # SEARCH RESULTS
  # ============================================================================

  type SearchResult {
    applications: [Application!]!
    blueprints: [Blueprint!]!
    totalCount: Int!
  }

  # ============================================================================
  # STATISTICS
  # ============================================================================

  type Statistics {
    totalApplications: Int!
    totalBlueprints: Int!
    totalCapabilities: Int!
    applicationsPerType: JSON!
    applicationsPerSource: JSON!
    topCapabilities: [CapabilityStats!]!
    topTags: [TagStats!]!
  }

  type CapabilityStats {
    capability: Capability!
    count: Int!
  }

  type TagStats {
    tag: String!
    count: Int!
  }

  # ============================================================================
  # QUERIES
  # ============================================================================

  type Query {
    # -------------------------------------------------------------------------
    # Applications
    # -------------------------------------------------------------------------

    """Get application by ID"""
    application(id: UUID!): Application

    """Get application by slug"""
    applicationBySlug(slug: String!): Application

    """List applications with pagination"""
    applications(
      first: Int = 20
      after: String
      filter: SearchFilter
      orderBy: String = "stars"
      orderDirection: String = "DESC"
    ): ApplicationConnection!

    """Search applications by semantic similarity"""
    searchApplications(
      query: String!
      limit: Int = 10
      threshold: Float = 0.7
    ): [Application!]!

    """Find alternatives to an application"""
    findAlternatives(
      applicationId: UUID!
      limit: Int = 5
    ): [Alternative!]!

    """Check compatibility between applications"""
    checkCompatibility(
      applicationIds: [UUID!]!
    ): [CompatibilityResult!]!

    # -------------------------------------------------------------------------
    # Capabilities
    # -------------------------------------------------------------------------

    """Get capability by ID"""
    capability(id: UUID!): Capability

    """List all capabilities"""
    capabilities(category: String): [Capability!]!

    """Get capability tree (hierarchical)"""
    capabilityTree: [Capability!]!

    # -------------------------------------------------------------------------
    # Blueprints
    # -------------------------------------------------------------------------

    """Get blueprint by ID"""
    blueprint(id: UUID!): Blueprint

    """Get blueprint by slug"""
    blueprintBySlug(slug: String!): Blueprint

    """List blueprints"""
    blueprints(
      category: String
      tags: [String!]
      limit: Int = 20
      offset: Int = 0
    ): [Blueprint!]!

    """Get recommended blueprints for use case"""
    recommendBlueprints(
      useCaseDescription: String!
      limit: Int = 5
    ): [Blueprint!]!

    # -------------------------------------------------------------------------
    # Use Cases
    # -------------------------------------------------------------------------

    """Get use case by ID"""
    useCase(id: UUID!): UseCase

    """List use cases"""
    useCases(category: String): [UseCase!]!

    # -------------------------------------------------------------------------
    # Search
    # -------------------------------------------------------------------------

    """Global search across all entities"""
    search(
      query: String!
      types: [String!]
      limit: Int = 20
    ): SearchResult!

    # -------------------------------------------------------------------------
    # Statistics
    # -------------------------------------------------------------------------

    """Get platform statistics"""
    statistics: Statistics!
  }

  # ============================================================================
  # MUTATIONS
  # ============================================================================

  type Mutation {
    # -------------------------------------------------------------------------
    # Applications
    # -------------------------------------------------------------------------

    """Create new application"""
    createApplication(input: CreateApplicationInput!): Application!

    """Update application"""
    updateApplication(
      id: UUID!
      input: UpdateApplicationInput!
    ): Application!

    """Delete application"""
    deleteApplication(id: UUID!): Boolean!

    """Add capability to application"""
    addCapabilityToApplication(
      applicationId: UUID!
      capabilityId: UUID!
      confidence: Float = 1.0
    ): Application!

    # -------------------------------------------------------------------------
    # Blueprints
    # -------------------------------------------------------------------------

    """Create new blueprint"""
    createBlueprint(input: CreateBlueprintInput!): Blueprint!

    """Update blueprint"""
    updateBlueprint(id: UUID!, input: JSON!): Blueprint!

    """Delete blueprint"""
    deleteBlueprint(id: UUID!): Boolean!

    # -------------------------------------------------------------------------
    # Reviews
    # -------------------------------------------------------------------------

    """Add review for application or blueprint"""
    addReview(
      targetType: String!
      targetId: UUID!
      rating: Int!
      title: String
      content: String
      authorName: String
    ): Review!

    # -------------------------------------------------------------------------
    # Compatibility
    # -------------------------------------------------------------------------

    """Record compatibility test result"""
    recordCompatibility(
      applicationAId: UUID!
      applicationBId: UUID!
      status: CompatibilityStatus!
      compatibilityScore: Float
      testResults: JSON
    ): CompatibilityResult!
  }

  # ============================================================================
  # SUBSCRIPTIONS (for real-time updates)
  # ============================================================================

  type Subscription {
    """Subscribe to new applications"""
    applicationAdded: Application!

    """Subscribe to blueprint updates"""
    blueprintUpdated(id: UUID!): Blueprint!
  }
`;
