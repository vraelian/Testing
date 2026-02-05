// js/services/ui/UISolStationControl.js
import { DB } from '../../data/database.js';
import { OFFICERS } from '../../data/officers.js';
import { formatCredits } from '../../utils.js';
import { ACTION_IDS, COMMODITY_IDS } from '../../data/constants.js';

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
        const output = this._calculateProjections(gameState);
        const stockpile = station.stockpile;
        const hasStockpile = stockpile.credits > 0 || stockpile.antimatter > 0;

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
                            <span class="label">OUTPUT/DAY</span>
                            <span class="value credits-text">${formatCredits(output.credits)}</span>
                            <span class="value text-purple-400 text-sm">+${output.antimatter} AM</span>
                        </div>
                        <div class="readout-item">
                            <span class="label">STOCKPILE</span>
                            <span class="value credits-text">${formatCredits(stockpile.credits)}</span>
                            <span class="value text-purple-400 text-sm">${stockpile.antimatter.toFixed(2)} AM</span>
                        </div>
                        <div class="readout-action">
                            <button class="btn btn-sm btn-pulse-gold w-full h-full" 
                                    data-action="sol-claim-output" 
                                    ${!hasStockpile ? 'disabled' : ''}>
                                CLAIM
                            </button>
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

        this.uiManager.queueModal('event-modal', 'Sol Station Directorate', contentHtml, null, {
            width: '800px', // Custom width for dashboard; constrained by CSS max-width
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
            case 'STABILITY': return "Min Decay. Std Output. <span class='text-green-400'>Low Maint.</span>";
            case 'COMMERCE': return "Max Credits. <span class='text-orange-400'>High Decay.</span>";
            case 'PRODUCTION': return "Max AM. <span class='text-red-500'>Extreme Decay.</span>";
            default: return "";
        }
    }

    _renderCacheGrid(gameState) {
        const caches = gameState.solStation.caches;
        const playerInventory = gameState.player.inventories[gameState.player.activeShipId];

        return Object.entries(caches).map(([commodityId, cache]) => {
            const commodity = DB.COMMODITIES.find(c => c.id === commodityId);
            
            // Fallback for safety if ID doesn't match
            if (!commodity) {
                return `<div class="cache-card"><div class="cache-name">Error: ${commodityId}</div></div>`;
            }

            const fillPct = (cache.current / cache.max) * 100;
            
            // Player Stock
            const playerStock = playerInventory[commodityId]?.quantity || 0;
            const canDonate = playerStock > 0 && cache.current < cache.max;

            // Determine Tier Color Variable
            const tierColorVar = `--tier-${commodity.tier || 1}-color`;

            return `
                <div class="cache-card">
                    <div class="cache-header">
                        <div class="cache-icon" style="background-image: url('${commodity.image || ''}')"></div>
                        <div class="cache-info">
                            <div class="cache-name">${commodity.name}</div>
                            <div class="cache-tier">TIER ${commodity.tier}</div>
                        </div>
                    </div>
                    <div class="cache-bar-track">
                        <div class="cache-bar-fill" style="width: ${fillPct}%; background-color: var(${tierColorVar}, #fff);"></div>
                    </div>
                    <div class="cache-details">
                        <span>${formatCredits(cache.current, false)} / ${formatCredits(cache.max, false)}</span>
                    </div>
                    <div class="cache-actions">
                        <span class="player-stock">Cargo: ${playerStock}</span>
                        <button class="btn-donate" 
                                data-action="sol-donate" 
                                data-tier="null" 
                                data-commodity-id="${commodityId}"
                                ${!canDonate ? 'disabled' : ''}>
                            + DONATE
                        </button>
                    </div>
                </div>
            `;
        }).join('');
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
        // Rounded values and shortened labels for UI compactness
        if (buffs.entropy !== 0) parts.push(`<span class="buff-entropy">${buffs.entropy > 0 ? '+' : ''}${Math.round(buffs.entropy * 100)}% Decay</span>`);
        if (buffs.creditMult !== 0) parts.push(`<span class="buff-credits">+${Math.round(buffs.creditMult * 100)}% Credits</span>`);
        if (buffs.amMult !== 0) parts.push(`<span class="buff-am">+${Math.round(buffs.amMult * 100)}% AM</span>`);
        
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