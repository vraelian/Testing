// js/main.js
import { GameState } from './services/GameState.js';
import { SimulationService } from './services/SimulationService.js';
import { UIManager } from './services/UIManager.js';
import { EventManager } from './services/EventManager.js';
import { TutorialService } from './services/TutorialService.js';
import { DebugService } from './services/DebugService.js';
import { Logger } from './services/LoggingService.js';

document.addEventListener('DOMContentLoaded', () => {
    const logger = new Logger();
    const startScreen = document.getElementById('start-screen');
    const startButton = document.getElementById('start-button');
    const loadingIndicator = document.getElementById('loading-indicator');
    const gameContainer = document.getElementById('game-container');
    const orientationLock = document.getElementById('orientation-lock');

    function checkOrientation() {
        if (window.innerHeight > window.innerWidth && window.innerWidth < 768) {
            orientationLock.style.display = 'flex';
            gameContainer.style.display = 'none';
        } else {
            orientationLock.style.display = 'none';
            if (gameContainer.classList.contains('initialized')) {
                gameContainer.style.display = 'block';
            }
        }
    }

    window.addEventListener('resize', checkOrientation);
    checkOrientation();

    // Prevent default touch behavior for buttons to avoid double-tap zoom
    document.querySelectorAll('button, .btn, [data-action]').forEach(el => {
        el.addEventListener('touchstart', e => e.preventDefault());
    });
    
    startButton.addEventListener('click', () => {
        startScreen.classList.add('fade-out');
        loadingIndicator.classList.remove('hidden');

        // Allow the fade-out animation to play
        setTimeout(() => {
            startScreen.classList.add('hidden');
            startGame();
        }, 1000);
    }, { once: true });

    let gameState, simulationService, uiManager, eventManager, tutorialService, debugService;
    let gameLoopInterval = null;

    function startGame() {
        gameState = new GameState();
        uiManager = new UIManager(logger);
        simulationService = new SimulationService(gameState, uiManager, logger);
        tutorialService = new TutorialService(gameState, uiManager, simulationService, logger);
        debugService = new DebugService(simulationService);
        eventManager = new EventManager(gameState, simulationService, uiManager, tutorialService, debugService, logger);
        
        // Inject missionService into UIManager after it's created in SimulationService
        uiManager.setMissionService(simulationService.missionService);
        
        eventManager.bindEvents();
        
        // Attempt to load a saved game. If none exists, initialize a new one.
        const loaded = gameState.load();
        if (!loaded) {
            simulationService.initializeNewGame();
        } else {
            // If loaded, ensure simulation service is aware of the state
            simulationService.syncWithGameState();
        }

        // Initial render
        uiManager.render(gameState.getState());

        // Subscribe to state changes for re-rendering
        gameState.subscribe((newState) => {
            uiManager.render(newState);
        });
        
        // Hide loading and show game
        loadingIndicator.classList.add('hidden');
        gameContainer.classList.remove('hidden');
        gameContainer.classList.add('initialized'); // Mark as initialized
        checkOrientation(); // Re-check orientation after game starts

        // Start the game loop
        gameLoopInterval = setInterval(() => {
            simulationService.tick();
        }, 1000);
    }
});