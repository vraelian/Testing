// js/services/DebugService.js
import { DB } from '../data/database.js';
import { LOCATION_IDS, SHIP_IDS, NAV_IDS, SCREEN_IDS, COMMODITY_IDS, STATUS_EFFECTS, PERK_IDS, ATTRIBUTE_TYPES } from '../data/constants.js';
import { Logger } from './LoggingService.js';
import { calculateInventoryUsed, skewedRandom } from '../utils.js'; 
import { AutomatedPlayer } from './bot/AutomatedPlayerService.js';
import { GameAttributes } from './GameAttributes.js'; 
import { AssetService } from './AssetService.js'; 
import { OFFICERS } from '../data/officers.js';
import { HELP_REGISTRY } from '../data/helpRegistry.js';
import { TelemetryStorageService } from './TelemetryStorageService.js';

// --- EPHEMERAL DEBUG MISSIONS ---
const DEBUG_MISSIONS = {
    'debug_kitchen_sink': {
        id: 'debug_kitchen_sink',
        name: '[DEBUG] Kitchen Sink Rewards',
        type: 'DEBUG',
        host: 'DEV',
        description: 'Instantly completes to test multiple reward types (Credits, Items, Licenses).',
        triggers: [],
        objectives: [], 
        completion: {
            locationId: null, 
            title: 'Debug Success',
            text: 'You have received a bounty of debug rewards.',
            buttonText: 'Claim Loot'
        },
        rewards: [
            { type: 'credits', amount: 50000 },
            { type: 'item', goodId: 'fuel', quantity: 100 },
            { type: 'license', licenseId: 't2_license' } 
        ]
    },
    'debug_obj_travel': {
        id: 'debug_obj_travel',
        name: '[DEBUG] Travel Logic (Mars)',
        type: 'DEBUG',
        host: 'DEV',
        description: 'Requires travel to Mars to verify location triggers.',
        triggers: [],
        objectives: [
            { type: 'TRAVEL_TO', target: 'loc_mars' }
        ],
        completion: {
            locationId: 'loc_mars',
            title: 'Arrived at Mars',
            text: 'Travel objective verified.',
            buttonText: 'OK'
        },
        rewards: [{ type: 'credits', amount: 100 }]
    },
    'debug_obj_wealth': {
        id: 'debug_obj_wealth',
        name: '[DEBUG] Wealth Check (>10k)',
        type: 'DEBUG',
        host: 'DEV',
        description: 'Requires player to have > 10,000 credits.',
        triggers: [],
        objectives: [
            { type: 'WEALTH_CHECK', value: 10000 }
        ],
        completion: {
            locationId: null,
            title: 'Wealth Verified',
            text: 'You are wealthy enough.',
            buttonText: 'OK'
        },
        rewards: [{ type: 'credits', amount: 1 }]
    },
    'debug_obj_delivery': {
        id: 'debug_obj_delivery',
        name: '[DEBUG] Delivery (water ice)',
        type: 'DEBUG',
        host: 'DEV',
        description: 'Deliver 5 water ice. (Cargo provided on accept)',
        triggers: [],
        objectives: [
            { type: 'DELIVER_ITEM', goodId: 'water_ice', quantity: 5 }
        ],
        providedCargo: [{ goodId: 'water_ice', quantity: 5 }],
        completion: {
            locationId: null,
            title: 'Delivery Done',
            text: 'Items deducted correctly?',
            buttonText: 'OK'
        },
        rewards: [{ type: 'credits', amount: 500 }]
    }
};

export class DebugService {
    constructor(gameState, simulationService, uiManager, logger) {
        this.gameState = gameState;
        this.simulationService = simulationService;
        this.uiManager = uiManager;
        this.logger = logger;
        this.gui = null;
        this.active = false;
        this.diagActive = false;
        this.diagElements = {};
        this.actions = {};
        
        // --- POPPED OUT MISSION TRIGGERS STATE ---
        this.isMissionPoppedOut = false;
        this.poppedActive = false;
        this.missionFolder = null;
        this.poppedMissionElement = null;
        this.missionFolderPlaceholder = null;
        this.poppedDragHandle = null;
        this.missionPopBtn = null;
        this.goToBtnEl = null;
        this.goToDropdownEl = null;
        
        this.debugState = {
            creditsToAdd: 100000,
            creditsToReduce: 100000,
            targetAge: 25, 
            selectedLocation: this.gameState.currentLocationId,
            daysToAdvance: 7,
            selectedStoryEvent: DB.STORY_EVENTS ? Object.keys(DB.STORY_EVENTS)[0] || '' : '',
            selectedRandomEvent: DB.RANDOM_EVENTS[0]?.id || '', 
            selectedMission: 'debug_kitchen_sink',
            selectedSystemState: 'NEUTRAL', 
            botDaysToRun: 365,
            botStrategy: 'MIXED', 
            botProgress: 'Idle',
            logLevel: 'INFO',
            
            selectedUpgrade: null, 
            selectedStatusEffect: null,
            selectedCommodityToAdd: COMMODITY_IDS.WATER_ICE,
            quantityToAdd: 10,
            alwaysTriggerEvents: false,
            verboseTickLogging: true,
            enableEconomicTelemetry: false,

            // --- UI GUIDES STATE (Arrays/Booleans) ---
            navLockMain: Object.values(NAV_IDS).reduce((acc, id) => ({ ...acc, [id]: false }), {}),
            navLockSub: Object.values(SCREEN_IDS).reduce((acc, id) => ({ ...acc, [id]: false }), {})
        }; 

        this.bot = new AutomatedPlayer(gameState, simulationService, logger);
    }

    init() {
        if (this.gui) return;
        
        Object.assign(DB.MISSIONS, DEBUG_MISSIONS);
        if(this.logger && this.logger.warn) this.logger.warn('DebugService', 'Injected Ephemeral Debug Missions into DB.MISSIONS');

        this._cacheDiagElements();
        this.gui = new lil.GUI({ draggable: false, title: 'Debug Menu' });
        this.gui.domElement.id = 'debug-panel';
        
        // Ensure UI state matches debug state for the tick toggles
        if (!this.gameState.uiState) this.gameState.uiState = {};
        this.gameState.uiState.verboseTickLogging = this.debugState.verboseTickLogging;
        this.gameState.uiState.enableEconomicTelemetry = this.debugState.enableEconomicTelemetry;

        this._registerDebugActions();
        this.buildGui();
        this._setupDraggableHandle();
    }
 
