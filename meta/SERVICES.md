// meta/SERVICES.md

Service Responsibility & Dependency Matrix
Core Architecture
SimulationService acts as the central Facade. It is the only service that the EventManager talks to directly for complex game actions. It coordinates the specialized services below and acts as the bridge for the Event System 2.0, handling Debug Event injection and high-level resolution orchestration.

1. State Management
GameState (F009)
Responsibility: Single source of truth. Holds all mutable data (player, market, day, ships).
Key Behavior: Emits notifications to subscribers (UIManager) whenever setState is called.
Dependencies: None (Leaf node).

2. Game Logic Services
SimulationService (F011) [FACADE]
Responsibility: The core game engine Facade. Instantiates and coordinates all specialized services.
Key Behavior: Receives calls from the EventManager and delegates them to the appropriate domain service. Orchestrates multi-step flows like ship purchasing.
Dependencies: GameState, UIManager, Logger, MarketService, TimeService, TravelService, IntroService, PlayerActionService, MissionService, NewsTickerService, IntelService, SolStationService, AnimationService, ToastService, BankruptcyService, SystemStateService.

IntroService (F033)
Responsibility: Manages the entire new game introduction sequence, from initial lore modals to the final cinematic handoff to the core game loop.
Dependencies: GameState, UIManager, Logger, SimulationService.

PlayerActionService (F034)
Responsibility: Handles direct player commands: Buy/Sell Cargo, Buy/Sell Ships, Install Upgrades, Refuel/Repair.
Key Behavior: Validates actions against player credits/capacity, mutates GameState, logs transactions. Uses dynamic class multipliers for refueling costs and algorithmic pricing (`ShipPrice * 0.0001`) for repairs. Orchestrates fleet trading, storage mechanics, and dynamic fleet cost averaging.
Dependencies: GameState, UIManager, MissionService, MarketService, GameAttributes.

GameAttributes (F069)
Responsibility: The Upgrade Registry. Defines the metadata (cost, name, description) for all Ship Upgrades and Station Quirks. Acts as a lookup engine for modifiers.
Dependencies: None.

TravelService (F036)
Responsibility: Manages the travel loop. Calculates fuel/time costs, applies Convoy Taxes, and triggers random events.
Key Behavior: Directly oversees the orchestration of the Ship Destruction and Towing flows (utilizing the Web Animations API for cinematic presentation), aggressively terminates ephemeral `activeHotIntel` loops upon initiation, and acts as the lifecycle manager for Ship Status Effects (calculating duration ticks and triggering expirations per travel leg).
Dependencies: GameState, TimeService, RandomEventService, StoryEventService.

MarketService (F010)
Responsibility: Simulates the economy. Evolves prices daily, replenishes stock weekly.
Key Behavior: Implements "Delayed Supply" logic where player actions affect prices 7 days later. Governed by tuned `MARKET_PRESSURE_DECAY` and `MEAN_REVERSION_STRENGTH` rules. Applies System State weather modifiers and Station Quirks dynamically.
Dependencies: GameState, IntelService, AssetService, SystemStateService.

IntelService (F057)
Responsibility: Manages the "Local Data Broker" system. Generates, prices, and executes Intel Packets.
Dependencies: GameState.

TimeService (F035)
Responsibility: Advances the calendar and manages long-term progression.
Key Behavior: Triggers daily/weekly simulation ticks (Market, News, Weather). Manages the "3-Era Age Engine".
Dependencies: GameState, MarketService, BankruptcyService, SystemStateService, SolStationService.

MissionService (F018)
Responsibility: Coordinates the Mission System 2.0 lifecycle.
Key Behavior: Delegates logic to evaluators (`MissionTriggerEvaluator`, `MissionObjectiveEvaluator`, and `FlagEvaluator`). Facilitates massive bulk objectives by handling localized `depositMissionCargo` loops. Validates two-step progression, explicit license unlocks, and executes cross-system integration via `FlagMutators`.
Dependencies: GameState, MissionTriggerEvaluator, MissionObjectiveEvaluator, FlagEvaluator, FlagMutator.

SolStationService (F098)
Responsibility: Manages the logic for the Sol Station endgame engine, progression mechanics, and mathematical integrity.
Key Behavior: Manages progression from Level 1-50. Implements deferred universe calculations and view-model interpolation. Executes Just-In-Time (JIT) commits. Manages the Synthesis Pipeline for Antimatter conversion.
Dependencies: GameState, Logger.

ToastService (F106)
Responsibility: Manages the volatile notification queue and evaluates thresholds upon location arrival.
Dependencies: GameState, UIManager, SimulationService.

