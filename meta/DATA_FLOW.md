// meta/DATA_FLOW.md

# Orbital Trading - Data Flow Architecture

## 1. System Overview
The application follows a Strict Unidirectional Data Flow: Input (Event) -> Logic (Service) -> State (Mutation) -> Output (Render)

### Core Layers
**Input Layer:** EventManager (Global Listeners), ActionClickHandler (Delegation).
**Logic Layer:** SimulationService (Facade), Domain Services (MarketService, PlayerActionService, BankruptcyService, SystemStateService).
**State Layer:** GameState (Single Source of Truth).
**Output Layer:** UIManager (Facade), Domain Controllers (UIMarketControl, etc.).
**Persistence Layer:** SaveStorageService (IndexedDB, File I/O, Native Bridge), AssetStorageService (IndexedDB).

## 2. Process Diagrams

### 2.1 Core Game Loop
The primary cycle for user interaction and state updates.

```mermaid
graph TD
    subgraph Input Layer
        A[User Interaction] --> B{EventManager};
        B -->|Delegate| C[Specialized Handlers];
    end

    subgraph Logic Layer
        C -->|Action Call| D[SimulationService Facade];
        D -->|Dispatch| E[Domain Service];
        E -->|Calculate| E;
    end

    subgraph State Layer
        E -->|Mutate| F((GameState));
    end

    subgraph Output Layer
        F -->|Notify| G[UIManager];
        G -->|Read State| F;
        G -->|Update DOM| H[Browser Viewport];
    end

    H --> A;
2.2 Boot Sequence & Pre-Flight (ADR-021 & ADR-034)
Initialization logic satisfying legal (EULA), performance (Asset Hydration), and cinematic (Web Animations API) constraints.

Code snippet
graph TD
    subgraph Phase 1: DOM Ready
        A[main.js executes] --> B[Initialize AssetService];
        B --> C[Background Hydration: Title Assets & UI Textures];
        A --> D[Initialize UIManager: Partial];
        D --> E[Render Title Screen & EULA Modal];
    end

    subgraph Phase 2: User Gate & Loan
        E --> F{User Accepts EULA?};
        F -- No --> G[Wait / Pulse Warning];
        F -- Yes --> H[Trigger Signature Modal];
        H --> I[Accept Loan & Intro Sequences];
    end

    subgraph Phase 3: Game Injection (Cinematic Handoff)
        I --> J[DOM Inject: Starter Ship Selection Overlay];
        J --> K{User Selects Ship};
        K --> L[Mutate GameState Invisibly];
        L --> M[Web Animations API: Crossfade Overlay to Game Container];
        M --> N[UIManager.render: Hangar/Shipyard];
    end
2.3 Asset Hydration Architecture
Persistence strategy to prevent iOS cache eviction, expanded to include high-frequency UI textures.

Code snippet
graph TD
    subgraph Request
        A[Asset/Texture Requested] --> B[AssetService.hydrateAssets];
    end

    subgraph Resolution Strategy
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
        D & H --> K[DOM Image/CSS Variable Injection];
    end
2.4 Intel Market System (Local Data Broker)
Flow for generating and purchasing temporary market advantages.

Code snippet
graph TD
    subgraph UI Interaction
        A[Click 'Intel Market' Tab] --> B[UIManager calls IntelMarketRenderer];
        B --> C{Read gameState.intelMarket};
        C --> D[Render 'Purchase' Buttons];
        D -- Click --> E[UIManager.handleBuyIntel];
    end

    subgraph Logic Execution
        E --> F[IntelService.purchaseIntel];
        F --> G{Validate Credits & Active Deals};
        G -- Valid --> H[Deduct Credits];
        H --> I[Mark Packet as Purchased];
        I --> J[Create 'activeIntelDeal' in State];
    end

    subgraph Economy Effect
        J --> K((GameState Update));
        K --> L[MarketService.getPrice];
        L --> M{Is Intel Deal Active?};
        M -- Yes --> N[Return Override Price];
        M -- No --> O[Return Standard Price];
    end
2.5 Upgrade Installation (Destructive Replacement)
Logic handling the 3-slot limit and replacement confirmation.

Code snippet
graph TD
    subgraph User Input
        A[Click 'Buy Upgrade'] --> B[ActionClickHandler];
        B --> C{Check Funds};
        C -- OK --> D[UIManager.showUpgradeInstallationModal];
    end

    subgraph Decision Flow
        D --> E{Slots Full? >=3};
        E -- No --> F[Show: Confirm Purchase];
        E -- Yes --> G[Show: Select Replacement];
        
        F -- Confirm --> H[Install New];
        G -- Select Old --> I[Show: Confirm Destruction];
        I -- Confirm --> J[Remove Old & Install New];
    end

    subgraph State Mutation
        H & J --> K[PlayerActionService.executeInstallUpgrade];
        K --> L((Update Ship State));
    end
2.6 Animated Transaction Flow
Handling asynchronous visual blocking during state transitions.

Code snippet
graph TD
    subgraph Input
        A[Buy Ship Click] --> B[ActionClickHandler];
    end

    subgraph Coordination
        B --> C[SimulationService.buyShip];
        C --> D[PlayerActionService.validate];
        D -- Valid --> E[UIManager.runShipTransactionAnimation];
        E --> F[AnimationService.playBlockingAnimation];
    end

    subgraph Visual Block
        F -- Await 'animationend' --> G[Animation Complete];
    end

    subgraph Finalization
        G --> H[PlayerActionService.executeBuyShip];
        H --> I((Mutate GameState));
        I --> J[UIManager.render];
    end
2.7 Automated Testing Bot
Headless execution path bypassing the input layer, heavily integrated with Economic Telemetry tracking.

Code snippet
graph TD
    subgraph AI Decision
        A[Bot Loop] --> B[State Machine];
        B --> C[Analyze Market Data];
        C --> D[Determine Strategy];
    end

    subgraph Direct Injection
        D -.-> |Bypass UI| E[PlayerActionService];
        D -.-> |Bypass UI| F[TravelService];
    end

    subgraph Simulation & Telemetry
        E & F --> G((GameState));
        E --> H[Log Detailed Economic Telemetry];
        G --> A;
    end
2.8 Travel Sequence (Visual Handoff & Stranding Interception)
Separation of instant logic calculation, fuel/stranding checks, and delayed visual presentation.

Code snippet
graph TD
    subgraph Initiation
        A[Launch Click] --> B[TravelService.initiateTravel];
        B --> C{Sufficient Fuel for Base + Events + Convoy Tax?};
        C -- No --> D[Stranding Protocol: Fuel=0, Add Time, Abort];
        C -- Yes --> E[Deduct Resources & Tax, Apply Damage & Roll Events];
    end

    subgraph Visualization
        D --> F[UI: Render Stranded Modal];
        E --> G[UIManager.showTravelAnimation];
        G --> H[TravelAnimationService: Canvas Overlay];
        H -- 2.5s Delay --> I[Animation Complete];
    end

    subgraph Resolution
        I --> J[Execute Result Callback];
        J --> K[UIManager.render: New Location];
        J --> L{Event Triggered?};
        L -- Yes --> M[Show Event Modal];
        L -- No --> N[ToastService.evaluateArrivalTriggers];
        F --> O[UIManager.render: Origin Location];
    end
2.9 Event System 2.0 Resolution
Data-driven event selection and effect application.

Code snippet
graph TD
    subgraph Trigger
        A[Travel Logic] --> B[RandomEventService.tryTriggerEvent];
    end

    subgraph Selection
        B --> C[ConditionEvaluator];
        C -->|Validate Requirements| D[Filter Registry];
        D -->|Weighted Random| E[Select Event];
    end

    subgraph User Choice
        E --> F[UI: Render Event Modal];
        F -- User Selection --> G[OutcomeResolver];
    end

    subgraph Application
        G --> H[Resolve Outcome: RNG/Fixed];
        H --> I[DynamicValueResolver: Parse Base Values & SHIP_CLASS_SCALAR];
        I --> J[eventEffectResolver: Apply Effects];
        J --> K((Mutate GameState));
    end
2.10 Contextual Help Modal Flow
The interaction loop for context-sensitive player assistance.

Code snippet
graph TD
    subgraph Triggering
        A[User Action / Screen Load] --> B[UIManager._evaluateHelpContext];
        B --> C{Current Context ID in seenHelpContexts?};
        C -- No --> D[Silently Push ID to State];
        C -- Yes --> E[Wait for Manual ? Click];
    end

    subgraph Visualization
        D & E --> F[UIHelpManager.showModal];
        F --> G[Fetch HTML from helpRegistry.js];
        G --> H[Inject Fixed-Aspect Modal DOM];
        H --> I[Highlight active pagination dot];
    end

    subgraph Micro-Pagination
        I --> J[User swipes left/right];
        J --> K[Calculate touch delta];
        K --> L{Exceeds threshold?};
        L -- Yes --> M[Update CSS transform: translateX];
        L -- No --> N[Snap back to current slide];
    end
2.11 Mission System Architecture
Flow from static Registry definition to dynamic player state via Logic Evaluators, accommodating two-step configurations and explicit license acquisition paths.

Code snippet
graph TD
    subgraph Definition
        A[Mission Modules] --> B[missionRegistry.js];
        B --> C[DB.MISSIONS (Facade)];
    end

    subgraph Availability Check
        C --> D[MissionService.getAvailableMissions];
        D --> E[MissionTriggerEvaluator];
        E -->|Check Triggers & Unlocked Tiers| F{Passed?};
        F -- Yes --> G[Render 'Terminal' Card];
    end

    subgraph Active Lifecycle (Two-Step & Standard)
        G --> H[User Accepts];
        H --> I[Push to activeMissionIds];
        I --> J[Init missionProgress];
    end

    subgraph Progress Evaluation
        J --> K[MissionObjectiveEvaluator];
        K -->|Evaluate Frame| L{Is Primary Met?};
        L -- Yes, Two-Step --> M[Reveal Secondary Objective/Location];
        L -- Partial --> N[Update Progress Bar];
        L -- All Met --> O[Mark isCompletable=true];
    end

    subgraph Completion
        O --> P[User Returns to Target Location];
        P --> Q[MissionService.completeMission];
        Q --> R[Grant Rewards/Licenses & Archive];
    end
2.12 Consumable Item Usage (Folded Space)
Flow for using an item to bypass standard travel costs.

Code snippet
graph TD
    subgraph UI Interaction
        A[UIEventControl.showLaunchModal] --> B{Check: Tier 7 & Has Item?};
        B -- Yes --> C[Render 'Fold Space' Checkbox];
        C -- Checked --> D[Update Button Dataset (useFoldedDrive=true)];
    end

    subgraph Initiation
        D -- Click Launch --> E[ActionClickHandler];
        E --> F[SimulationService.travelTo(locId, true)];
    end

    subgraph Execution
        F --> G[TravelService.initiateTravel];
        G --> H{useFoldedDrive == True?};
        H -- Yes --> I[Set Time=0, Fuel=0];
        I --> J[Consume Item from Inventory];
        H -- No --> K[Standard Calculation];
    end
    
    subgraph Resolution
        J & K --> L[Execute Travel (Anim + State)];
    end
2.13 Sol Station Deferred Simulation (JIT Commits)
Flow for managing high-frequency logic calculations securely and smoothly.

Code snippet
graph TD
    subgraph Engine Tick
        A[TimeService/SolStationService Ticks] --> B[Compute Entropy & Resource Generation];
    end

    subgraph Deferred State Loop
        B --> C[Buffer Values in DeferredState];
        C --> D[Interpolate Data for UI];
        D --> E[Render View-Model using Interpolated Values];
    end

    subgraph Commit Phase
        E --> F{User navigates away or confirms action?};
        F -- Yes --> G[Execute JIT Commit];
        G --> H[Flush Deferred Data into GameState];
        H --> I[Perform standard render cycle];
    end
2.14 Fleet Management Flow
Process for handling multi-ship arrays during arbitrage and travel.

Code snippet
graph TD
    subgraph Core
        A[Player Triggers Cargo Transaction] --> B[PlayerActionService Evaluates Cost];
    end
    
    subgraph Aggregation
        B --> C[Compile capacities across Fleet];
        C --> D[Dynamically Calculate Fleet Cost Averaging];
        D --> E[Complete Transaction and Update Average Values];
    end
    
    subgraph Travel Assessment
        E --> F[Player Clicks Launch];
        F --> G[TravelService counts active Ships in Fleet];
        G --> H[Assess Scaling Convoy Tax against resources];
    end
2.15 Game State Persistence & Dual-Write Storage
Flow for saving and loading game data.

Code snippet
graph TD
    subgraph Save Operation
        A1[User/Auto Saves Game] --> B1[SaveStorageService.saveGame];
        B1 --> C1[Write to IndexedDB];
        C1 --> D1{Is iOS WebKit Bridge Active?};
        D1 -- Yes --> E1[Post Message: iOS Native UserDefaults];
        D1 -- No --> F1[End Save];
        E1 --> F1;
    end

    subgraph Load Operation
        A2[User Loads Game / Boot] --> B2[SaveStorageService.loadGame];
        B2 --> C2{Is window.__IOS_SAVES present?};
        C2 -- Yes --> D2[Parse Native Save Data];
        D2 --> E2[Background: Heal IndexedDB];
        C2 -- No --> F2[Read from IndexedDB];
        E2 & F2 --> G2[Hydrate GameState];
    end

    subgraph Import / Export
        H1[User Exports Save] --> I1[SaveStorageService.exportSave];
        I1 --> J1[Serialize & Trigger File Download];
        H2[User Imports File] --> I2[SaveStorageService.importSave];
        I2 --> J2[Parse JSON & Overwrite IDB];
        J2 --> G2;
    end
2.16 Universal Toast System Queue
Flow for evaluating, capping, and rendering non-blocking notifications.

Code snippet
graph TD
    subgraph Trigger Post-Travel
        A[Travel Animation Completes] --> B[ToastService.evaluateArrivalTriggers];
    end

    subgraph Logic & Culling
        B --> C[Evaluate: Ship Systems, Finance, Intel, Missions];
        C --> D[Sort Valid Triggers by Priority];
        D --> E[Cull Queue to Max 2 Toasts];
    end

    subgraph Presentation Lifecycle
        E --> F[1.0s Initial Delay];
        F --> G[UIToastManager.showToast];
        G --> H[Animate DOM Injection];
        H -- 4.5s Duration --> I[UIToastManager.hideToast];
        I --> J[Animate DOM Removal];
        J -- 1.0s Interval Delay --> K{More in Queue?};
        K -- Yes --> G;
    end
    
    subgraph Interruption
        L[Player Initiates New Travel] --> M[ToastService.clearQueueAndHide];
        M --> N[Purge Queue & Timers];
        N --> O[UIToastManager.forceClear];
    end
2.17 Dynamic UI Portrait Injection
Flow for parsing portrait requests and dynamically mutating modal DOM structures via CSS sprite sheets.

Code snippet
graph TD
    subgraph Payload Request
        A[Service/Event requests Modal] --> B{Contains options.portraitId?};
    end

    subgraph Resolution
        B -- Yes --> C[UIModalEngine intercepts before render];
        C --> D[Call window.getPortraitStyle];
        D --> E[Lookup coords in PortraitRegistry / characters.js];
    end

    subgraph DOM Mutation
        E --> F[Inject .portrait-thumbnail node];
        F --> G[Apply inline CSS background-position];
        G --> H[Wrap and align Header text via .modal-header-flex];
    end

    subgraph Fallback
        B -- No --> I[Render Standard Center/Left Modal];
    end
2.18 Bankruptcy Evaluation & Repo Event Loop
Evaluation of deep financial insolvency leading to dynamic player asset forfeiture.

Code snippet
graph TD
    subgraph Solvency Check
        A[Daily Tick / Large Purchase] --> B[BankruptcyService.evaluateSolvency];
        B --> C{Syndicate Debt > Threshold?};
    end
    
    subgraph Repo Trigger
        C -- Yes --> D[Flag Repo Strike];
        D --> E{Strike Count == Max?};
        E -- Yes --> F[Trigger Repo Event];
    end
    
    subgraph Asset Forfeiture
        F --> G[Identify Highest Value Ship/Upgrade];
        G --> H[Force Liquidation into Credits];
        H --> I[Apply to Syndicate Debt];
        I --> J[Render Punitive Repo Modal to Player];
    end
2.19 System State / Economic Weather Propagation
Procedural macro-economic variables influencing trade conditions.

Code snippet
graph TD
    subgraph Weather Generation
        A[Weekly Simulation Tick] --> B[SystemStateService.rollWeather];
        B --> C[Select weather ID from Registry];
        C --> D[Apply globally to GameState.systemStates];
    end

    subgraph Propagation
        D --> E[MarketService Pricing Engine];
        E --> F[Adjust Target Price baselines system-wide];
        D --> G[RandomEventService Context Weights];
        G --> H[Increase/Decrease encounter probabilities];
    end
2.20 Mission Freight Depositing Flow
Flow for piecemeal fulfillment of massive cargo requirements.

Code snippet
graph TD
    subgraph User Input
        A[Click 'Deposit Freight'] --> B[UIMissionControl captures coordinates];
    end

    subgraph Logic Execution
        B --> C[MissionService.depositMissionCargo];
        C --> D[Iterate Fleet Inventories];
        D --> E{Relevant Cargo > 0?};
        E -- Yes --> F[Deduct from Fleet, Increment 'deposited'];
    end

    subgraph State Mutation & UI
        F --> G((Force GameState.setState));
        G --> H[Return deposited amount to UI];
        H --> I[UIManager.createFloatingText at Coordinates];
        I --> J[UIManager.render updates Navigation Bar and Modal];
    end
2.21 Ship Destruction & Towing Flow
Flow defining consequence resolution upon hull failure.

Code snippet
graph TD
    subgraph Critical Trigger
        A[TravelService Execution] --> B{Hull <= 0?};
        B -- Yes --> C[Trigger _handleShipDestruction];
    end
    
    subgraph Probability Branch
        C --> D[Roll: 33% Tow vs 66% Destruct];
    end
    
    subgraph Survival Route
        D -- 33% --> E[Execute _handleShipDisabledAndTowed];
        E --> F[Advance Time, Set Hull to 1, Fuel to 0];
        F --> G[Route to Starport Services];
    end

    subgraph Terminal Route
        D -- 66% --> H[Execute _executeShipDestruction];
        H --> I[Web Animations API: Cinematic Blackout Overlay];
        I --> J[State Wipe: Delete Asset Data Silently];
        J --> K{Is last ship?};
        K -- Yes --> L[Trigger Game Over];
        K -- No --> M[Render Hangar with Backup Ship];
    end
2.22 Hot Intel Lifecycle Flow
The volatile acquisition and evaporation mechanics of Hot Intel.

Code snippet
graph TD
    subgraph Generation & Acquisition
        A[Location Arrival] --> B[NewsTicker generates Hot Intel Packet];
        B --> C[Player Clicks Purchase];
        C --> D[State Mutation: activeHotIntel Set];
    end
    
    subgraph Action Verification
        D --> E[Player interacts with target market];
        E --> F{Is Hot Intel Valid for this transaction?};
        F -- Yes --> G[Apply drastic price override];
    end
    
    subgraph Termination
        H[Player Clicks Launch / Travel] --> I[TravelService.initiateTravel];
        I --> J[State Mutation: Force Wipe activeHotIntel];
    end
2.23 Manual Save & Exit Protocol
Execution path for explicit state commits and session termination via the Game Menu.

Code snippet
graph TD
    subgraph Trigger
        A[Player Opens Game Menu] --> B[Select 'Save Game' or 'Exit Game'];
    end
    
    subgraph Execution
        B --> C[SaveStorageService.saveGame];
        C --> D[Force IDB and iOS Native Bridge Writes];
    end
    
    subgraph Termination
        B -- Exit Selected --> E[Wait for Writes to Resolve];
        E --> F[Clear Ephemeral State / Flush JIT Telemetry];
        F --> G[Return to Title Screen];
    end
2.24 Officer Recruitment Pipeline
Flow converting static roster data into persistent player state via the UI.

Code snippet
graph TD
    subgraph Generation
        A[Player Accesses Services] --> B[UI Queries `officers.js` for Roster];
        B --> C[Render Recruitment Modal with Stat/Cost Previews];
    end
    
    subgraph Transaction
        C --> D[Player Selects Officer to Recruit];
        D --> E[PlayerActionService validates Credit Cost];
        E -- Valid --> F[Deduct Credits];
    end
    
    subgraph State Mutation
        F --> G[Push String ID to `player.officerRoster`];
        G --> H[GameState.setState];
        H --> I[SolStationService calculates new systemic engineering buffs];
    end

```markdown
// meta/STATE_SCHEMA.md

