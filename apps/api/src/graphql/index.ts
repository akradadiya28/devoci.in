/**
 * GraphQL Schema - Entry Point
 * Combines all modules
 */

import { authTypeDefs, authResolvers } from './auth';
import { articleTypeDefs, articleResolvers } from './article';
import { feedTypeDefs, feedResolvers } from './feed';
import { rssTypeDefs, rssResolvers } from './rss';
import { engagementTypeDefs, engagementResolvers } from './engagement/index';
import { notificationTypeDefs, notificationResolvers } from './notification/index';
import { premiumTypeDefs, premiumResolvers } from './premium/index';
import { adminTypeDefs, adminResolvers } from './admin/index';
import GraphQLJSON from 'graphql-type-json';

// Base types
const baseTypeDefs = `#graphql
  scalar JSON

  type Query {
    _empty: String
  }

  type Mutation {
    _empty: String
  }
`;

// Combine all typeDefs
export const typeDefs = [
  baseTypeDefs,
  authTypeDefs,
  articleTypeDefs,
  feedTypeDefs,
  rssTypeDefs,
  engagementTypeDefs,
  notificationTypeDefs,
  premiumTypeDefs,
  adminTypeDefs,
];

// Merge resolvers
export const resolvers = {
  Query: {
    ...authResolvers.Query,
    ...articleResolvers.Query,
    ...feedResolvers.Query,
    ...rssResolvers.Query,
    ...engagementResolvers.Query,
    ...notificationResolvers.Query,
    ...premiumResolvers.Query,
    ...adminResolvers.Query,
  },
  Mutation: {
    ...authResolvers.Mutation,
    ...articleResolvers.Mutation,
    ...rssResolvers.Mutation,
    ...engagementResolvers.Mutation,
    ...notificationResolvers.Mutation,
    ...premiumResolvers.Mutation,
    ...adminResolvers.Mutation,
  },
  // Field resolvers
  User: authResolvers.User,
  Article: articleResolvers.Article,
  RssSource: rssResolvers.RssSource,
  WeeklyPlan: premiumResolvers.WeeklyPlan,
  PlanArticle: premiumResolvers.PlanArticle,
  JSON: GraphQLJSON,
};
