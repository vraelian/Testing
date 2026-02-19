// js/services/ui/UISolStationControl.js
import { DB } from '../../data/database.js';
import { OFFICERS } from '../../data/officers.js';
import { formatCredits } from '../../utils.js';
import { ACTION_IDS, COMMODITY_IDS } from '../../data/constants.js';
import { AssetService } from '../AssetService.js';
import { spawnFloatingText, playBlockingAnimationAndRemove } from './AnimationService.js';
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
        
        // Memory router to preserve scroll states across views
        this.currentView = null;
        this.scrollMemory = {};
        
        // Handler references for cleanup
        this._clickHandler = null;
        this._scrollHandler = null;
    }

    _getLiveStationState(gameState) {
        if (this.uiManager && this.uiManager.simulationService && this.uiManager.simulationService.solStationService) {
            return this.uiManager.simulationService.solStationService.getLiveState();
        }
        return gameState.solStation;
    }

    /**
     * Resets the scroll memory. Call this when navigating away from the Services screen.
     */
    resetScrollMemory() {
        this.scrollMemory = {};
    }

    showDashboard(gameState) {
        this.currentView = 'dashboard';
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
        
        // Safety Clean-up for Silent Exit flag
        if (modalContainer) {
            modalContainer.classList.remove('silent-exit');
        }
        
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
            
            // --- UPDATE THEME DYNAMICALLY ---
            this._applyLevelTheme(station.level);

            const footerBtn = document.querySelector('#event-button-container button');
            if (footerBtn) {
                footerBtn.innerHTML = 'Dismiss';
                footerBtn.style.display = ''; // Ensure visible
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
                customSetup: (modal, closeHandler) => {
                    // --- FIX: APPLY THEME DIRECTLY TO MODAL CONTAINER ---
                    this._updateThemeClasses(modal, station.level);
                }
            });
            setTimeout(() => this._bindLocalListeners(gameState), 50);
        }
        
        this._startRefreshLoop();
        this._restoreScrollPosition();
    }

    _updateThemeClasses(element, level) {
        // Remove all potential theme classes first
        element.classList.remove(
            'sol-theme-white', 
            'sol-theme-green', 
            'sol-theme-blue', 
            'sol-theme-gold', 
            'sol-theme-orange', 
            'sol-theme-red'
        );

        // Add the correct class
        if (level < 10) element.classList.add('sol-theme-white');
        else if (level < 20) element.classList.add('sol-theme-green');
        else if (level < 30) element.classList.add('sol-theme-blue');
        else if (level < 40) element.classList.add('sol-theme-gold');
        else if (level < 50) element.classList.add('sol-theme-orange');
        else element.classList.add('sol-theme-red');
    }

    _applyLevelTheme(level) {
        const modal = document.getElementById('event-modal');
        if (modal) {
            // FIX: Ensure this always targets the parent container
            this._updateThemeClasses(modal, level);
        }
    }

    _bindLocalListeners(gameState) {
        const root = document.getElementById('sol-dashboard-root');
        if (!root) return;

        // --- 1. CLICK HANDLER ---
        if (this._clickHandler) {
            root.removeEventListener('click', this._clickHandler);
        }

        this._clickHandler = (e) => {
            const btn = e.target.closest('[data-local-action]');
            if (!btn) return;
            e.preventDefault();
            const action = btn.dataset.localAction;

            const svc = this.uiManager.simulationService.solStationService;

            if (action === 'open-officer-mgmt') {
                this.showOfficerManagement(gameState);
            } else if (action === 'open-engineering') {
                this.showEngineeringModal(gameState);
            } else if (action === 'return-dashboard') {
                this.showDashboard(gameState);
            } else if (action === 'info-officer') {
                const officerId = btn.dataset.officerId;
                if (officerId) this.showOfficerDetailModal(officerId, gameState);
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
                    spawnFloatingText(btn, `-⌬ ${formatCredits(qty, false)}`, 'text-red-500 font-bold text-lg');
                    const res = svc.contributeToProject('credits', qty);
                    if (res.success) this.showEngineeringModal(svc.gameState);
                }
            } else if (action === 'eng-contribute-cargo') {
                const commId = btn.dataset.commId;
                const reqs = LEVEL_REGISTRY[svc.gameState.solStation.level + 1].requirements;
                const banked = svc.gameState.solStation.activeProjectBank[commId] || 0;
                const needed = reqs[commId] - banked;
                const pStock = svc.gameState.player.ownedShipIds.reduce((total, id) => total + (svc.gameState.player.inventories[id]?.[commId]?.quantity || 0), 0);
                const depositQty = Math.min(needed, pStock);

                if (depositQty > 0) {
                    spawnFloatingText(btn, `-${depositQty.toLocaleString()}`, 'text-red-500 font-bold text-lg');
                    const res = svc.contributeToProject(commId, depositQty);
                    if (res.success) this.showEngineeringModal(svc.gameState);
                }
            } 
            else if (action === 'eng-complete-project') {
                const modal = document.querySelector('.sol-station-modal');
                if (modal) {
                    playBlockingAnimationAndRemove(modal, 'project-complete-dematerialize').then(() => {
                        const oldLevel = svc.gameState.solStation.level;
                        const res = svc.completeActiveProject();
                        
                        if (res.success) {
                            // 1. Silent Exit Logic
                            modal.classList.add('silent-exit');
                            this.uiManager.hideModal('event-modal');
                            
                            // 2. Target the specific UI elements on the Services Screen
                            const btn = document.getElementById('btn-sol-orbital-interface');
                            const lbl = document.getElementById('lbl-sol-level-indicator');

                            if (btn && lbl) {
                                lbl.textContent = oldLevel;
                                btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                btn.classList.add('sol-interface-levelup');

                                setTimeout(() => {
                                    lbl.textContent = svc.gameState.solStation.level;
                                    const newClass = this._getLevelStyleClass(svc.gameState.solStation.level);
                                    lbl.className = `font-orbitron font-bold text-2xl z-10 ${newClass}`;
                                }, 1200);

                                setTimeout(() => {
                                    btn.classList.remove('sol-interface-levelup');
                                    this.showDashboard(svc.gameState);
                                    const dashRoot = document.getElementById('sol-dashboard-root');
                                    if (dashRoot) dashRoot.classList.add('dashboard-fade-in');
                                }, 2500);

                            } else {
                                this.showDashboard(svc.gameState);
                                const dashRoot = document.getElementById('sol-dashboard-root');
                                if (dashRoot) dashRoot.classList.add('dashboard-fade-in');
                            }
                        }
                    });
                }
            }
        };
        root.addEventListener('click', this._clickHandler);

        // --- 2. SCROLL HANDLER (LIVE CAPTURE) ---
        const sc = document.getElementById('event-description');
        if (sc) {
            // Remove old listener if exists
            if (this._scrollHandler) {
                sc.removeEventListener('scroll', this._scrollHandler);
            }

            // Create new handler
            this._scrollHandler = (e) => {
                if (this.currentView) {
                    this.scrollMemory[this.currentView] = e.target.scrollTop;
                }
            };

            // Bind passive listener for performance
            sc.addEventListener('scroll', this._scrollHandler, { passive: true });
        }
    }

    _restoreScrollPosition() {
        const targetScroll = this.scrollMemory[this.currentView] || 0;
        const sc = document.getElementById('event-description');
        if (sc) {
            requestAnimationFrame(() => {
                sc.scrollTop = targetScroll;
            });
        }
    }

    _buildDomCache(root) {
        this.domCache = {
            integrityLabel: root.querySelector('.sol-health-bar-label > div:nth-child(2)'),
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

        if (lr.mode !== station.mode || !lr.hasCheckedLocks) {
            const unlocked = station.unlockedModes || ["STABILITY"];
            c.modeBtns.forEach(btn => {
                const mode = btn.dataset.mode;
                const isActive = mode === station.mode;
                const isLocked = !unlocked.includes(mode);
                
                btn.className = `mode-btn ${mode.toLowerCase()} ${isActive ? 'active' : ''}`;
                btn.disabled = isActive || isLocked;
                
                btn.style.opacity = isLocked ? '0.3' : '1';
                btn.style.cursor = isLocked ? 'not-allowed' : (isActive ? 'default' : 'pointer');
            });
            if (c.modeDesc) c.modeDesc.innerHTML = this._getModeDescription(station.mode);
            lr.mode = station.mode;
            lr.hasCheckedLocks = true;
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
        
        const sc = document.getElementById('event-description');
        if (sc && this._scrollHandler) {
            sc.removeEventListener('scroll', this._scrollHandler);
        }
        
        this.domCache = null; 
    }

    showOfficerManagement(gameState) {
        this.currentView = 'officers';
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
                    <div class="officer-mgmt-row empty-slot flex items-center justify-between p-2 bg-gray-800/50 border border-gray-700 border-dashed rounded mb-1" data-slot-id="${slot.slotId}">
                        <div class="flex items-center gap-2">
                            <div class="text-xs bg-gray-700 px-1 rounded text-gray-400">S${slot.slotId}</div>
                            <div class="text-sm text-gray-500 italic">Empty Slot</div>
                        </div>
                    </div>
                `;
            }
        }).join('');

        root.innerHTML = `
            <div class="sol-subview-header flex justify-between items-center mb-3">
                <div class="sol-level-header ${this._getLevelStyleClass(station.level)}">OFFICER MANAGEMENT</div>
            </div>
            <div class="officer-mgmt-container flex gap-2 w-full mb-3" style="height: 50vh; min-height: 350px;">
                <div class="column-avail flex-1 flex flex-col bg-black/40 border border-gray-700 rounded overflow-hidden">
                    <div class="bg-gray-800 p-2 text-center text-xs text-gray-400 font-bold border-b border-gray-700 shadow shrink-0">AVAILABLE ROSTER</div>
                    <div class="flex-1 overflow-y-auto p-2" style="scrollbar-width: thin;">${availHtml}</div>
                </div>
                <div class="column-active flex-1 flex flex-col bg-black/40 border border-gray-700 rounded overflow-hidden">
                    <div class="bg-gray-800 p-2 text-center text-xs text-gray-400 font-bold border-b border-gray-700 shadow shrink-0">ACTIVE SLOTS</div>
                    <div class="flex-1 overflow-y-auto p-2" style="scrollbar-width: thin;">${slotsHtml}</div>
                </div>
            </div>
            
            <div class="flex justify-center mt-2 border-t border-gray-700 pt-3">
                <button type="button" class="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white font-bold py-2 px-6 rounded uppercase tracking-wider text-xs shadow transition-colors" data-local-action="return-dashboard">
                    &larr; RETURN TO DASHBOARD
                </button>
            </div>
        `;

        const footerBtn = document.querySelector('#event-button-container button');
        if (footerBtn) {
            footerBtn.style.display = 'none'; 
        }

        const svc = this.uiManager.simulationService.solStationService;
        const handleInteraction = (e) => {
            const row = e.target.closest('.officer-mgmt-row');
            if (!row) return;

            const now = Date.now();
            const isDoubleTap = (now - this.lastTapTime < 350) && this.selectedOfficerId === row.dataset.officerId;
            this.lastTapTime = now;

            const isAssigned = row.dataset.assigned === 'true';
            const officerId = row.dataset.officerId;
            const slotId = row.dataset.slotId;

            if (e.target.closest('[data-local-action="info-officer"]')) {
                return; 
            }

            if (e.target.closest('.btn-inline-assign') || (isDoubleTap && !isAssigned)) {
                const emptySlot = slots.find(s => !s.assignedOfficerId);
                if (emptySlot) {
                    svc.assignOfficer(emptySlot.slotId, officerId);
                    this.showOfficerManagement(svc.gameState);
                }
            } else if (e.target.closest('.btn-inline-remove') || (isDoubleTap && isAssigned)) {
                const validation = svc.validateUnslotOfficer(slotId);
                
                if (!validation.safe) {
                    this.showUnslotWarningModal(slotId, officerId, validation, svc.gameState);
                } else {
                    svc.assignOfficer(slotId, null);
                    this.showOfficerManagement(svc.gameState);
                }
            } else {
                root.querySelectorAll('.officer-mgmt-row').forEach(r => {
                    r.style.borderColor = r.classList.contains('empty-slot') ? '#374151' : '#4b5563';
                    r.style.backgroundColor = r.classList.contains('empty-slot') ? 'rgba(31,41,55,0.5)' : '#1f2937';
                });
                row.style.borderColor = '#60a5fa';
                row.style.backgroundColor = '#1e3a8a';
                this.selectedOfficerId = officerId;
            }
        };

        root.removeEventListener('pointerup', this._mgmtHandler);
        this._mgmtHandler = handleInteraction;
        root.addEventListener('pointerup', this._mgmtHandler);

        this._restoreScrollPosition();
    }

    _buildOfficerRowHtml(officerId, isAssigned, slotId = null) {
        const officer = OFFICERS[officerId];
        if (!officer) return '';
        
        const actionBtn = isAssigned ? 
            `<button type="button" class="btn-inline-remove bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold py-1 px-2 rounded">REMOVE</button>` : 
            `<button type="button" class="btn-inline-assign bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold py-1 px-2 rounded">ASSIGN</button>`;
        const rarityColor = this._getRarityColorClass(officer.rarity);
        
        const nameParts = officer.name.split(' ');
        const shortName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : officer.name;

        return `
            <div class="officer-mgmt-row flex items-center justify-between p-2 bg-gray-800 border border-gray-600 rounded mb-1 cursor-pointer select-none" 
                 data-officer-id="${officerId}" 
                 data-assigned="${isAssigned}"
                 ${slotId ? `data-slot-id="${slotId}"` : ''}>
                
                <div class="flex items-center gap-2 overflow-hidden flex-1 mr-2">
                    ${isAssigned ? `<div class="text-xs bg-blue-900/50 px-1 rounded border border-blue-700 text-blue-300 font-mono shrink-0">S${slotId}</div>` : ''}
                    <button type="button" class="shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-gray-700 hover:bg-gray-600 border border-gray-500 text-xs font-bold text-gray-300 transition-colors" data-local-action="info-officer" data-officer-id="${officerId}">i</button>
                    <div class="flex flex-col min-w-0 items-start text-left w-full">
                        <div class="font-bold text-sm truncate ${rarityColor} leading-tight w-full">${shortName}</div>
                        <div class="text-[10px] text-gray-400 uppercase tracking-wide truncate leading-tight w-full">${officer.role}</div>
                    </div>
                </div>
                
                <div class="shrink-0">
                    ${actionBtn}
                </div>
            </div>
        `;
    }

    showOfficerDetailModal(officerId, gameState) {
        this.currentView = 'officerDetail';
        this._stopRefreshLoop();
        const root = document.getElementById('sol-dashboard-root');
        if (!root) return;

        const officer = OFFICERS[officerId];
        if (!officer) return;

        const rarityColor = this._getRarityColorClass(officer.rarity);
        const baseStyle = "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; line-height: 1.4;";

        let buffsHtml = '';
        if (officer.buffs.entropy !== 0) buffsHtml += `<div class="mb-2 pb-2 border-b border-gray-800/50" style="${baseStyle}"><span class="text-red-300 font-bold uppercase tracking-wider">ENTROPY:</span><br/> ${officer.buffs.entropy > 0 ? '+' : ''}${Math.round(officer.buffs.entropy * 100)}%</div>`;
        if (officer.buffs.creditMult !== 0) buffsHtml += `<div class="mb-2 pb-2 border-b border-gray-800/50" style="${baseStyle}"><span class="text-green-300 font-bold uppercase tracking-wider">CREDIT YIELD:</span><br/> +${Math.round(officer.buffs.creditMult * 100)}%</div>`;
        if (officer.buffs.amMult !== 0) buffsHtml += `<div class="mb-2 pb-2 border-b border-gray-800/50" style="${baseStyle}"><span class="text-purple-300 font-bold uppercase tracking-wider">AM YIELD:</span><br/> +${Math.round(officer.buffs.amMult * 100)}%</div>`;
        
        if (officer.buffs.capacityMods) {
            Object.entries(officer.buffs.capacityMods).forEach(([k, v]) => {
                const cName = DB.COMMODITIES.find(c => c.id === k)?.name || k;
                buffsHtml += `<div class="mb-2 pb-2 border-b border-gray-800/50" style="${baseStyle}"><span class="text-blue-300 font-bold uppercase tracking-wider">+ CAPACITY:</span><br/> ${cName} (${v.toLocaleString()})</div>`;
            });
        }
        if (officer.buffs.consumptionMods) {
            Object.entries(officer.buffs.consumptionMods).forEach(([k, v]) => {
                const cName = DB.COMMODITIES.find(c => c.id === k)?.name || k;
                buffsHtml += `<div class="mb-2 pb-2 border-b border-gray-800/50" style="${baseStyle}"><span class="text-yellow-300 font-bold uppercase tracking-wider">- CONSUMPTION:</span><br/> ${cName} (-${Math.round(v * 100)}%)</div>`;
            });
        }

        root.innerHTML = `
            <div class="sol-subview-header flex justify-center items-center mb-2 border-b border-gray-700 pb-2">
                <div class="sol-level-header ${rarityColor} text-[22px] tracking-wider uppercase text-center w-full">${officer.name}</div>
            </div>
            
            <div class="flex flex-col p-5 bg-gray-900 border border-gray-700 rounded-lg mb-4 shadow-xl">
                <div class="flex items-center justify-between mb-4 border-b border-gray-800 pb-2">
                    <div class="text-xs uppercase tracking-widest text-gray-400 mt-1">${officer.role}</div>
                    <div class="text-[10px] font-bold uppercase px-2 py-1 rounded border border-gray-600 ${rarityColor} opacity-80">
                        ${(officer.rarity || 'common').replace('_', ' ')}
                    </div>
                </div>
                
                <div class="text-sm text-gray-300 mb-6 leading-relaxed bg-black/30 p-3 rounded border-l-2 border-gray-600 font-sans">
                    "${officer.lore}"
                </div>
                
                <div class="w-full flex flex-col" style="max-height: 200px;">
                    <div class="text-xs text-gray-500 font-bold mb-2 uppercase tracking-widest">Influence</div>
                    <div class="flex-1 overflow-y-auto bg-black/50 p-3 rounded border border-gray-800" style="scrollbar-width: thin;">
                        ${buffsHtml || '<div class="text-sm text-gray-500">No measurable influence.</div>'}
                    </div>
                </div>
            </div>

            <div class="flex justify-center mt-2">
                <button type="button" class="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded uppercase tracking-wider text-sm shadow transition-colors" data-local-action="open-officer-mgmt">
                    &larr; RETURN TO ROSTER
                </button>
            </div>
        `;

        const footerBtn = document.querySelector('#event-button-container button');
        if (footerBtn) {
            footerBtn.style.display = 'none'; 
        }

        this._bindLocalListeners(gameState);
        this._restoreScrollPosition();
    }

    _getRarityColorClass(rarity) {
        switch (rarity) {
            case 'uncommon': return 'text-green-400';
            case 'valuable': return 'text-blue-400';
            case 'rare': return 'text-yellow-400';
            case 'very_rare': return 'text-orange-400';
            case 'hyper_rare': return 'text-red-500';
            case 'common':
            default: return 'text-white';
        }
    }

    showEngineeringModal(gameState) {
        this.currentView = 'engineering';
        this._stopRefreshLoop();
        const root = document.getElementById('sol-dashboard-root');
        if (!root) return;

        const station = this._getLiveStationState(gameState);
        const nextLevelData = LEVEL_REGISTRY[station.level + 1];

        if (!nextLevelData) {
            root.innerHTML = `<div class="text-center p-8"><h3 class="level-50-glow text-2xl font-bold">STATION MAXIMIZED</h3></div>`;
            return;
        }

        const reqs = nextLevelData.requirements;
        const bank = station.activeProjectBank;
        let allRequirementsMet = true;

        let reqsHtml = '';
        Object.entries(reqs).forEach(([resId, reqQty]) => {
            const bankedQty = bank[resId] || 0;
            const pct = Math.min(100, (bankedQty / reqQty) * 100);
            const isComplete = bankedQty >= reqQty;
            if (!isComplete) allRequirementsMet = false;
            
            if (resId === 'credits') {
                const playerCr = gameState.player.credits;
                reqsHtml += `
                    <div class="eng-req-row bg-gray-800 border border-gray-600 rounded p-3 mb-3">
                        <div class="req-header flex justify-between items-center mb-1">
                            <span class="font-bold text-sm">Credits</span>
                            <span class="font-mono text-sm text-blue-300">${formatCredits(bankedQty, false)} / ${formatCredits(reqQty, false)}</span>
                        </div>
                        <div class="eng-progress-track h-2 bg-black rounded overflow-hidden"><div class="eng-progress-fill h-full bg-green-500 transition-all" style="width: ${pct}%;"></div></div>
                        ${!isComplete ? `
                            <div class="credit-stepper flex gap-2 mt-3">
                                <input type="number" id="eng-credit-input" min="0" max="${Math.min(reqQty - bankedQty, playerCr)}" value="0" step="1000" class="flex-1 bg-black border border-gray-600 text-white rounded px-2 font-mono">
                                <button type="button" class="btn-sm bg-gray-700 hover:bg-gray-600 px-3 rounded text-xs font-bold" data-local-action="eng-donate-max-credits">MAX</button>
                                <button type="button" class="btn-sm bg-green-700 hover:bg-green-600 px-4 rounded text-xs font-bold text-white" data-local-action="eng-contribute-credits">FUND</button>
                            </div>
                        ` : '<div class="text-green-400 text-sm font-bold mt-2 text-right">FUNDED</div>'}
                    </div>
                `;
            } else {
                const comm = DB.COMMODITIES.find(c => c.id === resId);
                const pStock = gameState.player.ownedShipIds.reduce((total, id) => total + (gameState.player.inventories[id]?.[resId]?.quantity || 0), 0);
                
                reqsHtml += `
                    <div class="eng-req-row bg-gray-800 border border-gray-600 rounded p-3 mb-3">
                        <div class="req-header flex justify-between items-center mb-1">
                            <span class="font-bold text-sm">${comm ? comm.name : resId}</span>
                            <span class="font-mono text-sm text-blue-300">${bankedQty.toLocaleString()} / ${reqQty.toLocaleString()}</span>
                        </div>
                        <div class="eng-progress-track h-2 bg-black rounded overflow-hidden"><div class="eng-progress-fill h-full bg-blue-500 transition-all" style="width: ${pct}%;"></div></div>
                        ${!isComplete ? `
                            <div class="flex justify-between items-center mt-3">
                                <span class="text-xs text-gray-400">Fleet Stock: ${pStock.toLocaleString()}</span>
                                <button type="button" class="btn-sm bg-blue-700 hover:bg-blue-600 px-4 py-1 rounded text-xs font-bold text-white transition-colors" data-local-action="eng-contribute-cargo" data-comm-id="${resId}" ${pStock <= 0 ? 'disabled style="opacity:0.5;"' : ''}>DEPOSIT</button>
                            </div>
                        ` : '<div class="text-green-400 text-sm font-bold mt-2 text-right">SUPPLIED</div>'}
                    </div>
                `;
            }
        });

        const rewardsList = nextLevelData.rewards.description.split(', ').map(r => 
            `<div class="mb-2 text-gray-300 font-sans tracking-wide border-l-2 border-blue-500 pl-2 py-1 bg-black/30 rounded-r text-sm">
                ${r.trim()}
             </div>`
        ).join('');

        const completeBtn = allRequirementsMet 
            ? `<button class="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-4 rounded text-xl shadow-lg animate-pulse mb-4 tracking-widest" data-local-action="eng-complete-project">COMPLETE PROJECT</button>`
            : '';

        root.innerHTML = `
            <div class="sol-subview-header flex justify-between items-center mb-4">
                <div class="sol-level-header ${this._getLevelStyleClass(station.level)} text-lg font-bold">ENGINEERING: PROJECT ${station.level + 1}</div>
            </div>
            <div class="eng-project-info mb-6 p-4 bg-black/40 border border-gray-700 rounded">
                <div class="text-lg font-bold text-yellow-400 mb-1 tracking-wide">${nextLevelData.projectName}</div>
                <div class="text-xs text-gray-400 italic mb-3 leading-relaxed border-b border-gray-700 pb-3">"${nextLevelData.lore}"</div>
                
                <div class="text-sm font-bold text-blue-300 mb-2"><span class="text-white text-xs bg-blue-900 px-1 rounded mr-2">REWARDS</span></div>
                <div class="flex flex-col gap-1 mb-1">
                    ${rewardsList}
                </div>
            </div>
            
            ${completeBtn}

            <div class="eng-requirements-list">
                ${reqsHtml}
            </div>
            
            <div class="flex justify-center mt-6 border-t border-gray-700 pt-4">
                <button type="button" class="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white font-bold py-2 px-6 rounded uppercase tracking-wider text-xs shadow transition-colors" data-local-action="return-dashboard">
                    &larr; RETURN TO DASHBOARD
                </button>
            </div>
        `;

        this._bindLocalListeners(gameState);

        const footerBtn = document.querySelector('#event-button-container button');
        if (footerBtn) {
            footerBtn.style.display = 'none'; 
        }

        this._restoreScrollPosition();
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
                warningsHtml += `<div class="text-sm text-gray-300 ml-4 font-mono text-red-500">- ${payload.ventedCargo[k].toLocaleString()} units of ${commName}</div>`;
            });
        }

        const modalHtml = `
            <div id="unslot-warning-root" class="text-center p-4">
                <h3 class="text-xl font-bold text-red-500 mb-4 tracking-wider">CRITICAL LOAD WARNING</h3>
                <p class="mb-4 text-sm text-gray-300">Removing <span class="text-white font-bold">${officer.name}</span> will destabilize station operations.</p>
                <div class="text-left bg-black border border-red-900 p-4 rounded mb-6 shadow-inner">
                    ${warningsHtml}
                </div>
                <div class="flex gap-4 justify-center">
                    <button type="button" class="btn bg-red-700 hover:bg-red-600 text-white font-bold py-2 px-4 rounded" id="btn-confirm-unslot">CONFIRM REMOVAL</button>
                    <button type="button" class="btn border border-gray-500 hover:bg-gray-800 text-white font-bold py-2 px-4 rounded" id="btn-cancel-unslot">ABORT</button>
                </div>
            </div>
        `;

        const root = document.getElementById('sol-dashboard-root');
        root.innerHTML = modalHtml;

        document.getElementById('btn-confirm-unslot').onclick = () => {
            const svc = this.uiManager.simulationService.solStationService;
            svc.assignOfficer(slotId, null, true); 
            this.showOfficerManagement(svc.gameState);
        };

        document.getElementById('btn-cancel-unslot').onclick = () => {
            this.showOfficerManagement(gameState);
        };
    }

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

        const nextLvl = LEVEL_REGISTRY[station.level + 1];
        let engOverview = '<div class="text-center text-gray-500 text-xs">STATION MAXIMIZED</div>';
        if (nextLvl) {
            const reqRows = Object.entries(nextLvl.requirements).map(([resId, qty]) => {
                const banked = station.activeProjectBank[resId] || 0;
                const isComplete = banked >= qty;
                const name = resId === 'credits' ? 'Credits' : (DB.COMMODITIES.find(c => c.id === resId)?.name || resId);
                const progressText = isComplete 
                    ? '<span class="text-green-400 font-bold tracking-wider">DONE</span>' 
                    : `<span style="font-family: 'Roboto Mono', monospace;">${formatCredits(banked, false)} / ${formatCredits(qty, false)}</span>`;
                
                return `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.8rem;">
                        <span class="text-gray-400 uppercase tracking-wider">${name}</span>
                        <span class="text-blue-200">${progressText}</span>
                    </div>
                `;
            }).join('');
            
            const descText = this._getProjectImpactDescription(nextLvl.rewards.stats);

            engOverview = `
                <div style="display: flex; flex-direction: column; margin-top: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-transform: none; letter-spacing: normal;">
                    ${reqRows}
                    <div class="text-center text-xs text-gray-500 italic mt-2 border-t border-gray-700 pt-2">${descText}</div>
                    <button type="button" class="mt-3 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold py-1 px-4 rounded self-center shadow transition-colors w-1/2 mx-auto">REVIEW</button>
                </div>
            `;
        }

        return `
            <div id="sol-dashboard-root" class="sol-dashboard-container">
                
                <div class="sol-level-header ${this._getLevelStyleClass(station.level)} text-center mb-2 font-orbitron font-bold text-xl uppercase tracking-widest transition-colors duration-500">
                    SOL STATION LV. ${station.level}
                </div>

                <div class="sol-header-panel" style="display: flex; gap: 1rem; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
                    <div class="sol-health-container" style="flex-grow: 1;">
                        <div class="sol-health-bar-label" style="display: flex; flex-direction: column; align-items: flex-start; gap: 2px; margin-bottom: 0.5rem;">
                            <div style="font-size: 0.7rem; color: #9ca3af; letter-spacing: 1px;">STATION HEALTH</div>
                            <div class="${this._getHealthColorClass(station.health)}" style="font-size: 1.25rem; font-weight: bold; line-height: 1;">${station.health.toFixed(2)}%</div>
                        </div>
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
                    <button type="button" class="w-full bg-blue-900 border border-blue-500 text-white font-bold py-3 rounded uppercase tracking-wider shadow-lg transition-transform hover:scale-[1.02]" data-local-action="open-officer-mgmt">
                        OFFICER MANAGEMENT
                    </button>
                </div>

                <div class="mt-4 p-3 border border-gray-600 rounded cursor-pointer bg-gray-900 hover:bg-gray-800 transition-colors shadow-lg flex flex-col" data-local-action="open-engineering">
                    <div class="text-xs text-gray-400 uppercase font-bold text-center tracking-widest">ENGINEERING BAY</div>
                    ${nextLvl ? `<div class="text-center font-bold text-sm text-yellow-400 mt-1 uppercase tracking-wider">${nextLvl.projectName}</div>` : ''}
                    ${engOverview}
                </div>
            </div>
        `;
    }

    _getProjectImpactDescription(stats) {
        const parts = [];
        if (stats.cacheCapacity) {
            Object.keys(stats.cacheCapacity).forEach(k => {
                const cName = DB.COMMODITIES.find(c => c.id === k)?.name || k;
                parts.push(`Expand ${cName} storage.`);
            });
        }
        if (stats.amYieldMult > 0) parts.push(`Increase Antimatter synthesis by ${Math.round(stats.amYieldMult * 100)}%.`);
        if (stats.creditYieldMult > 0) parts.push(`Improve commercial revenue by ${Math.round(stats.creditYieldMult * 100)}%.`);
        if (stats.globalEntropyRed > 0) parts.push(`Reinforce hull integrity against solar decay.`);
        
        return parts.length > 0 ? parts.join(" ") : "General station improvements.";
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