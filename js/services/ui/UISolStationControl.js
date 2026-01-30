import { STATION_CONFIG } from '../../data/station_config.js';
import { ALL_OFFICERS } from '../../data/officers/officerRegistry.js';
import { DB } from '../../data/database.js';

export class UISolStationControl {
    constructor(uiManager) {
        this.uiManager = uiManager;
    }

    /**
     * Handles the mode switch lever interaction.
     * @param {string} modeId 
     */
    handleSetMode(modeId) {
        if (!this._getService()) return;
        const success = this._getService().setMode(modeId);
        if (success) {
            this.uiManager.render(this.uiManager.lastKnownState);
            this.uiManager.createFloatingText("Station Mode Updated", window.innerWidth/2, window.innerHeight/2, STATION_CONFIG.MODES[modeId].color);
        }
    }

    /**
     * Handles donating a commodity to the station cache.
     * Donates the maximum available amount from the player's active ship.
     * @param {string} commodityId 
     * @param {Event} event 
     */
    handleDonate(commodityId, event) {
        const gameState = this.uiManager.lastKnownState;
        const player = gameState.player;
        const inventory = player.inventories[player.activeShipId];
        
        if (!inventory || !inventory[commodityId] || inventory[commodityId].quantity <= 0) {
            this.uiManager.queueModal('event-modal', 'No Cargo', 'You do not have any of this commodity to donate.');
            return;
        }

        const amount = inventory[commodityId].quantity;
        const goodName = DB.COMMODITIES.find(c => c.id === commodityId).name;

        const success = this._getService().donateCargo(commodityId, amount);
        
        if (success) {
            // Remove from player inventory
            inventory[commodityId].quantity = 0;
            
            this.uiManager.render(gameState);
            this.uiManager.createFloatingText(`Donated ${amount}x ${goodName}`, event.clientX, event.clientY, '#22c55e');
            this.uiManager.triggerEffect('systemSurge', { theme: 'green' });

            // [[FIX]] Refresh the modal to show updated values
            this.showCachesModal();
        }
    }

    /**
     * Harvests accumulated resources (Credits/Antimatter).
     * @param {Event} event 
     */
    handleHarvest(event) {
        const payout = this._getService().withdrawAccumulated();
        if (payout) {
            let msg = [];
            if (payout.credits > 0) msg.push(`${payout.credits} Credits`);
            if (payout.antimatter > 0) msg.push(`${payout.antimatter.toFixed(2)} Antimatter`);
            
            this.uiManager.render(this.uiManager.lastKnownState);
            this.uiManager.createFloatingText(`Harvested: ${msg.join(', ')}`, event.clientX, event.clientY, '#fbbf24');
        } else {
            this.uiManager.queueModal('event-modal', 'Empty Banks', 'Production buffers are empty.');
        }
    }

    // --- Caches Management (NEW) ---

    showCachesModal() {
        const state = this.uiManager.lastKnownState.solStation;
        const player = this.uiManager.lastKnownState.player;
        const inventory = player.inventories[player.activeShipId] || {};

        let content = '<div class="sol-caches-grid">';
        
        // Group by Tier logic
        const tierGroups = {};
        Object.keys(state.caches).forEach(chemId => {
            const def = DB.COMMODITIES.find(c => c.id === chemId);
            if (!def) return;
            if (!tierGroups[def.tier]) tierGroups[def.tier] = [];
            tierGroups[def.tier].push({ id: chemId, qty: state.caches[chemId], def });
        });

        for (let t = 1; t <= 6; t++) {
            if (!tierGroups[t]) continue;
            const burnReq = STATION_CONFIG.WEEKLY_BURN[t];
            content += `<div class="tier-group"><div class="tier-label">TIER ${t} (Burn: ${burnReq}/wk)</div><div class="cache-row">`;
            
            tierGroups[t].forEach(item => {
                const daysRemaining = item.qty > 0 ? (item.qty / (burnReq/7)).toFixed(1) : '0.0';
                const playerStock = inventory[item.id]?.quantity || 0;
                const canDonate = playerStock > 0;

                content += `
                    <div class="cache-card tier-${t}" style="border-color: var(--tier-${t}-color)">
                        <div class="cache-icon" style="background-image: url('assets/commodities/${item.id}.png')"></div>
                        <div class="cache-info">
                            <div class="cache-name">${item.def.name}</div>
                            <div class="cache-stock ${item.qty === 0 ? 'text-red' : ''}">${Math.floor(item.qty)} Units</div>
                            <div class="cache-time">${daysRemaining} Days</div>
                        </div>
                        <button class="btn-donate ${canDonate ? 'active' : ''}" 
                                data-action="sol-donate" 
                                data-good-id="${item.id}"
                                ${!canDonate ? 'disabled' : ''}>
                            +
                        </button>
                    </div>
                `;
            });
            content += `</div></div>`;
        }
        content += '</div>';

        // Use 'event-modal' for reliability, repurposing it for custom HTML content
        this.uiManager.queueModal('event-modal', 'Maintenance Caches', content, null, {
            modalClass: 'sol-station-modal',
            dismissOutside: true
        });
    }

