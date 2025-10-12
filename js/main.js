// js/main.js
import { GameState } from './services/GameState.js';
import { SimulationService } from './services/SimulationService.js';
import { UIManager } from './services/UIManager.js';
import { EventManager } from './services/EventManager.js';
import { TutorialService } from './services/TutorialService.js';
import { MissionService } from './services/MissionService.js';
import { DebugService } from './services/DebugService.js';
import { Logger } from './services/LoggingService.js';

// Import the new service shells
import { IntroService } from './services/game/IntroService.js';
import { PlayerActionService } from './services/player/PlayerActionService.js';
import { TimeService } from './services/world/TimeService.js';
import { TravelService } from './services/world/TravelService.js';

/**
 * Sets the --app-height CSS variable to the actual window inner height.
 * This is the definitive fix for the mobile viewport height bug on iOS.
 */
const setAppHeight = () => {
    // Use the visualViewport height if available, as it's more reliable on mobile.
    const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty('--app-height', `${height}px`);
};

document.addEventListener('DOMContentLoaded', () => {
    // --- App Initialization ---
    const splashScreen = document.getElementById('splash-screen');
    const startButton = document.getElementById('start-game-btn');
    const debugStartButton = document.getElementById('debug-start-btn');
    const DEV_MODE = true; // Guard for development features.

    // Set the app height on initial load and whenever the viewport changes.
    setAppHeight();
    
    // The visualViewport API is a more reliable way to track viewport changes on mobile.
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', setAppHeight);
        window.visualViewport.addEventListener('scroll', setAppHeight);
    } else {
        window.addEventListener('resize', setAppHeight);
    }


    // Set up the main start button to initialize and begin the game.
    startButton.addEventListener('click', () => {
        // Fade out the splash screen and then start the game logic.
        splashScreen.classList.add('splash-screen-hiding');
        splashScreen.addEventListener('animationend', () => {
            splashScreen.style.display = 'none';
            startGame();
        }, { once: true });

    }, { once: true });
    
    debugStartButton.addEventListener('click', () => {
        // Fade out the splash screen and then start the game logic.
        splashScreen.classList.add('splash-screen-hiding');
        splashScreen.addEventListener('animationend', () => {
            splashScreen.style.display = 'none';
            startGame(true); // Pass flag for simple start
        }, { once: true });
    });

    /**
     * Instantiates all core game services, establishes their dependencies,
     * loads saved data or starts a new game, and binds all necessary event listeners.
     */
    function startGame(isSimpleStart = false) {
        // --- Service Instantiation ---
        const gameState = new GameState();
        const uiManager = new UIManager(Logger);
        const missionService = new MissionService(gameState, uiManager, Logger);
        const simulationService = new SimulationService(gameState, uiManager, Logger);
        const tutorialService = new TutorialService(gameState, uiManager, simulationService, uiManager.navStructure, Logger);
        let debugService = null;

        if (DEV_MODE) {
            debugService = new DebugService(gameState, simulationService, uiManager, Logger);
            debugService.init();
        }
        
        // --- Dependency Injection ---
        uiManager.setMissionService(missionService);
        uiManager.setSimulationService(simulationService);
        simulationService.setTutorialService(tutorialService);
        simulationService.setMissionService(missionService);
        missionService.setSimulationService(simulationService);
        const eventManager = new EventManager(gameState, simulationService, uiManager, tutorialService, debugService, Logger);
        
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
            uiManager.render(gameState.getState());
        }
        
        tutorialService.checkState({ type: 'SCREEN_LOAD', screenId: gameState.activeScreen });
    }
});