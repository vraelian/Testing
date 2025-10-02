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
        // Services are created first, then dependencies are injected to avoid circular reference issues during instantiation.
        uiManager.setMissionService(missionService);
        uiManager.setSimulationService(simulationService); // Inject SimulationService into UIManager
        simulationService.setTutorialService(tutorialService);
        simulationService.setMissionService(missionService);
        missionService.setSimulationService(simulationService);
        const eventManager = new EventManager(gameState, simulationService, uiManager, tutorialService, debugService, Logger);
        
        // --- Link GameState to UIManager for automatic re-rendering ---
        gameState.subscribe(() => uiManager.render(gameState.getState()));

        // --- Game Initialization ---
        const hasSave = gameState.loadGame();
        if (!hasSave) {
            // If no save file is found, begin the new game intro sequence.
            gameState.startNewGame('');
            simulationService.timeService.advanceDays(7); // Seed market with 1 week of price history.
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

        // --- Mobile Viewport Fix ---
        // Force a repaint after a short delay to correct initial viewport height issues on mobile.
        setTimeout(() => {
            const gameContainer = document.getElementById('game-container');
            if (gameContainer) {
                gameContainer.style.display = 'none';
                void gameContainer.offsetHeight; // This line forces the browser to reflow the layout.
                gameContainer.style.display = ''; // Revert to the default display property.
            }
        }, 100);
    }
});