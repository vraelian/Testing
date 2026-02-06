Service Responsibility & Dependency Matrix
Core Architecture
SimulationService acts as the central Facade. It is the only service that the EventManager talks to directly for complex game actions. It coordinates the specialized services below and acts as the bridge for the Event System 2.0, handling Debug Event injection and high-level resolution orchestration.

1. State Management
GameState (F009)

Responsibility: Single source of truth. Holds all mutable data (player, market, day, ships).

Key Behavior: Emits notifications to subscribers (UIManager) whenever setState is called.

Dependencies: None (Leaf node).

2. Game Logic Services
PlayerActionService (F034)

Responsibility: Handles direct player commands: Buy/Sell Cargo, Buy/Sell Ships, Install Upgrades, Refuel/Repair.

Key Behavior: Validates actions against player credits/capacity, mutates GameState, logs transactions. Uses MOD_FUEL_PRICE for refueling costs.

Dependencies: GameState, UIManager, MissionService, MarketService, GameAttributes.

GameAttributes (F069)

Responsibility: The Upgrade Registry. Defines the metadata (cost, name, description) for all Ship Upgrades and Station Quirks. Acts as a lookup engine for modifiers.

Key Behavior: Provides definition objects for Upgrade IDs. Distinguishes between MOD_FUEL_BURN (Travel) and MOD_FUEL_PRICE (Station).

Dependencies: None.

TravelService (F036)

Responsibility: Manages the travel loop. Calculates fuel/time costs, triggers random events.

Key Behavior:
* Uses GameState.TRAVEL_DATA for distances.
* Pauses travel for event resolution.
* Validates ship integrity (Hull destruction, Fuel depletion) post-event before resuming or aborting travel.
* **Consumable Logic:** Handles the consumption of "Folded Space Drives" to execute instant travel (0 days, 0 fuel) via the `useFoldedDrive` argument.

Dependencies: GameState, TimeService, RandomEventService.

MarketService (F010)

Responsibility: Simulates the economy. Evolves prices daily, replenishes stock weekly.

Key Behavior: Implements "Delayed Supply" logic where player actions affect prices 7 days later. Triggers asset hydration when new ships are spawned in shipyards.

Dependencies: GameState, IntelService, AssetService.

IntelService (F057)

Responsibility: Manages the "Local Data Broker" system. Generates, prices, and executes Intel Packets.

Key Behavior: Creates temporary activeIntelDeal objects in GameState that override market prices.

Dependencies: GameState.

TimeService (F035)

Responsibility: Advances the calendar and manages long-term progression.

Key Behavior:

Triggers daily/weekly simulation ticks (Market, News).

Manages the "3-Era Age Engine", applying procedural stat bonuses and world modifiers based on player age.

Checks for debt interest, Intel expiration, and loan garnishment.

Dependencies: GameState, MarketService.

MissionService (F018)

Responsibility: procedural mission generation and tracking.

Key Behavior: Checks prerequisites (wealth, location) to offer missions. Tracks completion status.

Dependencies: GameState.

TutorialService (F016)

Responsibility: Manages the state and flow of interactive tutorials (Logic Layer).

Key Behavior:

Checks game state/actions against triggers defined in tutorials.js.

Manages activeBatchId and activeStepId.

Enforces navLock in the GameState to restrict player movement during critical lessons.

Delegates visual rendering to UIManager -> UITutorialManager.

Dependencies: GameState, UIManager, SimulationService, js/data/tutorials.js.

3. Event System Services (Event 2.0)
RandomEventService

Responsibility: The high-level coordinator for the random event system. Determines if an event occurs and which event is selected.

Key Behavior: Filters the RANDOM_EVENTS registry based on current context (location, tags) and relative weights. Passes the selected event to the UI for display.

Dependencies: GameState, ConditionEvaluator.

ConditionEvaluator

Responsibility: A stateless utility service that validates requirements.

Key Behavior: Parses the requirements array of an event or choice (e.g., "Has Item: Water Ice > 5", "Has Perk: Navigator"). Returns true or false based on the current GameState.

Dependencies: GameState (Read-only).

OutcomeResolver

Responsibility: Handles the logic of the player's choice.

Key Behavior: Processes the resolution block of a selected choice. Determines the final outcome using Deterministic logic or Weighted RNG. Passes the result to eventEffectResolver for application.

Dependencies: GameState, eventEffectResolver.

DynamicValueResolver

Responsibility: Calculates dynamic integer values for event effects based on game state context.

Key Behavior: Resolves abstract value definitions (e.g., "Scale with WEALTH_TIER" or "Scale with MAX_FUEL") into concrete numbers for rewards/penalties.

Dependencies: GameState (Read-only), DB.

eventEffectResolver

Responsibility: The "Applicator". Applies the specific state mutations defined by an event's outcome.

Key Behavior: Routes effect types (e.g., MODIFY_FUEL, REMOVE_ITEM) to specific handler functions. Mutates GameState or pendingTravel accordingly. Pure state mutation only; does not handle game-over consequences.

Dependencies: GameState, SimulationService, DynamicValueResolver.

