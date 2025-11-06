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

/**
 * Sets the --app-height CSS variable to the actual window inner height.
 * This is the definitive fix for the mobile viewport height bug on iOS.
 */
/* // MODIFIED: This function actively prevents viewport-fit=cover from working correctly
   // by setting the height to the safe-area height, not the full screen height.
   // The CSS 'env(safe-area-inset-top)' variable is the correct way to handle the notch.
const setAppHeight = () => {
    // Use the visualViewport height if available, as it's more reliable on mobile.
    const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty('--app-height', `${height}px`);
};
*/

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
    // setAppHeight(); // MODIFIED: Disabled
    
    // The visualViewport API is a more reliable way to track viewport changes on mobile.
    /* // MODIFIED: Disabled
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', setAppHeight);
        window.visualViewport.addEventListener('scroll', setAppHeight);
    } else {
        window.addEventListener('resize', setAppHeight);
    }
    */


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
        }
        
        // --- [[START]] MODIFICATION ---
        // MOVED: The call to onLocationChange() was moved up to before the first render.
        // --- [[END]] MODIFICATION ---
        
        tutorialService.checkState({ type: 'SCREEN_LOAD', screenId: gameState.activeScreen });
    }
});