/**
 * Article GraphQL TypeDefs
 */

export const articleTypeDefs = `#graphql
  type TargetRole {
    role: String!
    weight: Float!
  }

  type Article {
    id: ID!
    title: String!
    description: String!
    url: String!
    imageUrl: String
    sourceName: String!
    author: String
    publishedAt: String!
    qualityScore: Float!
    targetRoles: [TargetRole!]!
    skillLevel: SkillLevel!
    tags: [String!]!
    views: Int!
    saves: Int!
  }

  type ArticleConnection {
    articles: [Article!]!
    nextCursor: String
    hasMore: Boolean!
  }

  extend type Query {
    articles(
      limit: Int
      cursor: String
      roles: [String]
      tags: [String]
      skillLevel: String
      minQuality: Int
    ): ArticleConnection!
    
    article(id: ID!): Article
    
    trending(days: Int, limit: Int): [Article!]!
  }

  extend type Mutation {
    viewArticle(id: ID!): Boolean!
    saveArticle(id: ID!, save: Boolean!): Boolean!
  }
`;
