# Orbital Trading - Core Data Flow

## System Architecture

The application is built on a strict **unidirectional data flow** model. This ensures that the state of the game is always predictable and that data mutations are traceable.

-   **Input Layer (`EventManager` & Handlers)**: Captures all user interactions and translates them into specific, semantic game actions. Implements explicit drag-suppression for actionable elements to ensure tap responsiveness on mobile.
-   **Logic Layer (`SimulationService` & Sub-Services)**: Executes the core game logic in response to actions from the input layer. This is the only layer authorized to request a state change.
-   **State Layer (`GameState`)**: The single source of truth. It holds all mutable game data and notifies the UI layer when changes occur.
-   **Output Layer (`UIManager`)**: Renders the UI based on the current data from the `GameState`. It is a "dumb" layer that only reads state and displays it.
-   **Asset Layer (`AssetService` & `AssetStorageService`)**: A new persistent layer. Manages the hydration of visual assets from network to IndexedDB ("Locker") to Memory Cache (`blob:` URLs) to ensure zero-latency rendering.

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
Asset Hydration Flow (Persistent Architecture)
This flow ensures assets are loaded and "locked" into device storage to prevent iOS cache eviction and pop-in.

Code snippet

graph TD
    subgraph Init / Event
        A[Game Start / Travel / Debug] --> B[AssetService.hydrateAssets(list)];
    end

    subgraph Asset Logic
        B --> C{In Memory Cache?};
        C -- Yes --> D[Return blob: URL];
        C -- No --> E{In IndexedDB?};
        
        E -- Yes --> F[Read Blob];
        F --> G[Create blob: URL];
        G --> H[Update Memory Cache];
        
        E -- No --> I[Fetch from Network];
        I --> J[Save Blob to IndexedDB];
        J --> G;
    end

    subgraph Render
        D & H --> K[UIManager / DOM];
        K --> L[Image Element src="blob:..."];
    end
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
Automated Stress Test Flow (The Bot)
This diagram illustrates how the AutomatedPlayerService bypasses the Input Layer to stress-test the economy directly via the Logic Layer.

Code snippet

graph TD
    subgraph Bot Layer
        A[Bot Loop Start] --> B[State Machine Decision];
        B -- "Find Trade" --> C[Analyze Market Prices];
        C --> D[Determine Best Route];
    end

    subgraph Bypass
        D -.-> |Direct Call| E[SimulationService.playerActionService];
        D -.-> |Direct Call| F[SimulationService.travelService];
    end

    subgraph Logic Layer
        E --> G[Execute Buy/Sell];
        F --> H[Execute Travel];
    end

    subgraph State Layer
        G & H --> I((GameState));
    end

    subgraph Feedback Loop
        I -- State Update --> A;
    end

    style I fill:#2a9d8f,stroke:#fff,stroke-width:2px
Travel Sequence Flow (Visual + Logic Handoff)
This diagram illustrates the asynchronous handoff between the instant logic calculation and the delayed visual presentation.

Code snippet

graph TD
    subgraph Input
        A[Player clicks 'Launch'] --> B[UIManager.showLaunchModal];
        B -- Confirm --> C[SimulationService.handleTravel];
    end

    subgraph Logic Layer (Instant)
        C --> D[TravelService.calculateTrip];
        D --> E[Deduct Fuel/Time];
        E --> F[Determine Random Event];
        F --> G[Return TravelResult];
    end

    subgraph Presentation Layer (Delayed)
        G --> H[UIManager.showTravelAnimation];
        H --> I[TravelAnimationService (Canvas Overlay)];
        I -- 2.5s Animation --> J{Animation Complete};
        
        J --> K[Execute Final Callback];
        K --> L[UIManager.render(New Location)];
        K --> M[Show Event Modal (if any)];
    end

    style I fill:#e76f51,stroke:#fff,stroke-width:2px