4. UI & Presentation Services
UIManager (F017) [FACADE]

Responsibility: The master "Switchboard". Instantiates and coordinates the 7 Domain Controllers. Handles the main render loop and navigation bars.

Key Behavior: Proxies requests from external services (like ActionClickHandler) to the appropriate Controller. Manages Generic Tooltips and the News Ticker.

Dependencies: UIModalEngine, UITutorialManager, UIMarketControl, UIMissionControl, UIHangarControl, UIEventControl, UISolStationControl.

Controllers (Delegates):

UIModalEngine: Manages the modal queue, priority processing, and dismissal logic.

UITutorialManager: Manages the "Presentation Layer" of tutorials. Handles Popper.js instantiation, positioning of toast elements relative to targets, and rendering of SVG highlight overlays.

UIMarketControl: Manages Market screen rendering, state retention, and graph generation.

UIMissionControl: Manages Mission data screens, sticky bar HUD, and Intel interactions.

UIHangarControl: Manages Hangar carousels, ship details, and the Upgrade Installation flow.

UIEventControl: "World" interactions (Maps, Lore, Random Events, EULA). Now manages the Launch Modal logic for Consumables (Folded Space).

UISolStationControl: Manages the Sol Station Dashboard, operational mode switching, cache grids, and the in-modal Officer Roster sub-view.

IntelMarketRenderer (F058)

Responsibility: Dedicated renderer for the dynamic "Intel Market" tab content (Called by UIMissionControl).

Dependencies: IntelService.

NewsTickerService (F053)

Responsibility: Manages the scrolling text bar content.

Key Behavior: Implements V2 logic with dynamic message types (SYSTEM, INTEL, FLAVOR, ALERT, STORY, STATUS) and live data injection.

Dependencies: GameState.

AssetService (F065)

Responsibility: Centralized path resolution and "Hydration" for visual assets.

Dependencies: AssetStorageService, assets_config.js.

AssetStorageService (F070)

Responsibility: Low-level IndexedDB wrapper.

Key Behavior: Manages the OrbitalAssetsDB. Stores raw Blob data to prevent iOS cache eviction.

Dependencies: None (Native IndexedDB API).

TravelAnimationService.js

Responsibility: Manages the high-fidelity visual transition during travel via Canvas.

Dependencies: DB (Travel Visuals).

5. Input & Event Handling
EventManager (F015): The root listener. Binds global click/touch events.

ActionClickHandler (F039): Routes data-action clicks to services. Handles Upgrade Installation and Travel initiation (including Consumable flags).

HoldEventHandler (F041): Manages "press-and-hold" for Refuel/Repair using Pointer Events.

CarouselEventHandler (F042): Manages swipe/drag for the Hangar.

MarketEventHandler (F040): Manages the buy/sell sliders on market cards.

TooltipHandler (F043): Manages hover states and popups for graphs and attribute pills.

Effects
EffectsManager.js: Manages the queueing and execution of visual effects (particle effects, UI animations, etc.).

BaseEffect.js: The abstract base class for all visual effects.

Debug & Automation
DebugService.js: Manages the debug panel (lil-gui), synchronizing its UI controls with the GameState and providing cheat/test functionalities. Triggers asset hydration for debug actions.

bot/AutomatedPlayerService.js: Contains the AutomatedPlayer class, a state-machine-driven bot designed to stress-test the economy. It mimics a human player by directly calling service methods, bypassing the input layer.

Static Data Files (js/data/)
database.js: Aggregates and exports static game data imported from other modules.

ship_database.js: Defines the static data for all player-tradable ships.

assets_config.js: Defines configuration for ship asset variants.

constants.js: Defines widely used constant values and enums (IDs, game rules, Upgrade Types, Upgrade Colors).

items.js: Defines the registry of Consumable Items (e.g., Folded Space Drives).

age_events.js: Defines static data for narrative events triggered by game progression.

events.js: (Facade) Aggregates all event categories into the master RANDOM_EVENTS registry.

events_traffic.js: Encounters & Distress signals.

events_entropy.js: System failures & maintenance issues.

events_hazards.js: Environmental threats (Solar flares, Asteroids).

events_bureaucracy.js: Customs, fines, and inspections.

events_logistics.js: Cargo spoilage & storage issues.

events_salvage.js: Derelict recovery & looting.

events_opportunity.js: Trade deals & windfalls.

events_story.js: Unique narrative encounters.

missions.js: Defines static data for all player missions.

tutorials.js: Defines static data for all tutorial batches and steps.

flavorAds.js: Defines static, location-specific flavor text ads for the news ticker.

intelMessages.js: Defines message templates for free and purchased market intel.

intelContent.js: Defines the "Sample" and "Details" message pairs for the purchasable Intel Packets.

eulaContent.js: Defines the static HTML content for the EULA modal.

lore/loreRegistry.js: (Facade) Aggregates all lore modules into the master LORE_REGISTRY.

lore/lore_broadstrokes.js: Defines the base lore content.

officers.js: Defines the registry of Sol Station Directorate officers and their buff stats.