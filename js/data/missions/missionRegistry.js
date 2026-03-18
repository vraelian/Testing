// js/data/missions/missionRegistry.js
/**
 * @fileoverview Mission Registry (Facade)
 * Aggregates all mission modules into the single MISSION_REGISTRY export.
 * New mission packs should be imported and spread here.
 */
import { TUTORIAL_MISSIONS } from './tutorial_missions.js';
import { LICENSE_MISSIONS } from './license_missions.js';
import { PHASE_ONE_MISSIONS } from './phase_one.js';

export const TEST_MISSIONS = {
    "mission_hero_test": {
        id: "mission_hero_test",
        name: "Directorate Evaluation",
        type: "STORY",
        host: "Sol Station Administration",
        portraitId: "Business_2",
        description: "A high-ranking official has noted your rising influence. They request a small donation of credits to secure a permanent liaison aboard the Sol Station.",
        prerequisites: [],
        objectives: [
            { type: "wealth_gt", value: 10000 }
        ],
        rewards: [
            { type: "credits", amount: 1000 }
        ],
        officerReward: "off_petrinor",
        completion: {
            title: "Liaison Secured",
            text: "The credits have been transferred, and the necessary paperwork filed. Your new officer will join your active roster immediately.",
            buttonText: "RECRUIT OFFICER",
            locationId: "any"
        }
    }
};

export const MISSION_REGISTRY = {
    ...TUTORIAL_MISSIONS,
    ...LICENSE_MISSIONS,
    ...PHASE_ONE_MISSIONS,
    ...TEST_MISSIONS
};