# Orbital Trading: State Schema Definition

## 1. Root State Object

The `GameState` class manages a monolithic state object. All properties below are children of this root.

| Property | Type | Description |
| --- | --- | --- |
| `day` | Number | Current game day (starts at 1). |
| `currentLocationId` | String | ID of the player's current location (e.g., 'loc_mars'). |
| `activeNav` | String | ID of the currently active main navigation tab. |
| `activeScreen` | String | ID of the currently active sub-screen. |
| `isGameOver` | Boolean | Flag indicating if the session has ended. |
| `introSequenceActive` | Boolean | Flag for the initial prologue sequence. |
| `player` | Object | **(See Section 2)** All player-specific data. |
| `market` | Object | **(See Section 3)** All economic data. |
| `systemStates` | Object | **(See Section 10)** System-wide macroeconomic conditions (Economic Weather). |
| `intelMarket` | Object | **(See Section 4)** Dynamic intel packets for sale. |
| `activeIntelDeal` | Object | **(See Section 5)** Currently active trade advantage. |
| **`activeHotIntel`** | **Object** | **(See Section 5)** Ephemeral intelligence that expires immediately upon departing a system. |
| **`pendingTravel`** | **Object** | **Transient state for event consequences during travel.** |
| `tutorials` | Object | **(See Section 6)** State regarding the Contextual Help Modal system. |
| `missions` | Object | **(See Section 8)** State regarding active and completed missions. |
| `solStation` | Object | **(See Section 7)** State for the Sol Station Endgame Engine. |
| `uiState` | Object | Ephemeral UI state (scroll positions, active tabs, menu overlays). |
| `telemetry` | Object | Debug/Analytics data tracking macro-economic trends and bot logs. |

