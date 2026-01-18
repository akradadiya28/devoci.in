/**
 * Engagement GraphQL TypeDefs
 */

export const engagementTypeDefs = `#graphql
  type Engagement {
    id: ID!
    userId: String!
    articleId: String!
    type: String!
    timeSpent: Int
    createdAt: String!
  }

  type StreakResult {
    streakCount: Int!
    broken: Boolean!
  }

  input ShareInput {
    type: String! # MILESTONE | STREAK | STATS | ARTICLE
    itemId: String! # badgeId | streakId | weekId | articleId
    platform: String! # twitter | linkedin | email | whatsapp
    customMessage: String
  }

  type ShareResult {
    success: Boolean!
    shareUrl: String
    message: String
    pointsAwarded: Int
  }

  extend type Mutation {
    viewArticle(articleId: ID!): Boolean!
    saveArticle(articleId: ID!): Boolean!
    shareArticle(articleId: ID!, platform: String!): Boolean!
    
    shareAchievement(input: ShareInput!): ShareResult!
  }

  type LeaderboardEntry {
    rank: Int!
    userId: ID!
    username: String
    avatarUrl: String
    value: Int! # score, streak count, articles read
    meta: String # badge count, streak info etc
  }

  enum LeaderboardType {
    STREAK
    WEEKLY_READERS
    MOST_ARTICLES
  }

  enum LeaderboardPeriod {
    WEEKLY
    ALL_TIME
  }

  extend type Query {
    myEngagement: [Engagement]
    leaderboard(type: LeaderboardType!, period: LeaderboardPeriod, limit: Int): [LeaderboardEntry]!
  }
`;
