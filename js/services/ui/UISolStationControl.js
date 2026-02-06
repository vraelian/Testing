// js/services/ui/UISolStationControl.js
import { DB } from '../../data/database.js';
import { OFFICERS } from '../../data/officers.js';
import { formatCredits } from '../../utils.js';
import { ACTION_IDS, COMMODITY_IDS } from '../../data/constants.js';
import { AssetService } from '../AssetService.js'; 

/**
 * @class UISolStationControl
 * @description Domain Controller responsible for the Sol Station Dashboard,
 * managing the Mode Lever, Cache List, and Officer Directorate UI.
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
        if (!station.unlocked) return; 

        const contentHtml = this._buildDashboardHtml(gameState);

        const modalContainer = document.getElementById('event-modal');
        
        // FIX: Detect and resolve "Zombie" modal state
        if (modalContainer && modalContainer.classList.contains('modal-hiding')) {
            modalContainer.classList.add('hidden');
            modalContainer.classList.remove('modal-hiding');
            modalContainer.classList.remove('modal-visible');
        }

        const existingRoot = document.getElementById('sol-dashboard-root');
        const isModalVisible = modalContainer && !modalContainer.classList.contains('hidden');

        if (existingRoot && isModalVisible) {
            existingRoot.outerHTML = contentHtml;
            const footerBtn = document.querySelector('#event-button-container button');
            if (footerBtn) {
                footerBtn.innerHTML = 'Dismiss';
                footerBtn.onclick = () => this.uiManager.hideModal('event-modal');
            }
        } else {
            this.uiManager.queueModal('event-modal', 'Sol Station Directorate', contentHtml, null, {
                width: '800px', 
                dismissOutside: true,
                specialClass: 'sol-station-modal',
                buttonText: 'Dismiss',
                buttonClass: 'btn-dismiss-sm'
            });
        }
    }

    /**
     * Surgically updates the values in the existing dashboard without re-rendering.
     * @param {object} gameState 
     */
    update(gameState) {
        const root = document.getElementById('sol-dashboard-root');
        if (!root) return; 

        const station = gameState.solStation;
        const output = this._calculateProjections(gameState);
        const stockpile = station.stockpile;

        // 1. Update Header Bars & Text
        const integrityLabel = root.querySelector('.sol-health-bar-label span');
        const integrityBar = root.querySelector('.sol-health-fill');
        if (integrityLabel && integrityBar) {
            integrityLabel.className = this._getHealthColorClass(station.health);
            integrityLabel.textContent = `${station.health}%`;
            integrityBar.style.width = `${station.health}%`;
            integrityBar.style.backgroundColor = `var(${this._getHealthColorVar(station.health)})`;
        }

        // 2. Update Readouts
        const creditsVal = root.querySelector('[data-id="output-credits"]');
        const amVal = root.querySelector('[data-id="output-am"]');
        const entropyVal = root.querySelector('[data-id="output-entropy"]');
        const stockCreds = root.querySelector('[data-id="stock-credits"]');
        const stockAm = root.querySelector('[data-id="stock-am"]');
        const claimBtn = root.querySelector('button[data-action="sol-claim-output"]');

        if (creditsVal) creditsVal.textContent = formatCredits(output.credits);
        if (amVal) amVal.textContent = `+${output.antimatter} AM`;
        if (entropyVal) entropyVal.textContent = `${output.entropy.toFixed(2)}x`;
        if (stockCreds) stockCreds.textContent = formatCredits(stockpile.credits);
        if (stockAm) stockAm.textContent = `${stockpile.antimatter.toFixed(2)} AM`;
        
        if (claimBtn) {
            const hasStockpile = stockpile.credits > 0 || stockpile.antimatter > 0;
            claimBtn.disabled = !hasStockpile;
        }

        // 3. Update Mode Buttons
        root.querySelectorAll('.mode-btn').forEach(btn => {
            const mode = btn.dataset.mode;
            const isActive = mode === station.mode;
            if (isActive) {
                btn.classList.add('active');
                btn.disabled = true;
            } else {
                btn.classList.remove('active');
                btn.disabled = false;
            }
        });
        const modeDesc = root.querySelector('.mode-description');
        if (modeDesc) modeDesc.innerHTML = this._getModeDescription(station.mode);

        // 4. Update Caches (NEW LIST LAYOUT)
        const playerInventory = gameState.player.inventories[gameState.player.activeShipId];
        
        // Filter out excluded items (Folded Drives)
        const cacheEntries = Object.entries(station.caches)
            .filter(([id]) => id !== COMMODITY_IDS.FOLDED_DRIVES);

        cacheEntries.forEach(([commId, cache]) => {
            // Target the row by data-comm-id
            const row = root.querySelector(`.sol-cache-row[data-comm-id="${commId}"]`);
            if (row) {
                const bar = row.querySelector('.sol-progress-fill');
                const text = row.querySelector('.sol-progress-text');
                const btn = row.querySelector('.btn-deposit-all');

                const fillPct = (cache.current / cache.max) * 100;
                const playerStock = playerInventory[commId]?.quantity || 0;
                // Enable deposit if we have stock AND cache has space
                const canDonate = playerStock > 0 && cache.current < cache.max;

                if (bar) bar.style.width = `${fillPct}%`;
                if (text) text.textContent = `${formatCredits(cache.current, false)} / ${formatCredits(cache.max, false)}`;
                
                if (btn) {
                    btn.disabled = !canDonate;
                    btn.style.opacity = canDonate ? '1' : '0.5';
                }
            }
        });
    }

    showOfficerRoster(slotId, gameState) {
        const root = document.getElementById('sol-dashboard-root');
        if (!root) return; 

        const roster = gameState.solStation.roster || [];
        const assignedIds = gameState.solStation.officers.map(s => s.assignedOfficerId).filter(id => id);
        const availableOfficers = roster.filter(id => !assignedIds.includes(id));

        let listHtml = '';
        if (availableOfficers.length === 0) {
            listHtml = `<div class="text-center p-4 text-gray-400">No unassigned officers available.</div>`;
        } else {
            listHtml = availableOfficers.map(officerId => {
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
        }

        const currentAssignment = gameState.solStation.officers.find(s => s.slotId === parseInt(slotId));
        let footerHtml = '';
        if (currentAssignment && currentAssignment.assignedOfficerId) {
            footerHtml = `
                <div class="roster-footer">
                    <button class="btn btn-red w-full" data-action="sol-assign-officer" data-slot-id="${slotId}" data-officer-id="null">
                        UNASSIGN CURRENT OFFICER
                    </button>
                </div>
            `;
        }

        root.innerHTML = `
            <div class="sol-subview-header flex justify-center items-center mb-4">
                <div class="section-title mb-0">SELECT OFFICER (SLOT ${slotId})</div>
            </div>
            <div class="roster-list text-left">
                ${listHtml}
            </div>
            ${footerHtml}
        `;

        const footerBtn = document.querySelector('#event-button-container button');
        if (footerBtn) {
            footerBtn.innerHTML = '&larr;'; 
            footerBtn.onclick = () => this.showDashboard(gameState);
        }
    }

    // --- HTML GENERATORS ---

    _buildDashboardHtml(gameState) {
        const station = gameState.solStation;
        const output = this._calculateProjections(gameState);
        const stockpile = station.stockpile;
        const hasStockpile = stockpile.credits > 0 || stockpile.antimatter > 0;

        return `
            <div id="sol-dashboard-root" class="sol-dashboard-container">
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
                            <span class="value credits-text" data-id="output-credits">${formatCredits(output.credits)}</span>
                            <span class="value text-purple-400 text-sm" data-id="output-am">+${output.antimatter} AM</span>
                        </div>
                        <div class="readout-item">
                            <span class="label">STOCKPILE</span>
                            <span class="value credits-text" data-id="stock-credits">${formatCredits(stockpile.credits)}</span>
                            <span class="value text-purple-400 text-sm" data-id="stock-am">${stockpile.antimatter.toFixed(2)} AM</span>
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
                            <span class="value text-red-400" data-id="output-entropy">${output.entropy.toFixed(2)}x</span>
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
                    <div class="sol-cache-list">
                        ${this._renderCacheList(gameState)}
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
    }

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

    /**
     * Renders the new "Collapsed Commodity Style" list.
     * UPDATED: 
     * - Filters out Folded Drives (Tier 7)
     * - Restructured for 2-column layout (Name/Bar left, Button right)
     * - Opaque Artwork with text outlines
     * @param {object} gameState 
     */
    _renderCacheList(gameState) {
        const caches = gameState.solStation.caches;
        const playerInventory = gameState.player.inventories[gameState.player.activeShipId];
        const playerVisualSeed = gameState.player.visualSeed;

        return Object.entries(caches)
            .filter(([id]) => id !== COMMODITY_IDS.FOLDED_DRIVES) // Filter out Folded Drives
            .map(([commodityId, cache]) => {
                const commodity = DB.COMMODITIES.find(c => c.id === commodityId);
                if (!commodity) return `<div class="sol-cache-row-error">Error: ${commodityId}</div>`;

                const fillPct = (cache.current / cache.max) * 100;
                const playerStock = playerInventory[commodityId]?.quantity || 0;
                const canDonate = playerStock > 0 && cache.current < cache.max;
                const tierColorVar = `--tier-${commodity.tier || 1}-color`;

                // Get background art
                const bgImage = AssetService.getCommodityImage(commodity.name, playerVisualSeed);
                // Force opacity: 1 and remove filters to reveal artwork
                const bgStyle = bgImage ? `background-image: url('${bgImage}'); opacity: 1; filter: none;` : '';
                
                // High contrast text shadow (Outline effect)
                const textShadow = '1px 1px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000, -1px -1px 0 #000';

                return `
                    <div class="sol-cache-row" data-comm-id="${commodityId}" style="display: flex; flex-direction: row; align-items: center; justify-content: space-between; height: auto; min-height: 70px; padding: 0.5rem;">
                        <div class="sol-cache-row-bg" style="${bgStyle}"></div>
                        
                        <div class="sol-cache-content-left" style="z-index: 2; flex-grow: 1; display: flex; flex-direction: column; justify-content: center; margin-right: 0.5rem;">
                            <div class="sol-row-name" title="${commodity.name}" style="text-align: left; font-size: 0.85rem; margin-bottom: 4px; text-shadow: ${textShadow};">${commodity.name}</div>
                            
                            <div class="sol-row-track-container" style="width: 100%;">
                                <div class="sol-progress-track" style="border: 1px solid #000; box-shadow: 0 0 4px rgba(0,0,0,0.5);">
                                    <div class="sol-progress-fill" style="width: ${fillPct}%; background-color: var(${tierColorVar}, #fff);"></div>
                                    <div class="sol-threshold-marker" style="left: 20%;"></div>
                                    <div class="sol-progress-text" style="text-shadow: ${textShadow}; font-weight: bold;">${formatCredits(cache.current, false)} / ${formatCredits(cache.max, false)}</div>
                                </div>
                            </div>
                        </div>

                        <div class="sol-cache-action-right" style="z-index: 2; flex-shrink: 0;">
                            <button class="btn-deposit-all" 
                                    data-action="sol-donate-all" 
                                    data-commodity-id="${commodityId}"
                                    style="height: 100%; border: 1px solid #000; box-shadow: 0 2px 5px rgba(0,0,0,0.5);"
                                    ${!canDonate ? 'disabled' : ''}>
                                DEPOSIT
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
        if (buffs.entropy !== 0) parts.push(`<span class="buff-entropy">${buffs.entropy > 0 ? '+' : ''}${Math.round(buffs.entropy * 100)}% Decay</span>`);
        if (buffs.creditMult !== 0) parts.push(`<span class="buff-credits">+${Math.round(buffs.creditMult * 100)}% Credits</span>`);
        if (buffs.amMult !== 0) parts.push(`<span class="buff-am">+${Math.round(buffs.amMult * 100)}% AM</span>`);
        return parts.join(mini ? '<br>' : ' • ');
    }

    _calculateProjections(gameState) {
        const station = gameState.solStation;
        const MODES = {
            STABILITY: { entropyMult: 1, amMult: 1, creditMult: 1 },
            COMMERCE: { entropyMult: 3, amMult: 1, creditMult: 4 },
            PRODUCTION: { entropyMult: 4, amMult: 4, creditMult: 1 }
        };
        const BASE_CREDIT_OUTPUT = 1000;
        const BASE_AM_OUTPUT = 0.1;

        const modeConfig = MODES[station.mode];
        let buffTotals = { entropy: 0, creditMult: 0, amMult: 0 };
        
        station.officers.forEach(slot => {
            if (slot.assignedOfficerId && OFFICERS[slot.assignedOfficerId]) {
                const b = OFFICERS[slot.assignedOfficerId].buffs;
                buffTotals.entropy += b.entropy;
                buffTotals.creditMult += b.creditMult;
                buffTotals.amMult += b.amMult;
            }
        });

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