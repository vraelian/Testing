// js/services/ui/UISolStationControl.js
import { DB } from '../../data/database.js';
import { OFFICERS } from '../../data/officers.js';
import { formatCredits } from '../../utils.js';
import { ACTION_IDS, COMMODITY_IDS } from '../../data/constants.js';
import { AssetService } from '../AssetService.js';
import { LEVEL_REGISTRY } from '../../data/solProgressionRegistry.js';

export class UISolStationControl {
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.animationFrameId = null;
        this.domCache = null; 
        this.lastRendered = {}; 
        
        // Local state for UI interaction
        this.selectedOfficerId = null;
        this.selectedSlotId = null;
        this.lastTapTime = 0;
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
            if (!svc.trackingActive) {
                svc.catchUpDays(gameState.day);
                svc.startLocalLiveLoop();
            }
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
            this._bindLocalListeners(gameState);
            
            const footerBtn = document.querySelector('#event-button-container button');
            if (footerBtn) {
                footerBtn.innerHTML = 'Dismiss';
                footerBtn.onclick = () => {
                    this._stopRefreshLoop();
                    this.uiManager.hideModal('event-modal');
                };
            }
        } else {
            this.domCache = null; 
            this.uiManager.queueModal('event-modal', '', contentHtml, () => {
                this._stopRefreshLoop();
            }, {
                width: '800px', 
                dismissOutside: true,
                specialClass: 'sol-station-modal',
                buttonText: 'Dismiss',
                buttonClass: 'btn-dismiss-sm',
            });
            setTimeout(() => this._bindLocalListeners(gameState), 50);
        }
        
        this._startRefreshLoop();
    }

    _bindLocalListeners(gameState) {
        const root = document.getElementById('sol-dashboard-root');
        if (!root) return;

        // Clean up old listener to prevent memory leaks if re-rendering in place
        if (this._clickHandler) {
            root.removeEventListener('click', this._clickHandler);
        }

        this._clickHandler = (e) => {
            const btn = e.target.closest('button[data-local-action]');
            if (!btn) return;
            e.preventDefault();
            const action = btn.dataset.localAction;

            const svc = this.uiManager.simulationService.solStationService;

            if (action === 'open-officer-mgmt') {
                this.showOfficerManagement(gameState);
            } else if (action === 'open-engineering') {
                this.showEngineeringModal(gameState);
            } else if (action === 'eng-donate-max-credits') {
                const reqs = LEVEL_REGISTRY[svc.gameState.solStation.level + 1].requirements;
                const banked = svc.gameState.solStation.activeProjectBank['credits'] || 0;
                const needed = reqs['credits'] - banked;
                const available = svc.gameState.player.credits;
                const input = document.getElementById('eng-credit-input');
                if (input) input.value = Math.min(needed, available);
            } else if (action === 'eng-contribute-credits') {
                const input = document.getElementById('eng-credit-input');
                const qty = parseInt(input?.value || 0, 10);
                if (qty > 0) {
                    const res = svc.contributeToProject('credits', qty);
                    if (res.success) this.showEngineeringModal(svc.gameState);
                }
            } else if (action === 'eng-contribute-cargo') {
                const commId = btn.dataset.commId;
                const reqs = LEVEL_REGISTRY[svc.gameState.solStation.level + 1].requirements;
                const banked = svc.gameState.solStation.activeProjectBank[commId] || 0;
                const needed = reqs[commId] - banked;
                if (needed > 0) {
                    const res = svc.contributeToProject(commId, needed);
                    if (res.success) this.showEngineeringModal(svc.gameState);
                }
            }
        };

        root.addEventListener('click', this._clickHandler);
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
            caches: {},
            engBars: {}
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
        const output = this._calculateProjections(gameState);
        const c = this.domCache;
        const lr = this.lastRendered;

        const healthDisp = station.health.toFixed(2);
        if (lr.health !== healthDisp) {
            if (c.integrityLabel && c.integrityBar) {
                c.integrityLabel.className = this._getHealthColorClass(station.health);
                c.integrityLabel.textContent = `${healthDisp}%`;
                c.integrityBar.style.width = `${station.health}%`;
                c.integrityBar.style.backgroundColor = `var(${this._getHealthColorVar(station.health)})`;
            }
            lr.health = healthDisp;
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

        const amCurrent = Math.min(LEVEL_REGISTRY[1]?.MAX_ANTIMATTER_STOCKPILE || 150, station.stockpile.antimatter); 
        if (c.amCollectBtn) {
             c.amCollectBtn.disabled = amCurrent < 1; 
             c.amCollectBtn.style.opacity = amCurrent >= 1 ? '1' : '0.5';
        }

        const creds = Math.floor(station.stockpile.credits);
        if (c.credCollectBtn) {
            c.credCollectBtn.disabled = creds <= 0;
            c.credCollectBtn.style.opacity = creds > 0 ? '1' : '0.5';
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
        Object.entries(station.caches).forEach(([commId, cache]) => {
            if (commId !== COMMODITY_IDS.FOLDED_DRIVES) {
                const playerStock = playerInventory[commId]?.quantity || 0;
                const canDonate = playerStock > 0 && cache.current < cache.max;
                const ui = c.caches[commId];
                if (ui && ui.btn) {
                    ui.btn.disabled = !canDonate;
                    ui.btn.style.opacity = canDonate ? '1' : '0.5';
                }
            }
        });
    }

    _startRefreshLoop() {
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        
        const svc = this.uiManager.simulationService ? this.uiManager.simulationService.solStationService : null;
        if (!svc) return;

        let lastSyncTime = 0;

        const loop = () => {
            const root = document.getElementById('sol-dashboard-root');
            if (!root || !document.body.contains(root) || root.closest('.hidden')) {
                this._stopRefreshLoop();
                return;
            }

            const station = svc.gameState.solStation;
            const rates = svc.getPerSecondRates();
            const timeNow = Date.now();
            
            let dtReal = 0;
            if (svc.trackingActive && svc.lastCommitTime > 0) {
                dtReal = Math.max(0, (timeNow - svc.lastCommitTime) / 1000);
            }

            const projectedCredits = station.stockpile.credits + rates.creditsPerSec * dtReal;
            const projectedAm = Math.min(150, station.stockpile.antimatter + rates.amPerSec * dtReal);

            if (this.domCache) {
                if (this.domCache.credVal) this.domCache.credVal.textContent = formatCredits(Math.floor(projectedCredits));
                
                if (this.domCache.amText) this.domCache.amText.textContent = `${projectedAm.toFixed(2)} / 150`;
                const amFillPct = (projectedAm / 150) * 100;
                if (this.domCache.amBar) this.domCache.amBar.style.width = `${amFillPct}%`;
                
                Object.entries(station.caches).forEach(([id, cache]) => {
                    if (id !== COMMODITY_IDS.FOLDED_DRIVES && id !== COMMODITY_IDS.ANTIMATTER) {
                        const cacheUi = this.domCache.caches[id];
                        if (cacheUi && cacheUi.text && cacheUi.bar) {
                            const specificBurnRed = svc.getOfficerBuffs().consumptionMods[id] || 0;
                            const k_specific = rates.k * Math.max(0, (1 - specificBurnRed));
                            const projectedVal = cache.current * Math.exp(-k_specific * dtReal);
                            cacheUi.text.textContent = `${Math.floor(projectedVal).toLocaleString()} / ${cache.max.toLocaleString()}`;
                            const fillPct = (projectedVal / cache.max) * 100;
                            cacheUi.bar.style.width = `${fillPct}%`;
                        }
                    }
                });
            }

            if (timeNow - lastSyncTime > 1000) {
                this.update(svc.gameState); 
                lastSyncTime = timeNow;
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

    // --- PHASE 3: OFFICER MANAGEMENT (DUAL COLUMN) ---

    showOfficerManagement(gameState) {
        this._stopRefreshLoop();
        const root = document.getElementById('sol-dashboard-root');
        if (!root) return;

        const station = this._getLiveStationState(gameState);
        const roster = gameState.player.officerRoster || [];
        const slots = station.officers;
        const assignedIds = slots.map(s => s.assignedOfficerId).filter(id => id);
        const availableOfficers = roster.filter(id => !assignedIds.includes(id));

        const availHtml = availableOfficers.length === 0 ? 
            `<div class="text-center p-4 text-gray-500 text-sm">No officers available.</div>` :
            availableOfficers.map(id => this._buildOfficerRowHtml(id, false)).join('');

        const slotsHtml = slots.map(slot => {
            if (slot.assignedOfficerId) {
                return this._buildOfficerRowHtml(slot.assignedOfficerId, true, slot.slotId);
            } else {
                return `
                    <div class="officer-mgmt-row empty-slot" data-slot-id="${slot.slotId}">
                        <div class="slot-indicator">SLOT ${slot.slotId}</div>
                        <div class="empty-text">Empty</div>
                    </div>
                `;
            }
        }).join('');

        root.innerHTML = `
            <div class="sol-subview-header flex justify-between items-center mb-4">
                <div class="sol-level-header ${this._getLevelStyleClass(station.level)}">OFFICER MANAGEMENT</div>
            </div>
            <div class="officer-mgmt-container">
                <div class="column-avail">
                    <div class="col-title">AVAILABLE ROSTER</div>
                    <div class="col-content">${availHtml}</div>
                </div>
                <div class="column-active">
                    <div class="col-title">ACTIVE SLOTS</div>
                    <div class="col-content">${slotsHtml}</div>
                </div>
            </div>
        `;

        const footerBtn = document.querySelector('#event-button-container button');
        if (footerBtn) {
            footerBtn.innerHTML = '&larr; BACK TO DASHBOARD'; 
            footerBtn.onclick = () => this.showDashboard(gameState);
        }

        // Setup double-tap and selection logic
        const svc = this.uiManager.simulationService.solStationService;
        
        const handleInteraction = (e) => {
            const row = e.target.closest('.officer-mgmt-row');
            if (!row) return;

            const now = Date.now();
            const isDoubleTap = (now - this.lastTapTime < 350) && this.selectedOfficerId === row.dataset.officerId;
            this.lastTapTime = now;

            const isAssigned = row.classList.contains('assigned');
            const officerId = row.dataset.officerId;
            const slotId = row.dataset.slotId;

            // Handle inline button clicks OR double taps
            if (e.target.closest('.btn-inline-assign') || (isDoubleTap && !isAssigned)) {
                // Assign first available empty slot
                const emptySlot = slots.find(s => !s.assignedOfficerId);
                if (emptySlot) {
                    svc.assignOfficer(emptySlot.slotId, officerId);
                    this.showOfficerManagement(svc.gameState);
                }
            } else if (e.target.closest('.btn-inline-remove') || (isDoubleTap && isAssigned)) {
                // Request Un-slot
                const res = svc.assignOfficer(slotId, null);
                if (res.requiresConfirmation) {
                    this.showUnslotWarningModal(slotId, officerId, res.payload, svc.gameState);
                } else {
                    this.showOfficerManagement(svc.gameState);
                }
            } else {
                // Highlight logic
                root.querySelectorAll('.officer-mgmt-row').forEach(r => r.classList.remove('selected'));
                row.classList.add('selected');
                this.selectedOfficerId = officerId;
            }
        };

        // Use pointerup for better mobile responsiveness
        root.removeEventListener('pointerup', this._mgmtHandler);
        this._mgmtHandler = handleInteraction;
        root.addEventListener('pointerup', this._mgmtHandler);
    }

    _buildOfficerRowHtml(officerId, isAssigned, slotId = null) {
        const officer = OFFICERS[officerId];
        if (!officer) return '';
        const actionBtn = isAssigned ? 
            `<button type="button" class="btn-inline-remove">REMOVE</button>` : 
            `<button type="button" class="btn-inline-assign">ASSIGN</button>`;

        return `
            <div class="officer-mgmt-row ${isAssigned ? 'assigned' : 'avail'}" data-officer-id="${officerId}" ${slotId ? `data-slot-id="${slotId}"` : ''}>
                ${isAssigned ? `<div class="slot-indicator">SLOT ${slotId}</div>` : ''}
                <div class="row-info">
                    <div class="o-name">${officer.name}</div>
                    <div class="o-role">${officer.role}</div>
                    <div class="o-buffs">${this._formatBuffs(officer.buffs, true)}</div>
                </div>
                <div class="row-action">${actionBtn}</div>
            </div>
        `;
    }

    // --- PHASE 3: ENGINEERING INTERFACE & WARNINGS ---

    showEngineeringModal(gameState) {
        this._stopRefreshLoop();
        const root = document.getElementById('sol-dashboard-root');
        if (!root) return;

        const station = this._getLiveStationState(gameState);
        const nextLevelData = LEVEL_REGISTRY[station.level + 1];

        if (!nextLevelData) {
            root.innerHTML = `<div class="text-center p-8"><h3 class="level-50-glow">STATION MAXIMIZED</h3></div>`;
            return;
        }

        const reqs = nextLevelData.requirements;
        const bank = station.activeProjectBank;

        let reqsHtml = '';
        Object.entries(reqs).forEach(([resId, reqQty]) => {
            const bankedQty = bank[resId] || 0;
            const pct = Math.min(100, (bankedQty / reqQty) * 100);
            const isComplete = bankedQty >= reqQty;
            
            if (resId === 'credits') {
                const playerCr = gameState.player.credits;
                reqsHtml += `
                    <div class="eng-req-row">
                        <div class="req-header">
                            <span>Credits</span>
                            <span>${formatCredits(bankedQty, false)} / ${formatCredits(reqQty, false)}</span>
                        </div>
                        <div class="eng-progress-track"><div class="eng-progress-fill" style="width: ${pct}%; background-color: #10b981;"></div></div>
                        ${!isComplete ? `
                            <div class="credit-stepper">
                                <input type="number" id="eng-credit-input" min="0" max="${Math.min(reqQty - bankedQty, playerCr)}" value="0" step="1000">
                                <button type="button" class="btn-sm" data-local-action="eng-donate-max-credits">MAX</button>
                                <button type="button" class="btn-sm btn-green" data-local-action="eng-contribute-credits">FUND</button>
                            </div>
                        ` : '<div class="text-green-400 text-sm font-bold mt-1 text-right">FUNDED</div>'}
                    </div>
                `;
            } else {
                const comm = DB.COMMODITIES.find(c => c.id === resId);
                const pStock = gameState.player.ownedShipIds.reduce((total, id) => total + (gameState.player.inventories[id]?.[resId]?.quantity || 0), 0);
                
                reqsHtml += `
                    <div class="eng-req-row">
                        <div class="req-header">
                            <span>${comm ? comm.name : resId}</span>
                            <span>${bankedQty.toLocaleString()} / ${reqQty.toLocaleString()}</span>
                        </div>
                        <div class="eng-progress-track"><div class="eng-progress-fill" style="width: ${pct}%;"></div></div>
                        ${!isComplete ? `
                            <div class="flex justify-between items-center mt-1">
                                <span class="text-xs text-gray-400">Fleet Stock: ${pStock.toLocaleString()}</span>
                                <button type="button" class="btn-sm" data-local-action="eng-contribute-cargo" data-comm-id="${resId}" ${pStock <= 0 ? 'disabled' : ''}>DEPOSIT</button>
                            </div>
                        ` : '<div class="text-green-400 text-sm font-bold mt-1 text-right">SUPPLIED</div>'}
                    </div>
                `;
            }
        });

        root.innerHTML = `
            <div class="sol-subview-header flex justify-between items-center mb-4">
                <div class="sol-level-header ${this._getLevelStyleClass(station.level)}">ENGINEERING: PROJECT ${station.level + 1}</div>
            </div>
            <div class="eng-project-info mb-4">
                <div class="text-lg font-bold mb-1">${nextLevelData.projectName}</div>
                <div class="text-xs text-gray-400 italic mb-2">${nextLevelData.lore}</div>
                <div class="text-sm text-blue-300">Reward: ${nextLevelData.rewards.description}</div>
            </div>
            <div class="eng-requirements-list">
                ${reqsHtml}
            </div>
        `;

        this._bindLocalListeners(gameState);

        const footerBtn = document.querySelector('#event-button-container button');
        if (footerBtn) {
            footerBtn.innerHTML = '&larr; BACK TO DASHBOARD'; 
            footerBtn.onclick = () => this.showDashboard(gameState);
        }
    }

    showUnslotWarningModal(slotId, officerId, payload, gameState) {
        const officer = OFFICERS[officerId];
        let warningsHtml = '';

        if (payload.netEntropyChange >= 0.1) {
            warningsHtml += `<div class="warning-item text-red-400 font-bold mb-2">⚠ WARNING: Net Entropy will increase by +${Math.round(payload.netEntropyChange * 100)}%!</div>`;
        }

        const ventedKeys = Object.keys(payload.ventedCargo);
        if (ventedKeys.length > 0) {
            warningsHtml += `<div class="warning-item text-yellow-400 font-bold mb-2">⚠ WARNING: Capacity reduction will instantly vent and destroy:</div>`;
            ventedKeys.forEach(k => {
                const commName = DB.COMMODITIES.find(c => c.id === k)?.name || k;
                warningsHtml += `<div class="text-sm text-gray-300 ml-4">- ${payload.ventedCargo[k].toLocaleString()} units of ${commName}</div>`;
            });
        }

        const modalHtml = `
            <div id="unslot-warning-root" class="text-center">
                <h3 class="text-xl font-bold text-red-500 mb-4">CRITICAL LOAD WARNING</h3>
                <p class="mb-4 text-sm text-gray-300">Removing ${officer.name} will destabilize station operations.</p>
                <div class="text-left bg-gray-900 border border-red-900 p-3 rounded mb-6">
                    ${warningsHtml}
                </div>
                <div class="flex gap-4 justify-center">
                    <button type="button" class="btn btn-red" id="btn-confirm-unslot">CONFIRM REMOVAL</button>
                    <button type="button" class="btn btn-outline" id="btn-cancel-unslot">ABORT</button>
                </div>
            </div>
        `;

        // We temporarily replace the management view with the warning view.
        const root = document.getElementById('sol-dashboard-root');
        root.innerHTML = modalHtml;

        document.getElementById('btn-confirm-unslot').onclick = () => {
            const svc = this.uiManager.simulationService.solStationService;
            svc.assignOfficer(slotId, null, true); // Force bypass validation
            this.showOfficerManagement(svc.gameState);
        };

        document.getElementById('btn-cancel-unslot').onclick = () => {
            this.showOfficerManagement(gameState);
        };
    }

    // --- HTML GENERATORS (Updated for Phase 3) ---

    _buildDashboardHtml(gameState) {
        const station = this._getLiveStationState(gameState);
        const output = this._calculateProjections(gameState);
        const stockpile = station.stockpile;
        const playerVisualSeed = gameState.player.visualSeed;

        const amBgImage = AssetService.getCommodityImage("Antimatter", playerVisualSeed);
        const amBgStyle = amBgImage ? `background-image: url('${amBgImage}'); opacity: 1; filter: none;` : '';
        const textShadow = '0 4px 6px rgba(0,0,0,0.9), 1px 1px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000, -1px -1px 0 #000';

        const amMax = LEVEL_REGISTRY[1]?.MAX_ANTIMATTER_STOCKPILE || 150;
        const amCurrent = Math.min(amMax, stockpile.antimatter);
        const amFillPct = (amCurrent / amMax) * 100;
        const hasAm = amCurrent >= 1;
        const hasCredits = stockpile.credits > 0;

        // Engineering Overview Prep
        const nextLvl = LEVEL_REGISTRY[station.level + 1];
        let engOverview = '<div class="text-center text-gray-500 text-xs">STATION MAXIMIZED</div>';
        if (nextLvl) {
            const reqs = Object.entries(nextLvl.requirements).map(([resId, qty]) => {
                const banked = station.activeProjectBank[resId] || 0;
                const name = resId === 'credits' ? 'Cr' : (DB.COMMODITIES.find(c => c.id === resId)?.name || resId);
                return `${name}: ${banked >= qty ? '<span class="text-green-400">DONE</span>' : `${formatCredits(banked, false)}/${formatCredits(qty, false)}`}`;
            }).join(' | ');
            engOverview = `<div class="text-xs text-center text-blue-200 mt-1">${reqs}</div>`;
        }

        return `
            <div id="sol-dashboard-root" class="sol-dashboard-container">
                
                <div class="sol-level-header ${this._getLevelStyleClass(station.level)} text-center mb-2">
                    SOL STATION LV. ${station.level}
                </div>

                <div class="sol-header-panel" style="display: flex; gap: 1rem; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
                    <div class="sol-health-container" style="flex-grow: 1;">
                        <div class="sol-health-bar-label">STATION HEALTH: <span class="${this._getHealthColorClass(station.health)}">${station.health.toFixed(2)}%</span></div>
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
                        ${this._renderModeButton('STABILITY', station.mode, station.unlockedModes)}
                        ${this._renderModeButton('COMMERCE', station.mode, station.unlockedModes)}
                        ${this._renderModeButton('PRODUCTION', station.mode, station.unlockedModes)}
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

                <div class="mt-4 pt-4 border-t border-gray-700">
                    <button type="button" class="w-full bg-blue-900 border border-blue-500 text-white font-bold py-3 rounded uppercase tracking-wider shadow-lg" data-local-action="open-officer-mgmt">
                        OFFICER MANAGEMENT
                    </button>
                </div>

                <div class="mt-4 p-3 border border-gray-600 rounded cursor-pointer bg-gray-900 hover:bg-gray-800 transition-colors" data-local-action="open-engineering">
                    <div class="text-xs text-gray-400 uppercase font-bold text-center">ENGINEERING BAY</div>
                    ${nextLvl ? `<div class="text-center font-bold text-sm text-yellow-400 mt-1">${nextLvl.projectName}</div>` : ''}
                    ${engOverview}
                </div>
            </div>
        `;
    }

    _renderModeButton(modeId, currentMode, unlockedModes = ["STABILITY"]) {
        const isActive = modeId === currentMode;
        const activeClass = isActive ? 'active' : '';
        const typeClass = modeId.toLowerCase(); 
        const isLocked = !unlockedModes.includes(modeId);
        
        return `
            <button type="button" class="mode-btn ${typeClass} ${activeClass}" 
                    data-action="sol-set-mode" 
                    data-mode="${modeId}"
                    ${isActive || isLocked ? 'disabled' : ''}
                    style="${isLocked ? 'opacity: 0.3;' : ''}">
                ${modeId} ${isLocked ? '🔒' : ''}
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

    _formatBuffs(buffs, mini = false) {
        const parts = [];
        if (buffs.entropy !== 0) parts.push(`<span class="text-red-300">${buffs.entropy > 0 ? '+' : ''}${Math.round(buffs.entropy * 100)}% Decay</span>`);
        if (buffs.creditMult !== 0) parts.push(`<span class="text-green-300">+${Math.round(buffs.creditMult * 100)}% Cr</span>`);
        if (buffs.amMult !== 0) parts.push(`<span class="text-purple-300">+${Math.round(buffs.amMult * 100)}% AM</span>`);
        
        if (buffs.capacityMods) {
            Object.keys(buffs.capacityMods).forEach(k => {
                parts.push(`<span class="text-blue-300">+Cap</span>`);
            });
        }
        if (buffs.consumptionMods) {
            Object.keys(buffs.consumptionMods).forEach(k => {
                parts.push(`<span class="text-yellow-300">-Burn</span>`);
            });
        }

        return parts.join(mini ? ' ' : ' • ');
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
    
    _getLevelStyleClass(level) {
        if (level < 10) return 'sol-level-white';
        if (level < 20) return 'sol-level-green';
        if (level < 30) return 'sol-level-blue';
        if (level < 40) return 'sol-level-gold';
        if (level < 50) return 'sol-level-orange';
        return 'sol-level-red';
    }
}