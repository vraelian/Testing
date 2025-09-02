/**
 * @file main.js
 * @description This is the main entry point for the Orbital Trading game. It handles the initial setup
 * and instantiation of all core services required to run the application.
 *
 * APPLICATION ARCHITECTURE:
 * -------------------------
 * 1.  **main.js**: (This file) Initializes the application. On game start, it instantiates all core services.
 * 2.  **GameState.js**: A centralized class that holds the entire mutable game state. It acts as the "single source of truth."
 * 3.  **SimulationService.js**: The core game engine. It contains all primary game logic for player actions (e.g., travel, trade), time progression, and event triggers. It is the only service that should directly modify the GameState.
 * 4.  **UIManager.js**: Responsible for rendering the entire UI based on the current GameState. It reads from the GameState but does not modify it.
 * 5.  **EventManager.js**: Listens for all user inputs (clicks, keys, etc.). It translates these inputs into calls to the SimulationService, acting as the bridge between the UI and the game logic.
 * 6.  **TutorialService.js**: A specialized service that hooks into the game loop to trigger and manage interactive tutorials.
 * 7.  **MissionService.js**: Manages the state and progression of player missions.
 *
 * DATA FLOW:
 * ------------
 * User Input -> EventManager -> SimulationService -> GameState (is mutated) -> UIManager (re-renders UI)
 */

// js/main.js
import { GameState } from './services/GameState.js';
import { SimulationService } from './services/SimulationService.js';
import { UIManager } from './services/UIManager.js';
import { EventManager } from './services/EventManager.js';
import { TutorialService } from './services/TutorialService.js';
import { MissionService } from './services/MissionService.js';
import { DebugService } from './services/DebugService.js';

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
        const uiManager = new UIManager();
        const missionService = new MissionService(gameState, uiManager);
        const simulationService = new SimulationService(gameState, uiManager);
        const tutorialService = new TutorialService(gameState, uiManager, simulationService, uiManager.navStructure);
        let debugService = null;

        if (DEV_MODE) {
            debugService = new DebugService(uiManager);
            debugService.init();
        }
        
        // --- Dependency Injection ---
        // Services are created first, then dependencies are injected to avoid circular reference issues during instantiation.
        uiManager.setMissionService(missionService);
        simulationService.setTutorialService(tutorialService);
        simulationService.setMissionService(missionService);
        missionService.setSimulationService(simulationService);
        const eventManager = new EventManager(gameState, simulationService, uiManager, tutorialService, debugService);
        
        // --- Link GameState to UIManager for automatic re-rendering ---
        gameState.subscribe(() => uiManager.render(gameState.getState()));

        // --- Game Initialization ---
        const hasSave = gameState.loadGame();
        if (!hasSave) {
            // If no save file is found, begin the new game intro sequence.
            gameState.startNewGame('');
            simulationService._advanceDays(7); // Seed market with 1 week of price history.
            simulationService.startIntroSequence();
        }

        // --- Bindings ---
        eventManager.bindEvents();
        
        // If a save file was loaded, the intro is skipped, and the game container is shown immediately.
        if (hasSave) {
            document.getElementById('game-container').classList.remove('hidden');
            uiManager.render(gameState.getState());
        }
        
        // Perform an initial check for any tutorials that should trigger on game load.
        tutorialService.checkState({ type: 'SCREEN_LOAD', screenId: gameState.activeScreen });
    }
});