// js/ui/components/MissionsScreen.js
/**
 * @fileoverview Rendering logic for Mission System 2.0.
 * Supports split view: 'Terminal' (Available) vs 'Log' (Active).
 * Phase 3 Update: Atmosphere, Animation, and Polish.
 */
import { DB } from '../../data/database.js';
import { formatCredits } from '../../utils.js';

// --- THEME MAPPING ---
const THEME_MAP = {
    'sol': 'loc-theme-sol',
    'mercury': 'loc-theme-mercury',
    'venus': 'loc-theme-venus',
    'earth': 'loc-theme-earth',
    'luna': 'loc-theme-luna',
    'mars': 'loc-theme-mars',
    'belt': 'loc-theme-belt',
    'jupiter': 'loc-theme-jupiter',
    'saturn': 'loc-theme-saturn',
    'uranus': 'loc-theme-uranus',
    'neptune': 'loc-theme-neptune',
    'pluto': 'loc-theme-pluto',
    'kepler': 'loc-theme-kepler'
};

const DEFAULT_THEME = 'loc-theme-earth';

/**
 * Returns a CSS class for the card gradient based on mission type keywords.
 */
const getMissionTypeClass = (missionType) => {
    if (!missionType) return 'm-type-standard';
    const type = missionType.toLowerCase();
    
    if (type.includes('trade') || type.includes('deliver') || type.includes('source') || type.includes('procurement')) {
        return 'm-type-trade'; // Cyan/Teal
    }
    if (type.includes('combat') || type.includes('bounty') || type.includes('patrol') || type.includes('kill')) {
        return 'm-type-combat'; // Red/Rust
    }
    if (type.includes('explor') || type.includes('travel') || type.includes('survey') || type.includes('scan')) {
        return 'm-type-exploration'; // Purple/Void
    }
    if (type.includes('min') || type.includes('harvest') || type.includes('salvage') || type.includes('industr')) {
        return 'm-type-industrial'; // Amber/Oil
    }
    
    return 'm-type-standard';
};

