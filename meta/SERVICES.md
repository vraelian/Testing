# Service Responsibility & Dependency Matrix

## Core Architecture
**SimulationService** acts as the central Facade. It is the only service that the `EventManager` talks to directly for complex game actions. It coordinates the specialized services below.

---

### 1. State Management
* **GameState (F009)**
    * **Responsibility**: Single source of truth. Holds all mutable data (`player`, `market`, `day`, `ships`).
    * **Key Behavior**: Emits notifications to subscribers (UIManager) whenever `setState` is called.
    * **Dependencies**: None (Leaf node).

### 2. Game Logic Services
* **PlayerActionService (F034)**
    * **Responsibility**: Handles direct player commands: Buy/Sell Cargo, Buy/Sell Ships, Install Upgrades, Refuel/Repair.
    * **Key Behavior**: Validates actions against player credits/capacity, mutates GameState, logs transactions. Uses `MOD_FUEL_PRICE` for refueling costs.
    * **Dependencies**: `GameState`, `UIManager`, `MissionService`, `MarketService`, `GameAttributes`.

* **GameAttributes (F069)**
    * **Responsibility**: The Upgrade Registry. Defines the metadata (cost, name, description) for all Ship Upgrades and Station Quirks. Acts as a lookup engine for modifiers.
    * **Key Behavior**: Provides definition objects for Upgrade IDs. Distinguishes between `MOD_FUEL_BURN` (Travel) and `MOD_FUEL_PRICE` (Station).
    * **Dependencies**: None.

* **TravelService (F036)**
    * **Responsibility**: Manages the travel loop. Calculates fuel/time costs, triggers random events.
    * **Key Behavior**: Uses `GameState.TRAVEL_DATA` for distances. Pauses travel for event resolution. Uses `MOD_FUEL_BURN` for consumption logic.
    * **Dependencies**: `GameState`, `TimeService`.

* **MarketService (F010)**
    * **Responsibility**: Simulates the economy. Evolves prices daily, replenishes stock weekly.
    * **Key Behavior**: Implements "Delayed Supply" logic where player actions affect prices 7 days later. Triggers asset hydration when new ships are spawned in shipyards.
    * **Dependencies**: `GameState`, `IntelService`, `AssetService`.

* **IntelService (F057)**
    * **Responsibility**: Manages the "Local Data Broker" system. Generates, prices, and executes Intel Packets.
    * **Key Behavior**: Creates temporary `activeIntelDeal` objects in GameState that override market prices.
    * **Dependencies**: `GameState`.

* **TimeService (F035)**
    * **Responsibility**: Advances the calendar and manages long-term progression.
    * **Key Behavior**: 
        * Triggers daily/weekly simulation ticks (Market, News).
        * Manages the **"3-Era Age Engine"**, applying procedural stat bonuses and world modifiers based on player age.
        * Checks for debt interest, Intel expiration, and loan garnishment.
    * **Dependencies**: `GameState`, `MarketService`.

* **MissionService (F018)**
    * **Responsibility**: procedural mission generation and tracking.
    * **Key Behavior**: Checks prerequisites (wealth, location) to offer missions. Tracks completion status.
    * **Dependencies**: `GameState`.

* **TutorialService (F016)**
    * **Responsibility**: Manages the interactive tutorial overlay.
    * **Key Behavior**: Watches GameState for specific triggers to advance steps or lock UI elements.
    * **Dependencies**: `GameState`, `UIManager`.

---

### 3. UI & Presentation Services
* **UIManager (F017)**
    * **Responsibility**: The master renderer. Orchestrates the drawing of all screens (`Hangar`, `Market`, etc.).
    * **Key Behavior**: Reads State -> Clears DOM -> Rebuilds HTML. Manages the "Triple-Confirmation" modal flow for upgrades.
    * **Dependencies**: `GameAttributes`, `IntelService`, `IntelMarketRenderer`, `EffectsManager`.

* **IntelMarketRenderer (F058)**
    * **Responsibility**: Dedicated renderer for the dynamic "Intel Market" tab.
    * **Key Behavior**: Separates the complex shop logic from the main `IntelScreen` shell.
    * **Dependencies**: `IntelService`.

