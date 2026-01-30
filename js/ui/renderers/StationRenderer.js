import { STATION_CONFIG } from '../../data/station_config.js';
import { DB } from '../../data/database.js';
import { formatCredits } from '../../utils.js';

export class StationRenderer {
    /**
     * Renders the Sol Station Dashboard into the container.
     * @param {HTMLElement} container 
     * @param {object} gameState 
     */
    static render(container, gameState) {
        const state = gameState.solStation;
        const modeDef = STATION_CONFIG.MODES[state.mode];
        
        // 1. Header & Bank
        const headerHtml = `
            <div class="sol-header">
                <div class="sol-title">SOL STATION <span class="sol-level">LVL ${state.level}</span></div>
                <div class="sol-bank">
                    <div class="bank-item">
                        <span class="bank-label">CREDITS</span>
                        <span class="bank-value credits-text">${formatCredits(state.accumulated.credits)}</span>
                    </div>
                    <div class="bank-item">
                        <span class="bank-label">ANTIMATTER</span>
                        <span class="bank-value antimatter-text">${state.accumulated.antimatter.toFixed(3)}</span>
                    </div>
                    <button class="btn btn-sm btn-harvest" data-action="sol-harvest">HARVEST</button>
                </div>
            </div>
        `;

        // 2. Status Bars (Entropy & XP)
        const entropyPct = state.entropy;
        const entropyColor = entropyPct > 70 ? '#22c55e' : entropyPct > 30 ? '#eab308' : '#ef4444';
        
        // XP Calculation
        const xpReq = STATION_CONFIG.getXPForLevel(state.level);
        const xpPct = (state.xp / xpReq) * 100;

        const statusHtml = `
            <div class="sol-status-panel">
                <div class="status-row">
                    <span class="status-label">ENTROPY STABILITY</span>
                    <div class="bar-container">
                        <div class="bar-fill" style="width: ${entropyPct}%; background-color: ${entropyColor};"></div>
                    </div>
                    <span class="status-value">${entropyPct.toFixed(1)}%</span>
                </div>
                <div class="status-row">
                    <span class="status-label">PROGRESS</span>
                    <div class="bar-container">
                        <div class="bar-fill xp-fill" style="width: ${xpPct}%;"></div>
                    </div>
                    <span class="status-value">${state.xp}/${xpReq} XP</span>
                </div>
            </div>
        `;

        // 3. The Lever (Mode Switch)
        const modesHtml = Object.values(STATION_CONFIG.MODES).map(m => {
            const isActive = m.id === state.mode;
            return `
                <div class="mode-option ${isActive ? 'active' : ''}" 
                     data-action="sol-set-mode" 
                     data-mode="${m.id}"
                     style="--mode-color: ${m.color}">
                    <div class="mode-label">${m.label}</div>
                    <div class="mode-flavor">${m.flavor}</div>
                </div>
            `;
        }).join('');

        const leverHtml = `
            <div class="sol-lever-container">
                <div class="lever-track">
                    ${modesHtml}
                </div>
            </div>
        `;

        // 4. Maintenance Caches (The Burn)
        // Group by Tier
        let cachesHtml = '<div class="sol-caches-grid">';
        
        const tierGroups = {};
        Object.keys(state.caches).forEach(chemId => {
            const def = DB.COMMODITIES.find(c => c.id === chemId);
            if (!def) return;
            if (!tierGroups[def.tier]) tierGroups[def.tier] = [];
            tierGroups[def.tier].push({ id: chemId, qty: state.caches[chemId], def });
        });

        // Iterate Tiers 1-6
        for (let t = 1; t <= 6; t++) {
            if (!tierGroups[t]) continue;
            const burnReq = STATION_CONFIG.WEEKLY_BURN[t];
            
            cachesHtml += `<div class="tier-group"><div class="tier-label">TIER ${t} (Burn: ${burnReq}/wk)</div><div class="cache-row">`;
            
            tierGroups[t].forEach(item => {
                const daysRemaining = item.qty > 0 ? (item.qty / (burnReq/7)).toFixed(1) : '0.0';
                const playerStock = gameState.player.inventories[gameState.player.activeShipId]?.[item.id]?.quantity || 0;
                const canDonate = playerStock > 0;

                cachesHtml += `
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
            cachesHtml += `</div></div>`;
        }
        cachesHtml += '</div>';

        // 5. Footer (Roster Button)
        const footerHtml = `
            <div class="sol-footer">
                <button class="btn btn-wide" data-action="sol-open-roster">MANAGE DIRECTORATE</button>
            </div>
        `;

        // Assemble
        container.innerHTML = `
            <div class="sol-dashboard" style="--active-mode-color: ${modeDef.color}">
                ${headerHtml}
                ${statusHtml}
                ${leverHtml}
                ${cachesHtml}
                ${footerHtml}
            </div>
        `;
    }
}