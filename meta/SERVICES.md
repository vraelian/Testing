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

Dependencies: GameState, UIManager, Logger, MarketService, TimeService, TravelService, IntroService, PlayerActionService, MissionService, NewsTickerService, IntelService, SolStationService, AnimationService, ToastService.

IntroService (F033)

Responsibility: Manages the entire new game introduction sequence, from initial lore modals to the final cinematic handoff to the core game loop.

Key Behavior: Mutates the player's starting state, debt, and handles bespoke UI transitions bypassing standard navigation logic.

Dependencies: GameState, UIManager, Logger, SimulationService.

PlayerActionService (F034)

Responsibility: Handles direct player commands: Buy/Sell Cargo, Buy/Sell Ships, Install Upgrades, Refuel/Repair.

Key Behavior: Validates actions against player credits/capacity, mutates GameState, logs transactions. Uses MOD_FUEL_PRICE for refueling costs. Orchestrates fleet trading, storage mechanics, and dynamic fleet cost averaging.

Dependencies: GameState, UIManager, MissionService, MarketService, GameAttributes.

GameAttributes (F069)

Responsibility: The Upgrade Registry. Defines the metadata (cost, name, description) for all Ship Upgrades and Station Quirks. Acts as a lookup engine for modifiers.

Key Behavior: Mathematically calculates the dynamic Hybrid Upgrade Cost (`Fixed Base + (ShipValue * TierMultiplier)`) and installation fees. Distinguishes between MOD_FUEL_BURN (Travel) and MOD_FUEL_PRICE (Station).

Dependencies: None.

TravelService (F036)

Responsibility: Manages the travel loop. Calculates fuel/time costs, applies Convoy Taxes, and triggers random events.

Key Behavior:
* Uses GameState.TRAVEL_DATA for distances.
* Calculates and deducts the 'Convoy Tax' resource scaling based on active fleet size.
* Pauses travel for event resolution, including Blockade events.
* Validates ship integrity (Hull destruction, Fuel depletion) post-event before resuming or aborting travel.
* Consumable Logic: Handles the consumption of "Folded Space Drives" to execute instant travel via the `useFoldedDrive` argument.

Dependencies: GameState, TimeService, RandomEventService.

MarketService (F010)

Responsibility: Simulates the economy. Evolves prices daily, replenishes stock weekly.

Key Behavior: Implements "Delayed Supply" logic where player actions affect prices 7 days later. Governed by tuned `MARKET_PRESSURE_DECAY` and `MEAN_REVERSION_STRENGTH` rules. Triggers asset hydration when new ships are spawned.

Dependencies: GameState, IntelService, AssetService.

IntelService (F057)

Responsibility: Manages the "Local Data Broker" system. Generates, prices, and executes Intel Packets.

Key Behavior: Creates temporary activeIntelDeal objects in GameState that override market prices.

Dependencies: GameState.

TimeService (F035)

Responsibility: Advances the calendar and manages long-term progression.

Key Behavior:
* Triggers daily/weekly simulation ticks (Market, News).
* Manages the "3-Era Age Engine", applying procedural stat bonuses and world modifiers based on player age.
* Checks for debt interest, Intel expiration, and loan garnishment.

Dependencies: GameState, MarketService.

MissionService (F018)

Responsibility: Coordinators the Mission System 2.0 lifecycle. Delegates logic to evaluators.

Key Behavior: 
* Orchestrates `MissionTriggerEvaluator` to check prerequisites for available missions.
* Orchestrates `MissionObjectiveEvaluator` to update progress on active missions.
* Manages the "Terminal" vs "Log" state flow and completion logic.

Dependencies: GameState, MissionTriggerEvaluator, MissionObjectiveEvaluator.

SolStationService (F098)

Responsibility: Manages the logic for the Sol Station endgame engine, progression mechanics, and mathematical integrity.

Key Behavior:
* Manages progression from Level 1-50.
* Implements deferred universe calculations and view-model interpolation to handle rapid ticking without layout thrashing.
* Executes Just-In-Time (JIT) commits to accurately flush deferred state variables into the persistent GameState.

Dependencies: GameState, Logger.

ToastService (F106)

Responsibility: Manages the volatile notification queue and evaluates thresholds upon location arrival.

Key Behavior: Checks state thresholds (financial, intel, missions) post-travel, populates the queue, sorts by priority, and culls excess alerts before handing them to the UI.

Dependencies: GameState, UIManager, SimulationService.

3. Event System Services (Event 2.0)
RandomEventService

Responsibility: The high-level coordinator for the random event system. Determines if an event occurs and which event is selected.

Key Behavior: Filters the RANDOM_EVENTS registry based on current context (location, tags) and relative weights. Passes the selected event to the UI for display.

Dependencies: GameState, ConditionEvaluator.

ConditionEvaluator

Responsibility: A stateless utility service that validates requirements.

Key Behavior: Parses the requirements array of an event or choice. Returns true or false based on the current GameState.

Dependencies: GameState (Read-only).

OutcomeResolver

Responsibility: Handles the logic of the player's choice.

Key Behavior: Processes the resolution block of a selected choice. Determines the final outcome using Deterministic logic or Weighted RNG. Passes the result to eventEffectResolver for application.

Dependencies: GameState, eventEffectResolver.

DynamicValueResolver

Responsibility: Calculates dynamic integer values for event effects based on game state context.

Key Behavior: Resolves abstract value definitions into concrete numbers for rewards/penalties. Calculates percentage-based liquid wealth (`PLAYER_CREDITS`) scaling for event penalties.

Dependencies: GameState (Read-only), DB.

eventEffectResolver

Responsibility: The "Applicator". Applies the specific state mutations defined by an event's outcome.