export function renderMissionsScreen(gameState, missionService) {
    const { missions, uiState, currentLocationId } = gameState;
    const { activeMissionIds, missionProgress, trackedMissionId } = missions;
    const activeTab = uiState.activeMissionTab || 'terminal'; // Default to terminal

    // Resolve Theme Class
    const themeClass = THEME_MAP[currentLocationId] || DEFAULT_THEME;

    // --- SUB-COMPONENTS ---

    /** Renders the Holographic Rail Navigation */
    const renderTabs = () => {
        const getTabClass = (tabId) => 
            `mission-tab-btn ${activeTab === tabId ? 'active' : ''}`;
        
        return `
            <div class="mission-tabs-nav ${themeClass}">
                <button class="${getTabClass('terminal')}" data-action="switch-mission-tab" data-target="terminal">
                    TERMINAL
                </button>
                <button class="${getTabClass('log')}" data-action="switch-mission-tab" data-target="log">
                    LOG <span class="text-xs ml-1 opacity-70">(${activeMissionIds.length}/4)</span>
                </button>
            </div>
        `;
    };

    /** Renders a "Datapad" style card for available missions */
    const renderTerminalCard = (mission) => {
        // Map Host to CSS Class for Color Variables
        const hostClass = `host-${mission.host.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        // Map Type to Gradient Class
        const typeClass = getMissionTypeClass(mission.type);
        
        // Format Rewards
        const rewardText = mission.rewards.map(r => {
            if(r.type === 'credits') return `<span class="credits-text-pulsing">${formatCredits(r.amount, true)}</span>`;
            return r.type.toUpperCase();
        }).join(', ');

        return `
            <div class="mission-card ${hostClass} ${typeClass}" data-action="show-mission-modal" data-mission-id="${mission.id}">
                <div class="mission-meta-row">
                    <span class="mission-type-badge">${mission.type}</span>
                    <span class="mission-host-label">${mission.host}</span>
                </div>
                
                <div class="mission-main-row">
                    <div class="mission-title">${mission.name}</div>
                    <div class="mission-reward-data">${rewardText}</div>
                </div>
            </div>`;
    };

    /** Renders a "Live Feed" style card with progress bars */
    const renderLogCard = (mission) => {
        const hostClass = `host-${mission.host.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        const typeClass = getMissionTypeClass(mission.type);
        const progress = missionProgress[mission.id] || { objectives: {}, isCompletable: false };
        
        // Determine Status Class (Active vs Turn-In Ready)
        let statusClass = 'mission-active';
        
        // Allow null location (Anywhere)
        const isAtCorrectLocation = !mission.completion.locationId || mission.completion.locationId === currentLocationId;

        if (progress.isCompletable && isAtCorrectLocation) {
            statusClass += ' mission-turn-in';
        }

        // Dynamic Status Text Logic
        let statusText = 'STATUS: IN PROGRESS';
        if (progress.isCompletable) {
            if (mission.completion.locationId) {
                const locName = DB.MARKETS.find(m => m.id === mission.completion.locationId)?.name || 'UNKNOWN';
                statusText = `RETURN TO: ${locName.toUpperCase()}`;
            } else {
                statusText = 'READY TO COMPLETE';
            }
        }

        // Render Objectives with Continuous Flow Bars
        let objectivesHtml = '';
        if (mission.objectives) {
            objectivesHtml = '<div class="mission-objectives-list">';
            mission.objectives.forEach(obj => {
                const objKey = obj.id || obj.goodId;
                const pObj = progress.objectives[objKey];
                const current = pObj ? pObj.current : 0;
                const target = pObj ? pObj.target : (obj.quantity || 1);
                const comparator = obj.comparator || '>=';

                // --- DESC & DISPLAY FORMATTING ---
                let desc = 'OBJECTIVE';
                let displayStr = `${current}/${target}`;
                let percent = 0;

                // Handle specific types
                if (obj.type === 'have_item' || obj.type === 'DELIVER_ITEM') {
                    desc = `DELIVER ${DB.COMMODITIES.find(c => c.id === (obj.goodId || obj.target))?.name.toUpperCase()}`;
                    percent = Math.min(100, Math.floor((current / target) * 100));
                } 
                else if (obj.type === 'travel_to' || obj.type === 'TRAVEL_TO') {
                    desc = `TRAVEL TO ${DB.MARKETS.find(m => m.id === obj.target)?.name.toUpperCase()}`;
                    displayStr = current === 1 ? 'ARRIVED' : 'EN ROUTE';
                    percent = current * 100;
                }
                else if (obj.type === 'wealth_gt' || obj.type === 'WEALTH_CHECK') {
                    desc = 'EARN CREDITS';
                    percent = Math.min(100, Math.floor((current / target) * 100));
                }
                else if (['have_fuel_tank', 'HAVE_FUEL_TANK'].includes(obj.type)) {
                    desc = 'FUEL LEVEL';
                    displayStr = `${current}`;
                    percent = Math.min(100, Math.floor((current / (target || 100)) * 100)); 
                }
                else if (['have_hull_pct', 'HAVE_HULL_PCT'].includes(obj.type)) {
                    desc = 'HULL INTEGRITY';
                    displayStr = `${current}%`;
                    if (comparator === '<=') {
                        percent = current <= target ? 100 : 0;
                    } else {
                        percent = Math.min(100, current); 
                    }
                }
                else if (['have_cargo_pct', 'HAVE_CARGO_PCT'].includes(obj.type)) {
                    desc = 'CARGO SPACE';
                    displayStr = `${current}%`;
                    if (comparator === '<=') {
                        percent = current <= target ? 100 : 0;
                    } else {
                        percent = Math.min(100, current);
                    }
                }

                objectivesHtml += `
                    <div class="objective-item text-xs">
                        <div class="flex justify-between mb-1 text-gray-400 font-bold">
                            <span>${desc}</span>
                            <span>${displayStr}</span>
                        </div>
                        <div class="objective-track">
                            <div class="objective-bar transition-all duration-500" style="width: ${percent}%"></div>
                        </div>
                    </div>
                `;
            });
            objectivesHtml += '</div>';
        }

        // [[NEW]] Star Tracking Logic
        const isTracked = mission.id === trackedMissionId;
        const starClass = isTracked ? 'active' : '';
        const starIcon = `
            <button class="mission-track-star ${starClass}" data-action="track-mission" data-mission-id="${mission.id}" title="Track on HUD">
                <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
            </button>
        `;

        // [[UPDATED]] Added typeClass to the list
        return `
            <div class="mission-card ${hostClass} ${typeClass} ${statusClass}" data-action="show-mission-modal" data-mission-id="${mission.id}">
                ${starIcon}
                <div class="mission-meta-row pl-6"> <span class="mission-type-badge">ACTIVE CONTRACT</span>
                     <span class="mission-host-label">${mission.host}</span>
                </div>
                
                <div class="mission-title mb-2">${mission.name}</div>
                
                <div class="text-xs text-gray-400 font-bold mb-2 animate-pulse" style="color: var(--theme-color-glow)">${statusText}</div>
                
                ${objectivesHtml}
            </div>
        `;
    };

    /** Returns the "System Idle" Empty State */
    const renderEmptyState = (msg) => {
        return `
            <div class="mission-empty-state">
                <svg class="mission-empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
                <div class="mission-empty-text">${msg}</div>
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
                // [[FIX]] Removed space-y-0 to fix card crowding issue
                contentHtml = '<div class="max-w-2xl mx-auto">'; 
                availableMissions.forEach(m => contentHtml += renderTerminalCard(m));
                contentHtml += '</div>';
            } else {
                contentHtml = renderEmptyState('NO CONTRACTS DETECTED');
            }
        }
    } else {
        // LOG VIEW
        if (activeMissionIds && activeMissionIds.length > 0) {
            // [[FIX]] Removed space-y-0 to fix card crowding issue
            contentHtml = '<div class="max-w-2xl mx-auto">';
            activeMissionIds.forEach(id => {
                const mission = DB.MISSIONS[id];
                if (mission) contentHtml += renderLogCard(mission);
            });
            contentHtml += '</div>';
        } else {
             contentHtml = renderEmptyState('MISSION LOG EMPTY');
        }
    }

    // [[PHASE 3]] Added missions-screen-container class for vignette support
    return `
        <div class="flex flex-col h-full ${themeClass} missions-screen-container">
            <h1 class="text-3xl font-orbitron text-center mb-4 flex-shrink-0" style="color: var(--theme-color-glow); text-shadow: 0 0 10px var(--theme-border);">MISSION CONTROL</h1>
            ${renderTabs()}
            <div class="missions-scroll-panel flex-grow min-h-0 overflow-y-auto custom-scrollbar px-2">
                ${contentHtml}
            </div>
        </div>
    `;
}