# Orbital Trading - Core Data Flow

## System Architecture

The application is built on a strict **unidirectional data flow** model. This ensures that the state of the game is always predictable and that data mutations are traceable.

-   **Input Layer (`EventManager` & Handlers)**: Captures all user interactions and translates them into specific, semantic game actions.
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
}
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
Explanation of Intel Market Data Flow
UI Render: When the 'Intel Market' tab is clicked, IntelMarketRenderer is called. It reads gameState.intelMarket for the current location and calls IntelService.calculateIntelPrice for each packet to get a dynamic price based on player credits.

Player Purchase: Player clicks 'Purchase'. UIManager calls IntelService.purchaseIntel.

Transaction Logic: IntelService validates the purchase, deducts player.credits, sets the packet's isPurchased flag, and (most importantly) creates the gameState.activeIntelDeal object. This object "locks" the market.

Market Override: The MarketService.getPrice function is modified to first check for an activeIntelDeal. If a deal matches the location and commodity, it returns the deal.overridePrice, bypassing all normal simulation logic.

Expiration: The TimeService.pulse function checks daily if the activeIntelDeal has expired. If it has, it sets activeIntelDeal back to null, "unlocking" the Intel Market.

Detailed Flow Example: Market Simulation
This diagram shows the data flow for the "Delayed Supply" economic model, which is triggered by a player trade and processed during the weekly simulation tick.

Code snippet

graph TD
    subgraph Player Action (Instant)
        A[PlayerActionService.buyItem/sellItem] --> B[Sets inventoryItem.lastPlayerInteractionTimestamp];
        A --> C[Instantly changes inventoryItem.quantity];
        A --> D[Sets inventoryItem.marketPressure];
    end

    subgraph Weekly Tick (Delayed)
        E(TimeService.advanceDays) --> F[SimulationService.updateMarket];
        F --> G[MarketService.evolveMarketPrices];
        F --> H[MarketService.replenishMarketInventory];
    end

    subgraph Price Logic (evolveMarketPrices)
        G --> I{Day >= timestamp + 7?};
        I -- No (Delay Active) --> J[Price change = meanReversion + randomFluctuation];
        I -- Yes (Delay Over) --> K[Calculate availabilityEffect from quantity];
        K --> L[Price change = meanReversion + randomFluctuation + availabilityEffect];
        C -.-> K;
        B -.-> I;
    end

    subgraph Stock Logic (replenishMarketInventory)
        H --> M[Calculate targetStock];
        M --> N[Calculate 10% replenishment];
        H --> O[Reset state if untouched > 120 days];
        D -.-> M;
    end

    style A fill:#e63946,stroke:#fff
    style E fill:#457b9d,stroke:#fff
Explanation of Market Data Flow
This model ensures player actions have a powerful, delayed effect, preventing same-day abuse.

Instant Player Action: When a player trades, PlayerActionService immediately modifies the GameState:

It changes the item's quantity (e.g., increases it on a sale).

It sets lastPlayerInteractionTimestamp to the current day.

It sets marketPressure (this is only for stock logic, not price).

It activates the priceLockEndDay (this disables meanReversion).

Weekly Price Logic (evolveMarketPrices): On the weekly tick, MarketService runs its price logic:

It checks if the 7-day anti-abuse delay has passed (Day >= timestamp + 7).

If NO (Delay Active): No availabilityEffect is calculated. The price is only affected by natural meanReversion (which is likely disabled by the Price Lock) and randomFluctuation.

If YES (Delay Over): The availabilityEffect is calculated now, using the quantity the player changed days ago. This single effect (tuned to 0.50 strength) creates the large price crash or spike.

Weekly Stock Logic (replenishMarketInventory):

This system runs separately and is not subject to the 7-day price delay.

It uses the marketPressure set by the player to dynamically adjust the targetStock.

It then moves the quantity 10% closer to this targetStock every week, creating the "race" for the player as the market's supply (and thus its price) slowly recovers.

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
Explanation of Animated Ship Purchase Flow
Async Handling: The EventManager and ActionClickHandler are now async to handle the await keyword.

Orchestration: SimulationService.buyShip acts as the orchestrator.

Validation: It first calls the synchronous PlayerActionService.validateBuyShip. If this fails, the process stops.

Blocking Animation: On success, it calls await UIManager.runShipTransactionAnimation. The await keyword pauses the execution of the buyShip function.

Promise: The UIManager in turn calls await AnimationService.playBlockingAnimation. This service attaches a CSS animation class and returns a Promise that only resolves when the animationend event fires.

Execution: Once the animation Promise resolves, execution resumes in SimulationService.buyShip. It then calls the synchronous PlayerActionService.executeBuyShip.

State Change: executeBuyShip mutates the GameState (deducts credits, adds ship).

Final Render: The GameState.setState call notifies UIManager.render, which re-renders the Hangar/Shipyard, now showing the newly purchased ship (or its absence from the shipyard list).