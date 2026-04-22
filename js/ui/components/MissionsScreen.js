// js/ui/components/MissionsScreen.js
/**
 * @fileoverview Rendering logic for Mission System 2.0.
 * Supports split view: 'Terminal' (Available) vs 'Log' (Active).
 * Phase 3 Update: Atmosphere, Animation, and Polish.
 */
import { DB } from '../../data/database.js';
import { formatCredits, formatAbbreviatedNumber } from '../../utils.js';
import { GameAttributes } from '../../services/GameAttributes.js';
import { OFFICERS } from '../../data/officers.js';

function getOfficerRarityHex(rarity) {
    switch (rarity) {
        case 'uncommon': return '#4ade80';
        case 'rare': return '#facc15';
        case 'very_rare': return '#fb923c';
        case 'hyper_rare': return '#f87171';
        case 'common':
        default: return '#94a3b8';
    }
}

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

// --- NEW HELPER: Dynamic Text Replacement ---
const parseMissionText = (text, gameState) => {
    if (!text) return '';
    let parsedText = text;
    
    if (parsedText.includes('[playerName]')) {
        const pName = gameState.player?.name || 'Captain';
        parsedText = parsedText.replace(/\[playerName\]/g, pName);
    }
    
    if (parsedText.includes('[shipName]')) {
        const activeId = gameState.player?.activeShipId;
        const shipName = activeId && DB.SHIPS[activeId] ? DB.SHIPS[activeId].name : 'Vessel';
        parsedText = parsedText.replace(/\[shipName\]/g, shipName);
    }
    
    return parsedText;
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
                    LOG
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
        const rewardTextParts = [];
        if (mission.rewards) {
            mission.rewards.forEach(r => {
                if(r.type.toLowerCase() === 'credits') rewardTextParts.push(`<span class="credits-text-pulsing">${formatCredits(r.amount, true)}</span>`);
                else if(r.type.toLowerCase() === 'upgrade') {
                    const upgName = GameAttributes.getDefinition(r.id || r.target)?.name || 'SHIP UPGRADE';
                    rewardTextParts.push(upgName.toUpperCase());
                }
                else if(r.type.toLowerCase() === 'fill_fleet_fuel') {
                    rewardTextParts.push(`<span class="text-blue-400 font-bold" style="-webkit-text-stroke: 1px black;">FUEL STIPEND</span>`);
                }
                else rewardTextParts.push(r.type.toUpperCase());
            });
        }
        
        if (mission.officerReward) {
            const offDef = OFFICERS[mission.officerReward];
            if (offDef) {
                const color = getOfficerRarityHex(offDef.rarity);
                rewardTextParts.push(`<span style="color: ${color}; font-weight: bold; text-shadow: 0 0 5px ${color};">OFFICER: ${offDef.name.toUpperCase()}</span>`);
            }
        }
        
        const rewardText = rewardTextParts.join(', ');

        return `
            <div class="mission-card ${hostClass} ${typeClass}" data-action="show-mission-modal" data-mission-id="${mission.id}">
                <div class="mission-meta-row">
                    <span class="mission-type-badge">${mission.type}</span>
                    <span class="mission-host-label">${mission.host}</span>
                </div>
                
                <div class="mission-main-row">
                    <div class="mission-title">${parseMissionText(mission.name, gameState)}</div>
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
        const isAtCorrectLocation = !mission.completion.locationId || mission.completion.locationId === 'any' || mission.completion.locationId === currentLocationId;

        // --- NEW LOGISTICS PICKUP PHASE LOGIC ---
        const isLogisticsPickupPhase = mission.deferredCargo && mission.deferredCargo.length > 0 && !progress.cargoLoaded;
        const isAtPickupLocation = isLogisticsPickupPhase && currentLocationId === mission.pickupLocationId;

        if (progress.isCompletable && isAtCorrectLocation && !isLogisticsPickupPhase) {
            statusClass += ' mission-turn-in';
        }

        // --- STATUS BANNER LOGIC ---
        let statusBannerHtml = '';
        if (isLogisticsPickupPhase) {
            if (isAtPickupLocation) {
                statusBannerHtml = `<div class="mission-status-banner" style="color: #f59e0b; border-color: #f59e0b; background: rgba(245, 158, 11, 0.1); box-shadow: inset 0 0 8px rgba(245, 158, 11, 0.2); animation: none !important;">CARGO READY TO LOAD</div>`;
            } else {
                const locName = DB.MARKETS.find(m => m.id === mission.pickupLocationId)?.name || 'UNKNOWN';
                statusBannerHtml = `<div class="mission-status-banner banner-text-return" style="color: #94a3b8; border-color: #475569;">ROUTE TO ${locName.toUpperCase()}</div>`;
            }
        } else if (progress.isCompletable) {
             let bannerText = 'READY TO COMPLETE';
             let bannerTextClass = 'banner-text-ready';
             if (mission.completion.locationId && mission.completion.locationId !== 'any' && !isAtCorrectLocation) {
                 const locName = DB.MARKETS.find(m => m.id === mission.completion.locationId)?.name || 'UNKNOWN';
                 bannerText = `RETURN TO ${locName.toUpperCase()}`;
                 bannerTextClass = 'banner-text-return';
             } else if (mission.objectives && mission.objectives.some(o => ['HAVE_DEBT', 'have_debt'].includes(o.type))) {
                 bannerText = 'CLEAR ALL DEBT'; 
             }
             statusBannerHtml = `<div class="mission-status-banner ${bannerTextClass}">${bannerText}</div>`;
        }

        // --- OBJECTIVES LOGIC ---
        let objectivesHtml = '';
        let actionButtonHtml = '';

        if (isLogisticsPickupPhase) {
            objectivesHtml = '<div class="mission-objectives-list">';
            const locName = DB.MARKETS.find(m => m.id === mission.pickupLocationId)?.name || 'UNKNOWN';
            
            if (isAtPickupLocation) {
                objectivesHtml += `
                    <div class="objective-row-filled objective-row-tall">
                        <div class="objective-fill-bar" style="width: 100%; background: rgba(245, 158, 11, 0.2);"></div>
                        <div class="objective-text" style="color: #f59e0b;">
                            <span>LOAD FREIGHT</span>
                            <span>AWAITING</span>
                        </div>
                    </div>
                `;
                actionButtonHtml = `
                    <div class="mt-3 px-2 pb-2">
                        <button class="btn w-full bg-amber-600/80 hover:bg-amber-500/80 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)] text-white font-bold" data-action="load-mission-cargo" data-mission-id="${mission.id}">
                            LOAD CARGO
                        </button>
                    </div>
                `;
            } else {
                objectivesHtml += `
                    <div class="objective-row-filled objective-row-tall">
                        <div class="objective-fill-bar" style="width: 0%"></div>
                        <div class="objective-text">
                            <span>TRAVEL TO ${locName.toUpperCase()}</span>
                            <span>EN ROUTE</span>
                        </div>
                    </div>
                `;
            }
            objectivesHtml += '</div>';
        } else if (mission.objectives && mission.objectives.length > 0) {
            objectivesHtml = '<div class="mission-objectives-list">';
            mission.objectives.forEach(obj => {
                const objKey = obj.id || obj.goodId;
                const pObj = progress.objectives[objKey];
                const current = pObj ? pObj.current : 0;
                const target = pObj ? pObj.target : (obj.quantity || obj.value || 1);
                const comparator = obj.comparator || '>=';

                let desc = 'OBJECTIVE';
                let displayStr = `${current} / ${target}`;
                let percent = 0;

                // Handle specific types
                if (obj.type === 'have_item' || obj.type === 'DELIVER_ITEM' || obj.type === 'HAVE_ITEM') {
                    const commName = DB.COMMODITIES.find(c => c.id === (obj.goodId || obj.target))?.name.toUpperCase() || 'ITEM';
                    if (obj.target) {
                        const locName = DB.MARKETS.find(m => m.id === obj.target)?.name.toUpperCase() || 'UNKNOWN';
                        desc = `DELIVER ${commName} TO ${locName}`;
                    } else {
                        desc = `PROCURE ${commName}`;
                    }
                    percent = Math.min(100, Math.floor((current / target) * 100));
                } 
                else if (obj.type === 'trade_item' || obj.type === 'TRADE_ITEM') {
                    desc = `${(obj.tradeType || 'trade').toUpperCase()} ${DB.COMMODITIES.find(c => c.id === obj.goodId)?.name.toUpperCase()}`;
                    percent = Math.min(100, Math.floor((current / target) * 100));
                }
                else if (obj.type === 'travel_to' || obj.type === 'TRAVEL_TO') {
                    desc = `TRAVEL TO ${DB.MARKETS.find(m => m.id === obj.target)?.name.toUpperCase()}`;
                    displayStr = current === 1 ? 'ARRIVED' : 'EN ROUTE';
                    percent = current * 100;
                }
                else if (['have_credits', 'HAVE_CREDITS', 'wealth_gt', 'WEALTH_CHECK'].includes(obj.type)) {
                    desc = 'AMASS CREDITS';
                    displayStr = `<span class="text-cyan-400 font-bold">⌬ ${formatAbbreviatedNumber(current)} / ${formatAbbreviatedNumber(target)}</span>`;
                    percent = Math.min(100, (current / target) * 100);
                }
                else if (['have_debt', 'HAVE_DEBT'].includes(obj.type)) {
                    desc = 'CLEAR ALL DEBT';
                    displayStr = `${formatCredits(current)}`;
                    percent = current <= target ? 100 : 0;
                }
                else if (['have_fuel_tank', 'HAVE_FUEL_TANK'].includes(obj.type)) {
                    desc = 'REFUEL SHIP';
                    displayStr = `${current} / ${target}`;
                    percent = Math.min(100, Math.floor((current / (target || 1)) * 100)); 
                }
                else if (['have_hull_pct', 'HAVE_HULL_PCT'].includes(obj.type)) {
                    desc = 'REPAIR HULL';
                    displayStr = `${current} / ${target}`;
                    if (comparator === '<=') {
                        percent = current <= target ? 100 : 0;
                    } else {
                        percent = Math.min(100, Math.floor((current / (target || 1)) * 100)); 
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
                else if (['visit_screen', 'VISIT_SCREEN'].includes(obj.type)) {
                    const screenTarget = obj.screenId ? obj.screenId.charAt(0).toUpperCase() + obj.screenId.slice(1).toLowerCase() : 'Screen';
                    desc = `VISIT THE ${screenTarget.toUpperCase()} SCREEN`;
                    displayStr = current === 1 ? 'COMPLETE' : 'PENDING';
                    percent = current * 100;
                }

                const tallClass = !progress.isCompletable ? 'objective-row-tall' : '';

                objectivesHtml += `
                    <div class="objective-row-filled ${tallClass}">
                        <div class="objective-fill-bar" style="width: ${percent}%"></div>
                        <div class="objective-text">
                            <span>${desc}</span>
                            <span>${displayStr}</span>
                        </div>
                    </div>
                `;
            });
            objectivesHtml += '</div>';
        }

        const isTracked = mission.id === trackedMissionId;
        const starClass = isTracked ? 'active' : '';
        const starIcon = '';
        
        let headerIcons = '';
        if (mission.objectives && mission.objectives.length > 0 || isLogisticsPickupPhase) {
            headerIcons = `
            <button class="mission-track-star ${starClass}" data-action="track-mission" data-mission-id="${mission.id}" title="Track on HUD">
                <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
            </button>`;
        }

        const contractStatusText = progress.isCompletable ? 'COMPLETE' : 'IN PROGRESS';

        return `
            <div class="mission-card ${hostClass} ${typeClass} ${statusClass}" data-action="show-mission-modal" data-mission-id="${mission.id}">
                ${headerIcons}
                <div class="mission-meta-row ${headerIcons ? 'pl-6' : ''}"> 
                     <span class="mission-type-badge">${contractStatusText}</span>
                     <span class="mission-host-label">${mission.host}</span>
                </div>
                
                <div class="mission-title mb-2">${parseMissionText(mission.name, gameState)}</div>
                
                ${statusBannerHtml}
                ${objectivesHtml}
                ${actionButtonHtml}
            </div>
        `;
    };

    /** Returns the "System Idle" Empty State */
    const renderEmptyState = (msg) => {
        return `
            <div class="mission-empty-state">
                <div class="mission-empty-text">${msg}</div>
            </div>
        `;
    };

    let contentHtml = '';

    if (activeTab === 'terminal') {
        if (missionService) {
            const availableMissions = missionService.getAvailableMissions();
            if (availableMissions.length > 0) {
                contentHtml = '<div class="max-w-2xl mx-auto">'; 
                availableMissions.forEach(m => contentHtml += renderTerminalCard(m));
                contentHtml += '</div>';
            } else {
                contentHtml = renderEmptyState('NO CONTRACTS DETECTED');
            }
        }
    } else {
        if (activeMissionIds && activeMissionIds.length > 0) {
            contentHtml = '<div class="max-w-2xl mx-auto">';
            
            const sortedMissions = activeMissionIds
                .map(id => DB.MISSIONS[id])
                .filter(m => m) 
                .sort((a, b) => {
                    const progA = missionProgress[a.id] || { isCompletable: false };
                    const progB = missionProgress[b.id] || { isCompletable: false };
                    
                    if (progA.isCompletable && !progB.isCompletable) return -1;
                    if (!progA.isCompletable && progB.isCompletable) return 1;
                    
                    return 0; 
                });

            sortedMissions.forEach(mission => {
                contentHtml += renderLogCard(mission);
            });
            contentHtml += '</div>';
        } else {
             contentHtml = renderEmptyState('MISSION LOG EMPTY');
        }
    }

    return `
        <div class="flex flex-col h-full ${themeClass} missions-screen-container">
            ${renderTabs()}
            <div class="missions-scroll-panel flex-grow min-h-0 overflow-y-auto custom-scrollbar px-2">
                ${contentHtml}
            </div>
        </div>
    `;
}