**Pending Travel Structure (`state.pendingTravel`)**
This object buffers data during the async travel/event loop.

* `destinationId`: The intended target location ID.
* `travelTimeAdd`: Additional days added to the trip by an event.
* `travelTimeAddPercent`: Percentage modifier for trip duration.
* `eventHullDamagePercent`: Accumulated hull damage from event outcomes.
* `setTravelTime`: Hard override for travel duration (if > 0).
* `convoyTaxDeduction`: Amount of resources/credits deducted due to fleet size during travel.
* `blockadeActive`: Boolean flag indicating an active blockade event affecting the travel route or destination access.

---

## 2. Player State (`state.player`)

Contains all progression, assets, and statistics for the user.

**IMPORTANT NOTE ON SHIP ATTRIBUTES:** All physical ship attributes (`maxHealth`, `cargoCapacity`, `maxFuel`) stored here or retrieved via DB definitions are strictly bounded to remain `<= 1000`. This constraint is mathematically necessary to sustain the Tier-Scaled Upkeep economy and the "Packing Peanut" inventory strategy.

| Property | Type | Description |
| --- | --- | --- |
| `name` | String | Player's chosen name. |
| `introStep` | Number | Current progression step within the cinematic intro sequence. |
| `playerAge` | Number | Current age (starts at 24). |
| `lastBirthdayYear` | Number | Year of the last processed birthday event. |
| `credits` | Number | Current currency balance. |
| `debt` | Object | Structured debt ledgers for 'guild' and 'syndicate' balances, tracking principal, interest rates, and loan start/due dates. |
| `bankruptcy` | Object | Flags and trackers for insolvency status, grace periods, and active Repo Events. |
| `revealedTier` | Number | Highest commodity tier visibly mapped, independent of strict wealth milestones. |
| `unlockedCommodityTiers` | Array<Number> | Detached milestone list of commodity tiers explicitly unlocked for trade (e.g., via licenses). |
| `visualSeed` | Number | Incrementing integer used to seed procedural asset variations. |
| **`statModifiers`** | **Object** | **Accumulated passive bonuses from Age/Era System.** |
|   `profitBonus` | Number | % Bonus to trade profits (e.g., 0.01 = 1%). |
|   `intelCost` | Number | % Discount on Intel purchases. |
|   `purchaseCost` | Number | % Discount on Commodity purchases. |
|   `intelDuration` | Number | % Increase to Intel deal duration. |
|   `fuelCost` | Number | % Discount on station refueling. |
|   `repairCost` | Number | % Discount on station repairs. |
|   `commoditySupply` | Number | % Increase to global market inventory. |
|   `shipPrice` | Number | % Discount on ship purchases. |
|   `travelSpeed` | Number | % Reduction in travel time calculations. |
|   `shipSpawnRate` | Number | % Increased chance for Rare Ships in shipyard. |
|   `upgradeSpawnRate` | Number | % Increased chance for upgrades in Tuning Shop. |
| **`serviceTokens`** | **Object** | **Counters for free service vouchers (Era 3).** |
|   `fuel` | Number | Count of free fuel fills available. |
|   `repair` | Number | Count of free hull repairs available. |
| `activeShipId` | String | ID of the currently piloted ship. |
| `ownedShipIds` | Array<String> | List of all ship IDs owned by the player. |
| `fleet` | Object | Map of stored `shipId`s to their status, docked location, and specific cargo configurations. |
| `officerRoster` | Array<String> | List of recruited officer IDs utilized in engineering pipelines. |
| `shipStates` | Object | Map of `shipId` -> `{ health, fuel, hullAlerts, upgrades[] }`. |
| `inventories` | Object | Map of `shipId` -> `{ commodityId: { quantity, avgCost } }`. The `avgCost` dynamically accounts for fleet-wide purchases and storage transfers. |
| `unlockedLicenseIds` | Array<String> | List of trade licenses owned, gating specific mission or commodity tiers. |
| `unlockedLocationIds` | Array<String> | List of locations visited/unlocked. |
| `seenEvents` | Array<String> | List of unique Event IDs already triggered. |

