/**
 * Feed GraphQL TypeDefs
 */

export const feedTypeDefs = `#graphql
  type FeedConnection {
    articles: [Article!]!
    nextCursor: String
    hasMore: Boolean!
  }

  extend type Query {
    feed(limit: Int, cursor: String): FeedConnection!
  }
`;
