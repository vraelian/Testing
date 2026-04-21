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
2.25 Event-Chain Resolution (Story Events)
Execution path for sequential narrative arcs utilizing specific state evaluations.

Code snippet
graph TD
    subgraph Trigger Check
        A[Context Trigger] --> B[StoryEventService Evaluates];
        B --> C{Prior Chain Flags set?};
    end

    subgraph Resolution
        C -- Yes --> D[Render Story Event];
        D --> E[Player Choice / Outcome];
        E --> F[FlagMutator executes flag sequence];
    end

    subgraph Chaining
        F --> G((Update storyFlags));
        G --> H[Next Sequential Trigger Unlocked];
    end
2.26 Ship Status Effects Lifecycle
Flow detailing the dynamic application, tick cycle, and expiration of volatile ship modifiers.

Code snippet
graph TD
    subgraph Application
        A[Event / Combat / UI Trigger] --> B[eventEffectResolver];
        B --> C[Append Effect Object to `shipStates.statusEffects`];
    end
    
    subgraph Lifecycle Ticks
        C --> D[TravelService triggers Journey];
        D --> E[Evaluate `statusEffects` array];
        E --> F[Apply Temporary Modifiers (Speed, Hull, Burn)];
    end
    
    subgraph Expiration
        F --> G[Decrement Duration];
        G --> H{Duration == 0?};
        H -- Yes --> I[Remove Effect from Array];
        H -- No --> J[Retain for Next Leg];
    end
2.27 Mission Flag Mutator Loop
Security and state management for cross-system mission variables.

Code snippet
graph TD
    subgraph Mutator Engine
        A[Action / Event Trigger] --> B[FlagMutator];
        B --> C[Validate Target Flag & Operation];
        C --> D[Modify `GameState.storyFlags`];
    end

    subgraph Validation Node
        D --> E[MissionTriggerEvaluator];
        E --> F{Read specific `storyFlags`};
    end
    
    subgraph State Action
        F -- Passed --> G[Unlock UI / Reveal Mission];
        F -- Failed --> H[Keep Gated];
    end