---

## 3. Market State (`state.market`)

The economic simulation data.

| Property | Type | Description |
| --- | --- | --- |
| `prices` | Object | Map of `locationId` -> `commodityId` -> `currentPrice`. |
| `inventory` | Object | Map of `locationId` -> `commodityId` -> `InventoryItem`. |
| `shipyardStock` | Object | Map of `locationId` -> `{ day, shipsForSale[] }`. |
| `priceHistory` | Object | Historical price data for graphing. |

**InventoryItem Structure:**

* `quantity`: Current stock level.
* `marketPressure`: Accumulator for player-driven price changes.
* `lastPlayerInteractionTimestamp`: Day of last trade (controls decay).
* `priceLockEndDay`: Day when the "Price Lock" effect expires.
* `isDepleted`: Flag for "Panic Buy" price hikes.
* `depletionDay`: Day the depletion triggered.

---

## 4. UI State (`state.uiState`)

Ephemeral data used to persist UI context across re-renders.

| Property | Type | Description |
| --- | --- | --- |
| `marketCardMinimized` | Object | Map of commodity IDs to boolean (true = minimized). |
| `hangarShipyardToggleState` | String | 'hangar' or 'shipyard'. |
| `hangarActiveIndex` | Number | Index of the currently viewed ship in the carousel. |
| `shipyardActiveIndex` | Number | Index of the currently viewed ship in the shipyard. |
| `activeFleetIndex` | Number | Index tracking the currently selected ship within the player's stored fleet on the services screen. |
| `activeIntelTab` | String | ID of the active Intel tab ('intel-codex-content' vs 'market'). |
| `servicesTab` | String | ID of the active Services sub-tab ('supply' vs 'tuning'). |
| `activeMissionTab` | String | ID of the active Mission tab ('terminal' vs 'log'). |
| `enableEconomicTelemetry` | Boolean | Toggles data aggregation for deep transaction logging. |
| `gameMenuActive` | Boolean | Toggles the active visibility and blocking state of the core Game/Pause Menu. |