    // --- Roster Management ---

    showRosterModal() {
        const state = this.uiManager.lastKnownState.solStation;
        const assigned = state.roster.assigned;
        
        let content = `<div class="roster-grid">`;
        
        // 1. Assigned Slots
        content += `<div class="roster-section"><h3>Directorate</h3><div class="roster-slots">`;
        assigned.forEach((offId, idx) => {
            if (offId) {
                const officer = ALL_OFFICERS.find(o => o.id === offId);
                content += this._renderOfficerCard(officer, true, idx);
            } else {
                content += `<div class="officer-card empty-slot"><span>VACANT SLOT</span></div>`;
            }
        });
        content += `</div></div>`;

        // 2. Available Pool
        content += `<div class="roster-section"><h3>Candidates</h3><div class="roster-pool">`;
        ALL_OFFICERS.forEach(officer => {
            if (!assigned.includes(officer.id)) {
                // Future: Check unlock conditions here
                content += this._renderOfficerCard(officer, false, null);
            }
        });
        content += `</div></div></div>`;

        // [[FIX]] Use standard 'event-modal' logic
        this.uiManager.queueModal('event-modal', 'Station Directorate', content, null, {
            modalClass: 'sol-station-modal',
            dismissOutside: true
        });
    }

    _renderOfficerCard(officer, isAssigned, slotIdx) {
        const action = isAssigned ? `data-action="sol-unassign" data-slot="${slotIdx}"` : `data-action="sol-assign" data-officer-id="${officer.id}"`;
        const btnText = isAssigned ? "Dismiss" : "Assign";
        const btnClass = isAssigned ? "btn-danger" : "btn-confirm";
        
        // Buffs formatting
        const buffs = Object.entries(officer.buffs).map(([k, v]) => {
            if (v === 0) return '';
            const val = (v * 100).toFixed(1);
            // Heuristic for color: Negative decay is good, Positive output is good
            const isGood = (k.includes('decay') && v < 0) || (!k.includes('decay') && v > 0);
            return `<div class="buff-row ${isGood ? 'text-green' : 'text-red'}">${k.replace('_mult', '')}: ${val}%</div>`;
        }).join('');

        return `
            <div class="officer-card">
                <div class="officer-portrait" style="background-image: url('${officer.portrait}')"></div>
                <div class="officer-info">
                    <div class="officer-name">${officer.name}</div>
                    <div class="officer-role">${officer.role}</div>
                    <div class="officer-buffs">${buffs}</div>
                </div>
                <button class="btn ${btnClass} btn-sm" ${action}>${btnText}</button>
            </div>
        `;
    }

    handleAssignOfficer(officerId) {
        const state = this.uiManager.lastKnownState.solStation;
        // Find first empty slot
        const emptyIdx = state.roster.assigned.indexOf(null);
        if (emptyIdx === -1) {
            this.uiManager.queueModal('event-modal', 'Directorate Full', 'No vacant slots available. Dismiss an officer first.');
            return;
        }
        
        state.roster.assigned[emptyIdx] = officerId;
        this.uiManager.render(this.uiManager.lastKnownState);
        this.uiManager.hideModal(); 
        this.showRosterModal(); 
    }

    handleUnassignOfficer(slotIdx) {
        const state = this.uiManager.lastKnownState.solStation;
        state.roster.assigned[slotIdx] = null;
        this.uiManager.render(this.uiManager.lastKnownState);
        this.uiManager.hideModal();
        this.showRosterModal();
    }

    _getService() {
        return this.uiManager.simulationService.solStationService;
    }
}