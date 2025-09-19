// js/ui/components/MissionsScreen.js
/**
 * @fileoverview This file contains the rendering logic for the Missions screen.
 * It is responsible for displaying the currently active mission and a list of all
 * available missions for the player.
 */
import { DB } from '../../data/database.js';

/**
 * Renders the entire Missions screen UI.
 * @param {object} gameState - The current state of the game.
 * @param {import('../../services/MissionService.js').MissionService} missionService - An instance of the MissionService to fetch available missions.
 * @returns {string} The HTML content for the Missions screen.
 */
export function renderMissionsScreen(gameState, missionService) {
    const { missions, currentLocationId } = gameState;
    const { activeMissionId, activeMissionObjectivesMet } = missions;

    /**
     * Generates the HTML for a single mission card.
     * @param {object} mission - The mission object from the database.
     * @param {string} status - The status of the mission ('active', 'completed', 'available').
     * @returns {string} The HTML for the mission card.
     */
    const getMissionCardHtml = (mission, status) => {
        let statusClass = '';
        if (status === 'active') statusClass = 'mission-active';
        if (status === 'completed') statusClass = 'mission-complete';
        // Special class for an active mission that is ready to be turned in at the current location.
        if (status === 'active' && activeMissionObjectivesMet && mission.completion.locationId === currentLocationId) {
            statusClass += ' mission-turn-in';
        }

        const hostClass = `host-${mission.host.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        const rewardText = mission.rewards.map(r => {
            if(r.type === 'credits') return `⌬ ${r.amount.toLocaleString()}`;
            return r.type.toUpperCase();
        }).join(', ');

        return `
            <div class="mission-card sci-fi-frame ${hostClass} ${statusClass}" data-action="show-mission-modal" data-mission-id="${mission.id}">
                <div class="flex justify-between items-center w-full text-xs mb-1">
                    <div class="flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                        <span class="mission-type">${mission.type}</span>
                    </div>
                    <span class="mission-host">${mission.host}</span>
                </div>
                <div class="flex justify-between items-end w-full">
                    <p class="font-bold text-base">${mission.name}</p>
                    <span class="mission-reward">${rewardText}</span>
                </div>
            </div>`;
    };

    let missionsHtml = '';
    const activeMission = activeMissionId ? DB.MISSIONS[activeMissionId] : null;
    if (activeMission) {
        missionsHtml += getMissionCardHtml(activeMission, 'active');
    }
    
    if (missionService) {
        const availableMissions = missionService.getAvailableMissions();
        availableMissions.forEach(mission => {
            missionsHtml += getMissionCardHtml(mission, 'available');
        });
    }

    if (missionsHtml === '') {
        missionsHtml = '<p class="text-center text-gray-500 text-lg">No missions available at this terminal.</p>';
    }

    return `
        <div class="flex flex-col h-full">
            <h1 class="text-3xl font-orbitron text-center mb-6 text-cyan-300 flex-shrink-0">Mission Terminal</h1>
            <div class="missions-scroll-panel flex-grow min-h-0">
                <div class="space-y-3 max-w-2xl mx-auto">
                    ${missionsHtml}
                </div>
            </div>
        </div>
    `;
}