---

## 5. Intel State

Data structures for the "Local Data Broker" system and volatile alerts.

**`state.intelMarket`**

* Map of `locationId` -> `Array<IntelPacket>`.
* **IntelPacket**: `{ id, commodityId, dealLocationId, discountPercent, durationDays, cost, isPurchased }`.

**`state.activeIntelDeal`**

* Represents the currently active market advantage.
* **Structure**: `{ locationId, commodityId, overridePrice, expiryDay, sourcePacketId }`.
* *Note: Only one long-term deal can be active at a time.*

**`state.activeHotIntel`**

* Represents volatile intelligence that vanishes instantly if the player initiates travel.
* **Structure**: `{ targetMarketId, commodityId, type, startDay, endDay }`.

---

## 6. Tutorial State (`state.tutorials`)

Exclusively manages the auto-instantiation tracking for the Contextual Help Modal System (ADR-033). Legacy Popper.js properties have been deprecated and removed.

| Property | Type | Description |
| --- | --- | --- |
| `seenHelpContexts` | Array<String> | List of Help Context IDs the player has already auto-triggered. |

---

## 7. Sol Station State (`state.solStation`)

Manages the Endgame Engine mechanics.

| Property | Type | Description |
| --- | --- | --- |
| `level` | Number | Current progression level (1-50). |
| `activeProject` | Object | The currently active progression project requirements. |
| `activeProjectBank` | Object | Incremental ledger of resources donated to the active project. |
| `unlocked` | Boolean | Whether the player has acquired access (default: false). |
| `mode` | String | Current mode: 'STABILITY', 'COMMERCE', 'PRODUCTION'. |
| `health` | Number | Aggregate health (0-100) based on cache fill %. |
| `caches` | Object | Map of `tierX` -> `{ current, max }` for Tier 1-6. |
| `engineering` | Object | State data for the engineering interface, including active systemic upgrades and layout configurations. |
| `officers` | Array | List of assigned officer objects `{ slotId, assignedOfficerId }`. |
| `stockpile` | Object | `{ credits, antimatter }` generated resources waiting for pickup. |
| `synthesisPipeline` | Object | Pipeline metrics for conversion, including `{ active, inputCommodities, targetAntimatter, completionDay }`. |
| `deferredState` | Object | Accumulator for view-model interpolation tracking unprocessed entropy and yields before JIT commits. |

