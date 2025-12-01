// js/main.js
import { GameState } from './services/GameState.js';
import { SimulationService } from './services/SimulationService.js';
import { UIManager } from './services/UIManager.js';
import { EventManager } from './services/EventManager.js';
import { TutorialService } from './services/TutorialService.js';
import { MissionService } from './services/MissionService.js';
import { DebugService } from './services/DebugService.js';
import { Logger } from './services/LoggingService.js';
import { NewsTickerService } from './services/NewsTickerService.js'; // IMPORT

// Import the new service shells
import { IntroService } from './services/game/IntroService.js';
import { PlayerActionService } from './services/player/PlayerActionService.js';
import { TimeService } from './services/world/TimeService.js';
import { TravelService } from './services/world/TravelService.js';

// --- [[START]] PHASE 4 IMPORT ---
import { AssetService } from './services/AssetService.js';
// --- [[END]] PHASE 4 IMPORT ---

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
    // --- App Initialization ---
    const splashScreen = document.getElementById('splash-screen');
    const startButton = document.getElementById('start-game-btn');
    const debugStartButton = document.getElementById('debug-start-btn');
    const DEV_MODE = true; // Guard for development features.

    // [[START]] VIRTUAL WORKBENCH (EULA Logic)
    
    // 1. Instantiate UI Manager and Logger early
    // These are needed to show the EULA modal *before* the game starts.
    const uiManager = new UIManager(Logger);

    const eulaCheckbox = document.getElementById('eula-checkbox');
    const eulaContainer = document.getElementById('eula-container');

    // 2. Add standalone listener for EULA link on splash screen
    if (splashScreen) {
        splashScreen.addEventListener('click', (e) => {
            const actionTarget = e.target.closest('[data-action]');
            if (actionTarget) {
                const action = actionTarget.dataset.action;
                if (action === 'show_eula_modal') {
                    e.preventDefault();
                    uiManager.showEulaModal();
                }
            }
        });
    }

    // 3. Add cleanup listener for the pulse animation
    if (eulaContainer) {
        eulaContainer.addEventListener('animationend', () => {
            eulaContainer.classList.remove('pulse-eula-warning');
        });
    }

    // 4. Create check function that wraps the start logic
    const checkEulaAndStart = (startFn) => {
        if (!eulaCheckbox || !eulaContainer) {
            console.error("EULA elements not found!");
            return;
        }

        if (!eulaCheckbox.checked) {
            // Trigger pulse animation
            eulaContainer.classList.remove('pulse-eula-warning');
            // Timeout ensures the class removal is processed, allowing the animation to re-trigger
            setTimeout(() => {
                eulaContainer.classList.add('pulse-eula-warning');
            }, 10);
            
            return; // Stop the function
        }

        // EULA is checked, proceed with game start
        splashScreen.classList.add('splash-screen-hiding');
        splashScreen.addEventListener('animationend', () => {
            splashScreen.style.display = 'none';
            startFn();
        }, { once: true });
    };
    // [[END]] VIRTUAL WORKBENCH (EULA Logic)

    // Set the app height on initial load and whenever the viewport changes.
    setAppHeight(); // MODIFIED: Re-enabled
    
    // The visualViewport API is a more reliable way to track viewport changes on mobile.
    // MODIFIED: Re-enabled
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', setAppHeight);
        window.visualViewport.addEventListener('scroll', setAppHeight);
    } else {
        window.addEventListener('resize', setAppHeight);
    }



    // Set up the main start button to initialize and begin the game.
    startButton.addEventListener('click', () => {
        // [[START]] VIRTUAL WORKBENCH (EULA Logic)
        // 5. Pass the original startGame function as a callback, along with pre-built uiManager
        checkEulaAndStart(() => startGame(false, uiManager, Logger));
        // [[END]] VIRTUAL WORKBENCH (EULA Logic)
    }, { once: false }); // Set once to false to allow re-checking
    
    debugStartButton.addEventListener('click', () => {
        // [[START]] VIRTUAL WORKBENCH (EULA Logic)
        // 5. Pass the debug start function as a callback, along with pre-built uiManager
        checkEulaAndStart(() => startGame(true, uiManager, Logger));
        // [[END]] VIRTUAL WORKBENCH (EULA Logic)
    }, { once: false }); // Set once to false to allow re-checking

    /**
     * Instantiates all core game services, establishes their dependencies,
     * loads saved data or starts a new game, and binds all necessary event listeners.
     * @param {boolean} isSimpleStart
     * @param {UIManager} uiManager - The pre-instantiated UIManager.
     * @param {Logger} logger - The Logger instance.
     */
    function startGame(isSimpleStart = false, uiManager, logger) {
        // --- Service Instantiation ---
        const gameState = new GameState();
        // uiManager and logger are now passed in, no need to instantiate.
        const newsTickerService = new NewsTickerService(gameState); // INSTANTIATE
        const missionService = new MissionService(gameState, uiManager, logger);
        // MODIFIED: Pass newsTickerService to SimulationService
        const simulationService = new SimulationService(gameState, uiManager, logger, newsTickerService);
        const tutorialService = new TutorialService(gameState, uiManager, simulationService, uiManager.navStructure, logger);
        let debugService = null;

        if (DEV_MODE) {
            debugService = new DebugService(gameState, simulationService, uiManager, logger);
            debugService.init();
            // --- [[START]] TUTORIAL TUNER WIRING ---
            uiManager.setDebugService(debugService);
            // --- [[END]] TUTORIAL TUNER WIRING ---
        }
        
        // --- Dependency Injection ---
        uiManager.setNewsTickerService(newsTickerService); // INJECT
        uiManager.setMissionService(missionService);
        uiManager.setSimulationService(simulationService);
        simulationService.setTutorialService(tutorialService);
        simulationService.setMissionService(missionService);
        // REMOVED: TimeService injection (now handled by SimService)
        missionService.setSimulationService(simulationService);
        const eventManager = new EventManager(gameState, simulationService, uiManager, tutorialService, debugService, logger);
        // MODIFIED: Inject EventManager into UIManager for post-render bindings
        uiManager.setEventManager(eventManager);
        
        // --- Link GameState to UIManager for automatic re-rendering ---
        gameState.subscribe(() => uiManager.render(gameState.getState()));

        // --- Game Initialization ---
        const hasSave = gameState.loadGame();
        if (!hasSave) {
            if (isSimpleStart && debugService) {
                gameState.startNewGame('');
                debugService.simpleStart();
            } else {
                gameState.startNewGame('');
                simulationService.timeService.advanceDays(7);
                simulationService.startIntroSequence();
            }
        }

        // --- Bindings ---
        eventManager.bindEvents();
        
        if (hasSave || isSimpleStart) {
            uiManager.showGameContainer(); 
            
            // --- [[START]] MODIFICATION ---
            // Populate the news ticker *before* the first render.
            // This prevents the "first tap" re-render bug.
            newsTickerService.onLocationChange();
            // --- [[END]] MODIFICATION ---

            uiManager.render(gameState.getState());

            // --- [[START]] PHASE 4: INITIALIZATION POLISH ---
            // Background preload current ship image immediately.
            // This guarantees the high-res asset is fetched for the active ship
            // even if the lazy-loading intersection observer hasn't fired yet.
            const state = gameState.getState();
            if (state.player && state.player.activeShipId) {
                const src = AssetService.getShipImage(state.player.activeShipId, state.player.visualSeed);
                // Creating an Image object forces the browser to download and cache the file
                const img = new Image();
                img.src = src;
            }
            // --- [[END]] PHASE 4: INITIALIZATION POLISH ---
        }
        
        // --- [[START]] MODIFICATION ---
        // MOVED: The call to onLocationChange() was moved up to before the first render.
        // --- [[END]] MODIFICATION ---
        
        tutorialService.checkState({ type: 'SCREEN_LOAD', screenId: gameState.activeScreen });
    }
});