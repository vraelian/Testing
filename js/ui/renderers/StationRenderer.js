/**
 * StationRenderer.js
 * * Responsible for rendering the visual components of the Sol Station Interface.
 * Handles the "Face" of the station: Dashboard, Metrics, and Mode Lever.
 */

import { STATION_CONFIG } from '../../data/station_config.js';

export class StationRenderer {
    constructor() {
        this.container = null;
    }

    /**
     * Main Render Entry
     * @param {string} containerId - The DOM ID to render into.
     * @param {Object} state - The current station state from Service.
     */
    render(containerId, state) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        // Base Grid Layout
        let html = `
            <div class="sol-station-wrapper">
                ${this._renderHeader(state)}
                
                <div class="sol-dashboard-grid">
                    <div class="sol-metrics-panel">
                        ${this._renderMetrics(state)}
                    </div>

                    <div class="sol-core-panel">
                        ${this._renderBank(state)}
                        ${this._renderLever(state)}
                    </div>

                    <div class="sol-actions-panel">
                        ${this._renderMenu(state)}
                    </div>
                </div>
            </div>
        `;

        this.container.innerHTML = html;
    }

    _renderHeader(state) {
        return `
            <div class="sol-header">
                <div class="station-identity">
                    <h1>SOL STATION <span class="tier-badge">TIER 7</span></h1>
                    <div class="sub-identity">PERIHELION OUTPOST</div>
                </div>
                <div class="station-status-text">
                    STATUS: <span class="status-indicator ${state.mode === 'overdrive' ? 'status-critical' : 'status-optimal'}">
                        ${state.mode === 'overdrive' ? 'OVERDRIVE' : 'NOMINAL'}
                    </span>
                </div>
            </div>
        `;
    }

    _renderMetrics(state) {
        // Entropy (0-100%) - Inverted visual (100% Health = 0% Entropy)
        // We render "Structural Integrity" or "Entropy Level" based on GDD. 
        // GDD says "Station Entropy".
        const entropyPct = state.entropy || 0;
        const xpPct = state.xpProgress || 0; // Assuming 0-100 float

        return `
            <div class="metric-container">
                <div class="metric-label">
                    <span>STATION ENTROPY</span>
                    <span class="metric-value danger-text">${entropyPct.toFixed(1)}%</span>
                </div>
                <div class="progress-track">
                    <div class="progress-fill entropy-fill" style="width: ${entropyPct}%"></div>
                </div>
            </div>

            <div class="metric-container">
                <div class="metric-label">
                    <span>DIRECTORATE ACCESS</span>
                    <span class="metric-value gold-text">LEVEL ${state.level || 1}</span>
                </div>
                <div class="progress-track">
                    <div class="progress-fill xp-fill" style="width: ${xpPct}%"></div>
                </div>
            </div>
        `;
    }

    _renderBank(state) {
        // Formatter for numbers
        const fmt = (n) => n.toLocaleString();

        return `
            <div class="sol-bank-display">
                <div class="readout-box antimatter-box">
                    <div class="readout-label">ANTIMATTER</div>
                    <div class="readout-value purple-glow">${fmt(state.antimatter || 0)} <span class="unit">AM</span></div>
                </div>
                <div class="readout-box credits-box">
                    <div class="readout-label">CREDITS</div>
                    <div class="readout-value blue-glow">${fmt(state.credits || 0)} <span class="unit">CR</span></div>
                </div>
            </div>
        `;
    }

    _renderLever(state) {
        const isOverdrive = state.mode === 'overdrive';
        
        return `
            <div class="lever-wrapper">
                <div class="lever-label ${!isOverdrive ? 'active-text' : ''}">STANDARD</div>
                
                <div id="sol-mode-toggle" class="sol-toggle-switch ${isOverdrive ? 'toggled-on' : ''}">
                    <div class="toggle-handle"></div>
                    <div class="toggle-track-decor"></div>
                </div>

                <div class="lever-label ${isOverdrive ? 'danger-text' : ''}">OVERDRIVE</div>
            </div>
            <div class="lever-help-text">
                ${isOverdrive ? 'WARNING: ENTROPY ACCELERATED' : 'STATION SYSTEMS STABLE'}
            </div>
        `;
    }

    _renderMenu(state) {
        return `
            <button id="btn-sol-maintenance" class="sol-action-btn">
                <span class="icon">🛠️</span>
                <span class="label">MAINTENANCE CACHES</span>
            </button>
            <button id="btn-sol-directorate" class="sol-action-btn">
                <span class="icon">👥</span>
                <span class="label">DIRECTORATE</span>
            </button>
            <button id="btn-sol-trade" class="sol-action-btn">
                <span class="icon">⚖️</span>
                <span class="label">COMMODITY EXCHANGE</span>
            </button>
        `;
    }
}