---

## 8. Mission State (`state.missions`)

Manages the active concurrent missions and their granular progress.

| Property | Type | Description |
| --- | --- | --- |
| `activeMissionIds` | Array<String> | List of currently accepted mission IDs (Max 4). |
| `completedMissionIds` | Array<String> | History of all completed missions. |
| `trackedMissionId` | String | The specific mission ID currently pinned to the HUD. |
| `missionProgress` | Object | Map of `missionId` -> `{ objectives, isCompletable }`. |

**MissionProgress Structure:**

* `isCompletable`: Boolean flag indicating if all objectives are met.
* `objectives`: Map of `objectiveId` -> `{ current, target, deposited }`.

---

## 9. Serialized Save Structure

When the game is saved via `SaveStorageService`, the core `GameState` is wrapped in an envelope containing metadata for safe persistence across IndexedDB and the iOS Native Bridge.

| Property | Type | Description |
| --- | --- | --- |
| `slotId` | String | The primary key identifier for the save slot (e.g., 'auto', 'slot1'). |
| `version` | Number | The schema version of the save file to handle future migrations. |
| `metadata` | Object | Lightweight summary data used for rendering the splash/load screen without parsing the entire gamestate. |
|   `day` | Number | The game day the save occurred. |
|   `credits` | Number | The player's wealth at the time of saving. |
|   `locationId` | String | The player's location. |
|   `timestamp` | Number | Standard UNIX epoch timestamp of the save event. |
| `...payload` | Object | The full, stringified (or direct, depending on bridge) `GameState` root object unpacked into the save object. |

