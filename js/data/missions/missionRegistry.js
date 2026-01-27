// js/data/missions/missionRegistry.js
/**
 * @fileoverview Mission Registry (Facade)
 * Aggregates all mission modules into the single MISSION_REGISTRY export.
 * New mission packs should be imported and spread here.
 */
import { TUTORIAL_MISSIONS } from './tutorial_missions.js';
import { LICENSE_MISSIONS } from './license_missions.js';

export const MISSION_REGISTRY = {
    ...TUTORIAL_MISSIONS,
    ...LICENSE_MISSIONS
    // Future mission packs (e.g. story_act_1, side_quests) will be spread here.
};