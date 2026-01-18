// Public Proxy for Premium GraphQL
// Loads EE version if available, otherwise disabled

let tDefs = '#graphql extend type Query { _premium_disabled: Boolean }';
let res: any = {
    Query: {},
    Mutation: {},
    WeeklyPlan: {}, // Resolve field resolvers too
    PlanArticle: {}
};

try {
    // @ts-ignore
    const ee = require('../../ee/graphql/premium');
    if (ee) {
        tDefs = ee.premiumTypeDefs;
        res = ee.premiumResolvers;
    }
} catch (e) {
    // Silent fallback
}

export const premiumTypeDefs = tDefs;
export const premiumResolvers = res;
