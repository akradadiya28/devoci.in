/**
 * RSS Admin GraphQL TypeDefs
 */

export const rssTypeDefs = `#graphql
  type RssSource {
    id: ID!
    url: String!
    name: String!
    category: String!
    description: String
    isActive: Boolean!
    updateFrequency: Int!
    priority: Float!
    tags: [String!]!
    targetRoles: [String!]!
    quality: Float!
    trustScore: Float!
    lastFetchAt: String
    nextFetchAt: String
    articleCount: Int!
    errorCount: Int!
    consecutiveErrors: Int!
    lastError: String
    createdAt: String!
    updatedAt: String!
  }

  input CreateRssSourceInput {
    url: String!
    name: String!
    category: String!
    description: String
    tags: [String!]
    targetRoles: [String!]
    updateFrequency: Int
    priority: Float
  }

  extend type Query {
    rssSources(activeOnly: Boolean): [RssSource!]!
    rssSource(id: ID!): RssSource
  }

  extend type Mutation {
    createRssSource(input: CreateRssSourceInput!): RssSource!
    toggleRssSource(id: ID!, active: Boolean!): RssSource!
    deleteRssSource(id: ID!): Boolean!
    triggerRssFetch: Boolean!
  }
`;