* **NewsTickerService (F053)**
    * **Responsibility**: Manages the scrolling text bar.
    * **Key Behavior**: Aggregates flavor text, system alerts, and intel rumors into a seamless loop.
    * **Dependencies**: `GameState`.

* **AssetService (F065)**
    * **Responsibility**: Centralized path resolution and "Hydration" for visual assets.
    * **Key Behavior**: Acts as a high-level manager for the "Asset Locker". Checks memory cache first, then `AssetStorageService`, then network. Converts Blobs to URLs.
    * **Dependencies**: `AssetStorageService`, `assets_config.js`.

* **AssetStorageService (F070)**
    * **Responsibility**: Low-level IndexedDB wrapper.
    * **Key Behavior**: Manages the `OrbitalAssetsDB`. Stores raw `Blob` data to prevent iOS cache eviction.
    * **Dependencies**: None (Native IndexedDB API).

* **TravelAnimationService.js**
    * **Responsibility**: Manages the high-fidelity visual transition during travel.
    * **Key Behavior**: Renders starfields and particles to an HTML5 Canvas overlay. Blocks UI interaction during the sequence.
    * **Dependencies**: `DB` (Travel Visuals).

---

### 4. Input & Event Handling
* **EventManager (F015)**: The root listener. Binds global click/touch events.
* **ActionClickHandler (F039)**: Routes `data-action` clicks to services. Now handles Upgrade Installation logic.
* **HoldEventHandler (F041)**: Manages "press-and-hold" for Refuel/Repair using Pointer Events.
* **CarouselEventHandler (F042)**: Manages swipe/drag for the Hangar.
* **MarketEventHandler (F040)**: Manages the buy/sell sliders on market cards.
* **TooltipHandler (F043)**: Manages hover states and popups for graphs and attribute pills.

### UI/Renderers

* **`IntelMarketRenderer.js`**: A new, dedicated renderer. Its sole job is to be called by UIManager to dynamically build the HTML for the content of the "Intel Market" tab.

### Event Effects

* **`eventEffectResolver.js`**: A central service that applies the game logic effects of a random event outcome by routing to specific handlers. **Uses:** `js/data/events.js`.
* **`effectAdriftPassenger.js`**: The specific implementation for the "Adrift Passenger" event outcome.
* **`effectSpaceRace.js`**: The specific implementation for the "Space Race" event outcome.

### Effects

* **`EffectsManager.js`**: Manages the queueing and execution of visual effects (particle effects, UI animations, etc.).
* **`BaseEffect.js`**: The abstract base class for all visual effects.

### Debug & Automation

* **`DebugService.js`**: Manages the debug panel (`lil-gui`), synchronizing its UI controls with the `GameState` and providing cheat/test functionalities. Triggers asset hydration for debug actions.
* **`bot/AutomatedPlayerService.js`**: Contains the `AutomatedPlayer` class, a state-machine-driven bot designed to stress-test the economy. It mimics a human player by directly calling service methods, bypassing the input layer.

---

### Static Data Files (`js/data/`)

* **`database.js`**: Aggregates and exports static game data imported from other modules.
* **`ship_database.js`**: Defines the static data for all player-tradable ships.
* **`assets_config.js`**: Defines configuration for ship asset variants.
* **`constants.js`**: Defines widely used constant values and enums (IDs, game rules, Upgrade Types, Upgrade Colors).
* **`age_events.js`**: Defines static data for narrative events triggered by game progression.
* **`events.js`**: Defines static data for random events encountered during travel.
* **`missions.js`**: Defines static data for all player missions.
* **`tutorials.js`**: Defines static data for all tutorial batches and steps.
* **`flavorAds.js`**: Defines static, location-specific flavor text ads for the news ticker.
* **`intelMessages.js`**: Defines message templates for free and purchased market intel.
* **`intelContent.js`**: Defines the "Sample" and "Details" message pairs for the purchasable Intel Packets.
* **`eulaContent.js`**: Defines the static HTML content for the EULA modal.