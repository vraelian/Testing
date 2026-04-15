// js/services/mission/MissionTriggerEvaluator.js
/**
 * @fileoverview Stateless logic engine for evaluating mission availability triggers.
 * Acts as the gatekeeper to determine if a mission should be shown in the terminal.
 */

export class MissionTriggerEvaluator {
    /**
     * Checks if a specific trigger condition is met.
     * @param {object} trigger - The trigger/prerequisite object (e.g. { type: 'location_is', value: 'luna' }).
     * @param {import('../GameState.js').GameState} gameState - The current state of the game.
     * @returns {boolean} True if the condition is met.
     */
    check(trigger, gameState) {
        switch (trigger.type) {
            // --- HISTORY CHECKS ---
            case 'mission_completed':
                return gameState.missions.completedMissionIds.includes(trigger.missionId || trigger.value);

            case 'mission_not_completed':
                 return !gameState.missions.completedMissionIds.includes(trigger.missionId || trigger.value);

            // --- STORY FLAGS ---
            case 'flag_is_true':
                return (gameState.player.storyFlags && gameState.player.storyFlags[trigger.flag]) === true;

            case 'flag_is_false':
                const isFalseVal = gameState.player.storyFlags ? gameState.player.storyFlags[trigger.flag] : undefined;
                return isFalseVal === false || isFalseVal === undefined;

            case 'flag_eq':
                return (gameState.player.storyFlags && gameState.player.storyFlags[trigger.flag]) === trigger.value;

            case 'flag_gt':
                return (gameState.player.storyFlags ? (gameState.player.storyFlags[trigger.flag] || 0) : 0) > trigger.value;

            case 'flag_gte':
                return (gameState.player.storyFlags ? (gameState.player.storyFlags[trigger.flag] || 0) : 0) >= trigger.value;

            case 'flag_lt':
                return (gameState.player.storyFlags ? (gameState.player.storyFlags[trigger.flag] || 0) : 0) < trigger.value;

            case 'flag_lte':
                return (gameState.player.storyFlags ? (gameState.player.storyFlags[trigger.flag] || 0) : 0) <= trigger.value;

            case 'flag_days_since':
                const stampDay = gameState.player.storyFlags ? (gameState.player.storyFlags[trigger.flag] || 0) : 0;
                return (gameState.day - stampDay) >= trigger.value;

            // --- ATTRIBUTE CHECKS ---
            case 'revealed_tier':
                return gameState.player.revealedTier >= (trigger.tier || trigger.value);
            
            case 'wealth_gt':
                return gameState.player.credits >= trigger.value;

            // --- LOCATION CHECKS ---
            case 'location_is':
                // Mission only available at specific station (Side Missions)
                return gameState.currentLocationId === trigger.value;
            
            case 'location_is_not':
                return gameState.currentLocationId !== trigger.value;

            // --- SHIP CHECKS ---
            case 'has_ship':
                return gameState.player.ownedShipIds.includes(trigger.value);

            // --- FALLBACK ---
            default:
                console.warn(`[MissionTriggerEvaluator] Unknown trigger type: ${trigger.type}`);
                return false;
        }
    }

    /**
     * Helper to check an array of triggers. All must pass (AND logic).
     * @param {Array<object>} triggers 
     * @param {import('../GameState.js').GameState} gameState 
     * @returns {boolean}
     */
    checkAll(triggers, gameState) {
        if (!triggers || triggers.length === 0) return true;
        return triggers.every(t => this.check(t, gameState));
    }
}