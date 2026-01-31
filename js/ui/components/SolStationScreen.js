// js/ui/components/SolStationScreen.js
import { formatCredits } from '../../utils.js';
import { STATION_CONFIG } from '../../data/station_config.js';

export class SolStationScreen {
    constructor(container, uiManager) {
        this.container = container;
        this.uiManager = uiManager;
        this.dom = null;
    }

    /**
     * Builds the static DOM structure.
     */
    mount() {
        this.container.innerHTML = `
            <div class="sol-station-container">
                <div class="sol-header">
                    <div class="sol-title">Sol Station Directorate</div>
                    <div class="entropy-container">
                        <div class="entropy-label">
                            <span>STATION ENTROPY</span>
                            <span id="sol-entropy-value">0%</span>
                        </div>
                        <div class="entropy-bar-track">
                            <div id="sol-entropy-fill" class="entropy-bar-fill"></div>
                        </div>
                    </div>
                </div>

                <div class="sol-deck">
                    <div class="mode-switcher" id="sol-mode-switcher">
                        <button class="mode-btn" data-mode="DEFAULT">STATION KEEPING</button>
                        <button class="mode-btn" data-mode="SIPHON">SOLAR SIPHON</button>
                        <button class="mode-btn" data-mode="FORTIFY">FORTIFY</button>
                    </div>

                    <div class="sol-bank">
                        <div class="bank-module">
                            <span class="bank-label">Accrued Credits</span>
                            <span class="bank-value credits" id="sol-bank-credits">0</span>
                        </div>
                        <div class="bank-module">
                            <span class="bank-label">Antimatter</span>
                            <span class="bank-value antimatter" id="sol-bank-antimatter">0.000</span>
                        </div>
                    </div>
                </div>

                <div class="sol-section-title">Maintenance Caches (Weekly Burn)</div>
                <div class="cache-grid" id="sol-cache-grid">
                    <div class="cache-card-placeholder">Loading Caches...</div>
                </div>

                <div class="sol-section-title">Command Staff</div>
                <div class="officer-roster" id="sol-officer-roster">
                    <div class="roster-slot">
                        <span class="slot-label">Commander</span>
                        <span class="slot-status">Vacant</span>
                    </div>
                </div>
            </div>
        `;
        
        // Bind events after mounting
        this.bindEvents();
    }

    /**
     * Updates the UI with current GameState data.
     * @param {Object} state - Full GameState
     */
    update(state) {
        const station = state.solStation;
        if (!station) return;

        // 1. Update Entropy
        const entropyVal = document.getElementById('sol-entropy-value');
        const entropyFill = document.getElementById('sol-entropy-fill');
        if (entropyVal && entropyFill) {
            const pct = Math.floor(station.entropy);
            entropyVal.textContent = `${pct}%`;
            entropyFill.style.width = `${pct}%`;
            
            // Visual Color Logic based on thresholds
            if (pct < 20) entropyFill.style.background = '#00ffaa'; // Good
            else if (pct < 80) entropyFill.style.background = '#ffae00'; // Warning
            else entropyFill.style.background = '#ff0000'; // Critical
        }

        // 2. Update Mode Buttons
        const buttons = document.querySelectorAll('.mode-btn');
        buttons.forEach(btn => {
            if (btn.dataset.mode === station.mode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // 3. Update Bank
        const bankCredits = document.getElementById('sol-bank-credits');
        const bankAM = document.getElementById('sol-bank-antimatter');
        if (bankCredits) bankCredits.textContent = formatCredits(Math.floor(station.bank.credits));
        if (bankAM) bankAM.textContent = station.bank.antimatter.toFixed(3);

        // 4. Update Caches (Skeleton for now)
        // In Phase 4, we will fully populate this.
        // For Phase 3, we just clear the "Loading" text.
        const grid = document.getElementById('sol-cache-grid');
        if (grid && grid.children[0]?.classList.contains('cache-card-placeholder')) {
             grid.innerHTML = ''; // Clear placeholder once
             // Temporary placeholder logic until Phase 4
             grid.innerHTML = `<div style="grid-column: span 2; text-align:center; color:#555; padding:20px;">
                Cache Management Interface Offline (Phase 3)
             </div>`;
        }
    }

    bindEvents() {
        const switcher = document.getElementById('sol-mode-switcher');
        if (switcher) {
            switcher.addEventListener('click', (e) => {
                if (e.target.classList.contains('mode-btn')) {
                    const newMode = e.target.dataset.mode;
                    this.handleModeSwitch(newMode);
                }
            });
        }
    }

    handleModeSwitch(newMode) {
        // Optimistic update via GameState
        // In a real implementation, we might call SolStationService directly 
        // or emit an event. For now, direct state mutation is consistent 
        // with this codebase's "Mutate & Notify" pattern.
        window.gameState.update('solStation.mode', newMode);
    }
}