Key Behavior: Routes effect types to specific handler functions. Mutates GameState or pendingTravel accordingly. Pure state mutation only.

Dependencies: GameState, SimulationService, DynamicValueResolver.

4. UI & Presentation Services
UIManager (F017) [FACADE]

Responsibility: The master "Switchboard". Instantiates and coordinates the Domain Controllers. Handles the main render loop.

Key Behavior: Proxies requests from external services to the appropriate Controller. Manages Generic Tooltips and the News Ticker.

Dependencies: UIModalEngine, UIHelpManager, UIMarketControl, UIMissionControl, UIHangarControl, UIEventControl, UISolStationControl, UIToastManager.

Controllers (Delegates):
* UIModalEngine: Manages the modal queue, priority processing, and dismissal logic. Dynamically intercepts `options.portraitId` payloads to restructure modal headers and inject CSS sprite portraits via the global `PortraitRegistry`.
* UIHelpManager: Manages the Contextual Help Modal system, micro-pagination tracks, and swipe threshold logic.
* UIToastManager: Manages Universal Toast notifications, DOM injection, and animation timing.
* UIMarketControl: Manages Market screen rendering, state retention, and graph generation.
* UIMissionControl: Manages Mission data screens, sticky bar HUD, and Intel interactions.
* UIHangarControl: Manages Hangar carousels, ship details, and the Upgrade Installation flow.
* UIEventControl: "World" interactions (Maps, Lore, Random Events, EULA, Launch Modals).
* UISolStationControl: Manages the Sol Station Dashboard, operational modes, cache grids, and Engineering Interface.

IntelMarketRenderer (F058)

Responsibility: Dedicated renderer for the dynamic "Intel Market" tab content.

Dependencies: IntelService.

NewsTickerService (F053)

Responsibility: Manages the scrolling text bar content.

Key Behavior: Implements V2 logic with dynamic message types (SYSTEM, INTEL, FLAVOR, ALERT, STORY, STATUS) and live data injection.

Dependencies: GameState.

AssetService (F065)

Responsibility: Centralized path resolution and "Hydration" for visual assets.

Dependencies: AssetStorageService, assets_config.js.

TravelAnimationService (F044)

Responsibility: Manages the high-fidelity visual transition during travel via Canvas.

Dependencies: DB (Travel Visuals).

AnimationService (F060)

Responsibility: Provides a generic, promise-based utility (`playBlockingAnimation`) to run CSS animations and block further execution until completion. Used for ship buy/sell transitions.

Dependencies: None.

5. Persistence Services
SaveStorageService (F101)

Responsibility: Manages game saves using a dual-write architecture for indestructible persistence.

Key Behavior: Serializes and stores `GameState` locally in IndexedDB (OrbitalSavesDB) while concurrently broadcasting to the iOS native layer (Swift UserDefaults) via WebKit message handlers. Prioritizes iOS native saves during hydration to silently heal wiped IndexedDB data.

Dependencies: Native IndexedDB API, WebKit Message Handlers.

AssetStorageService (F070)

Responsibility: Low-level IndexedDB wrapper.

Key Behavior: Manages the OrbitalAssetsDB. Stores raw Blob data to prevent iOS cache eviction.

Dependencies: Native IndexedDB API.

6. Input & Event Handling
EventManager (F015): The root listener. Binds global click/touch events.

ActionClickHandler (F039): Routes data-action clicks to services. Handles Upgrade Installation, ship cycling, and Travel initiation.

HoldEventHandler (F041): Manages "press-and-hold" for Refuel/Repair using Pointer Events.

CarouselEventHandler (F042): Manages swipe/drag for the Hangar.

MarketEventHandler (F040): Manages the buy/sell sliders on market cards.

TooltipHandler (F043): Manages hover states and popups for graphs and attribute pills.

7. Effects
EffectsManager.js: Manages the queueing and execution of visual effects.

BaseEffect.js: The abstract base class for all visual effects.

8. Debug & Automation
DebugService.js: Manages the debug panel (lil-gui), synchronizing its UI controls with the GameState and providing cheat/test functionalities.

bot/AutomatedPlayerService.js: Contains the AutomatedPlayer class, a state-machine-driven bot designed to stress-test the economy. Bypasses the input layer.

9. Static Data Files (js/data/)
database.js: Aggregates and exports static game data.
ship_database.js: Defines the static data for all player-tradable ships.
assets_config.js: Defines configuration for ship asset variants.
characters.js: Defines the PortraitRegistry mapping logical UI IDs to exact CSS sprite sheet pixel coordinates, and the overarching CharacterDatabase profiles.
constants.js: Defines widely used constant values and enums.
items.js: Defines the registry of Consumable Items.
age_events.js: Defines static data for narrative events triggered by progression.
events.js: (Facade) Aggregates all event categories.
events_traffic.js: Encounters & Distress signals.
events_entropy.js: System failures & maintenance issues.
events_hazards.js: Environmental threats.
events_bureaucracy.js: Customs, fines, and inspections.
events_logistics.js: Cargo spoilage & storage issues.
events_salvage.js: Derelict recovery & looting.
events_opportunity.js: Trade deals & windfalls.
events_story.js: Unique narrative encounters.
missions.js: Defines static data for all player missions.
helpRegistry.js: Defines static HTML string payloads organized by context IDs.
flavorAds.js: Defines static, location-specific flavor text ads.
intelMessages.js: Defines message templates for free and purchased market intel.
intelContent.js: Defines the "Sample" and "Details" message pairs.
eulaContent.js: Defines the static HTML content for the EULA modal.
lore/loreRegistry.js: (Facade) Aggregates all lore modules.
lore/lore_broadstrokes.js: Defines the base lore content.
officers.js: Defines the registry of Sol Station Directorate officers.