    _setupDraggableHandle() {
        if (!this.gui || !this.gui.domElement) return;
        const panel = this.gui.domElement;
        const titleEl = panel.querySelector('.title');
        if (!titleEl) return;

        // Create drag handle
        const handle = document.createElement('div');
        handle.className = 'debug-drag-handle';
        handle.setAttribute('title', 'Hold and drag to move');
        handle.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <circle cx="8" cy="5" r="1.75"/>
                <circle cx="16" cy="5" r="1.75"/>
                <circle cx="8" cy="12" r="1.75"/>
                <circle cx="16" cy="12" r="1.75"/>
                <circle cx="8" cy="19" r="1.75"/>
                <circle cx="16" cy="19" r="1.75"/>
            </svg>
        `;

        titleEl.insertBefore(handle, titleEl.firstChild);
        titleEl.style.touchAction = 'none';

        // Create header action buttons (Collapse, Reload) on the right side
        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'debug-header-actions';

        const collapseBtn = document.createElement('button');
        collapseBtn.className = 'debug-header-btn debug-collapse-btn';
        collapseBtn.type = 'button';
        collapseBtn.textContent = 'Collapse';
        collapseBtn.setAttribute('title', 'Immediately collapse all menus');
        collapseBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
        collapseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.collapseAll();
        });

        const reloadBtn = document.createElement('button');
        reloadBtn.className = 'debug-header-btn debug-reload-btn';
        reloadBtn.type = 'button';
        reloadBtn.textContent = 'Reload';
        reloadBtn.setAttribute('title', 'Reload game, quick start, and open debug menu');
        reloadBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
        reloadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.reloadAndQuickStart();
        });

        actionsContainer.appendChild(collapseBtn);
        actionsContainer.appendChild(reloadBtn);
        titleEl.appendChild(actionsContainer);

        let isDragging = false;
        let startPointerX = 0;
        let startPointerY = 0;
        let initialPanelLeft = 0;
        let initialPanelTop = 0;
        let panelWidth = 0;
        let panelHeight = 0;
        let activePointerId = null;
        let dragRafId = null;
        let pendingLeft = 0;
        let pendingTop = 0;

        const updatePosition = () => {
            if (!isDragging) return;
            panel.style.left = `${pendingLeft}px`;
            panel.style.top = `${pendingTop}px`;
            dragRafId = null;
        };

        const onPointerDown = (e) => {
            // Allow left mouse button (0) or touch/pen
            if (e.button !== undefined && e.button !== 0) return;
            // Prevent drag when clicking header buttons
            if (e.target.closest('.debug-header-actions') || e.target.closest('button')) return;

            isDragging = true;
            activePointerId = e.pointerId;
            
            const targetEl = e.target.closest('.debug-drag-handle') || titleEl;
            try {
                targetEl.setPointerCapture(e.pointerId);
            } catch (err) {}

            const rect = panel.getBoundingClientRect();
            startPointerX = e.clientX;
            startPointerY = e.clientY;
            initialPanelLeft = rect.left;
            initialPanelTop = rect.top;
            panelWidth = rect.width;
            panelHeight = rect.height;

            // Transition from centered relative styling to explicit fixed screen coordinates
            panel.style.position = 'fixed';
            panel.style.left = `${initialPanelLeft}px`;
            panel.style.top = `${initialPanelTop}px`;
            panel.style.transform = 'scale(0.75)';
            panel.style.transformOrigin = 'top left';

            panel.classList.add('is-dragging');
            document.body.classList.add('debug-is-dragging');

            e.preventDefault();
            e.stopPropagation();
        };

        const onPointerMove = (e) => {
            if (!isDragging || e.pointerId !== activePointerId) return;

            const deltaX = e.clientX - startPointerX;
            const deltaY = e.clientY - startPointerY;

            let targetLeft = initialPanelLeft + deltaX;
            let targetTop = initialPanelTop + deltaY;

            // Keep within viewport boundaries so the panel cannot be lost offscreen
            const minLeft = -panelWidth + 60; // Keep at least 60px visible
            const maxLeft = window.innerWidth - 60;
            const minTop = 0;
            const maxTop = window.innerHeight - 40;

            pendingLeft = Math.max(minLeft, Math.min(targetLeft, maxLeft));
            pendingTop = Math.max(minTop, Math.min(targetTop, maxTop));

            if (!dragRafId) {
                dragRafId = requestAnimationFrame(updatePosition);
            }

            e.preventDefault();
            e.stopPropagation();
        };

        const onPointerUp = (e) => {
            if (!isDragging || (activePointerId !== null && e.pointerId !== activePointerId)) return;
            isDragging = false;
            activePointerId = null;

            if (dragRafId) {
                cancelAnimationFrame(dragRafId);
                dragRafId = null;
            }

            const targetEl = e.target.closest?.('.debug-drag-handle') || titleEl;
            try {
                targetEl.releasePointerCapture(e.pointerId);
            } catch (err) {}

            panel.classList.remove('is-dragging');
            document.body.classList.remove('debug-is-dragging');

            e.preventDefault();
            e.stopPropagation();
        };

        titleEl.addEventListener('pointerdown', onPointerDown);
        titleEl.addEventListener('pointermove', onPointerMove);
        titleEl.addEventListener('pointerup', onPointerUp);
        titleEl.addEventListener('pointercancel', onPointerUp);

        // Keep panel in bounds on window resize or device orientation flip
        window.addEventListener('resize', () => {
            if (this.isMissionPoppedOut && this.poppedMissionElement && this.poppedActive) {
                const rect = this.poppedMissionElement.getBoundingClientRect();
                if (rect.left > window.innerWidth - 60) {
                    this.poppedMissionElement.style.left = `${Math.max(0, window.innerWidth - rect.width)}px`;
                }
                if (rect.top > window.innerHeight - 40) {
                    this.poppedMissionElement.style.top = `${Math.max(0, window.innerHeight - 40)}px`;
                }
                return;
            }
            if (!this.active || !this.gui) return;
            const rect = panel.getBoundingClientRect();
            if (rect.left > window.innerWidth - 60) {
                panel.style.left = `${Math.max(0, window.innerWidth - rect.width)}px`;
            }
            if (rect.top > window.innerHeight - 40) {
                panel.style.top = `${Math.max(0, window.innerHeight - 40)}px`;
            }
        });
    }

    collapseAll() {
        if (!this.gui) return;
        const closeFolderRecursive = (folder) => {
            if (folder.folders && folder.folders.length) {
                folder.folders.forEach(child => closeFolderRecursive(child));
            }
            if (typeof folder.close === 'function') {
                folder.close();
            }
        };

        if (this.gui.folders) {
            this.gui.folders.forEach(folder => closeFolderRecursive(folder));
        }
        if (typeof this.gui.open === 'function') {
            this.gui.open();
        }

        if (this.uiManager && typeof this.uiManager.createFloatingText === 'function') {
            this.uiManager.createFloatingText('All Menus Collapsed', window.innerWidth / 2, window.innerHeight / 2, '#38bdf8');
        }
    }

    reloadAndQuickStart() {
        sessionStorage.setItem('orbital_debug_quick_reload', 'true');
        window.location.reload();
    }

    _setupMissionFolderPopControl(missionFolder) {
        if (!missionFolder || !missionFolder.domElement) return;
        const titleEl = missionFolder.$title || missionFolder.domElement.querySelector(':scope > .title') || missionFolder.domElement.querySelector('.title');
        if (!titleEl) return;

        titleEl.style.display = 'flex';
        titleEl.style.alignItems = 'center';
        titleEl.style.justifyContent = 'space-between';
        titleEl.style.whiteSpace = 'nowrap';
        titleEl.style.flexWrap = 'nowrap';
        titleEl.style.minHeight = '28px';
        titleEl.style.height = 'auto';
        titleEl.style.width = '100%';
        titleEl.style.boxSizing = 'border-box';

        const popBtn = document.createElement('button');
        popBtn.className = 'debug-folder-action-btn';
        popBtn.type = 'button';
        popBtn.textContent = 'Pop ↗';
        popBtn.setAttribute('title', 'Pop out Mission Triggers menu');
        popBtn.style.marginLeft = 'auto';
        popBtn.style.flex = '0 0 auto';
        popBtn.style.width = 'auto';
        popBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
        popBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.isMissionPoppedOut) {
                this.popInMissionFolder();
            } else {
                this.popOutMissionFolder();
            }
        });

        titleEl.appendChild(popBtn);
        this.missionPopBtn = popBtn;
    }

    _setMissionFolderTitle(title) {
        if (!this.missionFolder || !this.missionFolder.domElement) return;
        const titleEl = this.missionFolder.$title || this.missionFolder.domElement.querySelector(':scope > .title') || this.missionFolder.domElement.querySelector('.title');
        if (!titleEl) return;
        let found = false;
        for (const node of titleEl.childNodes) {
            if (node.nodeType === 3) { // TEXT_NODE
                node.textContent = title;
                found = true;
                break;
            }
        }
        if (!found) {
            const textNode = document.createTextNode(title);
            if (this.poppedDragHandle && this.poppedDragHandle.nextSibling) {
                titleEl.insertBefore(textNode, this.poppedDragHandle.nextSibling);
            } else {
                titleEl.insertBefore(textNode, titleEl.firstChild);
            }
        }
    }

    popOutMissionFolder() {
        if (this.isMissionPoppedOut || !this.missionFolder) return;
        const el = this.missionFolder.domElement;
        this.poppedMissionElement = el;

        // Insert placeholder comment to anchor position in DOM
        this.missionFolderPlaceholder = document.createComment('mission-folder-placeholder');
        el.parentNode.insertBefore(this.missionFolderPlaceholder, el);

        // Move element to document.body
        document.body.appendChild(el);
        el.removeAttribute('style');
        el.classList.add('debug-popped-out-panel');
        el.classList.add('debug-visible');

        // Rename header to 'Mission Control'
        this._setMissionFolderTitle('Mission Control');

        this.missionFolder.open();

        if (!this.poppedDragHandle) {
            this._setupPoppedFolderDraggable(el);
        } else {
            this.poppedDragHandle.style.display = 'inline-flex';
        }

        if (this.missionPopBtn) {
            this.missionPopBtn.textContent = 'Pop In ↙';
            this.missionPopBtn.setAttribute('title', 'Pop back into Debug Menu');
        }

        // Close regular debug menu
        this.active = false;
        if (this.gui && this.gui.domElement) {
            this.gui.domElement.classList.remove('debug-visible');
        }

        this.isMissionPoppedOut = true;
        this.poppedActive = true;

        if (this.uiManager && typeof this.uiManager.createFloatingText === 'function') {
            this.uiManager.createFloatingText('Mission Control Popped Out', window.innerWidth / 2, window.innerHeight - 80, '#94a3b8');
        }
    }

    popInMissionFolder() {
        if (!this.isMissionPoppedOut || !this.poppedMissionElement) return;

        if (this.poppedDragRafId) {
            cancelAnimationFrame(this.poppedDragRafId);
            this.poppedDragRafId = null;
        }

        document.body.classList.remove('debug-is-dragging');

        const targetParent = (this.missionFolderPlaceholder && this.missionFolderPlaceholder.parentNode)
            ? this.missionFolderPlaceholder.parentNode
            : (this.triggersFolder ? (this.triggersFolder.$children || this.triggersFolder.domElement.querySelector('.children')) : null);

        if (this.missionFolderPlaceholder && this.missionFolderPlaceholder.parentNode) {
            this.missionFolderPlaceholder.parentNode.insertBefore(this.poppedMissionElement, this.missionFolderPlaceholder);
            this.missionFolderPlaceholder.remove();
        } else if (targetParent) {
            targetParent.insertBefore(this.poppedMissionElement, targetParent.firstChild);
        }
        this.missionFolderPlaceholder = null;

        // Completely strip all inline positioning/scaling/styling so it docks seamlessly into lil-gui flow
        this.poppedMissionElement.removeAttribute('style');
        this.poppedMissionElement.classList.remove('debug-popped-out-panel', 'debug-visible', 'is-dragging');

        // Restore title to 'Mission Triggers'
        this._setMissionFolderTitle('Mission Triggers');

        const titleEl = this.poppedMissionElement.querySelector('.title');
        if (titleEl) {
            titleEl.style.touchAction = '';
        }

        if (this.poppedDragHandle) {
            this.poppedDragHandle.style.display = 'none';
        }

        if (this.missionPopBtn) {
            this.missionPopBtn.textContent = 'Pop ↗';
            this.missionPopBtn.setAttribute('title', 'Pop out Mission Control');
        }

        this.isMissionPoppedOut = false;
        this.poppedActive = false;

        // Re-open main debug menu
        this.active = true;
        if (this.gui && this.gui.domElement) {
            this.gui.domElement.classList.add('debug-visible');
        }

        if (this.uiManager && typeof this.uiManager.createFloatingText === 'function') {
            this.uiManager.createFloatingText('Mission Control Restored to Menu', window.innerWidth / 2, window.innerHeight / 2, '#38bdf8');
        }
    }

    _setupPoppedFolderDraggable(panel) {
        const titleEl = panel.querySelector('.title');
        if (!titleEl) return;

        const handle = document.createElement('div');
        handle.className = 'debug-drag-handle';
        handle.setAttribute('title', 'Hold and drag to move');
        handle.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <circle cx="8" cy="5" r="1.75"/>
                <circle cx="16" cy="5" r="1.75"/>
                <circle cx="8" cy="12" r="1.75"/>
                <circle cx="16" cy="12" r="1.75"/>
                <circle cx="8" cy="19" r="1.75"/>
                <circle cx="16" cy="19" r="1.75"/>
            </svg>
        `;

        titleEl.insertBefore(handle, titleEl.firstChild);
        titleEl.style.touchAction = 'none';
        this.poppedDragHandle = handle;

        let isDragging = false;
        let startPointerX = 0;
        let startPointerY = 0;
        let initialPanelLeft = 0;
        let initialPanelTop = 0;
        let panelWidth = 0;
        let panelHeight = 0;
        let activePointerId = null;
        let pendingLeft = 0;
        let pendingTop = 0;
        this.poppedDragRafId = null;

        const updatePosition = () => {
            if (!this.isMissionPoppedOut || !isDragging) return;
            panel.style.left = `${pendingLeft}px`;
            panel.style.top = `${pendingTop}px`;
            this.poppedDragRafId = null;
        };

        const onPointerDown = (e) => {
            // STRICT GUARD: Never drag or alter styling unless actively popped out
            if (!this.isMissionPoppedOut) return;
            if (e.button !== undefined && e.button !== 0) return;
            if (e.target.closest('button')) return;

            isDragging = true;
            activePointerId = e.pointerId;

            const targetEl = e.target.closest('.debug-drag-handle') || titleEl;
            try {
                targetEl.setPointerCapture(e.pointerId);
            } catch (err) {}

            const rect = panel.getBoundingClientRect();
            startPointerX = e.clientX;
            startPointerY = e.clientY;
            initialPanelLeft = rect.left;
            initialPanelTop = rect.top;
            panelWidth = rect.width;
            panelHeight = rect.height;

            panel.style.position = 'fixed';
            panel.style.left = `${initialPanelLeft}px`;
            panel.style.top = `${initialPanelTop}px`;
            panel.style.bottom = 'auto';
            panel.style.transform = 'scale(0.75)';
            panel.style.transformOrigin = 'top left';

            panel.classList.add('is-dragging');
            document.body.classList.add('debug-is-dragging');

            e.preventDefault();
            e.stopPropagation();
        };

        const onPointerMove = (e) => {
            if (!this.isMissionPoppedOut || !isDragging || e.pointerId !== activePointerId) return;

            const deltaX = e.clientX - startPointerX;
            const deltaY = e.clientY - startPointerY;

            let targetLeft = initialPanelLeft + deltaX;
            let targetTop = initialPanelTop + deltaY;

            const minLeft = -panelWidth + 60;
            const maxLeft = window.innerWidth - 60;
            const minTop = 0;
            const maxTop = window.innerHeight - 40;

            pendingLeft = Math.max(minLeft, Math.min(targetLeft, maxLeft));
            pendingTop = Math.max(minTop, Math.min(targetTop, maxTop));

            if (!this.poppedDragRafId) {
                this.poppedDragRafId = requestAnimationFrame(updatePosition);
            }

            e.preventDefault();
            e.stopPropagation();
        };

        const onPointerUp = (e) => {
            if (!isDragging || (activePointerId !== null && e.pointerId !== activePointerId)) return;
            isDragging = false;
            activePointerId = null;

            if (this.poppedDragRafId) {
                cancelAnimationFrame(this.poppedDragRafId);
                this.poppedDragRafId = null;
            }

            const targetEl = e.target.closest?.('.debug-drag-handle') || titleEl;
            try {
                targetEl.releasePointerCapture(e.pointerId);
            } catch (err) {}

            panel.classList.remove('is-dragging');
            document.body.classList.remove('debug-is-dragging');

            e.preventDefault();
            e.stopPropagation();
        };

        titleEl.addEventListener('pointerdown', onPointerDown);
        titleEl.addEventListener('pointermove', onPointerMove);
        titleEl.addEventListener('pointerup', onPointerUp);
        titleEl.addEventListener('pointercancel', onPointerUp);
    }

    handleKeyPress(key) {}

    toggleVisibility() {
        if (this.isMissionPoppedOut && this.poppedMissionElement) {
            this.poppedActive = !this.poppedActive;
            this.poppedMissionElement.classList.toggle('debug-visible', this.poppedActive);
            return;
        }
        if (!this.gui) return;
        this.active = !this.active;
        this.gui.domElement.classList.toggle('debug-visible', this.active);
    }

    resetPosition(makeVisible = true) {
        const targetPanel = (this.isMissionPoppedOut && this.poppedMissionElement) ? this.poppedMissionElement : (this.gui ? this.gui.domElement : null);
        if (!targetPanel) return;

        // Reset inline positioning to default centered / bottom style
        targetPanel.style.position = '';
        targetPanel.style.left = '';
        targetPanel.style.top = '';
        targetPanel.style.bottom = '';
        targetPanel.style.transform = '';
        targetPanel.style.transformOrigin = '';
        targetPanel.classList.remove('is-dragging');
        document.body.classList.remove('debug-is-dragging');

        if (this.isMissionPoppedOut) {
            if (makeVisible && !this.poppedActive) {
                this.toggleVisibility();
            }
            if (this.uiManager && typeof this.uiManager.createFloatingText === 'function') {
                this.uiManager.createFloatingText('Mission Control Reset to Bottom', window.innerWidth / 2, window.innerHeight - 80, '#94a3b8');
            }
        } else {
            if (makeVisible && !this.active) {
                this.toggleVisibility();
            }
            if (this.uiManager && typeof this.uiManager.createFloatingText === 'function') {
                this.uiManager.createFloatingText('Debug Menu Reset to Center', window.innerWidth / 2, window.innerHeight / 2, '#38bdf8');
            }
        }
    }

    /**
     * Calculates the accurate travel days between locations considering active ship upgrades,
     * perks, and attribute modifiers.
     */
    _calculateTripDays(fromId, toId) {
        if (!fromId || !toId || fromId === toId) return 0;
        const baseData = this.gameState.TRAVEL_DATA?.[fromId]?.[toId];
        if (!baseData) return 0;
        let baseTime = baseData.time || 0;

        const activeShipId = this.gameState.player?.activeShipId;
        let timeMod = 1;
        if (this.gameState.player?.activePerks?.[PERK_IDS.NAVIGATOR]) {
            timeMod *= DB.PERKS[PERK_IDS.NAVIGATOR].travelTimeMod;
        }
        if (activeShipId && this.gameState.player?.shipStates?.[activeShipId]) {
            const upgrades = this.gameState.player.shipStates[activeShipId].upgrades || [];
            timeMod *= GameAttributes.getTravelTimeModifier(upgrades);
            const shipAttributes = GameAttributes.getShipAttributes(activeShipId);
            if (shipAttributes.includes('ATTR_HYPER_CALCULATION')) timeMod *= 0.75;
            if (shipAttributes.includes('ATTR_NEWTONS_GHOST')) timeMod *= 10.0;
            if (shipAttributes.includes('ATTR_SLEEPER')) timeMod *= 4.5;
            shipAttributes.forEach(attrId => {
                const def = GameAttributes.getDefinition(attrId);
                if (def && def.type === ATTRIBUTE_TYPES.MOD_TRAVEL_TIME && attrId !== 'ATTR_HYPER_CALCULATION' && def.value) {
                    timeMod *= def.value;
                }
            });
            const speedBonus = this.gameState.player.statModifiers?.travelSpeed || 0;
            if (speedBonus > 0) timeMod = timeMod / (1 + speedBonus);
        }
        return Math.max(1, Math.round(baseTime * timeMod));
    }

