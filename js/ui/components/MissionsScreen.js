// js/ui/components/MissionsScreen.js
/**
 * @fileoverview Rendering logic for Mission System 2.0.
 * Supports split view: 'Terminal' (Available) vs 'Log' (Active).
 */
import { DB } from '../../data/database.js';
import { formatCredits } from '../../utils.js';

export function renderMissionsScreen(gameState, missionService) {
    const { missions, uiState, currentLocationId } = gameState;
    const { activeMissionIds, missionProgress } = missions;
    const activeTab = uiState.activeMissionTab || 'terminal'; // Default to terminal

    // --- SUB-COMPONENTS ---

    /** Renders the Tab Navigation (Pills) */
    const renderTabs = () => {
        const getTabClass = (tabId) => 
            `mission-tab-btn ${activeTab === tabId ? 'active' : ''}`;
        
        return `
            <div class="mission-tabs-nav flex justify-center gap-4 mb-6">
                <button class="${getTabClass('terminal')}" data-action="switch-mission-tab" data-target="terminal">
                    MISSION TERMINAL
                </button>
                <button class="${getTabClass('log')}" data-action="switch-mission-tab" data-target="log">
                    MISSION LOG <span class="text-xs ml-1 opacity-70">(${activeMissionIds.length}/4)</span>
                </button>
            </div>
        `;
    };

    /** Renders a "Job Board" style card for available missions */
    const renderTerminalCard = (mission) => {
        const hostClass = `host-${mission.host.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        const rewardText = mission.rewards.map(r => {
            if(r.type === 'credits') return `<span class="credits-text-pulsing">${formatCredits(r.amount, true)}</span>`;
            return r.type.toUpperCase();
        }).join(', ');

        return `
            <div class="mission-card sci-fi-frame ${hostClass}" data-action="show-mission-modal" data-mission-id="${mission.id}">
                <div class="flex justify-between items-center w-full text-xs mb-1">
                    <div class="flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
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

    /** Renders a detailed "Log" style card with progress bars */
    const renderLogCard = (mission) => {
        const hostClass = `host-${mission.host.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        const progress = missionProgress[mission.id] || { objectives: {}, isCompletable: false };
        
        // Determine Status Class (Active vs Turn-In Ready)
        let statusClass = 'mission-active';
        
        // [FIX] Allow null location (Anywhere)
        const isAtCorrectLocation = !mission.completion.locationId || mission.completion.locationId === currentLocationId;

        if (progress.isCompletable && isAtCorrectLocation) {
            statusClass += ' mission-turn-in';
        }

        // Render Objectives with Progress Bars
        let objectivesHtml = '';
        if (mission.objectives) {
            objectivesHtml = '<div class="mission-objectives-list space-y-2 mt-2">';
            mission.objectives.forEach(obj => {
                const objKey = obj.id || obj.goodId;
                // Get generic desc
                let desc = 'Objective';
                if(obj.type === 'have_item' || obj.type === 'DELIVER_ITEM') desc = `Deliver ${DB.COMMODITIES.find(c => c.id === (obj.goodId || obj.target))?.name}`;
                else if (obj.type === 'travel_to' || obj.type === 'TRAVEL_TO') desc = `Travel to ${DB.MARKETS.find(m => m.id === obj.target)?.name}`;
                else if (obj.type === 'wealth_gt' || obj.type === 'WEALTH_CHECK') desc = 'Earn Credits';
                
                // Calculate %
                const pObj = progress.objectives[objKey];
                const current = pObj ? pObj.current : 0;
                const target = pObj ? pObj.target : (obj.quantity || 1);
                const percent = Math.min(100, Math.floor((current / target) * 100));

                objectivesHtml += `
                    <div class="objective-item text-xs">
                        <div class="flex justify-between mb-0.5 text-gray-400">
                            <span>${desc}</span>
                            <span>${current}/${target}</span>
                        </div>
                        <div class="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                            <div class="bg-cyan-500 h-full transition-all duration-500" style="width: ${percent}%"></div>
                        </div>
                    </div>
                `;
            });
            objectivesHtml += '</div>';
        }

        return `
            <div class="mission-card sci-fi-frame ${hostClass} ${statusClass} p-4" data-action="show-mission-modal" data-mission-id="${mission.id}">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="font-bold text-lg text-white">${mission.name}</h3>
                    <span class="mission-host text-xs px-2 py-0.5 rounded bg-black/30 border border-white/10">${mission.host}</span>
                </div>
                <div class="text-xs text-gray-400 italic mb-2">${mission.completion.locationId ? `Return to: ${DB.MARKETS.find(m => m.id === mission.completion.locationId)?.name}` : 'Mission Complete'}</div>
                ${objectivesHtml}
            </div>
        `;
    };

    // --- MAIN RENDER LOGIC ---

    let contentHtml = '';

    if (activeTab === 'terminal') {
        // TERMINAL VIEW
        if (missionService) {
            const availableMissions = missionService.getAvailableMissions();
            if (availableMissions.length > 0) {
                contentHtml = '<div class="space-y-3 max-w-2xl mx-auto">';
                availableMissions.forEach(m => contentHtml += renderTerminalCard(m));
                contentHtml += '</div>';
            } else {
                contentHtml = '<div class="flex h-64 items-center justify-center"><p class="text-gray-500 text-lg">No contracts available at this location.</p></div>';
            }
        }
    } else {
        // LOG VIEW
        if (activeMissionIds && activeMissionIds.length > 0) {
            contentHtml = '<div class="space-y-4 max-w-2xl mx-auto">';
            activeMissionIds.forEach(id => {
                const mission = DB.MISSIONS[id];
                if (mission) contentHtml += renderLogCard(mission);
            });
            contentHtml += '</div>';
        } else {
             contentHtml = '<div class="flex h-64 items-center justify-center"><p class="text-gray-500 text-lg">Mission Log Empty.</p></div>';
        }
    }

    return `
        <div class="flex flex-col h-full">
            <h1 class="text-3xl font-orbitron text-center mb-4 text-cyan-300 flex-shrink-0">Mission Control</h1>
            ${renderTabs()}
            <div class="missions-scroll-panel flex-grow min-h-0 overflow-y-auto custom-scrollbar px-2">
                ${contentHtml}
            </div>
        </div>
    `;
}