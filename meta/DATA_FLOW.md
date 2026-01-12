# Orbital Trading - Core Data Flow

## System Architecture

The application is built on a strict **unidirectional data flow** model. This ensures that the state of the game is always predictable and that data mutations are traceable.

-   **Input Layer (`EventManager` & Handlers)**: Captures all user interactions and translates them into specific, semantic game actions. Implements explicit drag-suppression for actionable elements to ensure tap responsiveness on mobile.
-   **Logic Layer (`SimulationService` & Sub-Services)**: Executes the core game logic in response to actions from the input layer. This is the only layer authorized to request a state change.
-   **State Layer (`GameState`)**: The single source of truth. It holds all mutable game data and notifies the UI layer when changes occur.
-   **Output Layer (`UIManager`)**: Renders the UI based on the current data from the `GameState`. It is a "dumb" layer that only reads state and displays it. *Note: Components (e.g., `HangarScreen`) now utilize helper services like `AssetService` to resolve static resource paths before rendering.*

---

## Core Logic Flowchart

The system uses two primary flows: a main flow for most game actions, and a "hot loop" for high-frequency, responsive actions.

```mermaid
graph TD
    subgraph Input Layer
        A[User Interaction e.g., Click/PointerDown] --> B{EventManager / Handlers};
    end

    subgraph Logic Layer
        B -- 1a. Main Flow (e.g., Buy Item) --> D[SimulationService Facade];
        D --> E[Specialized Service e.g., PlayerActionService];

        B -- 1b. Hot Loop (e.g., Refuel Tick) --> E;
    end

    subgraph State Layer
        E -- 2. Executes logic & computes new state --> F((GameState));
    end

    subgraph Output Layer
        F -- 3. Notifies subscribers of change --> G[UIManager];
        G -- 4. Reads new state & re-renders UI --> H[DOM];
    end

    H --> A;

    style F fill:#2a9d8f,stroke:#fff,stroke-width:2px
    style G fill:#f4a261,stroke:#fff,stroke-width:2px
Detailed Flow Example: Intel Market (Local Data Broker)
This diagram shows the data flow for the "Local Data Broker" feature, from rendering the shop to the activeIntelDeal affecting market prices.

Code snippet

graph TD
    subgraph Player Action (UI)
        A[Player clicks 'Intel Market' tab] --> B[UIManager calls IntelMarketRenderer];
        B --> C{Reads gameState.intelMarket[loc_id]};
        C --> D[IntelService.calculateIntelPrice(packet)];
        D --> E[Renders 'Purchase Intel' button];
        E -- Click --> F[UIManager.handleBuyIntel];
    end

    subgraph Logic Layer (Services)
        F --> G[IntelService.purchaseIntel(packetId)];
        G -- 1. --> H[Deducts player.credits];
        G -- 2. --> I[Sets packet.isPurchased = true];
        G -- 3. --> J[Creates 'activeIntelDeal' object];
        G -- 4. --> K[NewsTickerService.pushMessage];
    end

    subgraph State Layer
        H & I & J -- 5. Update --> L((GameState));
    end

    subgraph Downstream Effects
        L -- 6. On next Market render --> M[MarketService.getPrice(loc, comm)];
        M --> N{activeIntelDeal exists?};
        N -- Yes --> O[Return deal.overridePrice];
        N -- No --> P[...normal price logic...];
        
        L -- 7. On daily tick --> Q[TimeService.pulse];
        Q --> R{activeIntelDeal expired?};
        R -- Yes --> S[Set activeIntelDeal = null];
    end

    style L fill:#2a9d8f,stroke:#fff,stroke-width:2px
Detailed Flow Example: Upgrade Installation (Destructive Replacement)
This diagram illustrates the complex UI/Logic handshake required to handle the 3-slot limit and destructive replacement of ship upgrades.

Code snippet

graph TD
    subgraph Input Layer (ActionClickHandler)
        A[Click 'Buy Upgrade'] --> B{Check Funds};
        B -- OK --> C[UIManager.showUpgradeInstallationModal];
    end

    subgraph UI Layer (Modal Flow)
        C --> D{Slots Full? (>=3)};
        D -- No --> E[Show: Confirm Purchase];
        D -- Yes --> F[Show: Select Upgrade to Replace];
        
        E -- Confirm --> G[Callback: index = -1];
        F -- Select Item --> H[Show: Confirm Destruction];
        H -- Confirm --> I[Callback: index = 0..2];
    end

    subgraph Logic Layer (PlayerActionService)
        G & I --> J[executeInstallUpgrade];
        J -- 1. --> K[Deduct Credits];
        J -- 2. --> L{Index != -1?};
        L -- Yes --> M[Splice/Remove Old Upgrade];
        L -- No --> N[No Removal];
        M & N --> O[Push New Upgrade ID];
    end

    subgraph State Layer
        O -- 3. Update --> P((GameState));
    end

    style P fill:#2a9d8f,stroke:#fff,stroke-width:2px
Detailed Flow Example: Animated Ship Purchase
This diagram illustrates the asynchronous event flow for purchasing a ship, which includes a blocking animation.

Code snippet

graph TD
    subgraph Input Layer
        A[Click 'Buy Ship' Button] --> B[EventManager];
        B --> C[ActionClickHandler.handle (async)];
    end

    subgraph Logic Layer
        C -- 1. --> D[SimulationService.buyShip (async)];
        D -- 2. --> E[PlayerActionService.validateBuyShip];
        E -- 3. (Success) --> D;
        D -- 4. --> F[UIManager.runShipTransactionAnimation (await)];
        F -- 5. --> G[AnimationService.playBlockingAnimation (await)];
    end
    
    subgraph Output Layer
        G -- 6. (Animation ends) --> H[Promise Resolves];
    end

    subgraph Logic Layer
        H -- 7. --> D;
        D -- 8. --> I[PlayerActionService.executeBuyShip];
    end

    subgraph State Layer
        I -- 9. --> J((GameState.setState));
    end

    subgraph Output Layer
        J -- 10. --> K[UIManager.render];
        K -- 11. --> L[DOM (Ship card is gone)];
    end

    style J fill:#2a9d8f,stroke:#fff,stroke-width:2px
    style K fill:#f4a261,stroke:#fff,stroke-width:2px
    style F fill:#e76f51,stroke:#fff,stroke-width:2px
    style G fill:#e76f51,stroke:#fff,stroke-width:2px

### 4. `meta/SERVICES.md`
**Updates:** Updated `GameAttributes` description to reflect its new role as a Registry. Updated `PlayerActionService` and `UIManager` to include new upgrade-related responsibilities.

```markdown
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
    * **Key Behavior**: Validates actions against player credits/capacity, mutates GameState, logs transactions.
    * **Dependencies**: `GameState`, `UIManager`, `MissionService`, `MarketService`, `GameAttributes`.