---

## 10. System States (`state.systemStates`)

Manages procedural Economic Weather modifiers impacting global behavior.

| Property | Type | Description |
| --- | --- | --- |
| `activeWeatherId` | String | ID of the currently active macroeconomic modifier. |
| `expirationDay` | Number | The game day the current weather naturally ends. |
| `weatherModifiers` | Object | Current active stat weights affecting global pricing, event rates, and availability. |
Markdown
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
Responsibility: Handles direct player commands: Buy/Sell Cargo, Buy/Sell Ships, Install Upgrades, Refuel/Repair, Recruit Officers.
Key Behavior: Validates actions against player credits/capacity, mutates GameState, logs transactions. Uses dynamic class multipliers for refueling costs and algorithmic pricing (`ShipPrice * 0.0029`) for repairs. Orchestrates fleet trading, storage mechanics, dynamic fleet cost averaging, and UI handoffs for officer recruitment.
Dependencies: GameState, UIManager, MissionService, MarketService, GameAttributes.

GameAttributes (F069)
Responsibility: The Upgrade Registry. Defines the metadata (cost, name, description) for all Ship Upgrades and Station Quirks. Acts as a lookup engine for modifiers.
Dependencies: None.

TravelService (F036)
Responsibility: Manages the travel loop. Calculates fuel/time costs, applies Convoy Taxes, and triggers random events.
Key Behavior: Directly oversees the orchestration of the Ship Destruction and Towing flows (utilizing the Web Animations API for cinematic presentation), and aggressively terminates ephemeral `activeHotIntel` loops upon initiation.
Dependencies: GameState, TimeService, RandomEventService.

MarketService (F010)
Responsibility: Simulates the economy. Evolves prices daily, replenishes stock weekly.
Key Behavior: Implements "Delayed Supply" logic where player actions affect prices 7 days later. Governed by tuned `MARKET_PRESSURE_DECAY` and `MEAN_REVERSION_STRENGTH` rules. Applies System State weather modifiers and Station Quirks dynamically.
Dependencies: GameState, IntelService, AssetService, SystemStateService.

IntelService (F057)
Responsibility: Manages the intelligence network systems, specifically the 'Local Data Broker' operations and the highly volatile 'Hot Intel' generation loop directly sourced from the NewsTickerService.
Dependencies: GameState.

