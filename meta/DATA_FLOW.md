{
type: file_update,
fileName: meta/DATA_FLOW.md,
fullContent:
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
Asset Hydration Flow (Persistent Architecture) This flow ensures assets are loaded and "locked" into device storage to prevent iOS cache eviction and pop-in.

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
Detailed Flow Example: Intel Market (Local Data Broker) This diagram shows the data flow for the "Local Data Broker" feature, from rendering the shop to the activeIntelDeal affecting market prices.

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
Detailed Flow Example: Upgrade Installation (Destructive Replacement) This diagram illustrates the complex UI/Logic handshake required to handle the 3-slot limit and destructive replacement of ship upgrades.

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
Detailed Flow Example: Animated Ship Purchase This diagram illustrates the asynchronous event flow for purchasing a ship, which includes a blocking animation.

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
Automated Stress Test Flow (The Bot) This diagram illustrates how the AutomatedPlayerService bypasses the Input Layer to stress-test the economy directly via the Logic Layer.

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
Travel Sequence Flow (Visual + Logic Handoff) This diagram illustrates the asynchronous handoff between the instant logic calculation and the delayed visual presentation.

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
Event Resolution Flow (Event 2.0) This diagram visualizes the data flow for the new registry-driven event system, highlighting the separation between Selection, Validation, Outcome, and Application.

Code snippet

graph TD
    subgraph Event System 2.0
        A[RandomEventService (Trigger)] --> B[ConditionEvaluator (Validate)];
        B -- Valid --> C[OutcomeResolver (Process Choice)];
        C --> D{Resolution Type};
        D -- Deterministic --> E[Pick 1st Outcome];
        D -- Weighted --> F[Roll RNG w/ Modifiers];
        
        E & F --> G[eventEffectResolver (Apply)];
        G --> H{Value is Dynamic?};
        H -- Yes --> I[DynamicValueResolver (Calculate)];
        H -- No --> J[Use Static Value];
        
        I & J --> K[Mutate GameState];
    end
    
    style K fill:#2a9d8f,stroke:#fff,stroke-width:2px
}


### 3. Update `meta/ECONOMIC_BEHAVIOR.md`
Added **Section VII** detailing the Venus Intel quirk.

