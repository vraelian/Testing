// js/main.js
import { GameState } from './services/GameState.js';
import { SimulationService } from './services/SimulationService.js';
import { UIManager } from './services/UIManager.js';
import { EventManager } from './services/EventManager.js';
import { MissionService } from './services/MissionService.js';
import { DebugService } from './services/DebugService.js';
import { Logger } from './services/LoggingService.js';
import { NewsTickerService } from './services/NewsTickerService.js';

import { IntroService } from './services/game/IntroService.js';
import { PlayerActionService } from './services/player/PlayerActionService.js';
import { TimeService } from './services/world/TimeService.js';
import { TravelService } from './services/world/TravelService.js';

import { AssetService } from './services/AssetService.js';
import { saveStorageService } from './services/SaveStorageService.js';
import { SHIP_IDS } from './data/constants.js'; 

const setAppHeight = () => {
    const gameContainer = document.getElementById('game-container');
    if (!gameContainer) return;

    const visualHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    
    document.documentElement.style.setProperty('--app-height', `${visualHeight}px`);

    const DESIGN_TARGET_HEIGHT = 926;

    if (visualHeight < DESIGN_TARGET_HEIGHT) {
        const scaleFactor = visualHeight / DESIGN_TARGET_HEIGHT; 
        
        gameContainer.style.height = `${DESIGN_TARGET_HEIGHT}px`;
        gameContainer.style.transform = `scale(${scaleFactor})`;
        gameContainer.style.transformOrigin = 'top center';
        
        document.body.style.alignItems = 'flex-start';
    } else {
        gameContainer.style.transform = 'none';
        gameContainer.style.height = '100dvh';
        
        document.body.style.alignItems = 'center'; 
    }
};

