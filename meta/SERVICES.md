# Orbital Trading - Service Responsibilities
**Version:** 1.0
**Source:** `js/services/` directory structure

This document defines the single responsibility of each service in the application.

---

### Core Services

- **`GameState.js`**: Manages the central `state` object, provides load/save/reset functionality, and allows other services to subscribe to state changes.
- **`SimulationService.js`**: Acts as the main game loop "heartbeat" (facade), triggering simulation ticks for all other time-based services (Time, Market).
- **`EventManager.js`**: Provides a global event bus for decoupled communication, allowing services to publish events and register listeners.
- **`UIManager.js`**: Manages all DOM manipulation, screen rendering, UI state (modals, toasts), and data-binding updates based on GameState changes.
- **`LoggingService.js`**: Provides a centralized service for logging debug, info, warn, and error messages to the console.
- **`DebugService.js`**: Manages the debug panel, synchronizing its UI controls with the `GameState.debug` object and applying CSS variable changes.

### Game Logic Services

#### Player
- **`PlayerActionService.js`**: Contains all business logic for player-initiated actions, such as buying, selling, and transferring cargo.

#### World
- **`TimeService.js`**: Manages the in-game clock, advancing the `GameState.time.currentDate` based on simulation ticks.
- **`TravelService.js`**: Handles the business logic for player travel, initiating trips, and calculating arrival times.

#### Simulation
- **`MarketService.js`**: Simulates the galactic economy, updating prices and inventory levels for all commodities in all systems based on game time and player actions.
- **`MissionService.js`**: Manages the state of player missions, checking objective progress and updating `GameState.missions` when criteria are met.

#### Game
- **`IntroService.js`**: Manages the logic for the one-time introductory sequence and splash screen.

### UI/Event Handlers

- **`ActionClickHandler.js`**: Attaches and manages the primary click event listener for the entire app, delegating actions based on `data-action` attributes.
- **`MarketEventHandler.js`**: Manages complex UI interactions specific to the Market screen, such as quantity slider logic.
- **`HoldEventHandler.js`**: Implements the "click-and-hold" functionality for buttons (e.g., market quantity +/-).
- **`CarouselEventHandler.js`**: Manages the swipe/drag logic for carousel components (e.g., Hangar ship selector).
- **`TooltipHandler.js`**: Attaches and manages global `mouseover`/`mouseout` listeners to show and hide tooltips based on `data-tooltip` attributes.
- **`TravelAnimationService.js`**: Controls the visual "travel animation" (fade out/in, starfield) when the player travels.

### Event Effects
- **`eventEffectResolver.js`**: A central service that applies or removes the game logic effects of a world event.
- **`effectAdriftPassenger.js`**: The specific implementation for the "Adrift Passenger" event.
- **`effectSpaceRace.js`**: The specific implementation for the "Space Race" event.

### Effects
- **`EffectsManager.js`**: ManTESTS (particle effects, etc).
- **`BaseEffect.js`**: The base class for all visual effects.