TimeService (F035)
Responsibility: Advances the calendar and manages long-term progression.
Key Behavior: Triggers daily/weekly simulation ticks (Market, News, Weather). Manages the "3-Era Age Engine".
Dependencies: GameState, MarketService, BankruptcyService, SystemStateService, SolStationService.

MissionService (F018)
Responsibility: Coordinates the Mission System 2.0 lifecycle. Delegates logic to evaluators. Facilitates massive bulk objectives by handling localized `depositMissionCargo` loops and `loadDeferredCargo` routines across the active fleet. Validates two-step progression and explicit license unlocks.
Dependencies: GameState, MissionTriggerEvaluator, MissionObjectiveEvaluator.

SolStationService (F098)
Responsibility: Manages the logic for the Sol Station endgame engine, progression mechanics, and mathematical integrity.
Key Behavior: Manages progression from Level 1-50. Implements deferred universe calculations and view-model interpolation. Executes Just-In-Time (JIT) commits. Manages the Synthesis Pipeline for Antimatter conversion and implements global buffs from the newly structured `officerRoster`.
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

AutomatedPlayerService (F061)
Responsibility: Houses the 'Headless Bot' routine executing Goal-Oriented Action Planning logic to stress test the internal simulation loop.
Key Behavior: Heavily couples with `enableEconomicTelemetry` flags to generate expansive transactional logs testing macroeconomic balances over extreme simulated timeframes.
Dependencies: GameState, SimulationService.

3. Event System Services (Event 2.0)
RandomEventService
Responsibility: The high-level coordinator for the random event system. Determines if an event occurs and which event is selected based on contextual weight and active System States.
Dependencies: GameState, ConditionEvaluator.

ConditionEvaluator
Responsibility: A stateless utility service that validates requirements.
Dependencies: GameState (Read-only).

OutcomeResolver
Responsibility: Handles the logic of the player's choice.
Dependencies: GameState, eventEffectResolver.

DynamicValueResolver
Responsibility: Calculates dynamic integer values for event effects based on game state context.
Dependencies: GameState (Read-only), DB.

eventEffectResolver
Responsibility: The "Applicator". Applies the specific state mutations defined by an event's outcome.
Dependencies: GameState, SimulationService, DynamicValueResolver.

4. UI & Presentation Services
UIManager (F017) [FACADE]
Responsibility: The master "Switchboard". Instantiates and coordinates the Domain Controllers. Handles the main render loop.
Dependencies: UIModalEngine, UIHelpManager, UIMarketControl, UIMissionControl, UIHangarControl, UIEventControl, UISolStationControl, UIToastManager.

Controllers (Delegates):
* UIModalEngine: Manages the modal queue, priority processing, and dismissal logic. Dynamically intercepts `options.portraitId` payloads to restructure modal headers and inject CSS sprite portraits via the global `PortraitRegistry`.
* UIHelpManager: Manages the Contextual Help Modal system, micro-pagination tracks, and swipe threshold logic.
* UIToastManager: Manages Universal Toast notifications, DOM injection, and animation timing.
* UIMarketControl: Manages Market screen rendering, state retention, and graph generation.
* UIMissionControl: Manages Mission data screens, sticky bar HUD, and Intel interactions.
* UIHangarControl: Manages Hangar carousels, ship details, and the Upgrade Installation flow.
* UIEventControl: "World" interactions (Maps, Lore, Random Events, EULA, Launch Modals, Game Menu).
* UISolStationControl: Manages the Sol Station Dashboard, operational modes, cache grids, and Engineering Interface.

IntelMarketRenderer (F058)
Responsibility: Dedicated renderer for the dynamic "Intel Market" tab content.
Dependencies: IntelService.

NewsTickerService (F053)
Responsibility: Manages the scrolling text bar content.
Dependencies: GameState.

AssetService (F065)
Responsibility: Centralized path resolution and "Hydration" for visual assets. Expands into high-frequency UI texture pre-hydration for rendering stability.
Dependencies: AssetStorageService, assets_config.js.

StarfieldService
Responsibility: UI Service managing rendering context for dynamic starfield layers and deep space visual assets.
Dependencies: Canvas Context APIs.

TravelAnimationService (F044)
Responsibility: Manages the high-fidelity visual transition during travel via Canvas.
Dependencies: DB (Travel Visuals).

AnimationService (F060)
Responsibility: Provides a generic, promise-based utility (`playBlockingAnimation`) to run CSS animations and block further execution until completion.
Dependencies: None.

5. Persistence Services
SaveStorageService (F101)
Responsibility: Manages game saves using a dual-write architecture and local file I/O operations. Integrates explicit manual Save/Load commands and safe 'Exit Game' termination logic.
Key Behavior: Serializes and stores `GameState` locally in IndexedDB while concurrently broadcasting to the iOS native layer via WebKit message handlers. Exposes `exportSave` and `importSave` for external file manipulation. Flushes telemetry and buffers upon session termination requests.
Dependencies: Native IndexedDB API, WebKit Message Handlers.

AssetStorageService (F070)
Responsibility: Low-level IndexedDB wrapper for preserving core blobs and dynamic UI textures.
Dependencies: Native IndexedDB API.