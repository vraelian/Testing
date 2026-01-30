import { OFFICERS_GUILD } from './officers_guild.js';
// Future imports: OFFICERS_SYNDICATE, OFFICERS_KINTSUGI

/**
 * Master Registry for Sol Station Directorate Officers.
 * Aggregates all faction lists into a single queryable object.
 */
export const OFFICER_REGISTRY = {
    ...OFFICERS_GUILD.reduce((acc, off) => {
        acc[off.id] = off;
        return acc;
    }, {}),
    // Spread other factions here as they are added
};

export const ALL_OFFICERS = [
    ...OFFICERS_GUILD,
];