BankruptcyService (F107)
Responsibility: Evaluates financial health, manages distinct debt pools (Guild vs Syndicate), and executes punitive actions.
Key Behavior: Triggers Repo Events forcibly liquidating player assets to cover outstanding Syndicate Debt.
Dependencies: GameState, PlayerActionService, SimulationService, Logger.

SystemStateService (F108)
Responsibility: Manages procedural Economic Weather and systemic states across the solar system.
Key Behavior: Rolls conditions weekly that apply temporary, global modifiers to baseline market math and event generation.
Dependencies: GameState, TimeService, Logger.

3. Event System Services (Event 2.0 & Story Events)
RandomEventService
Responsibility: The high-level coordinator for the procedural random event system. Determines if an event occurs and which event is selected based on contextual weight and active System States.
Dependencies: GameState, ConditionEvaluator.

StoryEventService
Responsibility: The coordinator for the bespoke Story Event System. Evaluates explicit narrative conditions, triggers Event-Chains, and synchronizes with Mission Flags.
Dependencies: GameState, FlagEvaluator, FlagMutator.

ConditionEvaluator & FlagEvaluator
Responsibility: Stateless utility services that validate requirements. `ConditionEvaluator` handles inventory and standard state; `FlagEvaluator` specifically parses `storyFlags` for narrative triggers.
Dependencies: GameState (Read-only).

OutcomeResolver & FlagMutator
Responsibility: Handles the logic of the player's choice. `FlagMutator` explicitly guarantees safe, tracked mutation of cross-system narrative flags.
Dependencies: GameState, eventEffectResolver.

DynamicValueResolver
Responsibility: Calculates dynamic integer values for event effects based on game state context.
Dependencies: GameState (Read-only), DB.

eventEffectResolver
Responsibility: The "Applicator". Applies the specific state mutations defined by an event's outcome, including appending new Ship Status Effects to the active vessel.
Dependencies: GameState, SimulationService, DynamicValueResolver.

4. UI & Presentation Services
UIManager (F017) [FACADE]
Responsibility: The master "Switchboard". Instantiates and coordinates the 7 Domain Controllers (`UIModalEngine`, `UIHelpManager`, `UIMarketControl`, `UIMissionControl`, `UIHangarControl`, `UIEventControl`, `UISolStationControl`, `UIToastManager`). Responsible for the main render loop and proxying logic to delegates.
Dependencies: Logger, EffectsManager, TravelAnimationService, UIModalEngine, UIHelpManager, UIMarketControl, UIMissionControl, UIHangarControl, UIEventControl, UISolStationControl, UIToastManager.

Controllers (Delegates):
* UIModalEngine: Manages the modal queue, priority processing, and dismissal logic. Dynamically intercepts `options.portraitId` payloads to restructure modal headers and inject CSS sprite portraits via the global `PortraitRegistry`.
* UIHelpManager: Manages the Contextual Help Modal system, micro-pagination tracks, and swipe threshold logic.
* UIToastManager: Manages Universal Toast notifications, DOM injection, and animation timing.
* UIMarketControl: Manages Market screen rendering, state retention, and graph generation.
* UIMissionControl: Manages Mission data screens, sticky bar HUD, and Intel interactions.
* UIHangarControl: Manages Hangar carousels, ship card tooltips (including Ship Status Effects), and the Upgrade Installation flow.
* UIEventControl: "World" interactions (Maps, Lore, Procedural Events, Story Events, EULA, Launch Modals).
* UISolStationControl: Manages the Sol Station Dashboard, operational modes, cache grids, and Engineering Interface.

IntelMarketRenderer (F058)
Responsibility: Dedicated renderer for the dynamic "Intel Market" tab content.
Dependencies: IntelService.

NewsTickerService (F053)
Responsibility: Manages the scrolling text bar content.
Dependencies: GameState.

AssetService (F065)
Responsibility: Centralized path resolution and "Hydration" for visual assets.
Dependencies: AssetStorageService, assets_config.js.

TravelAnimationService (F044)
Responsibility: Manages the high-fidelity visual transition during travel via Canvas.
Dependencies: DB (Travel Visuals).

AnimationService (F060)
Responsibility: Provides a generic, promise-based utility (`playBlockingAnimation`) to run CSS animations and block further execution until completion. Expanded to support dynamic Ship Upgrade animations and Status Effect visualizations.
Dependencies: None.

5. Persistence Services
SaveStorageService (F101)
Responsibility: Manages game saves using a dual-write architecture and local file I/O operations.
Key Behavior: Serializes and stores `GameState` locally in IndexedDB while concurrently broadcasting to the iOS native layer via WebKit message handlers. Exposes `exportSave` and `importSave` for external file manipulation.
Dependencies: Native IndexedDB API, WebKit Message Handlers.

AssetStorageService (F070)
Responsibility: Low-level IndexedDB wrapper.
Dependencies: Native IndexedDB API.