    /**
     * Relocates the player to a target location and advances game days accurately.
     */
    _executeGoTo(locationId) {
        const fromId = this.gameState.currentLocationId;
        if (fromId === locationId) {
            const currentName = DB.MARKETS.find(m => m.id === locationId)?.name || locationId;
            this.uiManager.createFloatingText(`Already at ${currentName}`, window.innerWidth / 2, window.innerHeight / 2, '#94a3b8');
            return;
        }

        const destMarket = DB.MARKETS.find(m => m.id === locationId);
        const destName = destMarket ? destMarket.name : locationId;
        const tripDays = this._calculateTripDays(fromId, locationId);

        if (fromId === LOCATION_IDS.SUN || fromId === 'sol') {
            if (this.simulationService?.timeService?.solStationService) {
                this.simulationService.timeService.solStationService.stopLocalLiveLoop?.();
            }
        }

        // Advance game days based on trip duration
        if (tripDays > 0 && this.simulationService?.timeService) {
            this.simulationService.timeService.advanceDays(tripDays);
        }

        // Unlock location if not already unlocked
        if (!this.gameState.player.unlockedLocationIds.includes(locationId)) {
            this.gameState.player.unlockedLocationIds.push(locationId);
        }

        // Update player location
        this.gameState.currentLocationId = locationId;

        // News ticker update
        if (this.simulationService?.newsTickerService) {
            this.simulationService.newsTickerService.onLocationChange(locationId);
        }

        // Evaluate mission triggers & achievements
        if (this.simulationService?.missionService) {
            this.simulationService.missionService.checkTriggers();
        }
        if (this.simulationService?.achievementService) {
            this.simulationService.achievementService.increment('docked_' + locationId, 1);
        }

        // Direct screen to Starport Market
        this.simulationService.setScreen(NAV_IDS.STARPORT, SCREEN_IDS.MARKET);

        // Update state and UI
        this.gameState.setState({});
        this.uiManager.render(this.gameState.getState());

        const dayText = tripDays > 0 ? ` (+${tripDays}d)` : '';
        this.uiManager.createFloatingText(`Arrived at ${destName}${dayText}`, window.innerWidth / 2, window.innerHeight / 2, '#38bdf8');
    }