document.addEventListener('DOMContentLoaded', () => {

    // --- App Initialization Definitions ---
    const splashScreen = document.getElementById('splash-screen');
    const splashTitleHeader = document.getElementById('splash-title-header');
    const debugStartButton = document.getElementById('debug-start-btn');
    const DEV_MODE = true; 

    const uiManager = new UIManager(Logger);

    const eulaCheckbox = document.getElementById('eula-checkbox');
    const eulaContainer = document.getElementById('eula-container');

    // --- V4 SAVE SYSTEM: UI Element Hooks ---
    const splashMainMenu = document.getElementById('splash-main-menu');
    const splashNewGameMenu = document.getElementById('splash-new-game-menu');
    const splashLoadGameMenu = document.getElementById('splash-load-game-menu');
    const splashOptionsMenu = document.getElementById('splash-options-menu');
    const splashDataMenu = document.getElementById('splash-data-menu');
    
    const mainNewGameBtn = document.getElementById('main-new-game-btn');
    const mainLoadGameBtn = document.getElementById('main-load-game-btn');
    const mainOptionsBtn = document.getElementById('main-options-btn');
    
    const newGameBackBtn = document.getElementById('new-game-back-btn');
    const loadGameBackBtn = document.getElementById('load-game-back-btn');
    const optionsBackBtn = document.getElementById('options-back-btn');
    const optionsDataBtn = document.getElementById('options-data-btn');
    const dataBackBtn = document.getElementById('data-back-btn');
    
    const exportSavesBtn = document.getElementById('export-saves-btn');
    const importSavesBtn = document.getElementById('import-saves-btn');
    const importDataTextarea = document.getElementById('import-data-textarea');
    const optionsStatusMessage = document.getElementById('options-status-message');

    const newGameSlotsContainer = document.getElementById('new-game-slots');
    const loadGameSlotsContainer = document.getElementById('load-game-slots');

    const overwriteModal = document.getElementById('splash-overwrite-modal');
    const overwriteConfirmBtn = document.getElementById('overwrite-confirm-btn');
    const overwriteCancelBtn = document.getElementById('overwrite-cancel-btn');

    const deleteModal = document.getElementById('splash-delete-modal');
    const deleteConfirmBtn = document.getElementById('delete-confirm-btn');
    const deleteCancelBtn = document.getElementById('delete-cancel-btn');

    let pendingSlotAction = null; 
    let cachedExportCode = "";
    let importConfirmState = false;

    // --- PHASE 2: REQUEST BROWSER STORAGE PERSISTENCE ---
    if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().then(granted => {
            if (granted) {
                console.log("[Storage] Persistent storage granted by the browser.");
            } else {
                console.warn("[Storage] Persistent storage not granted. Subject to browser eviction.");
            }
        });
    }

    // --- PHASE 4: BACKGROUND ASSET HYDRATION & DB INIT ---
    Promise.all([AssetService.init(), saveStorageService._initDB()]).then(() => {
        AssetService.hydrateBootAssets();
        refreshSlotUI(); 
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
                newSlotBtn.className = 'save-slot-btn empty-slot';
                newSlotBtn.innerHTML = `<span class="text-lg font-orbitron">Empty Slot</span>`;
                newSlotBtn.onclick = () => executeStartGame('new', slotId);
                newSlotWrapper.appendChild(newSlotBtn);
            }
            newGameSlotsContainer.appendChild(newSlotWrapper);

            // 2. Build Load Game Slot
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
        splashOptionsMenu.classList.add('hidden');
        if (splashDataMenu) splashDataMenu.classList.add('hidden');

        // Hide title header if we need ultra-compact screen (like Options)
        if (splashTitleHeader) {
            if (viewId === 'options' || viewId === 'data') {
                splashTitleHeader.classList.add('hidden');
            } else {
                splashTitleHeader.classList.remove('hidden');
            }
        }

        if (viewId === 'main') splashMainMenu.classList.remove('hidden');
        else if (viewId === 'new') splashNewGameMenu.classList.remove('hidden');
        else if (viewId === 'load') splashLoadGameMenu.classList.remove('hidden');
        else if (viewId === 'options') splashOptionsMenu.classList.remove('hidden');
        else if (viewId === 'data') {
            splashDataMenu.classList.remove('hidden');
            preGenerateExportCode();
        }
    }

    mainNewGameBtn.addEventListener('click', () => { if (checkEula()) showSplashView('new'); });
    mainLoadGameBtn.addEventListener('click', () => { if (checkEula()) showSplashView('load'); });
    mainOptionsBtn.addEventListener('click', () => showSplashView('options'));
    optionsDataBtn.addEventListener('click', () => showSplashView('data'));
    
    newGameBackBtn.addEventListener('click', () => showSplashView('main'));
    loadGameBackBtn.addEventListener('click', () => showSplashView('main'));
    optionsBackBtn.addEventListener('click', () => showSplashView('main'));
    
    dataBackBtn.addEventListener('click', () => {
        importDataTextarea.value = '';
        cachedExportCode = "";
        resetImportButton();
        showSplashView('options');
    });

    // --- BASE64 HELPER UTILITIES (Prevents payload truncation & handles Unicode backwards-compatibility) ---
    function utf8ToBase64(str) {
        // Fast, native encoding that handles Unicode without bloating
        return window.btoa(unescape(encodeURIComponent(str)));
    }

    function base64ToUtf8(b64) {
        const decodedRaw = window.atob(b64);
        try {
            // Modern, efficient unescape mechanism
            return decodeURIComponent(escape(decodedRaw));
        } catch (e) {
            // Legacy Fallback: Recovers saves exported from the very first V1 implementation
            try {
                return decodeURIComponent(decodedRaw);
            } catch (legacyErr) {
                return decodedRaw; 
            }
        }
    }

    // --- PHASE 3: BACKUP & RESTORE PIPELINE ---
    function showOptionsStatus(message, isError = false) {
        optionsStatusMessage.textContent = message;
        optionsStatusMessage.className = `h-6 text-sm font-roboto-mono transition-opacity opacity-100 ${isError ? 'text-red-400' : 'text-cyan-300'} m-0`;
        setTimeout(() => {
            optionsStatusMessage.classList.replace('opacity-100', 'opacity-0');
        }, 4000);
    }

    async function preGenerateExportCode() {
        try {
            const allSaves = {};
            const slots = ['slot_1', 'slot_2', 'slot_3'];
            for (const slotId of slots) {
                const payload = await saveStorageService.loadGame(slotId);
                if (payload) allSaves[slotId] = payload;
            }
            
            if (Object.keys(allSaves).length === 0) {
                cachedExportCode = "";
                return;
            }

            const jsonString = JSON.stringify(allSaves);
            // Uses unified Base64 encoder ensuring minimal footprint and valid parsing
            cachedExportCode = utf8ToBase64(jsonString);
        } catch (error) {
            console.error("[Backup] Pre-generation failed:", error);
            cachedExportCode = "";
        }
    }

    exportSavesBtn.addEventListener('click', () => {
        if (!cachedExportCode) {
            showOptionsStatus('No valid backup code available.', true);
            return;
        }

        const triggerSuccessVisuals = () => {
            exportSavesBtn.textContent = 'Save Code Copied!';
            exportSavesBtn.classList.remove('bg-cyan-900/30', 'hover:bg-cyan-800/50', 'border-cyan-700');
            exportSavesBtn.classList.add('bg-green-800/60', 'hover:bg-green-700/80', 'border-green-500', 'text-white');
            
            setTimeout(() => {
                exportSavesBtn.textContent = 'Export Save Code';
                exportSavesBtn.classList.add('bg-cyan-900/30', 'hover:bg-cyan-800/50', 'border-cyan-700');
                exportSavesBtn.classList.remove('bg-green-800/60', 'hover:bg-green-700/80', 'border-green-500', 'text-white');
            }, 2000);
        };

        try {
            // Clipboard API (Works on HTTPS/Localhost)
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(cachedExportCode).then(() => {
                    triggerSuccessVisuals();
                }).catch(err => {
                    fallbackCopyTextToClipboard(triggerSuccessVisuals);
                });
            } else {
                fallbackCopyTextToClipboard(triggerSuccessVisuals);
            }
        } catch (error) {
            console.error("[Backup] Copy failed:", error);
            showOptionsStatus('Copy failed. Try manually copying the text.', true);
        }
    });

    function fallbackCopyTextToClipboard(successCallback) {
        const tempTextArea = document.createElement("textarea");
        tempTextArea.value = cachedExportCode;
        tempTextArea.style.top = "0";
        tempTextArea.style.left = "0";
        tempTextArea.style.position = "fixed";
        document.body.appendChild(tempTextArea);
        tempTextArea.focus();
        tempTextArea.select();
        tempTextArea.setSelectionRange(0, 9999999); 
        try {
            const successful = document.execCommand("copy");
            if (successful && successCallback) {
                successCallback();
            } else {
                showOptionsStatus('Copy failed. Try manually copying the text.', true);
            }
        } catch (err) {
            showOptionsStatus('Copy failed. Try manually copying the text.', true);
        }
        document.body.removeChild(tempTextArea);
    }

    function resetImportButton() {
        importConfirmState = false;
        importSavesBtn.textContent = 'Import Save Code';
        importSavesBtn.classList.add('bg-blue-900/30', 'hover:bg-blue-800/50', 'border-blue-700');
        importSavesBtn.classList.remove('bg-red-800/80', 'hover:bg-red-700', 'border-red-600', 'text-white');
    }

    importDataTextarea.addEventListener('input', resetImportButton);

    importSavesBtn.addEventListener('click', async () => {
        // Strip all whitespace/newlines that might be introduced by textarea or iOS pasting
        const b64Data = importDataTextarea.value.replace(/\s+/g, '');
        if (!b64Data) {
            showOptionsStatus('Please paste a backup code first.', true);
            return;
        }

        if (!importConfirmState) {
            importConfirmState = true;
            importSavesBtn.textContent = 'OVERWRITE & IMPORT?';
            importSavesBtn.classList.remove('bg-blue-900/30', 'hover:bg-blue-800/50', 'border-blue-700');
            importSavesBtn.classList.add('bg-red-800/80', 'hover:bg-red-700', 'border-red-600', 'text-white');
            return;
        }

        try {
            // Decode cleanly via the unified decoder to ensure legacy compatibility
            const jsonString = base64ToUtf8(b64Data);
            const parsedSaves = JSON.parse(jsonString);
            
            const slots = ['slot_1', 'slot_2', 'slot_3'];
            let importedCount = 0;
            
            for (const slotId of slots) {
                if (parsedSaves[slotId] && parsedSaves[slotId].state) {
                    // This call securely syncs to IDB and the native iOS bridge
                    await saveStorageService.saveGame(slotId, parsedSaves[slotId]);
                    importedCount++;
                }
            }

            if (importedCount > 0) {
                importDataTextarea.value = '';
                showOptionsStatus(`Successfully restored ${importedCount} save(s)!`);
                await refreshSlotUI(); // Refresh UI to show the imported slots
                preGenerateExportCode(); // Update the export field with newly loaded data
            } else {
                showOptionsStatus('Invalid backup code. No valid saves found.', true);
            }
        } catch (error) {
            console.error("[Backup] Import failed:", error);
            showOptionsStatus('Invalid backup code format.', true);
        } finally {
            resetImportButton();
        }
    });

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

    function checkEula() {
        if (!eulaCheckbox || !eulaContainer) return false;
        if (!eulaCheckbox.checked) {
            eulaContainer.classList.remove('pulse-eula-warning');
            setTimeout(() => eulaContainer.classList.add('pulse-eula-warning'), 10);
            return false;
        }
        return true;
    }

    setAppHeight(); 
    
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', setAppHeight);
        window.visualViewport.addEventListener('scroll', setAppHeight);
    } else {
        window.addEventListener('resize', setAppHeight);
    }

    // --- V4 SAVE SYSTEM: Execution Pipeline ---
    async function executeStartGame(type, slotId, isSimpleStart = false) {
        splashScreen.classList.add('splash-screen-hiding');
        
        let payload = null;
        if (type === 'load') {
            payload = await saveStorageService.loadGame(slotId);
            if (!payload) type = 'new';
        }

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
     */
    function startGame(initData, uiManager, logger) {
        const gameState = new GameState();
        const newsTickerService = new NewsTickerService(gameState); 
        const missionService = new MissionService(gameState, uiManager, logger);
        const simulationService = new SimulationService(gameState, uiManager, logger, newsTickerService);
        let debugService = null;

        if (DEV_MODE) {
            debugService = new DebugService(gameState, simulationService, uiManager, logger);
            debugService.init();
            uiManager.setDebugService(debugService);
        }
        
        uiManager.setNewsTickerService(newsTickerService); 
        uiManager.setMissionService(missionService);
        uiManager.setSimulationService(simulationService);
        simulationService.setMissionService(missionService);
        missionService.setSimulationService(simulationService);
        const eventManager = new EventManager(gameState, simulationService, uiManager, debugService, logger);
        uiManager.setEventManager(eventManager);
        
        gameState.subscribe(() => uiManager.render(gameState.getState()));

        const hasSave = initData.type === 'load' && initData.payload;

        if (hasSave) {
            gameState.importMergedState(initData.payload);
        } else {
            gameState.startNewGame('');
            gameState.slotId = initData.slotId; 

            if (initData.isSimpleStart && debugService) {
                debugService.simpleStart();
            } else {
                simulationService.timeService.advanceDays(7);
                simulationService.startIntroSequence();
            }
        }

        eventManager.bindEvents();
        
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

        if (hasSave || initData.isSimpleStart) {
            uiManager.showGameContainer(); 
            newsTickerService.onLocationChange();
            uiManager.render(gameState.getState());
        }
        
        AssetService.hydrateGameAssets(gameState.getState());
    }
});