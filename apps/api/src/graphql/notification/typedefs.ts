/**
 * Notification TypeDefs
 */

export const notificationTypeDefs = `#graphql
  enum NotificationType {
    STREAK_RISK
    MILESTONE_UNLOCK
    SOCIAL_ENGAGEMENT
    SYSTEM
  }

  type Notification {
    id: ID!
    type: NotificationType!
    title: String!
    message: String!
    data: JSON
    isRead: Boolean!
    createdAt: String!
  }

  # Push Notification Types
  input PushSubscriptionInput {
    endpoint: String!
    keys: PushKeysInput!
  }

  input PushKeysInput {
    p256dh: String!
    auth: String!
  }

  type PushConfig {
    publicKey: String
    isConfigured: Boolean!
  }

  extend type Query {
    myNotifications(limit: Int, unreadOnly: Boolean): [Notification!]!
    unreadNotificationCount: Int!
    getPushConfig: PushConfig!
  }

  extend type Mutation {
    markNotificationRead(id: ID!): Boolean!
    markAllNotificationsRead: Boolean!
    subscribeToPush(subscription: PushSubscriptionInput!): Boolean!
    unsubscribeFromPush(endpoint: String!): Boolean!
  }
`;
