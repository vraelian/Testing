# Orbital Trading - Service Responsibilities
**Version:** 2.0
**Source:** `js/services/` directory structure and `js/data/` structure

This document defines the single responsibility of each service in the application and notes key static data dependencies.

---

### Core Services

-   **`GameState.js`**: Manages the central `state` object, provides load/save/reset functionality, and allows other services to subscribe to state changes.
-   **`SimulationService.js`**: Acts as the main game loop "heartbeat" (facade), triggering simulation ticks for all other time-based services (Time, Market) and delegating player actions and UI messages (e.g., to the `NewsTickerService`).
-   **`EventManager.js`**: Instantiates specialized handlers, binds global listeners, and delegates event handling to the appropriate module. Now includes explicit drag-suppression for interactive targets.
-   **`UIManager.js`**: Manages all DOM manipulation, screen rendering, UI state (modals, toasts), and data-binding updates based on GameState changes. Supports dynamic vertical positioning (right/top) for responsive tooltips.
-   **`LoggingService.js`**: Provides a centralized service for logging debug, info, warn, and error messages to the console.
-   **`NewsTickerService.js`**: Manages the dynamic message queue for the scrolling news ticker. Handles different message types (SYSTEM, INTEL, FLAVOR, ALERT, STATUS), rebuilds the queue on location change, and pulls data from various sources. Is a primary driver for the Intel system. **Uses:** `js/data/flavorAds.js`, `js/data/intelMessages.js`, `js/data/database.js`.

### Game Logic Services

#### Player

-   **`PlayerActionService.js`**: Contains all business logic for player-initiated actions with immediate effects (buy/sell items/ships, use services).

#### World

-   **`TimeService.js`**: Manages the in-game clock, advancing the `GameState.day` and triggering time-based events (birthdays, interest, market updates) via the `SimulationService` facade. Calls `IntelService.generateIntelRefresh()` and checks for `activeIntelDeal` expiration. **Uses:** `js/data/age_events.js`.
-   **`TravelService.js`**: Handles the business logic for player travel, initiating trips, calculating costs/time, and managing random events. **Uses:** `js/data/events.js` (via `eventEffectResolver`).

#### Simulation

-   **`MarketService.js`**: Simulates the galactic economy. Manages all price evolution (mean reversion, volatility) and inventory replenishment. It implements a "Delayed Supply" model where player actions (buy/sell) change stock levels, which in turn creates a single, powerful `availabilityEffect` on price that is *delayed by 7 days* to prevent abuse. Checks for an `activeIntelDeal` override before calculating its normal prices.
-   **`IntelService.js`**: The "brain" of the Intel Market system. Manages the entire lifecycle of intel: procedural generation, persistence, dynamic pricing, and the core purchase logic. **Uses:** `js/data/intelContent.js`.
-   **`MissionService.js`**: Manages the state of player missions, checking objective progress and updating `GameState.missions` when criteria are met. **Uses:** `js/data/missions.js`.

#### Game & Assets

-   **`IntroService.js`**: Manages the logic for the one-time introductory sequence and splash screen.
-   **`TutorialService.js`**: Controls the flow of the tutorial, managing steps and dispatching tutorial-specific UI events. **Uses:** `js/data/tutorials.js`.
-   **`AssetService.js`**: Centralizes the logic for generating dynamic asset paths (specifically for ships). Implements the "Modulo Variant" system to deterministically select visual variants (A, B, C...) based on the player's `visualSeed`. **Uses:** `js/data/assets_config.js`.

### UI/Event Handlers

-   **`ActionClickHandler.js`**: Handles general `data-action` click events (navigation, simple modals, basic state changes). Now passes ship attribute management to `TooltipHandler`.
-   **`MarketEventHandler.js`**: Manages complex UI interactions specific to the Market screen commodity cards.
-   **`HoldEventHandler.js`**: Implements the "click-and-hold" functionality for buttons (e.g., refuel/repair, market quantity steppers).
-   **`CarouselEventHandler.js`**: Manages the swipe/drag/wheel logic for carousel components (e.g., Hangar ship selector).
-   **`TooltipHandler.js`**: Attaches and manages global listeners to show/hide tooltips, price graphs, etc., on hover/click. Now includes ship attribute lifecycle management and stateful toggle logic.
-   **`TravelAnimationService.js`**: Controls the visual "travel animation" modal when the player travels.

### UI/Renderers

-   **`IntelMarketRenderer.js`**: A new, dedicated renderer. Its sole job is to be called by UIManager to dynamically build the HTML for the content of the "Intel Market" tab.

### Event Effects

-   **`eventEffectResolver.js`**: A central service that applies the game logic effects of a random event outcome by routing to specific handlers. **Uses:** `js/data/events.js`.
-   **`effectAdriftPassenger.js`**: The specific implementation for the "Adrift Passenger" event outcome.
-   **`effectSpaceRace.js`**: The specific implementation for the "Space Race" event outcome.

### Effects

-   **`EffectsManager.js`**: Manages the queueing and execution of visual effects (particle effects, UI animations, etc.).
-   **`BaseEffect.js`**: The abstract base class for all visual effects.

### Debug & Automation

-   **`DebugService.js`**: Manages the debug panel (`lil-gui`), synchronizing its UI controls with the `GameState` and providing cheat/test functionalities. Now includes tools for asset validation (`cycleShipPics`, `boardShip`) and Tutorial Tuning.
-   **`bot/AutomatedPlayerService.js`**: Contains the `AutomatedPlayer` class, a state-machine-driven bot designed to stress-test the economy by simulating an advanced, market-manipulating player.

---

### Static Data Files (`js/data/`)

-   **`database.js`**: Aggregates and exports static game data imported from other modules (constants, commodities, ships, markets, etc.).
-   **`ship_database.js`**: Defines the static data for all player-tradable ships, including stats, lore, and pricing. This is imported by `database.js`.
-   **`assets_config.js`**: Defines configuration for ship asset variants (e.g., how many variants exist for each ship ID).
-   **`constants.js`**: Defines widely used constant values and enums (IDs, game rules).
-   **`age_events.js`**: Defines static data for narrative events triggered by game progression (e.g., player age, wealth).
-   **`events.js`**: Defines static data for random events encountered during travel.
-   **`missions.js`**: Defines static data for all player missions.
-   **`tutorials.js`**: Defines static data for all tutorial batches and steps.
-   **`flavorAds.js`**: Defines static, location-specific flavor text ads for the news ticker.
-   **`intelMessages.js`**: Defines message templates for free and purchased market intel displayed on the news ticker.
-   **`intelContent.js`**: Defines the "Sample" and "Details" message pairs for the purchasable Intel Packets in the Intel Market.
-   **`eulaContent.js`**: Defines the static HTML content for the End-User License Agreement displayed in the modal.