// Public Proxy for Admin GraphQL
// Loads EE version if available, otherwise disabled

let tDefs = '#graphql extend type Query { _admin_disabled: Boolean }';
let res: any = { Query: {}, Mutation: {} };

try {
    // @ts-ignore
    const ee = require('../../ee/graphql/admin');
    if (ee) {
        tDefs = ee.adminTypeDefs;
        res = ee.adminResolvers;
    }
} catch (e) {
    // Silent fallback
}

export const adminTypeDefs = tDefs;
export const adminResolvers = res;
