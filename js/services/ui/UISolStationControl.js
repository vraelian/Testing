// js/services/ui/UISolStationControl.js
import { DB } from '../../data/database.js';
import { OFFICERS } from '../../data/officers.js';
import { formatCredits } from '../../utils.js';
import { ACTION_IDS } from '../../data/constants.js';

/**
 * @class UISolStationControl
 * @description Domain Controller responsible for the Sol Station Dashboard,
 * managing the Mode Lever, Cache Grid, and Officer Directorate UI.
 */
export class UISolStationControl {
    /**
     * @param {import('../UIManager.js').UIManager} uiManager
     */
    constructor(uiManager) {
        this.uiManager = uiManager;
    }

    /**
     * Builds and displays the main Sol Station Dashboard modal.
     * @param {object} gameState
     */
    showDashboard(gameState) {
        const station = gameState.solStation;
        if (!station.unlocked) return; // Should not happen if button is gated

        // Calculate projections
        // We need access to the service for accurate projections, but UI should only read state.
        // Ideally, we replicate the projection logic or get it from state if cached.
        // For now, we will perform a lightweight calculation matching the service logic for display.
        const output = this._calculateProjections(gameState);

        const contentHtml = `
            <div class="sol-dashboard-container">
                <div class="sol-header-panel">
                    <div class="sol-health-bar-container">
                        <div class="sol-health-bar-label">STATION INTEGRITY: <span class="${this._getHealthColorClass(station.health)}">${station.health}%</span></div>
                        <div class="sol-health-track">
                            <div class="sol-health-fill" style="width: ${station.health}%; background-color: var(${this._getHealthColorVar(station.health)});"></div>
                        </div>
                    </div>
                    <div class="sol-readout-grid">
                        <div class="readout-item">
                            <span class="label">CREDIT OUTPUT</span>
                            <span class="value credits-text">${formatCredits(output.credits)}/day</span>
                        </div>
                        <div class="readout-item">
                            <span class="label">ANTIMATTER</span>
                            <span class="value text-purple-400">${output.antimatter}/day</span>
                        </div>
                        <div class="readout-item">
                            <span class="label">ENTROPY</span>
                            <span class="value text-red-400">${output.entropy.toFixed(2)}x</span>
                        </div>
                    </div>
                </div>

                <div class="sol-mode-control">
                    <div class="section-title">OPERATIONAL MODE</div>
                    <div class="mode-toggle-group">
                        ${this._renderModeButton('STABILITY', station.mode)}
                        ${this._renderModeButton('COMMERCE', station.mode)}
                        ${this._renderModeButton('PRODUCTION', station.mode)}
                    </div>
                    <div class="mode-description">
                        ${this._getModeDescription(station.mode)}
                    </div>
                </div>

                <div class="sol-cache-section">
                    <div class="section-title">MAINTENANCE CACHES</div>
                    <div class="cache-grid">
                        ${this._renderCacheGrid(gameState)}
                    </div>
                </div>

                <div class="sol-officer-section">
                    <div class="section-title">DIRECTORATE ASSIGNMENTS</div>
                    <div class="officer-slot-container">
                        ${this._renderOfficerSlots(gameState)}
                    </div>
                </div>
            </div>
        `;

        this.uiManager.queueModal('sol-dashboard-modal', 'Sol Station Directorate', contentHtml, null, {
            width: '800px', // Custom width for dashboard
            dismissOutside: true
        });
    }

    /**
     * Renders the Officer Roster modal for selecting an officer.
     * @param {number} slotId 
     * @param {object} gameState 
     */
    showOfficerRoster(slotId, gameState) {
        const roster = gameState.solStation.roster || [];
        const assignedIds = gameState.solStation.officers.map(s => s.assignedOfficerId).filter(id => id);
        
        // Filter: Available officers only (in roster AND not currently assigned)
        const availableOfficers = roster.filter(id => !assignedIds.includes(id));

        let contentHtml = '';

        if (availableOfficers.length === 0) {
            contentHtml = `<div class="text-center p-4 text-gray-400">No unassigned officers available.</div>`;
        } else {
            const listHtml = availableOfficers.map(officerId => {
                const officer = OFFICERS[officerId];
                if (!officer) return '';
                
                return `
                    <div class="roster-card" data-action="sol-assign-officer" data-slot-id="${slotId}" data-officer-id="${officerId}">
                        <div class="officer-info">
                            <div class="officer-name">${officer.name}</div>
                            <div class="officer-role">${officer.role}</div>
                        </div>
                        <div class="officer-buffs">
                            ${this._formatBuffs(officer.buffs)}
                        </div>
                        <button class="btn btn-sm btn-action">ASSIGN</button>
                    </div>
                `;
            }).join('');
            
            contentHtml = `<div class="roster-list">${listHtml}</div>`;
        }

        // Add "Clear Slot" option if slot is currently occupied
        const currentAssignment = gameState.solStation.officers.find(s => s.slotId === parseInt(slotId));
        if (currentAssignment && currentAssignment.assignedOfficerId) {
            contentHtml += `
                <div class="roster-footer">
                    <button class="btn btn-red w-full" data-action="sol-assign-officer" data-slot-id="${slotId}" data-officer-id="null">
                        UNASSIGN CURRENT OFFICER
                    </button>
                </div>
            `;
        }

        this.uiManager.queueModal('event-modal', 'Staff Roster', contentHtml);
    }

