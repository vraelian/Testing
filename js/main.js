/**
 * @file main.js
 * @description Main entry point for the Orbital Trading game.
 *
 * APPLICATION ARCHITECTURE:
 * -------------------------
 * 1.  **main.js**: Initializes the application. On game start, it instantiates all core services.
 * 2.  **GameState.js**: A centralized object holding the entire game state. It's the "single source of truth."
 * 3.  **SimulationService.js**: The core game engine. It contains all the primary game logic for player actions (travel, trade, etc.), time progression, and event triggers. It modifies the GameState.
 * 4.  **UIManager.js**: Responsible for rendering the entire UI based on the current GameState. It reads from the GameState but does not modify it.
 * 5.  **EventManager.js**: Listens for all user inputs (clicks, keys). It translates these inputs into calls to the SimulationService, acting as the bridge between the UI and the game logic.
 * 6.  **TutorialService.js**: A specialized service that hooks into the game loop to trigger and manage interactive tutorials.
 *
 * DATA FLOW:
 * ------------
 * User Input -> EventManager -> SimulationService -> GameState (mutated) -> UIManager (re-renders UI)
 */

// js/main.js
import { GameState } from './services/GameState.js';
import { SimulationService } from './services/SimulationService.js';
import { UIManager } from './services/UIManager.js';
import { EventManager } from './services/EventManager.js';
import { TutorialService } from './services/TutorialService.js';
import { MissionService } from './services/MissionService.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- App Initialization ---
    const splashScreen = document.getElementById('splash-screen');
    const startButton = document.getElementById('start-game-btn');

    startButton.addEventListener('click', () => {
        splashScreen.classList.add('modal-hiding');
        splashScreen.addEventListener('animationend', () => {
            splashScreen.style.display = 'none';
        }, { once: true });

        startGame();

    }, { once: true });

    function startGame() {
        // --- Service Instantiation ---
        const gameState = new GameState();
        const uiManager = new UIManager();
        const simulationService = new SimulationService(gameState, uiManager);
        const tutorialService = new TutorialService(gameState, uiManager, simulationService, uiManager.navStructure);
        const missionService = new MissionService(gameState, uiManager);
        
        // Now that all services are created, inject dependencies
        simulationService.setTutorialService(tutorialService);
        simulationService.setMissionService(missionService);
        const eventManager = new EventManager(gameState, simulationService, uiManager, tutorialService);

        // --- Game Initialization ---
        const hasSave = gameState.loadGame();
        if (!hasSave) {
            gameState.startNewGame('');
            // The intro sequence is now responsible for revealing the game container and the first render.
            simulationService.startIntroSequence();
        }

        // --- Bindings ---
        eventManager.bindEvents();
        
        // Initial render is deferred until the intro sequence reveals the game container
        if (hasSave) {
            document.getElementById('game-container').classList.remove('hidden');
            uiManager.render(gameState.getState());
        }
        tutorialService.checkState({ type: 'SCREEN_LOAD', screenId: gameState.activeScreen });
    }
});