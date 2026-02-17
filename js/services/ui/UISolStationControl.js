// js/services/ui/UISolStationControl.js
import { DB } from '../../data/database.js';
import { OFFICERS } from '../../data/officers.js';
import { formatCredits } from '../../utils.js';
import { ACTION_IDS, COMMODITY_IDS } from '../../data/constants.js';
import { AssetService } from '../AssetService.js'; 

export class UISolStationControl {
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.animationFrameId = null;
        this.visualState = null; 
        
        this.domCache = null; 
        this.lastRendered = {}; 
    }

    _getLiveStationState(gameState) {
        if (this.uiManager && this.uiManager.simulationService && this.uiManager.simulationService.solStationService) {
            return this.uiManager.simulationService.solStationService.getLiveState();
        }
        return gameState.solStation;
    }

    showDashboard(gameState) {
        const station = this._getLiveStationState(gameState);
        if (!station.unlocked) return; 

        if (this.uiManager && this.uiManager.simulationService && this.uiManager.simulationService.solStationService) {
            const svc = this.uiManager.simulationService.solStationService;
            svc.catchUpDays(gameState.day);
            svc.startTracking();
        }

        const contentHtml = this._buildDashboardHtml(gameState);
        const modalContainer = document.getElementById('event-modal');
        
        if (modalContainer && modalContainer.classList.contains('modal-hiding')) {
            modalContainer.classList.add('hidden');
            modalContainer.classList.remove('modal-hiding');
            modalContainer.classList.remove('modal-visible');
        }

        const existingRoot = document.getElementById('sol-dashboard-root');
        const isModalVisible = modalContainer && !modalContainer.classList.contains('hidden');

        if (existingRoot && isModalVisible) {
            existingRoot.outerHTML = contentHtml;
            this.domCache = null; 
            
            const footerBtn = document.querySelector('#event-button-container button');
            if (footerBtn) {
                footerBtn.innerHTML = 'Dismiss';
                footerBtn.onclick = () => {
                    this._stopRefreshLoop();
                    if (this.uiManager.simulationService && this.uiManager.simulationService.solStationService) {
                        const svc = this.uiManager.simulationService.solStationService;
                        svc.stopTracking();
                        svc.commitPendingUniverseDays();
                    }
                    this.uiManager.hideModal('event-modal');
                };
            }
        } else {
            this.domCache = null; 
            this.uiManager.queueModal('event-modal', '', contentHtml, () => {
                this._stopRefreshLoop();
                if (this.uiManager.simulationService && this.uiManager.simulationService.solStationService) {
                    const svc = this.uiManager.simulationService.solStationService;
                    svc.stopTracking();
                    svc.commitPendingUniverseDays();
                }
            }, {
                width: '800px', 
                dismissOutside: true,
                specialClass: 'sol-station-modal',
                buttonText: 'Dismiss',
                buttonClass: 'btn-dismiss-sm',
            });
        }
        
        this._startRefreshLoop();
    }

    _buildDomCache(root) {
        this.domCache = {
            integrityLabel: root.querySelector('.sol-health-bar-label span'),
            integrityBar: root.querySelector('.sol-health-fill'),
            entropyVal: root.querySelector('[data-id="output-entropy"]'),
            thresholdMarker: root.querySelector('.sol-health-threshold-marker'),
            amBar: root.querySelector('.sol-am-fill'),
            amText: root.querySelector('.sol-am-text'),
            amCollectBtn: root.querySelector('button[data-action="sol-claim-output"][data-type="antimatter"]'),
            credVal: root.querySelector('[data-id="stock-credits"]'),
            credCollectBtn: root.querySelector('button[data-action="sol-claim-output"][data-type="credits"]'),
            modeBtns: Array.from(root.querySelectorAll('.mode-btn')),
            modeDesc: root.querySelector('.mode-description'),
            caches: {}
        };

        root.querySelectorAll('.sol-cache-row').forEach(row => {
            const commId = row.dataset.commId;
            if (commId) {
                this.domCache.caches[commId] = {
                    bar: row.querySelector('.sol-progress-fill'),
                    text: row.querySelector('.sol-progress-text'),
                    btn: row.querySelector('.btn-deposit-all')
                };
            }
        });
    }

    update(gameState) {
        const root = document.getElementById('sol-dashboard-root');
        if (!root) return; 

        if (!this.domCache) {
            this._buildDomCache(root);
            this.lastRendered = { caches: {} };
        }

        const station = this._getLiveStationState(gameState);
        
        // Resync Visual State to True State
        if (this.visualState) {
            this.visualState.credits = station.stockpile.credits;
            this.visualState.antimatter = station.stockpile.antimatter;
            Object.entries(station.caches).forEach(([id, c]) => {
                this.visualState.caches[id] = c.current;
            });
        }

        const output = this._calculateProjections(gameState);
        const c = this.domCache;
        const lr = this.lastRendered;

        if (lr.health !== station.health) {
            if (c.integrityLabel && c.integrityBar) {
                c.integrityLabel.className = this._getHealthColorClass(station.health);
                c.integrityLabel.textContent = `${station.health}%`;
                c.integrityBar.style.width = `${station.health}%`;
                c.integrityBar.style.backgroundColor = `var(${this._getHealthColorVar(station.health)})`;
            }
            lr.health = station.health;
        }

        if (lr.entropy !== output.entropy) {
            if (c.entropyVal) c.entropyVal.textContent = `${output.entropy.toFixed(2)}x`;
            lr.entropy = output.entropy;
        }

        if (lr.threshold !== output.threshold) {
            if (c.thresholdMarker) {
                c.thresholdMarker.style.left = `${output.threshold}%`;
            }
            lr.threshold = output.threshold;
        }

        const amMax = 150; 
        const amCurrent = Math.min(amMax, station.stockpile.antimatter); 
        if (lr.amCurrent !== amCurrent) {
            const amFillPct = (amCurrent / amMax) * 100;
            if (c.amBar) c.amBar.style.width = `${amFillPct}%`;
            if (c.amCollectBtn) {
                 c.amCollectBtn.disabled = amCurrent < 1; 
                 c.amCollectBtn.style.opacity = amCurrent >= 1 ? '1' : '0.5';
            }
            lr.amCurrent = amCurrent;
        }

        const creds = Math.floor(station.stockpile.credits);
        if (lr.credits !== creds) {
            if (c.credCollectBtn) {
                c.credCollectBtn.disabled = creds <= 0;
                c.credCollectBtn.style.opacity = creds > 0 ? '1' : '0.5';
            }
            lr.credits = creds;
        }

        if (lr.mode !== station.mode) {
            c.modeBtns.forEach(btn => {
                const mode = btn.dataset.mode;
                const isActive = mode === station.mode;
                btn.className = `mode-btn ${mode.toLowerCase()} ${isActive ? 'active' : 'inactive'}`;
                btn.disabled = isActive;
            });
            if (c.modeDesc) c.modeDesc.innerHTML = this._getModeDescription(station.mode);
            lr.mode = station.mode;
        }

        const playerInventory = gameState.player.inventories[gameState.player.activeShipId];
        const cacheEntries = Object.entries(station.caches).filter(([id]) => id !== COMMODITY_IDS.FOLDED_DRIVES);

        cacheEntries.forEach(([commId, cache]) => {
            const playerStock = playerInventory[commId]?.quantity || 0;
            const cacheKey = `${cache.current}_${playerStock}`; 

            if (lr.caches[commId] !== cacheKey) {
                const ui = c.caches[commId];
                if (ui) {
                    const fillPct = (cache.current / cache.max) * 100;
                    const canDonate = playerStock > 0 && cache.current < cache.max;

                    if (ui.bar) ui.bar.style.width = `${fillPct}%`;
                    if (ui.btn) {
                        ui.btn.disabled = !canDonate;
                        ui.btn.style.opacity = canDonate ? '1' : '0.5';
                    }
                }
                lr.caches[commId] = cacheKey;
            }
        });
    }

    _startRefreshLoop() {
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        
        const svc = this.uiManager.simulationService ? this.uiManager.simulationService.solStationService : null;
        if (!svc) return;

        this.visualState = {
            credits: svc.gameState.solStation.stockpile.credits,
            antimatter: svc.gameState.solStation.stockpile.antimatter,
            caches: {}
        };
        Object.entries(svc.gameState.solStation.caches).forEach(([id, c]) => {
            this.visualState.caches[id] = c.current;
        });

        let lastFrameTime = performance.now();
        let lastCommitTime = performance.now();

        const loop = (now) => {
            const root = document.getElementById('sol-dashboard-root');
            if (!root || !document.body.contains(root) || root.closest('.hidden')) {
                this._stopRefreshLoop();
                return;
            }

            const dtReal = (now - lastFrameTime) / 1000;
            lastFrameTime = now;

            const rates = svc.getPerSecondRates();

            this.visualState.credits += rates.creditsPerSec * dtReal;
            this.visualState.antimatter = Math.min(150, this.visualState.antimatter + rates.amPerSec * dtReal);
            
            Object.keys(this.visualState.caches).forEach(id => {
                this.visualState.caches[id] = this.visualState.caches[id] * Math.exp(-rates.k * dtReal);
            });

            if (this.domCache) {
                if (this.domCache.credVal) this.domCache.credVal.textContent = Math.floor(this.visualState.credits).toLocaleString();
                if (this.domCache.amText) this.domCache.amText.textContent = `${this.visualState.antimatter.toFixed(2)} / 150`;
                
                Object.entries(this.visualState.caches).forEach(([id, val]) => {
                    const cacheUi = this.domCache.caches[id];
                    if (cacheUi) {
                        const max = svc.gameState.solStation.caches[id].max;
                        cacheUi.text.textContent = `${Math.floor(val).toLocaleString()} / ${max.toLocaleString()}`;
                    }
                });
            }

            if (now - lastCommitTime > 1000) {
                svc.commitLiveTime();
                this.update(svc.gameState);
                
                const navDay = document.getElementById('nav-date') || document.querySelector('.nav-date'); 
                if (navDay && svc.gameState.day) navDay.innerText = `Day ${svc.gameState.day}`;
                
                lastCommitTime = now;
            }

            this.animationFrameId = requestAnimationFrame(loop);
        };

        this.animationFrameId = requestAnimationFrame(loop);
    }

    _stopRefreshLoop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.domCache = null; 
    }

    showOfficerRoster(slotId, gameState) {
        const root = document.getElementById('sol-dashboard-root');
        if (!root) return; 

        this._stopRefreshLoop();

        const station = this._getLiveStationState(gameState);
        const roster = station.roster || [];
        const assignedIds = station.officers.map(s => s.assignedOfficerId).filter(id => id);
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
                        <button type="button" class="btn btn-sm btn-action">ASSIGN</button>
                    </div>
                `;
            }).join('');
        }

        const currentAssignment = station.officers.find(s => s.slotId === parseInt(slotId));
        let footerHtml = '';
        if (currentAssignment && currentAssignment.assignedOfficerId) {
            footerHtml = `
                <div class="roster-footer">
                    <button type="button" class="btn btn-red w-full" data-action="sol-assign-officer" data-slot-id="${slotId}" data-officer-id="null">
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

        this.domCache = null; 

        const footerBtn = document.querySelector('#event-button-container button');
        if (footerBtn) {
            footerBtn.innerHTML = '&larr;'; 
            footerBtn.onclick = () => this.showDashboard(gameState);
        }
    }

    // --- HTML GENERATORS ---

    _buildDashboardHtml(gameState) {
        const station = this._getLiveStationState(gameState);
        const output = this._calculateProjections(gameState);
        const stockpile = station.stockpile;
        const playerVisualSeed = gameState.player.visualSeed;

        const amBgImage = AssetService.getCommodityImage("Antimatter", playerVisualSeed);
        const amBgStyle = amBgImage ? `background-image: url('${amBgImage}'); opacity: 1; filter: none;` : '';
        const textShadow = '0 4px 6px rgba(0,0,0,0.9), 1px 1px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000, -1px -1px 0 #000';

        const amMax = 150;
        const amCurrent = Math.min(amMax, stockpile.antimatter);
        const amFillPct = (amCurrent / amMax) * 100;
        const hasAm = amCurrent >= 1;
        const hasCredits = stockpile.credits > 0;

        return `
            <div id="sol-dashboard-root" class="sol-dashboard-container">
                
                <div class="sol-header-panel" style="display: flex; gap: 1rem; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
                    <div class="sol-health-container" style="flex-grow: 1;">
                        <div class="sol-health-bar-label">STATION HEALTH: <span class="${this._getHealthColorClass(station.health)}">${station.health}%</span></div>
                        <div class="sol-health-track" style="position: relative;">
                            <div class="sol-health-fill" style="width: ${station.health}%; background-color: var(${this._getHealthColorVar(station.health)});"></div>
                            <div class="sol-health-threshold-marker" style="position: absolute; top: -2px; bottom: -2px; width: 3px; background-color: transparent; z-index: 10; border-left: 2px solid #fff; box-shadow: -1px 0 2px #000; left: ${output.threshold}%;"></div>
                        </div>
                    </div>
                    <div class="sol-entropy-readout" style="text-align: right;">
                        <div class="label" style="font-size: 0.7rem; color: #6b7280;">ENTROPY</div>
                        <div class="value text-red-400" data-id="output-entropy" style="font-size: 1.2rem; font-weight: bold;">${output.entropy.toFixed(2)}x</div>
                    </div>
                </div>

                <div class="sol-output-container">
                    <div class="section-title">STATION OUTPUT</div>
                    
                    <div class="sol-cache-row" style="display: flex; flex-direction: row; align-items: center; justify-content: space-between; height: auto; min-height: 70px; padding: 0.5rem; margin-bottom: 0.5rem;">
                        <div class="sol-cache-row-bg" style="${amBgStyle}"></div>
                        
                        <div class="sol-cache-content-left" style="z-index: 2; flex-grow: 1; display: flex; flex-direction: column; justify-content: center; margin-right: 0.5rem;">
                            <div class="sol-row-name" style="text-align: left; font-size: 1.1rem; margin-bottom: 4px; text-shadow: ${textShadow}; white-space: nowrap; overflow: visible;">ANTIMATTER</div>
                            
                            <div class="sol-row-track-container" style="width: 100%;">
                                <div class="sol-progress-track" style="border: 1px solid #000; box-shadow: 0 0 4px rgba(0,0,0,0.5);">
                                    <div class="sol-am-fill" style="width: ${amFillPct}%; background-color: var(--tier-7-color, #a855f7); height: 100%;"></div>
                                    <div class="sol-am-text" style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-shadow: ${textShadow}; font-weight: bold; font-family: 'Roboto Mono', monospace; font-size: 0.75rem;">${amCurrent.toFixed(2)} / ${amMax}</div>
                                </div>
                            </div>
                        </div>

                        <div class="sol-cache-action-right" style="z-index: 2; flex-shrink: 0;">
                            <button type="button" class="btn-deposit-all" 
                                    data-action="sol-claim-output"
                                    data-type="antimatter"
                                    style="height: 100%; border: 1px solid #000; box-shadow: 0 2px 5px rgba(0,0,0,0.5);"
                                    ${!hasAm ? 'disabled' : ''}>
                                COLLECT
                            </button>
                        </div>
                    </div>

                    <div class="sol-credits-block">
                        <div class="credits-info">
                            <div class="label">CREDITS</div>
                            <div class="value" data-id="stock-credits">${formatCredits(Math.floor(stockpile.credits))}</div>
                        </div>
                        <button type="button" class="btn-deposit-all" 
                                data-action="sol-claim-output"
                                data-type="credits"
                                style="background: linear-gradient(to bottom, #16a34a, #15803d); border-color: #16a34a;"
                                ${!hasCredits ? 'disabled' : ''}>
                            COLLECT
                        </button>
                    </div>
                </div>

                <div class="sol-mode-control" style="margin-top: 0.75rem;">
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

                <div class="sol-cache-section" style="margin-top: 2rem;">
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
        const typeClass = modeId.toLowerCase(); 
        
        return `
            <button type="button" class="mode-btn ${typeClass} ${activeClass}" 
                    data-action="sol-set-mode" 
                    data-mode="${modeId}"
                    ${isActive ? 'disabled' : ''}>
                ${modeId}
            </button>
        `;
    }

    _getModeDescription(mode) {
        switch (mode) {
            case 'STABILITY': return "<span style='color: #9ca3af;'>Low Entropy, Slow Generation</span>";
            case 'COMMERCE': return "<span style='color: #fbbf24;'>High Entropy, High Income</span>";
            case 'PRODUCTION': return "<span style='color: #a855f7;'>Max Entropy, Max Antimatter</span>";
            default: return "";
        }
    }

    _renderCacheList(gameState) {
        const station = this._getLiveStationState(gameState);
        const caches = station.caches;
        const playerInventory = gameState.player.inventories[gameState.player.activeShipId];
        const playerVisualSeed = gameState.player.visualSeed;

        return Object.entries(caches)
            .filter(([id]) => id !== COMMODITY_IDS.FOLDED_DRIVES) 
            .map(([commodityId, cache]) => {
                const commodity = DB.COMMODITIES.find(c => c.id === commodityId);
                if (!commodity) return `<div class="sol-cache-row-error">Error: ${commodityId}</div>`;

                const fillPct = (cache.current / cache.max) * 100;
                const playerStock = playerInventory[commodityId]?.quantity || 0;
                const canDonate = playerStock > 0 && cache.current < cache.max;
                const tierColorVar = `--tier-${commodity.tier || 1}-color`;

                const bgImage = AssetService.getCommodityImage(commodity.name, playerVisualSeed);
                const bgStyle = bgImage ? `background-image: url('${bgImage}'); opacity: 1; filter: none;` : '';
                const textShadow = '0 4px 6px rgba(0,0,0,0.9), 1px 1px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000, -1px -1px 0 #000';

                return `
                    <div class="sol-cache-row" data-comm-id="${commodityId}" style="display: flex; flex-direction: row; align-items: center; justify-content: space-between; height: auto; min-height: 70px; padding: 0.5rem;">
                        <div class="sol-cache-row-bg" style="${bgStyle}"></div>
                        
                        <div class="sol-cache-content-left" style="z-index: 2; flex-grow: 1; display: flex; flex-direction: column; justify-content: center; margin-right: 0.5rem;">
                            <div class="sol-row-name" title="${commodity.name}" style="text-align: left; font-size: 1.1rem; margin-bottom: 4px; text-shadow: ${textShadow}; white-space: nowrap; overflow: visible;">${commodity.name}</div>
                            
                            <div class="sol-row-track-container" style="width: 100%;">
                                <div class="sol-progress-track" style="border: 1px solid #000; box-shadow: 0 0 4px rgba(0,0,0,0.5);">
                                    <div class="sol-progress-fill" style="width: ${fillPct}%; background-color: var(${tierColorVar}, #fff);"></div>
                                    <div class="sol-threshold-marker" style="left: 20%;"></div>
                                    <div class="sol-progress-text" style="text-shadow: ${textShadow}; font-weight: bold;">${formatCredits(Math.floor(cache.current), false)} / ${formatCredits(cache.max, false)}</div>
                                </div>
                            </div>
                        </div>

                        <div class="sol-cache-action-right" style="z-index: 2; flex-shrink: 0;">
                            <button type="button" class="btn-deposit-all" 
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
        const station = this._getLiveStationState(gameState);
        const slots = station.officers;
        
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
        if (this.uiManager && this.uiManager.simulationService && this.uiManager.simulationService.solStationService) {
            const service = this.uiManager.simulationService.solStationService;
            const projections = service.getProjectedOutput();
            const rawThreshold = service.getDeathSpiralThreshold ? service.getDeathSpiralThreshold() : 0;
            
            projections.threshold = Math.round(rawThreshold * 1000) / 10;
            return projections;
        }
        return { credits: 0, antimatter: 0, entropy: 1, threshold: 0 };
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