// js/data/missions/missionRegistry.js
/**
 * @fileoverview Mission Registry (Facade)
 * Aggregates all mission modules into the single MISSION_REGISTRY export.
 * New mission packs should be imported and spread here.
 */
import { TUTORIAL_MISSIONS } from './tutorial_missions.js';
import { LICENSE_MISSIONS } from './license_missions.js';
import { PHASE_ONE_MISSIONS } from './phase_one.js';

export const MISSION_REGISTRY = {
    ...TUTORIAL_MISSIONS,
    ...LICENSE_MISSIONS,
    ...PHASE_ONE_MISSIONS
    // Future mission packs (e.g. story_act_2, side_quests) will be spread here.
};