    // --- RENDER HELPERS ---

    _renderModeButton(modeId, currentMode) {
        const isActive = modeId === currentMode;
        const activeClass = isActive ? 'active' : '';
        return `
            <button class="mode-btn ${activeClass} mode-${modeId.toLowerCase()}" 
                    data-action="sol-set-mode" 
                    data-mode="${modeId}"
                    ${isActive ? 'disabled' : ''}>
                ${modeId}
            </button>
        `;
    }

    _getModeDescription(mode) {
        switch (mode) {
            case 'STABILITY': return "Minimized Entropy. Standard Output. <span class='text-green-400'>Low Maintenance.</span>";
            case 'COMMERCE': return "Maximizes Credit generation. <span class='text-orange-400'>High Entropy.</span>";
            case 'PRODUCTION': return "Maximizes Antimatter generation. <span class='text-red-500'>Extreme Entropy.</span>";
            default: return "";
        }
    }

    _renderCacheGrid(gameState) {
        const caches = gameState.solStation.caches;
        const playerInventory = gameState.player.inventories[gameState.player.activeShipId];

        return Object.entries(caches).map(([tierKey, cache]) => {
            // Determine Commodity for this Tier (simplified mapping based on game design)
            // Tier 1: Hydrogen (good_hydrogen)
            // Tier 2: Water Ice (good_water_ice) -> Ore (good_ore) ... 
            // *NOTE*: The GDD implies caches accept "Tier X commodities". 
            // For V1 implementation, we will map specific "Fuel/Maintenance" commodities or accept ANY of that tier.
            // However, `donateToCache` takes a specific commodityID.
            // To simplify UI, we will request specific common commodities for maintenance.
            
            // Mapping Tier to Commodity ID (Hardcoded for V1 Simplicity as per "Feed vast quantities")
            const tierMap = {
                tier1: { id: 'good_hydrogen', name: 'Hydrogen' },
                tier2: { id: 'good_water_ice', name: 'Water Ice' },
                tier3: { id: 'good_ore', name: 'Ore' },
                tier4: { id: 'good_machinery', name: 'Machinery' },
                tier5: { id: 'good_cybernetics', name: 'Cybernetics' },
                tier6: { id: 'good_antimatter', name: 'Antimatter' } // Wait, T6 shouldn't be AM? AM is T7.
                // Let's use 'good_neural_processors' for T6 or similar high-tier.
            };
            
            // Correction: Check DB for tiers
            // Using a representative commodity for each tier cache for the UI
            // T1: Hydrogen, T2: Plasteel, T3: Machinery, T4: Cybernetics, T5: Neural Proc, T6: ?
            // Let's assume strict mapping for now.
            const targetId = this._getCommodityForTier(tierKey);
            const commodity = DB.COMMODITIES.find(c => c.id === targetId);
            const fillPct = (cache.current / cache.max) * 100;
            
            // Player Stock
            const playerStock = playerInventory[targetId]?.quantity || 0;
            const canDonate = playerStock > 0 && cache.current < cache.max;

            return `
                <div class="cache-card">
                    <div class="cache-header">
                        <div class="cache-icon" style="background-image: url('${commodity.image}')"></div>
                        <div class="cache-info">
                            <div class="cache-name">${commodity.name}</div>
                            <div class="cache-tier">${tierKey.toUpperCase()}</div>
                        </div>
                    </div>
                    <div class="cache-bar-track">
                        <div class="cache-bar-fill" style="width: ${fillPct}%; background-color: var(--tier-${tierKey}-color, #fff);"></div>
                    </div>
                    <div class="cache-details">
                        <span>${formatCredits(cache.current, false)} / ${formatCredits(cache.max, false)}</span>
                    </div>
                    <div class="cache-actions">
                        <span class="player-stock">Cargo: ${playerStock}</span>
                        <button class="btn-donate" 
                                data-action="sol-donate" 
                                data-tier="${tierKey}" 
                                data-commodity-id="${targetId}"
                                ${!canDonate ? 'disabled' : ''}>
                            + DONATE
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    _getCommodityForTier(tierKey) {
        // Hardcoded mapping for the maintenance sinks
        switch(tierKey) {
            case 'tier1': return 'good_hydrogen';
            case 'tier2': return 'good_water_ice';
            case 'tier3': return 'good_ore'; // Or Plasteel
            case 'tier4': return 'good_machinery';
            case 'tier5': return 'good_cybernetics';
            case 'tier6': return 'good_neural_processors'; // Assuming high tier
            default: return 'good_hydrogen';
        }
    }

    _renderOfficerSlots(gameState) {
        const slots = gameState.solStation.officers;
        
        return slots.map(slot => {
            const officerId = slot.assignedOfficerId;
            const officer = officerId ? OFFICERS[officerId] : null;

            if (officer) {
                return `
                    <div class="officer-slot filled" data-action="sol-open-roster" data-slot-id="${slot.slotId}">
                        <div class="slot-header">SLOT ${slot.slotId}</div>
                        <div class="officer-name">${officer.name}</div>
                        <div class="officer-role">${officer.role}</div>
                        <div class="officer-buffs-mini">${this._formatBuffs(officer.buffs, true)}</div>
                    </div>
                `;
            } else {
                return `
                    <div class="officer-slot empty" data-action="sol-open-roster" data-slot-id="${slot.slotId}">
                        <div class="slot-header">SLOT ${slot.slotId}</div>
                        <div class="empty-label">+ ASSIGN</div>
                    </div>
                `;
            }
        }).join('');
    }

    _formatBuffs(buffs, mini = false) {
        const parts = [];
        if (buffs.entropy !== 0) parts.push(`<span class="buff-entropy">${buffs.entropy > 0 ? '+' : ''}${buffs.entropy * 100}% Decay</span>`);
        if (buffs.creditMult !== 0) parts.push(`<span class="buff-credits">+${buffs.creditMult * 100}% Credits</span>`);
        if (buffs.amMult !== 0) parts.push(`<span class="buff-am">+${buffs.amMult * 100}% Antimatter</span>`);
        
        return parts.join(mini ? '<br>' : ' • ');
    }

    _calculateProjections(gameState) {
        // Replicating basic service logic for the UI view
        const station = gameState.solStation;
        const MODES = {
            STABILITY: { entropyMult: 1, amMult: 1, creditMult: 1 },
            COMMERCE: { entropyMult: 3, amMult: 1, creditMult: 4 },
            PRODUCTION: { entropyMult: 4, amMult: 4, creditMult: 1 }
        };
        const BASE_CREDIT_OUTPUT = 1000;
        const BASE_AM_OUTPUT = 0.1;

        const modeConfig = MODES[station.mode];
        
        // Get Buffs
        let buffTotals = { entropy: 0, creditMult: 0, amMult: 0 };
        station.officers.forEach(slot => {
            if (slot.assignedOfficerId && OFFICERS[slot.assignedOfficerId]) {
                const b = OFFICERS[slot.assignedOfficerId].buffs;
                buffTotals.entropy += b.entropy;
                buffTotals.creditMult += b.creditMult;
                buffTotals.amMult += b.amMult;
            }
        });

        // Calculate
        let entropy = Math.max(0.1, modeConfig.entropyMult + buffTotals.entropy);
        let efficiency = station.health / 100;
        if (efficiency < 0.5) efficiency = Math.pow(efficiency, 2);

        const credits = Math.floor(BASE_CREDIT_OUTPUT * (modeConfig.creditMult + buffTotals.creditMult) * efficiency);
        const antimatter = (BASE_AM_OUTPUT * (modeConfig.amMult + buffTotals.amMult) * efficiency).toFixed(2);

        return { credits, antimatter, entropy };
    }

    _getHealthColorClass(health) {
        if (health >= 80) return 'text-green-400';
        if (health >= 50) return 'text-yellow-400';
        return 'text-red-500';
    }

    _getHealthColorVar(health) {
        if (health >= 80) return '--ot-green-base';
        if (health >= 50) return '--ot-yellow-base';
        return '--ot-red-base';
    }
}