```markdown
{
type: file_update,
fileName: meta/ECONOMIC_BEHAVIOR.md,
fullContent:
CURRENT ECONOMIC BEHAVIOR
Orbital Trading Gameplay Data
Last Edit: 1/12/26, ver. 34.00
This document provides a complete breakdown of the game's current economic model, including the core price mechanics, local market influences, and the specific forces that govern the player-driven simulation.

I. Core Price Mechanics Explained
These are the foundational rules that establish the baseline price of a commodity before any player actions are taken.
Galactic Average: This is the foundational, system-wide average price for a commodity. Think of it as the "default" price before any local factors.
Local Price Target: This is the new price baseline that each location's market thinks it should have. It's calculated by taking the Galactic Average and pulling it 50% of the way toward its "ideal" import/export price.
An Exporter (e.g., modifier of 2.0) has a local target price that is significantly lower than the Galactic Average.
An Importer (e.g., modifier of 0.5) has a local target price that is significantly higher than the Galactic Average.
Mean Reversion: This is the "gravitational pull" (currently set to 4% strength) that slowly pulls a commodity's current price back toward its new Local Price Target each week. This new system ensures that import/export locations will always trend toward the prices you expect, creating stable and logical trade routes.

II. Local Price Influences by Location
This is the full list of price influences for every market.
Venus
Exports (Price Reverts Toward a Lower Baseline):
Cloned Organs
Neural Processors
Imports (Price Reverts Toward a Higher Baseline):
Sentient AI Cores
Earth
Exports (Price Reverts Toward a Lower Baseline):
Hydroponics
Imports (Price Reverts Toward a Higher Baseline):
Cloned Organs
Xeno-Geologicals
The Moon
Exports (Price Reverts Toward a Lower Baseline):
Plasteel
Refined Propellant
Graphene Lattices
Imports (Price Reverts Toward a Higher Baseline):
Water Ice
Hydroponics
Mars
Exports (Price Reverts Toward a Lower Baseline):
Plasteel
Imports (Price Reverts Toward a Higher Baseline):
Hydroponics
Cryo-Sleep Pods
Water Ice
Graphene Lattices
The Belt
Exports (Price Reverts Toward a Lower Baseline):
Water Ice
Xeno-Geologicals
Imports (Price Reverts Toward a Higher Baseline):
Hydroponics
Cybernetics
The Exchange
Neutral Location: This location has no local modifiers. All prices will revert directly toward the Galactic Average.
Jupiter
Exports (Price Reverts Toward a Lower Baseline):
Refined Propellant
Atmo Processors
Imports (Price Reverts Toward a Higher Baseline):
Neural Processors
Saturn
Imports (Price Reverts Toward a Higher Baseline):
Cryo-Sleep Pods
Cloned Organs
Uranus
Exports (Price Reverts Toward a Lower Baseline):
Atmo Processors
Imports (Price Reverts Toward a Higher Baseline):
Sentient AI Cores
Neural Processors
Neptune
Imports (Price Reverts Toward a Higher Baseline):
Plasteel (Note: This is a strong import with a 0.1 modifier, so prices will trend very high)
Refined Propellant
Kepler's Eye
Neutral Location: This location has no local modifiers. All prices will revert directly toward the Galactic Average.
Pluto
Exports (Price Reverts Toward a Lower Baseline):
Water Ice
Xeno-Geologicals
Imports (Price Reverts Toward a Higher Baseline):
Hydroponics
Cybernetics
Cloned Organs

III. Player-Driven Market Dynamics & Simulation
Beyond the baseline mechanics, the market is governed by a set of interconnected, player-driven systems. These forces are designed to make the market a dynamic entity that the player actively manipulates. These forces are processed during the weekly TimeService.advanceDays simulation tick.
1. Force: Availability Pressure (The Delayed Market Shock)
This is the new, unified force that replaces the old "Player Pressure" and "Scarcity Pressure." It is the primary driver of all player-initiated price changes.
Mechanic: This force directly simulates supply and demand. When a player buys or sells, they immediately change the item's quantity at that market. This change in stock is the only thing that drives the price change.
Technical Detail: In evolveMarketPrices, the system calculates an availabilityRatio (current quantity / targetStock). This ratio is used to create an availabilityEffect.
The 7-Day Delay (Anti-Abuse): This effect is intentionally delayed. The game checks if 7 days have passed since the lastPlayerInteractionTimestamp. The availabilityEffect is only calculated after this 7-day window, preventing players from manipulating a price and exploiting it in the same visit.
The Strength (High Impact): This effect is controlled by AVAILABILITY_PRESSURE_STRENGTH (currently 0.50). This high value makes market manipulation feel powerful and rewarding.
Example (Sell): Doubling a market's stock (a 2.0 ratio) will cause the price to crash by 50% after the 7-day delay.
Example (Buy): Buying half a market's stock (a 0.5 ratio) will cause the price to spike by 25% after the 7-day delay.
2. Force: Price Lock (The Core Loop)
This is the system that makes market manipulation viable.
Mechanic: When a player makes a trade, the market's natural "Mean Reversion" (the 4% pull back to the local average) is disabled for a long duration.
Technical Detail: When applyMarketImpact is called, it sets a priceLockEndDay on the inventory item.
Jan-Jun (Day 1-182): 75 to 120 days (2.5 - 4 months).
Jul-Dec (Day 183-365): 105 to 195 days (3.5 - 6.5 months).
Effect: In evolveMarketPrices, the system checks if this.gameState.day < inventoryItem.priceLockEndDay. If true, reversionEffect is set to 0. This "locks" the price at the new level created by the player's trade, allowing them to travel and return to exploit the price they created.
3. Force: Depletion Bonus (The Panic)
A special, one-time bonus for buying out a significant portion of a market's stock, simulating a supply panic.
Technical Detail: This is a multi-part check originating in PlayerActionService.buyItem.
Trigger: When a purchase reduces inventoryItem.quantity to <= 0.
Threshold Check: The game checks if the amount purchased was >= 8% of the item's calculated targetStock.
Cooldown Check: It then checks if 365 days have passed since the last bonus (depletionBonusDay).
Effect: If all checks pass, isDepleted and depletionDay are set. For the next 7 days, evolveMarketPrices applies a 1.5x priceHikeMultiplier to the availabilityEffect, causing the price to rise 50% faster than normal.
4. Force: Inventory Replenishment (The Bottleneck)
The market's supply-side response. This is the primary balancing factor that bottlenecks market manipulation.
Mechanic: The market slowly restocks (or sheds) its inventory to move back toward its targetStock.
Technical Detail: In replenishMarketInventory, the market only moves 10% of the difference (targetStock - currentStock) each week.
Effect: This slow 10% rate acts as the main "cooldown" for the manipulation loop. A player can lock a price, but they must wait for stock to slowly recover (or be shed, in a surplus) before they can trade against that locked price again.
Role of marketPressure: The marketPressure variable (set during a trade) is now used exclusively by this system. Negative pressure (from player buying) will dynamically increase the market's targetStock, simulating the market adapting to new demand.
5. Force: Market Memory (The Reset)
The passive fail-safe that prevents the universe from being permanently altered.
Mechanic: This is the "garbage collector" for markets the player abandons.
Technical Detail: In replenishMarketInventory, the system checks if lastPlayerInteractionTimestamp is older than 120 days.
Effect: If the player has not traded that specific item at that specific location for 120 days, the item's state is completely reset.
marketPressure is reset to 0.
priceLockEndDay is reset to 0, re-enabling Mean Reversion.
depletionBonusDay is reset to 0, allowing the bonus to be triggered again.

IV. How The Market Behaves (Simple Terms)
Here is a simple breakdown of those forces with examples.
Availability Pressure (The Shock): You sell 1,000 "Plasteel" on Mars, doubling its stock.
For the next 7 days, nothing happens to the price (this prevents you from buying it right back).
On Day 7, the price crashes by 50%.
Price Lock (Your Loop): You sell 1,000 "Plasteel" on Mars, crashing the price.
That price will stay crashed (it won't recover from natural Mean Reversion) for a random 3-6 months.
This allows you to travel, then return to buy it back at the low price you created.
Depletion Bonus (The Panic): You buy the entire large stock of "Cybernetics" (e.g., 50 units) on Earth.
For the next 7 days, the price for "Cybernetics" on Earth will rise 50% faster than normal.
This won't happen if you just buy the last 2 units, and it can only happen once per year.
Replenishment (The Bottleneck): A market wants 1,000 "Plasteel" but has 1,200 (a surplus of 200).
It will not shed 200 units at once.
It will only shed 10% of the 200-unit gap, losing 20 units per week.
This is the "race": the price crash from your sale slowly gets weaker each week as the surplus shrinks.
Market Memory (The Reset): You crash the "Plasteel" price on Mars, then fly to the outer system and don't come back.
After 120 days of you not trading Plasteel on Mars, the market "forgets" you, and the price returns to normal.

V. Commodity Behavior
(See existing file for full Commodity Tier list...)

VI. Ship Upgrade Economy
The Upgrade System introduces a secondary economy layer, turning ships into customizable assets. Upgrades have fixed costs based on their Tier, but they directly influence a ship's resale value and the player's operating margins.

1. Tiered Pricing Structure
Upgrades are categorized into three tiers of rarity and power.
Tier I (Common): 5,000 Credits. Entry-level modifications.
Tier II (Rare): 15,000 Credits. Advanced specialized equipment.
Tier III (Very Rare): 45,000 Credits. Experimental or military-grade technology.

2. Resale Value Logic
Ships are now valued based on the sum of their hull and their installed components.
Base Calculation: (Ship Base Price + Sum of Installed Upgrade Values)
Depreciation: The total is multiplied by the standard depreciation factor (0.75).
Implication: Players do not lose the full cost of an upgrade when selling a ship; they recover 75% of the upgrade's value, making experimentation financially viable.
Destructive Replacement: However, if a player installs an upgrade into a full slot (3/3), the replaced upgrade is destroyed (0% recovery).

3. Economic Modifiers
Specific upgrades directly alter the player's profit margins and operating costs.
Signal Hacker (Buy Price): Reduces the purchase price of all commodities by 3% / 5% / 7%.
Guild Badge (Sell Price): Increases the sell price of all commodities by 3% / 5% / 7%.
Fuel Pass (Service Cost): Reduces refueling costs by 20% / 50% / 75%.
Syndicate Badge (Debt): Reduces monthly debt interest by 20% / 30% / 50%.
Engine Mod (Trade-Off): Increases travel speed (time efficiency) but increases fuel consumption by 15% / 30% / 45%.

VII. Service Economies & Quirks
Beyond the commodity market, specific services have unique economic behaviors rooted in lore or local conditions.

1. Local Data Broker (Intel Service)
* **Venus Data Quirk**: Due to its status as a high-tech hub, Venus offers unique advantages for the Intel Market.
    * **Cost**: Intel packets sold at Venus are **50% cheaper** than standard rates.
    * **Duration**: Intel deals originating from Venus last **2x longer** than the standard travel-based duration.
}