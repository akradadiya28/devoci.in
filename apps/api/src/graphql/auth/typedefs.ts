/**
 * Auth GraphQL TypeDefs
 */

export const authTypeDefs = `#graphql
  type DynamicRole {
    role: String!
    weight: Float!
  }

  input DynamicRoleInput {
    role: String!
    weight: Float!
  }

  type UserPreferences {
    topics: [String!]!
    languages: [String!]!
    skillLevel: SkillLevel!
    interests: [String!]
    preferredTags: [String!]
  }

  input OnboardingInput {
    dynamicRoles: [DynamicRoleInput!]!
    skillLevel: SkillLevel!
    interests: [String!]!
    preferredTags: [String!]!
  }

  type User {
    id: ID!
    email: String!
    name: String!
    avatar: String
    dynamicRoles: [DynamicRole!]!
    preferences: UserPreferences!
    isPremium: Boolean!
    createdAt: String!
    onboardingCompleted: Boolean!
    isEmailVerified: Boolean!
  }

  enum SkillLevel {
    BEGINNER
    INTERMEDIATE
    ADVANCED
  }

  type AuthPayload {
    user: User!
    accessToken: String!
    refreshToken: String!
  }

  extend type Query {
    me: User
  }

  extend type Mutation {
    signup(email: String!, password: String!, name: String!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    refreshToken(token: String!): AuthPayload!
    logout: Boolean!
    completeOnboarding(input: OnboardingInput!): User!
    verifyEmail(token: String!): Boolean!
    requestPasswordReset(email: String!): Boolean!
    resetPassword(token: String!, newPassword: String!): Boolean!
    resendVerificationEmail: Boolean!
  }
`;
