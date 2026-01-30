import { STATION_CONFIG } from '../../data/station_config.js';
import { DB } from '../../data/database.js';
import { formatCredits } from '../../utils.js';

export class StationRenderer {
    /**
     * Returns the HTML string for the Sol Station Dashboard.
     * @param {object} gameState 
     * @returns {string}
     */
    static getHTML(gameState) {
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

        // 4. Action Buttons (Replaced Inline Caches)
        const actionsHtml = `
            <div class="sol-actions-row" style="display: flex; gap: 1rem; margin-top: 1rem;">
                <button class="btn btn-wide" data-action="sol-open-caches">MANAGE MAINTENANCE CACHES</button>
                <button class="btn btn-wide" data-action="sol-open-roster">MANAGE DIRECTORATE</button>
            </div>
        `;

        // Assemble
        return `
            <div class="sol-dashboard" style="--active-mode-color: ${modeDef.color}">
                ${headerHtml}
                ${statusHtml}
                ${leverHtml}
                ${actionsHtml}
            </div>
        `;
    }
}