    /**
     * Toggles a compact, performant location dropdown for the Go To control.
     */
    _toggleGoToDropdown() {
        if (!this.goToDropdownEl) {
            this.goToDropdownEl = document.createElement('div');
            this.goToDropdownEl.className = 'debug-goto-dropdown';
            document.body.appendChild(this.goToDropdownEl);

            document.addEventListener('pointerdown', (e) => {
                if (this.goToDropdownEl && this.goToDropdownEl.style.display !== 'none') {
                    if (!this.goToDropdownEl.contains(e.target) && !this.goToBtnEl?.contains(e.target)) {
                        this.goToDropdownEl.style.display = 'none';
                        this.goToDropdownEl.classList.remove('is-open');
                    }
                }
            });
        }

        if (this.goToDropdownEl.style.display !== 'none' && this.goToDropdownEl.classList.contains('is-open')) {
            this.goToDropdownEl.style.display = 'none';
            this.goToDropdownEl.classList.remove('is-open');
            return;
        }

        const currentLoc = this.gameState.currentLocationId;
        const markets = DB.MARKETS || [];

        let html = `
            <div class="debug-goto-header">
                <span>SELECT DESTINATION</span>
                <button class="debug-goto-close-btn">&times;</button>
            </div>
            <div class="debug-goto-list">
        `;

        markets.forEach(m => {
            const isCurrent = m.id === currentLoc;
            const tripDays = this._calculateTripDays(currentLoc, m.id);
            const timeBadge = isCurrent ? '<span class="debug-goto-badge current">HERE</span>' : `<span class="debug-goto-badge">${tripDays}d</span>`;
            const itemClass = isCurrent ? 'debug-goto-item current-location' : 'debug-goto-item';
            html += `
                <div class="${itemClass}" data-location-id="${m.id}">
                    <span class="debug-goto-name">${m.name}</span>
                    ${timeBadge}
                </div>
            `;
        });

        html += `</div>`;
        this.goToDropdownEl.innerHTML = html;

        this.goToDropdownEl.querySelectorAll('.debug-goto-item').forEach(item => {
            item.addEventListener('click', () => {
                const locId = item.dataset.locationId;
                this.goToDropdownEl.style.display = 'none';
                this.goToDropdownEl.classList.remove('is-open');
                this._executeGoTo(locId);
            });
        });

        const closeBtn = this.goToDropdownEl.querySelector('.debug-goto-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.goToDropdownEl.style.display = 'none';
                this.goToDropdownEl.classList.remove('is-open');
            });
        }

        this.goToDropdownEl.style.display = 'flex';
        this.goToDropdownEl.classList.add('is-open');

        if (this.goToBtnEl) {
            const rect = this.goToBtnEl.getBoundingClientRect();
            const menuWidth = 230;
            let left = rect.left + (rect.width / 2) - (menuWidth / 2);
            left = Math.max(10, Math.min(window.innerWidth - menuWidth - 10, left));

            if (rect.top > window.innerHeight / 2) {
                this.goToDropdownEl.style.left = `${left}px`;
                this.goToDropdownEl.style.bottom = `${window.innerHeight - rect.top + 6}px`;
                this.goToDropdownEl.style.top = 'auto';
            } else {
                this.goToDropdownEl.style.left = `${left}px`;
                this.goToDropdownEl.style.top = `${rect.bottom + 6}px`;
                this.goToDropdownEl.style.bottom = 'auto';
            }
        }
    }

    toggleDiagnosticOverlay() {
        this.diagActive = !this.diagActive;
        const overlay = document.getElementById('diagnostic-overlay');
        if (overlay) {
            overlay.classList.toggle('hidden', !this.diagActive);
        }
        if (this.diagActive) {
            this._startDiagLoop();
        }
    }

    generateBugReport() {
        const logHistory = this.logger.getLogHistory();
        const gameState = this.gameState.getState();

        delete gameState.TRAVEL_DATA;
        delete gameState.market.priceHistory;

        const report = `
ORBITAL TRADING - BUG REPORT
==============================
Date: ${new Date().toISOString()}

--- GAME STATE SNAPSHOT ---
${JSON.stringify(gameState, null, 2)}

--- RECENT LOG HISTORY ---
${logHistory}
        `;

        navigator.clipboard.writeText(report.trim())
            .then(() => {
                this.uiManager.createFloatingText('Bug Report Copied to Clipboard!', window.innerWidth / 2, window.innerHeight / 2, '#4ade80');
            })
            .catch(err => {
                if(this.logger && this.logger.error) this.logger.error('DebugService', 'Failed to copy bug report.', err);
            });
    }

    async exportTelemetry(type) {
        let mergedTelemetry = [];

        // 1. Fetch from the IDB Vault (Garbage Collected historical data)
        try {
            const storageService = new TelemetryStorageService();
            const db = await storageService._initDB();
            
            await new Promise((resolve) => {
                const transaction = db.transaction([storageService.storeName], 'readonly');
                const store = transaction.objectStore(storageService.storeName);
                const request = store.getAll();

                request.onsuccess = (event) => {
                    const results = event.target.result;
                    if (results && results.length > 0) {
                        results.forEach(entry => {
                            if (entry.data && entry.data[type]) {
                                mergedTelemetry = mergedTelemetry.concat(entry.data[type]);
                            }
                        });
                    }
                    resolve();
                };

                request.onerror = (event) => {
                    console.warn("DebugService: Failed to fetch IDB telemetry.", event.target.error);
                    resolve(); 
                };
            });
        } catch (error) {
            console.warn("DebugService: Telemetry DB read error.", error);
        }

        // 2. Append the Live Buffer from GameState (Current week's data before flush)
        if (this.gameState.telemetry && this.gameState.telemetry[type]) {
            mergedTelemetry = mergedTelemetry.concat(this.gameState.telemetry[type]);
        }

        // 3. Abort if absolutely nothing exists
        if (mergedTelemetry.length === 0) {
            this.uiManager.createFloatingText(`No ${type.toUpperCase()} Data`, window.innerWidth/2, window.innerHeight/2, '#ef4444');
            if(this.logger && this.logger.warn) this.logger.warn('DebugService', `Attempted to export ${type}, but no data exists.`);
            return;
        }

        let headers = [];
        if (type === 'ticks') {
            headers = ['day', 'type', 'locationId', 'commodityId', 'oldPrice', 'newPrice', 'localBaseline', 'reversionEffect', 'pressureEffect', 'currentStock', 'marketPressure', 'isDepleted', 'isSaturated'];
        } else if (type === 'trades') {
            headers = ['day', 'type', 'action', 'locationId', 'commodityId', 'quantity', 'baseUnitCost', 'executionUnitCost', 'baseUnitValue', 'executionUnitValue', 'totalTransactionValue', 'modifier_pct'];
        } else if (type === 'impacts') {
            headers = ['day', 'type', 'action', 'locationId', 'commodityId', 'quantityTraded', 'pressureChange', 'resultingPressure', 'lockDuration', 'isSaturated'];
        }

        const csvRows = [];
        csvRows.push(headers.join(','));

        mergedTelemetry.forEach(entry => {
            const values = headers.map(header => {
                let val = entry[header];
                
                // Inject calculated field: profit/loss modifier percentage dynamically
                if (type === 'trades' && header === 'modifier_pct') {
                    if (entry.action === 'BUY' && entry.baseUnitCost) {
                        val = (((entry.executionUnitCost - entry.baseUnitCost) / entry.baseUnitCost) * 100).toFixed(2) + '%';
                    } else if (entry.action === 'SELL' && entry.baseUnitValue) {
                        val = (((entry.executionUnitValue - entry.baseUnitValue) / entry.baseUnitValue) * 100).toFixed(2) + '%';
                    } else {
                        val = '0.00%';
                    }
                }

                if (val === undefined || val === null) val = '';
                return `"${val}"`;
            });
            csvRows.push(values.join(','));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `orbital_telemetry_${type}_day${this.gameState.day}.csv`);
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.uiManager.createFloatingText(`${type.toUpperCase()} Exported`, window.innerWidth/2, window.innerHeight/2, '#4ade80');
        if(this.logger && this.logger.info) this.logger.info.system(this.gameState.day, 'DEBUG_EXPORT', `Exported ${mergedTelemetry.length} rows of ${type} telemetry.`);
    }

    _markAllTutorialsSeen() {
        if (!this.gameState.tutorials) {
            this.gameState.tutorials = { seenHelpContexts: [] };
        }
        if (HELP_REGISTRY) {
            this.gameState.tutorials.seenHelpContexts = Object.keys(HELP_REGISTRY);
        } else {
            this.gameState.tutorials.seenHelpContexts = [];
        }
        
        if (this.logger && this.logger.info && this.logger.info.system) {
            this.logger.info.system(this.gameState.day, 'DEBUG_TOOL', 'All help modal contexts injected into seen state.');
        }
    }

    _unlockEndgame() {
        const { player, solStation } = this.gameState;
        
        if (!player.unlockedLocationIds.includes(LOCATION_IDS.MERCURY)) {
            player.unlockedLocationIds.push(LOCATION_IDS.MERCURY);
        }
        if (!player.unlockedLocationIds.includes(LOCATION_IDS.SUN)) {
            player.unlockedLocationIds.push(LOCATION_IDS.SUN);
        }

        if (solStation) {
            solStation.unlocked = true;
        }
    }

    godMode() {
        if(this.logger && this.logger.warn) this.logger.warn('DebugService', 'GOD MODE ACTIVATED.');
        this.gameState.introSequenceActive = false;
        this.gameState.isDebugStart = true;
        
        this._markAllTutorialsSeen();

        if (!this.gameState.missions) this.gameState.missions = { completedMissionIds: [], activeMissionIds: [], missionProgress: {} };
        if (!this.gameState.missions.completedMissionIds) this.gameState.missions.completedMissionIds = [];
        if (!this.gameState.missions.completedMissionIds.includes('mission_tutorial_09')) {
            this.gameState.missions.completedMissionIds.push('mission_tutorial_09');
        }
        if (this.simulationService && typeof this.simulationService.clearNavigationLock === 'function') {
            this.simulationService.clearNavigationLock();
        }

        this.gameState.player.credits = Number.MAX_SAFE_INTEGER;

        this.gameState.player.ownedShipIds = [];
        this.simulationService.addShipToHangar(SHIP_IDS.BEHEMOTH);
        this.gameState.player.activeShipId = SHIP_IDS.BEHEMOTH;

        this.gameState.player.revealedTier = 7;
        this.gameState.player.unlockedLicenseIds = Object.keys(DB.LICENSES);
        this.gameState.player.unlockedLocationIds = DB.MARKETS.map(m => m.id);

        this._unlockEndgame();

        this.uiManager.showGameContainer();
        this.simulationService.setScreen(NAV_IDS.STARPORT, SCREEN_IDS.MARKET);
        this.simulationService.timeService.advanceDays(7);
        this.gameState.setState({});
    }

    simpleStart() {
        if(this.logger && this.logger.warn) this.logger.warn('DebugService', 'SIMPLE START ACTIVATED.');
        this.gameState.introSequenceActive = false;
        this.gameState.isDebugStart = true;
        
        this._markAllTutorialsSeen();

        if (!this.gameState.missions) this.gameState.missions = { completedMissionIds: [], activeMissionIds: [], missionProgress: {} };
        if (!this.gameState.missions.completedMissionIds) this.gameState.missions.completedMissionIds = [];
        if (!this.gameState.missions.completedMissionIds.includes('mission_tutorial_09')) {
            this.gameState.missions.completedMissionIds.push('mission_tutorial_09');
        }
        if (this.simulationService && typeof this.simulationService.clearNavigationLock === 'function') {
            this.simulationService.clearNavigationLock();
        }

        this.gameState.player.ownedShipIds = [];
        this.simulationService.addShipToHangar(SHIP_IDS.WANDERER);
        this.gameState.player.activeShipId = SHIP_IDS.WANDERER;
        
        const seed = this.gameState.player.visualSeed;
        AssetService.hydrateAllShips(seed);
        AssetService.hydrateAllCommodities(seed);

        this.uiManager.showGameContainer();
        this.simulationService.setScreen(NAV_IDS.DATA, SCREEN_IDS.MISSIONS);
        this.simulationService.timeService.advanceDays(7);
        this.gameState.setState({});
    }

    _executePhasedMissionTest(credits, completedMissionMax, targetMissions, locationsToUnlock) {
        if(this.logger && this.logger.warn) this.logger.warn('DebugService', `PHASE MISSION TEST ACTIVATED (Up to Mission ${completedMissionMax}).`);
        this.gameState.introSequenceActive = false;
        this.gameState.isDebugStart = true;
        
        this._markAllTutorialsSeen();

        if (!this.gameState.missions) this.gameState.missions = { completedMissionIds: [], activeMissionIds: [], missionProgress: {} };
        
        const completed = [];
        for (let i = 1; i <= 9; i++) {
            completed.push(`mission_tutorial_0${i}`);
        }
        for (let i = 10; i <= completedMissionMax; i++) {
            completed.push(`mission_${i}`);
            completed.push(`mission_${i}_guild`);
            completed.push(`mission_${i}_syndicate`);
        }
        this.gameState.missions.completedMissionIds = completed;

        if (this.simulationService && typeof this.simulationService.clearNavigationLock === 'function') {
            this.simulationService.clearNavigationLock();
        }

        this.gameState.player.credits = credits;

        this.gameState.player.ownedShipIds = [];
        const targetShipId = SHIP_IDS?.PTERODACTYL || 'Pterodactyl.Ship';
        if (this.simulationService && typeof this.simulationService.addShipToHangar === 'function') {
            this.simulationService.addShipToHangar(targetShipId);
        } else {
             this.gameState.player.ownedShipIds.push(targetShipId);
        }
        this.gameState.player.activeShipId = targetShipId;
        
        const seed = this.gameState.player.visualSeed || 0;
        AssetService.hydrateAllShips(seed);
        AssetService.hydrateAllCommodities(seed);

        locationsToUnlock.forEach(locId => {
            if (!this.gameState.player.unlockedLocationIds.includes(locId)) {
                this.gameState.player.unlockedLocationIds.push(locId);
            }
        });

        if (this.simulationService && this.simulationService.missionService) {
            targetMissions.forEach(mId => {
                this.simulationService.missionService.forceToTerminal(mId);
            });
            this.uiManager.createFloatingText('Test Phase Missions Injected', window.innerWidth/2, window.innerHeight/2, '#facc15');
        }

        this.uiManager.showGameContainer();
        this.simulationService.setScreen(NAV_IDS.DATA, SCREEN_IDS.MISSIONS);
        this.simulationService.timeService.advanceDays(7);
        this.gameState.setState({});
    }

    skipToStarterSelection() {
        if(this.logger && this.logger.warn) this.logger.warn('DebugService', 'SKIP TO STARTER SHIP SELECTION.');
        
        this.gameState.introSequenceActive = true;
        this.gameState.isDebugStart = true;
        
        if (!this.gameState.missions) this.gameState.missions = { completedMissionIds: [], activeMissionIds: [], missionProgress: {} };
        if (!this.gameState.missions.completedMissionIds) this.gameState.missions.completedMissionIds = [];
        if (!this.gameState.missions.completedMissionIds.includes('mission_tutorial_09')) {
            this.gameState.missions.completedMissionIds.push('mission_tutorial_09');
        }
        if (this.simulationService && typeof this.simulationService.clearNavigationLock === 'function') {
            this.simulationService.clearNavigationLock();
        }

        this.gameState.player.credits = 25000;
        this.gameState.player.ownedShipIds = [];
        this.gameState.player.activeShipId = null;
        this.gameState.player.shipStates = {};
        this.gameState.player.inventories = {};

        this.uiManager.showGameContainer();
        
        if (this.simulationService && this.simulationService.introService) {
            this.simulationService.introService._showStarterShipSelection();
        } else {
            import('./game/IntroService.js').then(({IntroService}) => {
                const intro = new IntroService(this.gameState, this.uiManager, this.logger, this.simulationService);
                intro._showStarterShipSelection();
            }).catch(e => {
                console.error("Failed to load IntroService for debug skip", e);
            });
        }
        
        this.gameState.setState({});
    }

    skipToHangarTutorial() {
        if(this.logger && this.logger.warn) this.logger.warn('DebugService', 'SKIP TO HANGAR (DEPRECATED - Normal Start).');
        this.gameState.introSequenceActive = true;

        if (!this.gameState.missions) this.gameState.missions = { completedMissionIds: [], activeMissionIds: [], missionProgress: {} };
        if (!this.gameState.missions.completedMissionIds) this.gameState.missions.completedMissionIds = [];
        if (!this.gameState.missions.completedMissionIds.includes('mission_tutorial_09')) {
            this.gameState.missions.completedMissionIds.push('mission_tutorial_09');
        }
        if (this.simulationService && typeof this.simulationService.clearNavigationLock === 'function') {
            this.simulationService.clearNavigationLock();
        }

        this.gameState.player.credits = 25000;
        this.gameState.player.ownedShipIds = [];
        this.gameState.player.activeShipId = null;
        this.gameState.player.shipStates = {};
        this.gameState.player.inventories = {};

        this.uiManager.showGameContainer();
        this.simulationService.setScreen(NAV_IDS.STARPORT, SCREEN_IDS.HANGAR);
        this.gameState.setState({});
    }

    deductHull(amount) {
         const ship = this.simulationService._getActiveShip();
        if (ship) {
            const shipState = this.gameState.player.shipStates[ship.id];
            shipState.health = Math.max(0, shipState.health - amount);
            if(this.logger && this.logger.warn) this.logger.warn('DebugService', `Deducted ${amount} hull from ${ship.name}.`);
            this.gameState.setState({});
        }
    }

    restoreHull() {
        const ship = this.simulationService._getActiveShip();
        if (ship) {
            const shipState = this.gameState.player.shipStates[ship.id];
            shipState.health = ship.maxHealth;
            if(this.logger && this.logger.warn) this.logger.warn('DebugService', `Restored hull for ${ship.name}.`);
            this.gameState.setState({});
        }
    }

    destroyShip() {
        const ship = this.simulationService._getActiveShip();
        if (ship) {
            const shipState = this.gameState.player.shipStates[ship.id];
            shipState.health = 0;
            if(this.logger && this.logger.warn) this.logger.warn('DebugService', `Destroyed ${ship.name}.`);
            this.simulationService.travelService._handleShipDestruction(ship.id);
        }
    }

    deductFuel(amount) {
        const ship = this.simulationService._getActiveShip();
        if (ship) {
            const shipState = this.gameState.player.shipStates[ship.id];
            shipState.fuel = Math.max(0, shipState.fuel - amount);
            if(this.logger && this.logger.warn) this.logger.warn('DebugService', `Deducted ${amount} fuel from ${ship.name}.`);
            this.gameState.setState({});
        }
    }

    restoreFuel() {
        const ship = this.simulationService._getActiveShip();
        if (ship) {
             const shipState = this.gameState.player.shipStates[ship.id];
            shipState.fuel = ship.maxFuel;
            if(this.logger && this.logger.warn) this.logger.warn('DebugService', `Restored fuel for ${ship.name}.`);
            this.gameState.setState({});
        }
    }

    removeAllCargo() {
        const inventory = this.simulationService._getActiveInventory();
        if (inventory) {
            for (const goodId in inventory) {
                inventory[goodId].quantity = 0;
                inventory[goodId].avgCost = 0;
            }
            if(this.logger && this.logger.warn) this.logger.warn('DebugService', 'All cargo removed from active ship.');
            this.gameState.setState({});
        }
    }

    giveItemToShip() {
        const ship = this.simulationService._getActiveShip();
        const inventory = this.simulationService._getActiveInventory();
        const itemId = this.debugState.selectedCommodityToAdd;
        const qty = this.debugState.quantityToAdd;

        if (ship && inventory && itemId) {
            if (!inventory[itemId]) {
                inventory[itemId] = { quantity: 0, avgCost: 0 };
            }
            inventory[itemId].quantity += qty;
            
            if(this.logger && this.logger.warn) this.logger.warn('DebugService', `Added ${qty}x ${itemId} to ${ship.name}.`);
            this.uiManager.createFloatingText(`+${qty} ${itemId}`, window.innerWidth/2, window.innerHeight/2, '#4ade80');
            this.gameState.setState({});
        }
    }

    fillShipyard() {
        const { currentLocationId, day } = this.gameState;
        if (this.gameState.market.shipyardStock[currentLocationId]) {
            const allShipIds = Object.keys(DB.SHIPS);
            this.gameState.market.shipyardStock[currentLocationId] = {
                day: day,
                shipsForSale: allShipIds
            };
            if(this.logger && this.logger.warn) this.logger.warn('DebugService', `SHIPYARD FILLED: All ships added to ${currentLocationId}.`);
            this.gameState.setState({});
        } else {
            if(this.logger && this.logger.error) this.logger.error('DebugService', `Cannot fill shipyard: No stock object for ${currentLocationId}.`);
        }
    }
    
    installSelectedUpgrade(upgradeId) {
        if (!upgradeId) return;
        const activeShip = this.simulationService._getActiveShip();
        if (!activeShip) return;

        const shipState = this.gameState.player.shipStates[activeShip.id];
        if (!shipState.upgrades) shipState.upgrades = [];
        
        if (shipState.upgrades.length < 3) {
            shipState.upgrades.push(upgradeId);
            if(this.logger && this.logger.info && this.logger.info.system) this.logger.info.system(this.gameState.day, 'DEBUG_TOOL', `Installed ${upgradeId} on ${activeShip.name}`);
            this.gameState.setState({}); 
        } else {
            if(this.logger && this.logger.warn) this.logger.warn('DebugService', 'Ship upgrade slots full (3/3). Remove one first.');
        }
    }

    applyRandomUpgrades() {
        const activeShip = this.simulationService._getActiveShip();
        if (!activeShip) return;
        const shipState = this.gameState.player.shipStates[activeShip.id];
        
        shipState.upgrades = [];

        const allIds = GameAttributes.getAllUpgradeIds();
        if (allIds.length === 0) return;

        for (let i = 0; i < 3; i++) {
            const randomId = allIds[Math.floor(Math.random() * allIds.length)];
            shipState.upgrades.push(randomId);
        }

        if(this.logger && this.logger.info && this.logger.info.system) this.logger.info.system(this.gameState.day, 'DEBUG_TOOL', `Applied 3 random upgrades to ${activeShip.name}`);
        this.gameState.setState({});
    }

    removeAllUpgrades() {
        const activeShip = this.simulationService._getActiveShip();
        if (!activeShip) return;
        const shipState = this.gameState.player.shipStates[activeShip.id];
        
        shipState.upgrades = [];
        if(this.logger && this.logger.info && this.logger.info.system) this.logger.info.system(this.gameState.day, 'DEBUG_TOOL', `Removed all upgrades from ${activeShip.name}`);
        this.gameState.setState({});
    }

    applySelectedStatusEffect(statusId) {
        if (!statusId) return;
        const activeShip = this.simulationService._getActiveShip();
        if (!activeShip) return;

        const shipState = this.gameState.player.shipStates[activeShip.id];
        if (!shipState.statusEffects) shipState.statusEffects = [];
        
        const duration = Math.floor(Math.random() * (480 - 120 + 1)) + 120;
        const expiryDay = this.gameState.day + duration;

        const existing = shipState.statusEffects.find(s => s.id === statusId);
        if (existing) {
            existing.expiryDay = expiryDay;
        } else {
            shipState.statusEffects.push({ id: statusId, expiryDay });
        }

        if(this.logger && this.logger.info && this.logger.info.system) this.logger.info.system(this.gameState.day, 'DEBUG_TOOL', `Applied ${statusId} on ${activeShip.name}`);
        this.uiManager.createFloatingText('Status Effect Applied', window.innerWidth/2, window.innerHeight/2, '#ef4444');
        this.gameState.setState({}); 
    }

    removeAllStatusEffects() {
        const activeShip = this.simulationService._getActiveShip();
        if (!activeShip) return;
        const shipState = this.gameState.player.shipStates[activeShip.id];
        
        shipState.statusEffects = [];
        if(this.logger && this.logger.info && this.logger.info.system) this.logger.info.system(this.gameState.day, 'DEBUG_TOOL', `Removed all status effects from ${activeShip.name}`);
        this.uiManager.createFloatingText('Statuses Cleared', window.innerWidth/2, window.innerHeight/2, '#4ade80');
        this.gameState.setState({});
    }

    resetEconomyMemory() {
        const { market } = this.gameState;
        DB.MARKETS.forEach(loc => {
            DB.COMMODITIES.forEach(c => {
                const item = market.inventory[loc.id][c.id];
                if (item) {
                    item.marketPressure = 0;
                    item.lastPlayerInteractionTimestamp = 0;
                    item.priceLockEndDay = 0;
                    item.isDepleted = false;
                    item.depletionDay = 0;
                    item.depletionBonusDay = 0;
                }
            });
        });
        this.uiManager.createFloatingText('Economic Memory Reset', window.innerWidth/2, window.innerHeight/2, '#facc15');
        this.gameState.setState({});
    }

    sootheEconomy() {
        const { market } = this.gameState;
        DB.MARKETS.forEach(loc => {
            DB.COMMODITIES.forEach(c => {
                const minPrice = c.basePriceRange[0];
                market.prices[loc.id][c.id] = minPrice;
            });
        });
        this.uiManager.createFloatingText('Economy Soothed (Min Prices)', window.innerWidth/2, window.innerHeight/2, '#4ade80');
        this.gameState.setState({});
    }

    riotEconomy() {
        const { market } = this.gameState;
        DB.MARKETS.forEach(loc => {
            DB.COMMODITIES.forEach(c => {
                const maxPrice = c.basePriceRange[1];
                market.prices[loc.id][c.id] = maxPrice;
            });
        });
        this.uiManager.createFloatingText('Economy Rioting (Max Prices)', window.innerWidth/2, window.innerHeight/2, '#ef4444');
        this.gameState.setState({});
    }

    injectStock() {
        const { market } = this.gameState;
        DB.MARKETS.forEach(loc => {
            DB.COMMODITIES.forEach(c => {
                const item = market.inventory[loc.id][c.id];
                if (item) {
                    item.quantity += 100;
                }
            });
        });
        this.uiManager.createFloatingText('+100 Stock Injected System-Wide', window.innerWidth/2, window.innerHeight/2, '#facc15');
        this.gameState.setState({});
    }

    fillSolCaches() {
        if (this.gameState.solStation && this.gameState.solStation.caches) {
            Object.values(this.gameState.solStation.caches).forEach(cache => {
                cache.current = cache.max;
            });
            this.uiManager.createFloatingText('Sol Caches Filled', window.innerWidth/2, window.innerHeight/2, '#facc15');
            this.gameState.setState({});
        }
    }

    triggerToast(type) {
        if (!this.simulationService.toastService) return;
        
        this.simulationService.toastService.clearQueueAndHide();
        
        let config;
        switch(type) {
            case 'system':
                config = { type: 'system', title: 'SYSTEM ALERT', message: '[DEBUG] Critical Systems Failure.', navTarget: 'starport', actionTarget: 'services' };
                break;
            case 'finance':
                config = { type: 'finance', title: 'FINANCE ALERT', message: '[DEBUG] Impending loan garnishment.', navTarget: 'data', actionTarget: 'finance' };
                break;
            case 'intel':
                config = { type: 'intel', title: 'INTEL EXPIRED', message: '[DEBUG] Market data has expired.', navTarget: 'data', actionTarget: 'intel' };
                break;
            case 'mission':
                config = { type: 'mission', title: 'MISSIONS AVAILABLE', message: '[DEBUG] New contracts available.', navTarget: 'data', actionTarget: 'missions' };
                break;
            case 'sol':
                config = { type: 'sol', title: 'STATION CRITICAL', message: 'Station supplies are low!', navTarget: 'starport', actionTarget: 'services' };
                break;
        }
        
        if (config) {
            this.simulationService.toastService.toastQueue.push(config);
            this.simulationService.toastService.playNextInQueue();
        }
    }

    _clearAssetsForBankruptcy() {
        const player = this.gameState.player;
        player.ownedShipIds = [SHIP_IDS.WANDERER];
        player.activeShipId = SHIP_IDS.WANDERER;
        player.inventories = { [SHIP_IDS.WANDERER]: {} };
        if (this.gameState.missions) {
            this.gameState.missions.activeMissionIds = [];
        }
    }

    _triggerCinematicDebugGrant(tierNum) {
        const licenseId = `t${tierNum}_license`;
        const licenseDef = DB.LICENSES ? DB.LICENSES[licenseId] : null;
        
        const tierComms = DB.COMMODITIES.filter(c => c.tier === tierNum).map(c => c.name);
        const bodyText = `Unlocked ${tierComms.join(' and ')} trading.`;

        import('./ui/AnimationService.js').then(async ({ startLicenseAnimation, endLicenseAnimation }) => {
            await startLicenseAnimation(tierNum);

            const textHtml = `
                <div class="text-center w-full flex flex-col items-center justify-center p-2">
                    <div class="license-header-text license-header-t${tierNum}">LICENSE ACQUIRED</div>
                    <br>
                    <div class="license-subheader-text license-text-t${tierNum} mb-2">${licenseDef ? licenseDef.name.toUpperCase() : `TIER ${tierNum} TRADE LICENSE`}</div>
                    <div class="license-body-text">${bodyText}</div>
                </div>
            `;

            this.uiManager.queueModal('event-modal', '', textHtml, null, {
                dismissInside: false,
                dismissOutside: false,
                theme: `license-t${tierNum}`,
                customSetup: (licModal, licCloseHandler) => {
                    const modalContent = licModal.querySelector('.modal-content');
                    modalContent.classList.remove('license-modal-blur-out');
                    modalContent.classList.add('license-modal-blur-in');

                    const titleEl = licModal.querySelector('.modal-title');
                    if(titleEl) titleEl.style.display = 'none';

                    const btnContainer = licModal.querySelector('#event-button-container');
                    btnContainer.innerHTML = `<button type="button" id="accept-license-btn" class="btn w-full license-btn license-btn-t${tierNum}" style="padding-top: 0.5rem; padding-bottom: 0.5rem; min-height: 32px;">ACCEPT LICENSE</button>`;
                    
                    licModal.querySelector('#accept-license-btn').onclick = async () => {
                        modalContent.classList.remove('license-modal-blur-in');
                        modalContent.classList.add('license-modal-blur-out');
                        
                        setTimeout(async () => {
                            modalContent.classList.remove('license-modal-blur-out');
                            licCloseHandler();
                            await endLicenseAnimation(tierNum);

                            if (this.gameState) {
                                const coreState = this.gameState;
                                coreState.player.revealedTier = Math.max(coreState.player.revealedTier || 1, tierNum);
                                if (!coreState.player.unlockedLicenseIds.includes(licenseId)) {
                                    coreState.player.unlockedLicenseIds.push(licenseId);
                                }
                                coreState.setState({}); 
                                
                                if (this.uiManager) {
                                    this.uiManager.render(coreState.getState());
                                }
                            }
                        }, 800);
                    };
                }
            });
            
            if (this.uiManager.modalEngine) {
                this.uiManager.modalEngine.processModalQueue();
            }
        });
    }

    _registerDebugActions() {
        this.actions = {
            godMode: { name: 'God Mode', type: 'button', handler: () => this.godMode() },
            simpleStart: { name: 'Simple Start', type: 'button', handler: () => this.simpleStart() },
            skipToStarterSelection: { name: 'Skip to Ship Select (Intro)', type: 'button', handler: () => this.skipToStarterSelection() },
            skipToHangarTutorial: { name: 'Normal Start Skip', type: 'button', handler: () => this.skipToHangarTutorial() },
            
            phase1MissionTest: { name: 'Phase 1 Mission Test', type: 'button', handler: () => {
                this._executePhasedMissionTest(8000, 9, ['mission_10'], []);
            }},
            phase2MissionTest: { name: 'Phase 2 Mission Test', type: 'button', handler: () => {
                this._executePhasedMissionTest(500000, 17, ['mission_18'], [LOCATION_IDS.MERCURY || 'loc_mercury']);
            }},
            phase3MissionTest: { name: 'Phase 3 Mission Test', type: 'button', handler: () => {
                this._executePhasedMissionTest(2000000, 32, ['mission_33_guild', 'mission_33_syndicate'], [LOCATION_IDS.MERCURY || 'loc_mercury', 'loc_kepler']);
            }},
            phase4MissionTest: { name: 'Phase 4 Mission Test', type: 'button', handler: () => {
                this._executePhasedMissionTest(50000000, 46, ['mission_47_guild', 'mission_47_syndicate'], [LOCATION_IDS.MERCURY || 'loc_mercury', 'loc_kepler', LOCATION_IDS.EXCHANGE || 'loc_exchange']);
            }},

            addCredits: { name: 'Add Credits', type: 'button', handler: () => {
                this.gameState.player.credits = Math.min(Number.MAX_SAFE_INTEGER, this.gameState.player.credits + this.debugState.creditsToAdd);
                this.gameState.setState({});
            }},
            reduceCredits: { name: 'Reduce Credits', type: 'button', handler: () => {
                this.gameState.player.credits -= this.debugState.creditsToReduce;
                this.simulationService._checkGameOverConditions();
                this.gameState.setState({});
            }},
            setAge: { name: 'Set Age', type: 'button', handler: () => {
                this.gameState.player.playerAge = this.debugState.targetAge;
                if(this.logger && this.logger.warn) this.logger.warn('DebugService', `Player age manually set to ${this.debugState.targetAge}.`);
                
                if (this.simulationService.timeService) {
                    this.simulationService.timeService._handleBirthday(this.debugState.targetAge);
                }

                this.gameState.setState({});
            }},
            grantLicenseT2: { name: 'Grant Tier 2 License', type: 'button', handler: () => this._triggerCinematicDebugGrant(2) },
            grantLicenseT3: { name: 'Grant Tier 3 License', type: 'button', handler: () => this._triggerCinematicDebugGrant(3) },
            grantLicenseT4: { name: 'Grant Tier 4 License', type: 'button', handler: () => this._triggerCinematicDebugGrant(4) },
            grantLicenseT5: { name: 'Grant Tier 5 License', type: 'button', handler: () => this._triggerCinematicDebugGrant(5) },
            grantLicenseT6: { name: 'Grant Tier 6 License', type: 'button', handler: () => this._triggerCinematicDebugGrant(6) },
            grantLicenseT7: { name: 'Grant Tier 7 License', type: 'button', handler: () => this._triggerCinematicDebugGrant(7) },
            payDebt: { name: 'Pay Off Debt', type: 'button', handler: () => this.simulationService.playerActionService.payOffDebt() },
            teleport: { name: 'Teleport', type: 'button', handler: () => {
                if (this.debugState.selectedLocation) {
                    this.gameState.currentLocationId = this.debugState.selectedLocation;
                    this.gameState.setState({});
                }
            }},
            unlockAll: { name: 'Unlock All', type: 'button', handler: () => {
                this.gameState.player.unlockedLocationIds = DB.MARKETS.map(m => m.id);
                this.gameState.player.revealedTier = 7;
                this.gameState.player.unlockedLicenseIds = Object.keys(DB.LICENSES);
                
                this._unlockEndgame();

                // --- PHASE 3: LICENSE DEBUG TRACKING FIX ---
                if (this.simulationService && this.simulationService.achievementService) {
                    this.simulationService.achievementService.increment('licensesOwned', Object.keys(DB.LICENSES).length, true);
                }

                this.gameState.setState({});
                this.uiManager.createFloatingText('Unlocked: Maps, Licenses, Tiers, Sol Station', window.innerWidth/2, window.innerHeight/2, '#facc15');
            }},
            
            solTesting: { name: 'Sol Testing', type: 'button', handler: () => {
                this.actions.unlockAll.handler();
                this.actions.godMode.handler();
                this.gameState.currentLocationId = LOCATION_IDS.SUN;
                this.gameState.setState({});
                this.uiManager.createFloatingText('Sol Testing Initiated', window.innerWidth/2, window.innerHeight/2, '#facc15');
            }},
            
            levelUpSolStation: { name: 'Level Up Sol Station', type: 'button', handler: () => {
                if (this.simulationService && this.simulationService.solStationService) {
                    this.simulationService.solStationService.applyLevelUp();
                    this.uiManager.createFloatingText('Sol Level Up', window.innerWidth/2, window.innerHeight/2, '#facc15');
                    this.gameState.setState({});
                }
            }},
            addAllOfficers: { name: 'Add All Officers', type: 'button', handler: () => {
                if (this.gameState.solStation && this.gameState.solStation.roster) {
                    Object.keys(OFFICERS).forEach(id => {
                        if (!this.gameState.solStation.roster.includes(id)) {
                            this.gameState.solStation.roster.push(id);
                        }
                    });
                    this.uiManager.createFloatingText('All Officers Added', window.innerWidth/2, window.innerHeight/2, '#4ade80');
                    this.gameState.setState({});
                }
            }},
            unlockAllOfficerSlots: { name: 'Unlock All Slots', type: 'button', handler: () => {
                if (this.gameState.solStation && this.gameState.solStation.officers) {
                    while(this.gameState.solStation.officers.length < 10) {
                        this.gameState.solStation.officers.push({ slotId: this.gameState.solStation.officers.length + 1, assignedOfficerId: null });
                    }
                    this.uiManager.createFloatingText('All Slots Unlocked', window.innerWidth/2, window.innerHeight/2, '#4ade80');
                    this.gameState.setState({});
                }
            }},
            add1000AllItems: { name: '+1000 All Items', type: 'button', handler: () => {
                const shipId = this.gameState.player.activeShipId;
                if (!shipId) return;
                
                let inv = this.gameState.player.inventories[shipId];
                if (!inv) {
                    this.gameState.player.inventories[shipId] = {};
                    inv = this.gameState.player.inventories[shipId];
                }
                
                DB.COMMODITIES.forEach(c => {
                    if (!inv[c.id]) {
                        inv[c.id] = { quantity: 0, avgCost: 0 };
                    }
                    inv[c.id].quantity += 1000;
                });
                
                this.uiManager.createFloatingText('+1000 Cargo Added', window.innerWidth/2, window.innerHeight/2, '#4ade80');
                this.gameState.setState({});
            }},
            fillSolCaches: { name: 'Fill Sol Caches', type: 'button', handler: () => this.fillSolCaches() },
            
            testRecruitOfficer: { name: 'Test Recruit Officer', type: 'button', handler: () => {
                const officerIds = Object.keys(OFFICERS);
                if (officerIds.length > 0) {
                    const randomId = officerIds[Math.floor(Math.random() * officerIds.length)];
                    if (this.uiManager && typeof this.uiManager.queueOfficerRecruitmentModal === 'function') {
                        this.uiManager.queueOfficerRecruitmentModal(randomId);
                    }
                }
            }},

            grantAllShips: { name: 'Grant All Ships', type: 'button', handler: () => {
                Object.keys(DB.SHIPS).forEach(shipId => {
                    if (!this.gameState.player.ownedShipIds.includes(shipId)) {
                         this.simulationService.addShipToHangar(shipId);
                    }
                });
                AssetService.hydrateAllShips(this.gameState.player.visualSeed);
                this.gameState.setState({});
            }},
            cycleShipPics: { name: 'Cycle Ship Pics', type: 'button', handler: () => {
                this.gameState.player.visualSeed = (this.gameState.player.visualSeed || 0) + 1;
                this.gameState.setState({}); 
                if(this.logger && this.logger.info && this.logger.info.system) this.logger.info.system(this.gameState.day, 'DEBUG_TOOL', `Cycled ship visual variant. New Seed: ${this.gameState.player.visualSeed}`);
            }},
            
            advanceTime: { name: 'Advance Days', type: 'button', handler: () => {
                this.simulationService.timeService.advanceDays(this.debugState.daysToAdvance);
                this.uiManager.render(this.gameState.getState());
            }},

            replenishStock: { name: 'Replenish All Stock', type: 'button', handler: () => {
                 this.simulationService.marketService.replenishMarketInventory();
                this.gameState.setState({});
            }},
            
            triggerRandomEvent: { name: 'Trigger Random Event', type: 'button', handler: () => {
                if (this.debugState.selectedRandomEvent) {
                     this.simulationService.forceTriggerEvent(this.debugState.selectedRandomEvent);
                }
            }},

            forceQueueStoryEvent: { name: 'Force Queue Story Event', type: 'button', handler: () => {
                if (this.debugState.selectedStoryEvent && this.simulationService) {
                    // Temporarily flag as repeatable to allow infinite manual iterations
                    const eventDef = DB.STORY_EVENTS[this.debugState.selectedStoryEvent];
                    if (eventDef) eventDef.repeatable = true;
                    
                    // Force flag set to TRUE to bypass seen restrictions for manual debug testing
                    this.simulationService.queueStoryEvent(this.debugState.selectedStoryEvent, true);
                    this.uiManager.createFloatingText('Story Event Queued', window.innerWidth/2, window.innerHeight/2, '#facc15');
                }
            }},

            forceAddTerminalMission: { name: 'Force to Terminal', type: 'button', handler: () => {
                if (this.debugState.selectedMission && this.simulationService && this.simulationService.missionService) {
                    this.simulationService.missionService.forceToTerminal(this.debugState.selectedMission);
                    this.uiManager.createFloatingText('Mission Added to Terminal', window.innerWidth/2, window.innerHeight/2, '#4ade80');
                }
            }},
            forceAcceptMission: { name: 'Force Accept Mission', type: 'button', handler: () => {
                if (this.debugState.selectedMission) {
                    this.simulationService.missionService.acceptMission(this.debugState.selectedMission, true); 
                }
            }},
            satisfyMissionRequirements: { name: 'Satisfy', type: 'button', handler: () => {
                let targetMissionId = this.debugState.selectedMission;
                if (!targetMissionId && this.gameState.missions.activeMissionIds.length > 0) {
                    targetMissionId = this.gameState.missions.activeMissionIds[0];
                }
                if (!targetMissionId) {
                    this.uiManager.createFloatingText('No Mission Selected', window.innerWidth/2, window.innerHeight/2, '#ef4444');
                    return;
                }

                // If a mission is selected in the dropdown and not yet in the active log, accept it first
                if (!this.gameState.missions.activeMissionIds.includes(targetMissionId)) {
                    if (this.simulationService?.missionService) {
                        this.simulationService.missionService.acceptMission(targetMissionId, true);
                    }
                }

                const mission = DB.MISSIONS[targetMissionId];
                if (!this.gameState.missions.missionProgress[targetMissionId]) {
                    this.gameState.missions.missionProgress[targetMissionId] = { objectives: {}, isCompletable: false, acceptDay: this.gameState.day };
                }
                const progress = this.gameState.missions.missionProgress[targetMissionId];
                if (mission && progress) {
                    if (mission.completion) {
                        mission.completion.locationId = 'any';
                    }
                    if (mission.objectives) {
                        mission.objectives.forEach(obj => {
                            const objKey = obj.id || obj.goodId || obj.targetLoc || obj.target;
                            const targetVal = obj.quantity !== undefined ? obj.quantity : (obj.value !== undefined ? obj.value : 1);
                            if (!progress.objectives[objKey]) {
                                progress.objectives[objKey] = { current: 0, target: targetVal, deposited: 0, collected: 0 };
                            }
                            progress.objectives[objKey].current = targetVal;
                            progress.objectives[objKey].target = targetVal;
                            progress.objectives[objKey].deposited = targetVal;
                            progress.objectives[objKey].collected = targetVal;
                            progress.objectives[objKey].satisfiedByDebug = true;
                        });
                    }
                    progress.satisfiedByDebug = true;
                    progress.isCompletable = true;
                    progress.cargoLoaded = true;
                }

                this.uiManager.createFloatingText(`Mission Satisfied: ${mission?.name || targetMissionId}`, window.innerWidth/2, window.innerHeight/2, '#4ade80');
                this.gameState.setState({});
                this.uiManager.render(this.gameState.getState());
                if (typeof this.uiManager.flashObjectiveProgress === 'function') {
                    this.uiManager.flashObjectiveProgress();
                }
            }},

            satisfyAllMissions: { name: 'Satisfy All', type: 'button', handler: () => {
                const activeIds = [...this.gameState.missions.activeMissionIds];
                if (activeIds.length === 0) {
                    this.uiManager.createFloatingText('No Active Missions in Log', window.innerWidth/2, window.innerHeight/2, '#ef4444');
                    return;
                }
                
                activeIds.forEach(missionId => {
                    const mission = DB.MISSIONS[missionId];
                    if (!this.gameState.missions.missionProgress[missionId]) {
                        this.gameState.missions.missionProgress[missionId] = { objectives: {}, isCompletable: false, acceptDay: this.gameState.day };
                    }
                    const progress = this.gameState.missions.missionProgress[missionId];
                    if (mission && progress) {
                        if (mission.completion) mission.completion.locationId = 'any';
                        if (mission.objectives) {
                            mission.objectives.forEach(obj => {
                                const objKey = obj.id || obj.goodId || obj.targetLoc || obj.target;
                                const targetVal = obj.quantity !== undefined ? obj.quantity : (obj.value !== undefined ? obj.value : 1);
                                if (!progress.objectives[objKey]) {
                                    progress.objectives[objKey] = { current: 0, target: targetVal, deposited: 0, collected: 0 };
                                }
                                progress.objectives[objKey].current = targetVal;
                                progress.objectives[objKey].target = targetVal;
                                progress.objectives[objKey].deposited = targetVal;
                                progress.objectives[objKey].collected = targetVal;
                                progress.objectives[objKey].satisfiedByDebug = true;
                            });
                        }
                        progress.satisfiedByDebug = true;
                        progress.isCompletable = true;
                        progress.cargoLoaded = true;
                    }
                });
                
                this.uiManager.createFloatingText('All Log Missions Satisfied!', window.innerWidth/2, window.innerHeight/2, '#4ade80');
                this.gameState.setState({});
                this.uiManager.render(this.gameState.getState());
                if (typeof this.uiManager.flashObjectiveProgress === 'function') {
                    this.uiManager.flashObjectiveProgress();
                }
            }},

            forceCompleteMission: { name: 'Complete', type: 'button', handler: () => {
                let targetMissionId = this.debugState.selectedMission;
                if (!targetMissionId && this.gameState.missions.activeMissionIds.length > 0) {
                    targetMissionId = this.gameState.missions.activeMissionIds[0];
                }
                if (!targetMissionId || !this.gameState.missions.activeMissionIds.includes(targetMissionId)) {
                    this.uiManager.createFloatingText('Selected Mission Not Active', window.innerWidth/2, window.innerHeight/2, '#ef4444');
                    return;
                }

                const mission = DB.MISSIONS[targetMissionId];
                if (!this.gameState.missions.missionProgress[targetMissionId]) {
                    this.gameState.missions.missionProgress[targetMissionId] = { objectives: {}, isCompletable: false, acceptDay: this.gameState.day };
                }
                const progress = this.gameState.missions.missionProgress[targetMissionId];
                if (mission && progress) {
                    if (mission.completion) mission.completion.locationId = 'any';
                    if (mission.objectives) {
                        mission.objectives.forEach(obj => {
                            const objKey = obj.id || obj.goodId || obj.targetLoc || obj.target;
                            const targetVal = obj.quantity || obj.value || 1;
                            if (!progress.objectives[objKey]) {
                                progress.objectives[objKey] = { current: 0, target: targetVal, deposited: 0, collected: 0 };
                            }
                            progress.objectives[objKey].current = targetVal;
                            progress.objectives[objKey].target = targetVal;
                            progress.objectives[objKey].satisfiedByDebug = true;
                        });
                    }
                    progress.isCompletable = true;
                    progress.cargoLoaded = true;
                    
                    if (this.simulationService?.missionService) {
                        this.simulationService.missionService.completeMission(targetMissionId, true);
                    }
                }
                
                this.uiManager.createFloatingText(`Mission ${mission?.name || targetMissionId} Completed`, window.innerWidth/2, window.innerHeight/2, '#4ade80');
                this.gameState.setState({});
            }},

            completeAllMissions: { name: 'Complete All', type: 'button', handler: () => {
                const activeIds = [...this.gameState.missions.activeMissionIds];
                if (activeIds.length === 0) {
                    this.uiManager.createFloatingText('No Active Missions in Log', window.innerWidth/2, window.innerHeight/2, '#ef4444');
                    return;
                }
                
                activeIds.forEach(missionId => {
                    const mission = DB.MISSIONS[missionId];
                    if (!this.gameState.missions.missionProgress[missionId]) {
                        this.gameState.missions.missionProgress[missionId] = { objectives: {}, isCompletable: false, acceptDay: this.gameState.day };
                    }
                    const progress = this.gameState.missions.missionProgress[missionId];
                    if (mission && progress) {
                        if (mission.completion) mission.completion.locationId = 'any';
                        if (mission.objectives) {
                            mission.objectives.forEach(obj => {
                                const objKey = obj.id || obj.goodId || obj.targetLoc || obj.target;
                                const targetVal = obj.quantity || obj.value || 1;
                                if (!progress.objectives[objKey]) {
                                    progress.objectives[objKey] = { current: 0, target: targetVal, deposited: 0, collected: 0 };
                                }
                                progress.objectives[objKey].current = targetVal;
                                progress.objectives[objKey].target = targetVal;
                                progress.objectives[objKey].satisfiedByDebug = true;
                            });
                        }
                        progress.isCompletable = true;
                        progress.cargoLoaded = true;
                        
                        if (this.simulationService?.missionService) {
                            this.simulationService.missionService.completeMission(missionId, true);
                        }
                    }
                });
                
                this.uiManager.createFloatingText('All Log Missions Completed!', window.innerWidth/2, window.innerHeight/2, '#4ade80');
                this.gameState.setState({});
            }},

            openGoToDropdown: { name: 'Go To', type: 'button', handler: () => {
                this._toggleGoToDropdown();
            }},

            restoreActiveShip: { name: 'Restore', type: 'button', handler: () => {
                const activeShip = this.simulationService?._getActiveShip();
                if (!activeShip) {
                    this.uiManager.createFloatingText('No Active Ship', window.innerWidth/2, window.innerHeight/2, '#ef4444');
                    return;
                }
                const effectiveStats = this.simulationService.getEffectiveShipStats(activeShip.id);
                const activeShipState = this.gameState.player.shipStates[activeShip.id];
                if (activeShipState && effectiveStats) {
                    activeShipState.health = effectiveStats.maxHealth;
                    activeShipState.fuel = effectiveStats.maxFuel;
                    this.simulationService._checkHullWarnings?.(activeShip.id);
                }
                this.uiManager.createFloatingText('Ship Hull & Fuel Restored', window.innerWidth/2, window.innerHeight/2, '#4ade80');
                this.gameState.setState({});
                this.uiManager.render(this.gameState.getState());
            }},

            triggerSystemToast: { name: 'Toast: System', type: 'button', handler: () => this.triggerToast('system') },
            triggerFinanceToast: { name: 'Toast: Finance', type: 'button', handler: () => this.triggerToast('finance') },
            triggerIntelToast: { name: 'Toast: Intel', type: 'button', handler: () => this.triggerToast('intel') },
            triggerMissionToast: { name: 'Toast: Mission', type: 'button', handler: () => this.triggerToast('mission') },
            triggerSolToast: { name: 'Toast: Sol', type: 'button', handler: () => this.triggerToast('sol') },

            triggerSystemState: { name: 'Force System State', type: 'button', handler: () => {
                const sysService = this.simulationService?.timeService?.systemStateService;
                if (sysService) {
                    if (this.debugState.selectedSystemState === 'NEUTRAL') {
                        sysService.endCurrentState();
                    } else {
                        sysService.triggerState(this.debugState.selectedSystemState);
                    }
                    this.uiManager.showEconWeatherModal(this.gameState.getState());
                    this.gameState.setState({});
                }
            }},
            showEconWeatherUI: { name: 'Show Weather UI', type: 'button', handler: () => {
                this.uiManager.showEconWeatherModal(this.gameState.getState());
            }},

            exportTicks: { name: 'Export Tick Data (CSV)', type: 'button', handler: () => this.exportTelemetry('ticks') },
            exportTrades: { name: 'Export Trade Data (CSV)', type: 'button', handler: () => this.exportTelemetry('trades') },
            exportImpacts: { name: 'Export Impact Data (CSV)', type: 'button', handler: () => this.exportTelemetry('impacts') },

            startBot: { name: 'Start AUTOTRADER-01', type: 'button', handler: () => {
                const progressController = this.gui.controllers.find(c => c.property === 'botProgress');
                
                const config = {
                    daysToRun: this.debugState.botDaysToRun,
                     strategy: this.debugState.botStrategy 
                };
                
                this.bot.runSimulation(config, (current, end) => {
                    if(progressController) progressController.setValue(`${current} / end`).updateDisplay();
                });
            }},
            stopBot: { name: 'Stop AUTOTRADER-01', type: 'button', handler: () => this.bot.stop() },

            fillShipyard: { name: 'Fill Shipyard w/ All Ships', type: 'button', handler: () => this.fillShipyard() },
            deductHull20: { name: 'Deduct 20 Hull', type: 'button', handler: () => this.deductHull(20) },
            restoreHull: { name: 'Restore Hull', type: 'button', handler: () => this.restoreHull() },
            destroyShip: { name: 'Destroy Current Ship', type: 'button', handler: () => this.destroyShip() },
             deductFuel20: { name: 'Deduct 20 Fuel', type: 'button', handler: () => this.deductFuel(20) },
            restoreFuel: { name: 'Restore Fuel', type: 'button', handler: () => this.restoreFuel() },
            removeAllCargo: { name: 'Remove All Cargo', type: 'button', handler: () => this.removeAllCargo() },
            
            giveItemToShip: { name: 'Give Item', type: 'button', handler: () => this.giveItemToShip() },

            applyRandomUpgrades: { name: 'Apply 3 Random Upgrades', type: 'button', handler: () => this.applyRandomUpgrades() },
            removeAllUpgrades: { name: 'Remove All Upgrades', type: 'button', handler: () => this.removeAllUpgrades() },
            
            applySelectedStatusEffect: { name: 'Apply Status Effect', type: 'button', handler: () => this.applySelectedStatusEffect(this.debugState.selectedStatusEffect) },
            removeAllStatusEffects: { name: 'Remove All Statuses', type: 'button', handler: () => this.removeAllStatusEffects() },

            resetEconomyMemory: { name: 'Reset Econ Memory', type: 'button', handler: () => this.resetEconomyMemory() },
            sootheEconomy: { name: 'Bullish Economy (Soothe)', type: 'button', handler: () => this.sootheEconomy() },
            riotEconomy: { name: 'Bearish Economy (Riot)', type: 'button', handler: () => this.riotEconomy() },
            injectStock: { name: '+100 Item Avail', type: 'button', handler: () => this.injectStock() },
            
            triggerHotIntel: { name: 'Trigger Hot Intel', type: 'button', handler: () => {
                if (this.simulationService && this.simulationService.intelService) {
                    this.simulationService.intelService.generateHotIntel();
                    const state = this.gameState.getState();
                    if (state.activeHotIntel && this.uiManager && this.uiManager.eventControl) {
                        this.uiManager.eventControl.showHotIntelModal(state.activeHotIntel);
                        this.uiManager.createFloatingText('Hot Intel Triggered', window.innerWidth/2, window.innerHeight/2, '#facc15');
                    }
                }
            }},

            // --- UI GUIDES LOGIC ---
            applyNavLock: { name: 'Apply Nav Lock', type: 'button', handler: () => {
                const selectedNavs = Object.keys(this.debugState.navLockMain).filter(k => this.debugState.navLockMain[k]);
                const selectedScreens = Object.keys(this.debugState.navLockSub).filter(k => this.debugState.navLockSub[k]);
                
                if (selectedNavs.length === 0 && selectedScreens.length === 0) {
                    this.simulationService.setNavigationLock([], []);
                } else {
                    this.simulationService.setNavigationLock(selectedNavs, selectedScreens);
                }
            }},
            clearNavLock: { name: 'Clear Nav Lock', type: 'button', handler: () => {
                // Reset toggles in UI
                Object.keys(this.debugState.navLockMain).forEach(k => this.debugState.navLockMain[k] = false);
                Object.keys(this.debugState.navLockSub).forEach(k => this.debugState.navLockSub[k] = false);
                // Update GUI controllers
                if (this.gui) {
                    this.gui.controllersRecursive().forEach(c => {
                        if (c.parent && (c.parent._title === 'Allowed Main Navs' || c.parent._title === 'Allowed Sub Navs')) {
                            c.updateDisplay();
                        }
                    });
                }
                this.simulationService.clearNavigationLock();
            }},
            
            // --- BANKRUPTCY EVENTS ---
            forceGuildBankruptcy: { name: 'Force Guild Servitude', type: 'button', handler: () => {
                this.gameState.player.credits = 0;
                this.gameState.player.debt = 50000;
                this.gameState.player.loanType = 'guild';
                this._clearAssetsForBankruptcy();
                this.simulationService.bankruptcyService.triggerBankruptcyFlow();
            }},
            forceSyndicateBankruptcy: { name: 'Force Syndicate Seizure', type: 'button', handler: () => {
                this.gameState.player.credits = 0;
                this.gameState.player.debt = 50000;
                this.gameState.player.loanType = 'syndicate';
                this._clearAssetsForBankruptcy();
                this.simulationService.bankruptcyService.triggerBankruptcyFlow();
            }},
            forceDestituteBankruptcy: { name: 'Force Vagrancy', type: 'button', handler: () => {
                this.gameState.player.credits = 0;
                this.gameState.player.debt = 0;
                this.gameState.player.loanType = 'guild';
                this._clearAssetsForBankruptcy();
                this.simulationService.bankruptcyService.triggerBankruptcyFlow();
            }},
            clearLoanLockoutTimer: { name: 'Clear Credit Lockout', type: 'button', handler: () => {
                this.gameState.player.creditLockoutExpiryDate = null;
                this.gameState.setState({});
                this.uiManager.createFloatingText('Credit Lockout Cleared', window.innerWidth/2, window.innerHeight/2, '#4ade80');
            }}
        };
    }

    _cacheDiagElements() {
        this.diagElements = {
            winW: document.getElementById('diag-window-w'),
            winH: document.getElementById('diag-window-h'),
            visualVpW: document.getElementById('diag-visual-vp-w'),
            visualVpH: document.getElementById('diag-visual-vp-h'),
            gameW: document.getElementById('diag-game-container-w'),
            gameH: document.getElementById('diag-game-container-h'),
            bodyW: document.getElementById('diag-body-w'),
            bodyH: document.getElementById('diag-body-h'),
            pixelRatio: document.getElementById('diag-pixel-ratio'),
            displayMode: document.getElementById('diag-display-mode'),
            day: document.getElementById('diag-day'),
            navScreen: document.getElementById('diag-nav-screen')
        };
    }

    _startDiagLoop() {
        if (this._diagLoopActive) return;
        this._diagLoopActive = true;
        const update = () => {
            if (!this.diagActive) {
                this._diagLoopActive = false;
                return;
            }
            this._updateDiagOverlay();
            requestAnimationFrame(update);
        };
        requestAnimationFrame(update);
    }

    _updateDiagOverlay() {
        if (!this.diagActive) return;

        const state = this.gameState.getState();
        const gameContainer = document.getElementById('game-container');

        if(this.diagElements.winW) this.diagElements.winW.textContent = window.innerWidth;
        if(this.diagElements.winH) this.diagElements.winH.textContent = window.innerHeight;

        if (window.visualViewport) {
            if(this.diagElements.visualVpW) this.diagElements.visualVpW.textContent = Math.round(window.visualViewport.width);
            if(this.diagElements.visualVpH) this.diagElements.visualVpH.textContent = Math.round(window.visualViewport.height);
        }

        if(this.diagElements.gameW) this.diagElements.gameW.textContent = gameContainer.clientWidth;
        if(this.diagElements.gameH) this.diagElements.gameH.textContent = gameContainer.clientHeight;
        if(this.diagElements.bodyW) this.diagElements.bodyW.textContent = document.body.clientWidth;
        if(this.diagElements.bodyH) this.diagElements.bodyH.textContent = document.body.clientHeight;
        if(this.diagElements.pixelRatio) this.diagElements.pixelRatio.textContent = window.devicePixelRatio.toFixed(2);
        if(this.diagElements.displayMode) this.diagElements.displayMode.textContent = window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser';
        if(this.diagElements.day) this.diagElements.day.textContent = state.day;
        if(this.diagElements.navScreen) this.diagElements.navScreen.textContent = `${state.activeNav} / ${state.activeScreen}`;
    }

    buildGui() {
        const triggerFolder = this.gui.addFolder('Triggers');
        this.triggersFolder = triggerFolder;

        // --- MISSION TRIGGERS (Auto-expanded, top of Triggers) ---
        const missionFolder = triggerFolder.addFolder('Mission Triggers');
        this.missionFolder = missionFolder;
        this._setupMissionFolderPopControl(missionFolder);
        
        const sortedMissions = Object.values(DB.MISSIONS).map(m => {
            const match = m.id.match(/\d+/);
            const num = match ? parseInt(match[0], 10) : -1;
            const prefix = match ? `${match[0].padStart(2, '0')} ` : '';
            let suffix = '';
            if (m.id.endsWith('_guild')) suffix = ' (G)';
            else if (m.id.endsWith('_syndicate')) suffix = ' (S)';
            return { label: `${prefix}${m.name}${suffix}`, id: m.id, num };
        }).sort((a, b) => {
            if (a.num !== b.num) return b.num - a.num; // Higher/newer mission numbers first
            return a.label.localeCompare(b.label);
        });

        const missionOptions = {};
        sortedMissions.forEach(m => missionOptions[m.label] = m.id);

        missionFolder.domElement.classList.add('mission-triggers-folder');
        missionFolder.add(this.debugState, 'selectedMission', missionOptions).name('Mission');
        // Row 1: Single Mission Controls
        const showCtrl = missionFolder.add(this.actions.forceAddTerminalMission, 'handler').name('Show');
        const acceptCtrl = missionFolder.add(this.actions.forceAcceptMission, 'handler').name('Accept');
        const satisfyCtrl = missionFolder.add(this.actions.satisfyMissionRequirements, 'handler').name('Satisfy');
        const completeCtrl = missionFolder.add(this.actions.forceCompleteMission, 'handler').name('Complete');

        showCtrl.domElement?.setAttribute('title', 'Force mission to Terminal (Show)');
        acceptCtrl.domElement?.setAttribute('title', 'Force Accept mission');
        satisfyCtrl.domElement?.setAttribute('title', 'Satisfy selected mission requirements');
        completeCtrl.domElement?.setAttribute('title', 'Force Complete selected mission');

        const btnRow1 = document.createElement('div');
        btnRow1.className = 'mission-control-btn-row mission-control-btn-row-1';
        btnRow1.appendChild(showCtrl.domElement);
        btnRow1.appendChild(acceptCtrl.domElement);
        btnRow1.appendChild(satisfyCtrl.domElement);
        btnRow1.appendChild(completeCtrl.domElement);

        // Row 2: Bulk & Utility Controls (Satisfy All, Complete All, Go To, Restore)
        const satisfyAllCtrl = missionFolder.add(this.actions.satisfyAllMissions, 'handler').name('Satisfy All');
        const completeAllCtrl = missionFolder.add(this.actions.completeAllMissions, 'handler').name('Complete All');
        const goToCtrl = missionFolder.add(this.actions.openGoToDropdown, 'handler').name('Go To');
        const restoreCtrl = missionFolder.add(this.actions.restoreActiveShip, 'handler').name('Restore');

        this.goToBtnEl = goToCtrl.domElement;

        satisfyAllCtrl.domElement?.setAttribute('title', 'Satisfy ALL active mission requirements in log');
        completeAllCtrl.domElement?.setAttribute('title', 'Force Complete ALL active missions in log');
        goToCtrl.domElement?.setAttribute('title', 'Select location to travel and advance time');
        restoreCtrl.domElement?.setAttribute('title', 'Restore active ship Fuel and Hull to full');

        const btnRow2 = document.createElement('div');
        btnRow2.className = 'mission-control-btn-row mission-control-btn-row-2';
        btnRow2.appendChild(satisfyAllCtrl.domElement);
        btnRow2.appendChild(completeAllCtrl.domElement);
        btnRow2.appendChild(goToCtrl.domElement);
        btnRow2.appendChild(restoreCtrl.domElement);

        const folderChildren = missionFolder.$children || missionFolder.domElement.querySelector('.children');
        if (folderChildren) {
            folderChildren.appendChild(btnRow1);
            folderChildren.appendChild(btnRow2);
        }

        missionFolder.open();

        // --- STORY EVENTS (Collapsed nested subfolder) ---
        const storyFolder = triggerFolder.addFolder('Story Events');
        const storyEventOptions = DB.STORY_EVENTS ? Object.keys(DB.STORY_EVENTS).reduce((acc, key) => ({...acc, [DB.STORY_EVENTS[key].title || key]: key}), {}) : {};
        storyFolder.add(this.debugState, 'selectedStoryEvent', storyEventOptions).name('Story Event');
        storyFolder.add(this.actions.forceQueueStoryEvent, 'handler').name('Queue Story Event');
        storyFolder.close();

        // --- RANDOM EVENTS (Collapsed nested subfolder) ---
        const randomFolder = triggerFolder.addFolder('Random Events');
        const randomEventOptions = DB.RANDOM_EVENTS.reduce((acc, event) => ({...acc, [event.template.title]: event.id }), {});
        randomFolder.add(this.debugState, 'selectedRandomEvent', randomEventOptions).name('Random Event');
        randomFolder.add(this.actions.triggerRandomEvent, 'handler').name('Force Trigger Event');
        randomFolder.add(this.actions.triggerHotIntel, 'handler').name(this.actions.triggerHotIntel.name);
        randomFolder.add(this.debugState, 'alwaysTriggerEvents')
            .name('Always Trigger (100%)')
            .onChange(val => {
                if (this.simulationService && this.simulationService.travelService) {
                    this.simulationService.travelService.debugAlwaysTriggerEvents = val;
                }
            });
        randomFolder.close();

        // --- TOASTS (Collapsed nested subfolder) ---
        const toastFolder = triggerFolder.addFolder('Toasts');
        toastFolder.add(this.actions.triggerSystemToast, 'handler').name(this.actions.triggerSystemToast.name);
        toastFolder.add(this.actions.triggerFinanceToast, 'handler').name(this.actions.triggerFinanceToast.name);
        toastFolder.add(this.actions.triggerIntelToast, 'handler').name(this.actions.triggerIntelToast.name);
        toastFolder.add(this.actions.triggerMissionToast, 'handler').name(this.actions.triggerMissionToast.name);
        toastFolder.add(this.actions.triggerSolToast, 'handler').name(this.actions.triggerSolToast.name);
        toastFolder.close();

        // --- GAME FLOW (Below Triggers) ---
        const flowFolder = this.gui.addFolder('Game Flow');
        flowFolder.add(this.actions.godMode, 'handler').name(this.actions.godMode.name);
        flowFolder.add(this.actions.simpleStart, 'handler').name(this.actions.simpleStart.name);
        flowFolder.add(this.actions.skipToStarterSelection, 'handler').name(this.actions.skipToStarterSelection.name);
        flowFolder.add(this.actions.skipToHangarTutorial, 'handler').name(this.actions.skipToHangarTutorial.name);
        flowFolder.add(this.actions.unlockAll, 'handler').name('Unlock ALL');
        
        flowFolder.add(this.actions.phase1MissionTest, 'handler').name(this.actions.phase1MissionTest.name);
        flowFolder.add(this.actions.phase2MissionTest, 'handler').name(this.actions.phase2MissionTest.name);
        flowFolder.add(this.actions.phase3MissionTest, 'handler').name(this.actions.phase3MissionTest.name);
        flowFolder.add(this.actions.phase4MissionTest, 'handler').name(this.actions.phase4MissionTest.name);

        const uiFolder = this.gui.addFolder('UI Guides');
        const mainNavFolder = uiFolder.addFolder('Allowed Main Navs');
        Object.values(NAV_IDS).forEach(id => mainNavFolder.add(this.debugState.navLockMain, id).name(id));
        const subNavFolder = uiFolder.addFolder('Allowed Sub Navs');
        Object.values(SCREEN_IDS).forEach(id => subNavFolder.add(this.debugState.navLockSub, id).name(id));
        uiFolder.add(this.actions.applyNavLock, 'handler').name(this.actions.applyNavLock.name);
        uiFolder.add(this.actions.clearNavLock, 'handler').name(this.actions.clearNavLock.name);

        const solFolder = this.gui.addFolder('Sol Station');
        solFolder.add(this.actions.solTesting, 'handler').name('Sol Testing');
        solFolder.add(this.actions.levelUpSolStation, 'handler').name(this.actions.levelUpSolStation.name);
        solFolder.add(this.actions.addAllOfficers, 'handler').name(this.actions.addAllOfficers.name);
        solFolder.add(this.actions.unlockAllOfficerSlots, 'handler').name(this.actions.unlockAllOfficerSlots.name);
        solFolder.add(this.actions.add1000AllItems, 'handler').name(this.actions.add1000AllItems.name);
        solFolder.add(this.actions.fillSolCaches, 'handler').name(this.actions.fillSolCaches.name);
        solFolder.add(this.actions.testRecruitOfficer, 'handler').name(this.actions.testRecruitOfficer.name);

        const playerFolder = this.gui.addFolder('Player');
        playerFolder.add(this.debugState, 'creditsToAdd').name('Credits Amount');
        playerFolder.add(this.actions.addCredits, 'handler').name('Add Credits');
        playerFolder.add(this.debugState, 'creditsToReduce', 100, 1000000, 100).name('Credits to Reduce');
        playerFolder.add(this.actions.reduceCredits, 'handler').name('Reduce Credits');
        playerFolder.add(this.actions.payDebt, 'handler').name(this.actions.payDebt.name);
        playerFolder.add(this.debugState, 'targetAge', 18, 1000, 1).name('Target Age');
        playerFolder.add(this.actions.setAge, 'handler').name('Set Age');
        
        const licensesFolder = playerFolder.addFolder('Grant Licenses');
        licensesFolder.add(this.actions.grantLicenseT2, 'handler').name(this.actions.grantLicenseT2.name);
        licensesFolder.add(this.actions.grantLicenseT3, 'handler').name(this.actions.grantLicenseT3.name);
        licensesFolder.add(this.actions.grantLicenseT4, 'handler').name(this.actions.grantLicenseT4.name);
        licensesFolder.add(this.actions.grantLicenseT5, 'handler').name(this.actions.grantLicenseT5.name);
        licensesFolder.add(this.actions.grantLicenseT6, 'handler').name(this.actions.grantLicenseT6.name);
        licensesFolder.add(this.actions.grantLicenseT7, 'handler').name(this.actions.grantLicenseT7.name);

        const shipFolder = this.gui.addFolder('Ship');
        shipFolder.add(this.actions.cycleShipPics, 'handler').name(this.actions.cycleShipPics.name);
        
        const commodityOptions = DB.COMMODITIES.reduce((acc, c) => ({...acc, [c.name]: c.id}), {});
        shipFolder.add(this.debugState, 'selectedCommodityToAdd', commodityOptions).name('Item Type');
        shipFolder.add(this.debugState, 'quantityToAdd', 1, 1000, 1).name('Quantity');
        shipFolder.add(this.actions.giveItemToShip, 'handler').name(this.actions.giveItemToShip.name);

        const locationOptions = DB.MARKETS.reduce((acc, loc) => ({...acc, [loc.name]: loc.id }), {});
        shipFolder.add(this.debugState, 'selectedLocation', locationOptions).name('Location');
        shipFolder.add(this.actions.teleport, 'handler').name('Teleport');
        shipFolder.add(this.actions.fillShipyard, 'handler').name(this.actions.fillShipyard.name);
        shipFolder.add(this.actions.grantAllShips, 'handler').name('Grant All Ships');

        const vitalsFolder = shipFolder.addFolder('Vitals & Cargo');
        vitalsFolder.add(this.actions.deductHull20, 'handler').name(this.actions.deductHull20.name);
        vitalsFolder.add(this.actions.restoreHull, 'handler').name(this.actions.restoreHull.name);
        vitalsFolder.add(this.actions.destroyShip, 'handler').name(this.actions.destroyShip.name);
        vitalsFolder.add(this.actions.deductFuel20, 'handler').name(this.actions.deductFuel20.name);
        vitalsFolder.add(this.actions.restoreFuel, 'handler').name(this.actions.restoreFuel.name);
        vitalsFolder.add(this.actions.removeAllCargo, 'handler').name(this.actions.removeAllCargo.name);

        const attributesFolder = shipFolder.addFolder('Game Attributes');
        const upgradeIds = GameAttributes.getAllUpgradeIds();
        const upgradeOptions = upgradeIds.reduce((acc, id) => {
            const def = GameAttributes.getDefinition(id);
            acc[def ? def.name : id] = id;
            return acc;
        }, {});
        attributesFolder.add(this.debugState, 'selectedUpgrade', upgradeOptions)
            .name('Install Upgrade')
            .onChange((id) => this.installSelectedUpgrade(id));
        attributesFolder.add(this.actions.applyRandomUpgrades, 'handler').name('Apply 3 Random');
        attributesFolder.add(this.actions.removeAllUpgrades, 'handler').name('Remove All');

        const statusFolder = shipFolder.addFolder('Status Effects');
        const statusOptions = Object.values(STATUS_EFFECTS).reduce((acc, effect) => {
            acc[effect.name] = effect.id;
            return acc;
        }, {});
        statusFolder.add(this.debugState, 'selectedStatusEffect', statusOptions)
            .name('Apply Status')
            .onChange((id) => this.applySelectedStatusEffect(id));
        statusFolder.add(this.actions.removeAllStatusEffects, 'handler').name('Remove All');

        const worldFolder = this.gui.addFolder('World & Time');
        worldFolder.add(this.debugState, 'daysToAdvance', 1, 365, 1).name('Days to Advance');
        worldFolder.add(this.actions.advanceTime, 'handler').name('Advance Time');

        this.economyFolder = this.gui.addFolder('Economy'); 
        this.economyFolder.add(this.actions.replenishStock, 'handler').name(this.actions.replenishStock.name);
        this.economyFolder.add(this.actions.resetEconomyMemory, 'handler').name(this.actions.resetEconomyMemory.name);
        this.economyFolder.add(this.actions.sootheEconomy, 'handler').name(this.actions.sootheEconomy.name);
        this.economyFolder.add(this.actions.riotEconomy, 'handler').name(this.actions.riotEconomy.name);
        this.economyFolder.add(this.actions.injectStock, 'handler').name(this.actions.injectStock.name);

        const bankFolder = this.economyFolder.addFolder('Bankruptcy Events');
        bankFolder.add(this.actions.forceGuildBankruptcy, 'handler').name(this.actions.forceGuildBankruptcy.name);
        bankFolder.add(this.actions.forceSyndicateBankruptcy, 'handler').name(this.actions.forceSyndicateBankruptcy.name);
        bankFolder.add(this.actions.forceDestituteBankruptcy, 'handler').name(this.actions.forceDestituteBankruptcy.name);
        bankFolder.add(this.actions.clearLoanLockoutTimer, 'handler').name(this.actions.clearLoanLockoutTimer.name);

        const sysStateFolder = this.economyFolder.addFolder('System States');
        const stateOptions = Object.keys(DB.SYSTEM_STATES).reduce((acc, key) => {
            acc[DB.SYSTEM_STATES[key].name] = key;
            return acc;
        }, {});
        sysStateFolder.add(this.debugState, 'selectedSystemState', stateOptions).name('Select State');
        sysStateFolder.add(this.actions.triggerSystemState, 'handler').name(this.actions.triggerSystemState.name);
        sysStateFolder.add(this.actions.showEconWeatherUI, 'handler').name(this.actions.showEconWeatherUI.name);

        const automationFolder = this.gui.addFolder('Automation & Logging');
        automationFolder.add(this, 'toggleDiagnosticOverlay').name('Toggle HUD Diagnostics');
        automationFolder.add(this.debugState, 'logLevel', ['DEBUG', 'INFO', 'WARN', 'ERROR', 'NONE']).name('Log Level').onChange(v => { if(this.logger && this.logger.setLevel) this.logger.setLevel(v) });
        automationFolder.add(this, 'generateBugReport').name('Generate Bug Report');
        
        automationFolder.add(this.debugState, 'enableEconomicTelemetry')
            .name('Enable Econ Telemetry')
            .onChange(val => {
                if (!this.gameState.uiState) this.gameState.uiState = {};
                this.gameState.uiState.enableEconomicTelemetry = val;
            });
            
        automationFolder.add(this.debugState, 'verboseTickLogging')
            .name('Verbose Tick Logging')
            .onChange(val => {
                if (!this.gameState.uiState) this.gameState.uiState = {};
                this.gameState.uiState.verboseTickLogging = val;
            });

        automationFolder.add(this.actions.exportTicks, 'handler').name(this.actions.exportTicks.name);
        automationFolder.add(this.actions.exportTrades, 'handler').name(this.actions.exportTrades.name);
        automationFolder.add(this.actions.exportImpacts, 'handler').name(this.actions.exportImpacts.name);

        automationFolder.add(this.debugState, 'botStrategy', ['MIXED', 'HONEST_TRADER', 'MANIPULATOR', 'DEPLETE_ONLY', 'PROSPECTOR']).name('Bot Strategy');
        
        automationFolder.add(this.debugState, 'botDaysToRun', 1, 10000, 1).name('Simulation Days');
        automationFolder.add(this.actions.startBot, 'handler').name(this.actions.startBot.name);
        automationFolder.add(this.actions.stopBot, 'handler').name(this.actions.stopBot.name);
        automationFolder.add(this.debugState, 'botProgress').name('Progress');

        this.gui.folders.forEach(folder => folder.close());
        triggerFolder.open();
        missionFolder.open();
    }
}