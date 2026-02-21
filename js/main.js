// js/main.js
import { GameState } from './services/GameState.js';
import { SimulationService } from './services/SimulationService.js';
import { UIManager } from './services/UIManager.js';
import { EventManager } from './services/EventManager.js';
import { TutorialService } from './services/TutorialService.js';
import { MissionService } from './services/MissionService.js';
import { DebugService } from './services/DebugService.js';
import { Logger } from './services/LoggingService.js';
import { NewsTickerService } from './services/NewsTickerService.js';

import { IntroService } from './services/game/IntroService.js';
import { PlayerActionService } from './services/player/PlayerActionService.js';
import { TimeService } from './services/world/TimeService.js';
import { TravelService } from './services/world/TravelService.js';

// --- [[START]] PHASE 4 IMPORTS ---
import { AssetService } from './services/AssetService.js';
import { saveStorageService } from './services/SaveStorageService.js';
import { SHIP_IDS } from './data/constants.js'; 
// --- [[END]] PHASE 4 IMPORTS ---

/**
 * This function now manages both app height and "letterbox" scaling.
 * It sets the --app-height variable for the body and dynamically scales
 * the game-container down if the visual viewport is too short.
 */
const setAppHeight = () => {
    const gameContainer = document.getElementById('game-container');
    if (!gameContainer) return;

    // This is the *true* available height, including notch/browser UI.
    const visualHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    
    // Set the body height to the *full* inner height (PWA/standalone height)
    // or the visual viewport height (browser). 100dvh in CSS handles this mostly,
    // but this JS variable is a robust override.
    document.documentElement.style.setProperty('--app-height', `${visualHeight}px`);

    // --- SCALING LOGIC ---
    // We define the DESIGN TARGET height (iPhone Pro Max).
    // If the screen is shorter, we scale the container down.
    const DESIGN_TARGET_HEIGHT = 926; // iPhone 14/13 Pro Max logical height

    if (visualHeight < DESIGN_TARGET_HEIGHT) {
        // The screen is too short, we must scale down.
        const scaleFactor = visualHeight / DESIGN_TARGET_HEIGHT; // e.g., 667px / 926px = 0.72
        
        // Set height to the *design* height, then scale it
        gameContainer.style.height = `${DESIGN_TARGET_HEIGHT}px`;
        gameContainer.style.transform = `scale(${scaleFactor})`;
        gameContainer.style.transformOrigin = 'top center';
        
        // Align the scaled container to the top of the flex-box body
        document.body.style.alignItems = 'flex-start'; // <-- MODIFIED
    } else {
        // The screen is tall enough, no scaling needed.
        gameContainer.style.transform = 'none';
        gameContainer.style.height = '100dvh'; // Use dynamic height
        
        // Re-center the container vertically (for desktop/tall devices)
        document.body.style.alignItems = 'center'; // <-- MODIFIED
    }
};

