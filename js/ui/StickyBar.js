// js/ui/components/StickyBar.js
/**
 * @fileoverview Renders the sticky mission bar at the bottom of the screen.
 */
import { DB } from '../../data/database.js';

/**
 * Generates the state object needed to render the sticky mission bar.
 * @param {object} gameState - The current state of the game.
 * @returns {object} An object describing the sticky bar's state { display, objectiveText, progressText, hostClass, turnInClass }.
 */
export function renderStickyBar(gameState) {
    if (gameState.missions.activeMissionId) {
        const mission = DB.MISSIONS[gameState.missions.activeMissionId];
        if (!mission.objectives || mission.objectives.length === 0) {
            return { display: 'none' };
        }
        const progress = gameState.missions.missionProgress[mission.id] || { objectives: {} };

        const objective = mission.objectives[0]; // Assuming only one objective for now
        const current = progress.objectives[objective.goodId]?.current ?? 0;
        const target = objective.quantity;
        const goodName = DB.COMMODITIES.find(c => c.id === objective.goodId).name;
        const locationName = DB.MARKETS.find(m => m.id === mission.completion.locationId).name;

        const objectiveText = `Deliver ${goodName} to ${locationName}`;
        const progressText = `[${current}/${target}]`;

        const hostClass = `host-${mission.host.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        const turnInClass = gameState.missions.activeMissionObjectivesMet && mission.completion.locationId === gameState.currentLocationId ? 'mission-turn-in' : '';

        return {
            display: 'block',
            objectiveText,
            progressText,
            hostClass,
            turnInClass
        };
    } else {
        return { display: 'none' };
    }
}