* **GameAttributes (F069)**
    * **Responsibility**: The Upgrade Registry. Defines the metadata (cost, name, description) for all Ship Upgrades and Station Quirks. Acts as a lookup engine for modifiers.
    * **Key Behavior**: Provides definition objects for Upgrade IDs. Neutralizes legacy attribute calls.
    * **Dependencies**: None.

* **TravelService (F036)**
    * **Responsibility**: Manages the travel loop. Calculates fuel/time costs, triggers random events.
    * **Key Behavior**: Uses `GameState.TRAVEL_DATA` for distances. Pauses travel for event resolution.
    * **Dependencies**: `GameState`, `TimeService`.

* **MarketService (F010)**
    * **Responsibility**: Simulates the economy. Evolves prices daily, replenishes stock weekly.
    * **Key Behavior**: Implements "Delayed Supply" logic where player actions affect prices 7 days later.
    * **Dependencies**: `GameState`, `IntelService`.

* **IntelService (F057)**
    * **Responsibility**: Manages the "Local Data Broker" system. Generates, prices, and executes Intel Packets.
    * **Key Behavior**: Creates temporary `activeIntelDeal` objects in GameState that override market prices.
    * **Dependencies**: `GameState`.

* **TimeService (F035)**
    * **Responsibility**: Advances the calendar. Triggers daily/weekly ticks for other services.
    * **Key Behavior**: Checks for debt interest, Intel expiration, and birthday events.
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
    * **Responsibility**: path resolution for visual assets.
    * **Key Behavior**: Uses `visualSeed` to deterministically cycle through ship art variants.
    * **Dependencies**: `assets_config.js`.

---

### 4. Input & Event Handling
* **EventManager (F015)**: The root listener. Binds global click/touch events.
* **ActionClickHandler (F039)**: Routes `data-action` clicks to services. Now handles Upgrade Installation logic.
* **HoldEventHandler (F041)**: Manages "press-and-hold" for Refuel/Repair using Pointer Events.
* **CarouselEventHandler (F042)**: Manages swipe/drag for the Hangar.
* **MarketEventHandler (F040)**: Manages the buy/sell sliders on market cards.
* **TooltipHandler (F043)**: Manages hover states and popups for graphs and attribute pills.