document.addEventListener('DOMContentLoaded', () => {

    // --- App Initialization Definitions ---
    const splashScreen = document.getElementById('splash-screen');
    const debugStartButton = document.getElementById('debug-start-btn');
    const DEV_MODE = true; // Guard for development features.

    const uiManager = new UIManager(Logger);

    const eulaCheckbox = document.getElementById('eula-checkbox');
    const eulaContainer = document.getElementById('eula-container');

    // --- V4 SAVE SYSTEM: UI Element Hooks ---
    const splashMainMenu = document.getElementById('splash-main-menu');
    const splashNewGameMenu = document.getElementById('splash-new-game-menu');
    const splashLoadGameMenu = document.getElementById('splash-load-game-menu');
    
    const mainNewGameBtn = document.getElementById('main-new-game-btn');
    const mainLoadGameBtn = document.getElementById('main-load-game-btn');
    
    const newGameBackBtn = document.getElementById('new-game-back-btn');
    const loadGameBackBtn = document.getElementById('load-game-back-btn');
    
    const newGameSlotsContainer = document.getElementById('new-game-slots');
    const loadGameSlotsContainer = document.getElementById('load-game-slots');

    const overwriteModal = document.getElementById('splash-overwrite-modal');
    const overwriteConfirmBtn = document.getElementById('overwrite-confirm-btn');
    const overwriteCancelBtn = document.getElementById('overwrite-cancel-btn');

    const deleteModal = document.getElementById('splash-delete-modal');
    const deleteConfirmBtn = document.getElementById('delete-confirm-btn');
    const deleteCancelBtn = document.getElementById('delete-cancel-btn');

    let pendingSlotAction = null; // Stores intent during confirmation modals { action: 'overwrite'|'delete', slotId: string }

    // --- PHASE 4: BACKGROUND ASSET HYDRATION & DB INIT ---
    // Initialize the Asset Locker and Save Storage concurrently
    Promise.all([AssetService.init(), saveStorageService._initDB()]).then(() => {
        AssetService.hydrateBootAssets();
        refreshSlotUI(); // Populate V4 Save Slots
    }).catch(err => console.warn("[Main] Storage Initialization failed:", err));

    // --- V4 SAVE SYSTEM: Slot Rendering Logic ---
    async function refreshSlotUI() {
        const metadataList = await saveStorageService.getAllSaveMetadata();

        // Unlock Load Game button if saves exist
        mainLoadGameBtn.disabled = metadataList.length === 0;

        newGameSlotsContainer.innerHTML = '';
        loadGameSlotsContainer.innerHTML = '';

        const slotIds = ['slot_1', 'slot_2', 'slot_3'];
        
        slotIds.forEach(slotId => {
            const data = metadataList.find(s => s.slotId === slotId);
            const slotNumber = slotId.split('_')[1];

            // 1. Build New Game Slot
            const newSlotWrapper = document.createElement('div');
            newSlotWrapper.className = 'save-slot-wrapper';
            
            const newSlotBtn = document.createElement('button');
            if (data) {
                // Populated Slot (New Game Menu -> Triggers Overwrite Warning)
                newSlotBtn.className = 'save-slot-btn';
                newSlotBtn.innerHTML = `
                    <span class="text-lg text-cyan-300 font-orbitron mb-1">Slot ${slotNumber}</span>
                    <span class="save-slot-metadata">[${data.metadata.realDate}] | [<span class="save-slot-metadata-hl">${data.metadata.creditsFormatted}</span>] | [${data.metadata.shipName}]</span>
                `;
                newSlotBtn.onclick = () => showOverwriteWarning(slotId);

                const deleteBtn = createDeleteButton(slotId);
                newSlotWrapper.appendChild(newSlotBtn);
                newSlotWrapper.appendChild(deleteBtn);
            } else {
                // Empty Slot
                newSlotBtn.className = 'save-slot-btn empty-slot';
                newSlotBtn.innerHTML = `<span class="text-lg font-orbitron">Empty Slot</span>`;
                newSlotBtn.onclick = () => executeStartGame('new', slotId);
                newSlotWrapper.appendChild(newSlotBtn);
            }
            newGameSlotsContainer.appendChild(newSlotWrapper);

            // 2. Build Load Game Slot (Only if populated)
            if (data) {
                const loadSlotWrapper = document.createElement('div');
                loadSlotWrapper.className = 'save-slot-wrapper';

                const loadSlotBtn = document.createElement('button');
                loadSlotBtn.className = 'save-slot-btn';
                loadSlotBtn.innerHTML = `
                    <span class="text-lg text-cyan-300 font-orbitron mb-1">Slot ${slotNumber}</span>
                    <span class="save-slot-metadata">[${data.metadata.realDate}] | [<span class="save-slot-metadata-hl">${data.metadata.creditsFormatted}</span>] | [${data.metadata.shipName}]</span>
                `;
                loadSlotBtn.onclick = () => executeStartGame('load', slotId);

                const deleteBtn = createDeleteButton(slotId);
                loadSlotWrapper.appendChild(loadSlotBtn);
                loadSlotWrapper.appendChild(deleteBtn);
                loadGameSlotsContainer.appendChild(loadSlotWrapper);
            }
        });
    }

    function createDeleteButton(slotId) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-slot-btn';
        deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
        deleteBtn.onclick = () => showDeleteWarning(slotId);
        return deleteBtn;
    }

    // --- V4 SAVE SYSTEM: Menu State Machine Transitions ---
    function showSplashView(viewId) {
        splashMainMenu.classList.add('hidden');
        splashNewGameMenu.classList.add('hidden');
        splashLoadGameMenu.classList.add('hidden');

        if (viewId === 'main') splashMainMenu.classList.remove('hidden');
        else if (viewId === 'new') splashNewGameMenu.classList.remove('hidden');
        else if (viewId === 'load') splashLoadGameMenu.classList.remove('hidden');
    }

    // Navigation Bindings
    mainNewGameBtn.addEventListener('click', () => { if (checkEula()) showSplashView('new'); });
    mainLoadGameBtn.addEventListener('click', () => { if (checkEula()) showSplashView('load'); });
    newGameBackBtn.addEventListener('click', () => showSplashView('main'));
    loadGameBackBtn.addEventListener('click', () => showSplashView('main'));

    // --- V4 SAVE SYSTEM: Warning Modals Logic ---
    function showOverwriteWarning(slotId) {
        pendingSlotAction = { action: 'overwrite', slotId };
        overwriteModal.classList.remove('hidden');
    }

    function showDeleteWarning(slotId) {
        pendingSlotAction = { action: 'delete', slotId };
        deleteModal.classList.remove('hidden');
    }

    overwriteCancelBtn.onclick = () => { overwriteModal.classList.add('hidden'); pendingSlotAction = null; };
    deleteCancelBtn.onclick = () => { deleteModal.classList.add('hidden'); pendingSlotAction = null; };

    overwriteConfirmBtn.onclick = () => {
        overwriteModal.classList.add('hidden');
        if (pendingSlotAction && pendingSlotAction.action === 'overwrite') {
            executeStartGame('new', pendingSlotAction.slotId);
        }
    };

    deleteConfirmBtn.onclick = async () => {
        deleteModal.classList.add('hidden');
        if (pendingSlotAction && pendingSlotAction.action === 'delete') {
            await saveStorageService.deleteGame(pendingSlotAction.slotId);
            await refreshSlotUI();
            pendingSlotAction = null;
        }
    };

    // EULA Link Binding
    if (splashScreen) {
        splashScreen.addEventListener('click', (e) => {
            const actionTarget = e.target.closest('[data-action]');
            if (actionTarget && actionTarget.dataset.action === 'show_eula_modal') {
                e.preventDefault();
                uiManager.showEulaModal();
            }
        });
    }

    if (eulaContainer) {
        eulaContainer.addEventListener('animationend', () => {
            eulaContainer.classList.remove('pulse-eula-warning');
        });
    }

    // Isolated EULA Gatekeeper
    function checkEula() {
        if (!eulaCheckbox || !eulaContainer) return false;
        if (!eulaCheckbox.checked) {
            eulaContainer.classList.remove('pulse-eula-warning');
            setTimeout(() => eulaContainer.classList.add('pulse-eula-warning'), 10);
            return false;
        }
        return true;
    }

    // Set the app height on initial load and whenever the viewport changes.
    setAppHeight(); 
    
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', setAppHeight);
        window.visualViewport.addEventListener('scroll', setAppHeight);
    } else {
        window.addEventListener('resize', setAppHeight);
    }

    // --- V4 SAVE SYSTEM: Execution Pipeline ---
    async function executeStartGame(type, slotId, isSimpleStart = false) {
        // Trigger fade animation
        splashScreen.classList.add('splash-screen-hiding');
        
        let payload = null;
        if (type === 'load') {
            payload = await saveStorageService.loadGame(slotId);
            // Fallback safety if the payload goes missing between render and click
            if (!payload) type = 'new';
        }

        // Pre-Flight Hydration Hook
        try {
            if (type === 'load' && payload) {
                AssetService.hydrateGameAssets(payload.state);
            } else {
                const tempState = new GameState();
                tempState.startNewGame('');
                AssetService.hydrateGameAssets(tempState.getState());
            }
        } catch (e) {
            console.warn("[Main] Pre-flight hydration warning:", e);
        }

        // Wait for the animation to finish before starting the heavy game loop.
        splashScreen.addEventListener('animationend', () => {
            splashScreen.style.display = 'none';
            startGame({ type, slotId, payload, isSimpleStart }, uiManager, Logger);
        }, { once: true });
    }
    
    debugStartButton.addEventListener('click', () => {
        if (checkEula()) {
            executeStartGame('new', 'slot_1', true);
        }
    });

    /**
     * Instantiates all core game services, establishes their dependencies,
     * loads saved data or starts a new game, and binds all necessary event listeners.
     * @param {object} initData - V4 INIT SCHEMA: { type: 'new'|'load', slotId: string, payload: object|null, isSimpleStart: boolean }
     * @param {UIManager} uiManager - The pre-instantiated UIManager.
     * @param {Logger} logger - The Logger instance.
     */
    function startGame(initData, uiManager, logger) {
        // --- Service Instantiation ---
        const gameState = new GameState();
        const newsTickerService = new NewsTickerService(gameState); 
        const missionService = new MissionService(gameState, uiManager, logger);
        const simulationService = new SimulationService(gameState, uiManager, logger, newsTickerService);
        const tutorialService = new TutorialService(gameState, uiManager, simulationService, uiManager.navStructure, logger);
        let debugService = null;

        if (DEV_MODE) {
            debugService = new DebugService(gameState, simulationService, uiManager, logger);
            debugService.init();
            uiManager.setDebugService(debugService);
        }
        
        // --- Dependency Injection ---
        uiManager.setNewsTickerService(newsTickerService); 
        uiManager.setMissionService(missionService);
        uiManager.setSimulationService(simulationService);
        simulationService.setTutorialService(tutorialService);
        simulationService.setMissionService(missionService);
        missionService.setSimulationService(simulationService);
        const eventManager = new EventManager(gameState, simulationService, uiManager, tutorialService, debugService, logger);
        uiManager.setEventManager(eventManager);
        
        // --- Link GameState to UIManager for automatic re-rendering ---
        gameState.subscribe(() => uiManager.render(gameState.getState()));

        // --- V4 SAVE SYSTEM: Game Initialization ---
        const hasSave = initData.type === 'load' && initData.payload;

        if (hasSave) {
            // Apply loaded payload using deep merge backwards compatibility
            gameState.importMergedState(initData.payload);
        } else {
            // Fresh start
            gameState.startNewGame('');
            gameState.slotId = initData.slotId; // Ensure slot association for background auto-saves

            if (initData.isSimpleStart && debugService) {
                debugService.simpleStart();
            } else {
                simulationService.timeService.advanceDays(7);
                simulationService.startIntroSequence();
            }
        }

        // --- Bindings ---
        eventManager.bindEvents();
        
        // --- CONSOLE EXPOSURE ---
        if (DEV_MODE || true) {
            window.game = {
                gameState,
                simulationService,
                missionService,
                uiManager,
                eventManager
            };
            console.log("Game services exposed to window.game");
        }

        // --- Post-Init Rendering ---
        if (hasSave || initData.isSimpleStart) {
            uiManager.showGameContainer(); 
            
            // Populate the news ticker *before* the first render to prevent "first tap" re-render bug.
            newsTickerService.onLocationChange();
            
            uiManager.render(gameState.getState());
        }
        
        tutorialService.checkState({ type: 'SCREEN_LOAD', screenId: gameState.activeScreen });

        // Final Hydration check ensures any dynamically requested assets in loaded state are caught
        AssetService.hydrateGameAssets(gameState.getState());
    }
});