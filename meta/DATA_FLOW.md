# Orbital Trading - Core Data Flow

## System Architecture

The application is built on a strict **unidirectional data flow** model. This ensures that the state of the game is always predictable and that data mutations are traceable.

-   **Input Layer (`EventManager` & Handlers)**: Captures all user interactions and translates them into specific, semantic game actions.
-   **Logic Layer (`SimulationService` & Sub-Services)**: Executes the core game logic in response to actions from the input layer. This is the only layer authorized to request a state change.
-   **State Layer (`GameState`)**: The single source of truth. It holds all mutable game data and notifies the UI layer when changes occur.
-   **Output Layer (`UIManager`)**: Renders the UI based on the current data from the `GameState`. It is a "dumb" layer that only reads state and displays it.

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
````

-----

## Detailed Flow Example: Market Simulation

This diagram shows the data flow for the "Delayed Supply" economic model, which is triggered by a player trade and processed during the weekly simulation tick.

```mermaid
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
```

### Explanation of Market Data Flow

This model ensures player actions have a powerful, delayed effect, preventing same-day abuse.

1.  **Instant Player Action**: When a player trades, `PlayerActionService` *immediately* modifies the `GameState`:

      * It changes the item's `quantity` (e.g., increases it on a sale).
      * It sets `lastPlayerInteractionTimestamp` to the current `day`.
      * It sets `marketPressure` (this is *only* for stock logic, not price).
      * It activates the `priceLockEndDay` (this disables `meanReversion`).

2.  **Weekly Price Logic (`evolveMarketPrices`)**: On the weekly tick, `MarketService` runs its price logic:

      * It checks if the 7-day anti-abuse delay has passed (Day \>= timestamp + 7).
      * **If NO (Delay Active)**: No `availabilityEffect` is calculated. The price is only affected by natural `meanReversion` (which is likely disabled by the Price Lock) and `randomFluctuation`.
      * **If YES (Delay Over)**: The `availabilityEffect` is calculated *now*, using the `quantity` the player changed days ago. This single effect (tuned to 0.50 strength) creates the large price crash or spike.

3.  **Weekly Stock Logic (`replenishMarketInventory`)**:

      * This system runs separately and is *not* subject to the 7-day price delay.
      * It uses the `marketPressure` set by the player to dynamically adjust the `targetStock`.
      * It then moves the `quantity` 10% closer to this `targetStock` every week, creating the "race" for the player as the market's supply (and thus its price) slowly recovers.

<!-- end list -->

```
```