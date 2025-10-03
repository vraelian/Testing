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

document.addEventListener('DOMContentLoaded', () => {
    // --- App Initialization ---
    const splashScreen = document.getElementById('splash-screen');
    const startButton = document.getElementById('start-game-btn');
    const DEV_MODE = true; // Guard for development features.

    // Set up the main start button to initialize and begin the game.
    startButton.addEventListener('click', () => {
        // Fade out the splash screen and then start the game logic.
        splashScreen.classList.add('modal-hiding');
        splashScreen.addEventListener('animationend', () => {
            splashScreen.style.display = 'none';
        }, { once: true });

        startGame();

    }, { once: true });

    /**
     * Instantiates all core game services, establishes their dependencies,
     * loads saved data or starts a new game, and binds all necessary event listeners.
     */
    function startGame() {
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
            gameState.startNewGame('');
            simulationService.timeService.advanceDays(7);
            simulationService.startIntroSequence();
        }

        // --- Bindings ---
        eventManager.bindEvents();
        
        if (hasSave) {
            uiManager.showGameContainer(); // Use the UIManager method to show the container
            uiManager.render(gameState.getState());
        }
        
        tutorialService.checkState({ type: 'SCREEN_LOAD', screenId: gameState.activeScreen });
    }
});