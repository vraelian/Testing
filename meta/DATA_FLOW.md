Orbital Trading - Data Flow Architecture
1. System Overview
The application follows a Strict Unidirectional Data Flow: Input (Event) -> Logic (Service) -> State (Mutation) -> Output (Render)

Core Layers
Input Layer: EventManager (Global Listeners), ActionClickHandler (Delegation).

Logic Layer: SimulationService (Facade), Domain Services (MarketService, PlayerActionService).

State Layer: GameState (Single Source of Truth).

Output Layer: UIManager (Facade), Domain Controllers (UIMarketControl, etc.).

Persistence Layer: AssetStorageService (IndexedDB), AssetService (Memory Cache).

2. Process Diagrams
2.1 Core Game Loop
The primary cycle for user interaction and state updates.

Code snippet
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

2.2 Boot Sequence & Pre-Flight (ADR-021)
Initialization logic satisfying legal (EULA) and performance (Asset Hydration) constraints.

Code snippet
graph TD
    subgraph Phase 1: DOM Ready
        A[main.js executes] --> B[Initialize AssetService];
        B --> C[Background Hydration: Title Assets];
        A --> D[Initialize UIManager: Partial];
        D --> E[Render Title Screen & EULA Modal];
    end

    subgraph Phase 2: User Gate
        E --> F{User Accepts EULA?};
        F -- No --> G[Wait / Pulse Warning];
        F -- Yes --> H[Trigger Start Sequence];
    end

    subgraph Phase 3: Game Injection
        H --> I[Unlock AudioContext: User Gesture];
        I --> J[Instantiate GameState & Core Services];
        J --> K[Hydrate Game Assets: Ships/Planets];
        K --> L[UIManager.render: Game];
    end

2.3 Asset Hydration Architecture
Persistence strategy to prevent iOS cache eviction.

Code snippet
graph TD
    subgraph Request
        A[Asset Requested] --> B[AssetService.hydrateAssets];
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
        D & H --> K[DOM Image Element];
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
Headless execution path bypassing the input layer.

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

    subgraph Simulation
        E & F --> G((GameState));
        G --> A;
    end

2.8 Travel Sequence (Visual Handoff)
Separation of instant logic calculation and delayed visual presentation.

Code snippet
graph TD
    subgraph Initiation
        A[Launch Click] --> B[SimulationService.handleTravel];
        B --> C[TravelService.calculateTrip];
        C --> D[Deduct Resources & Roll Events];
        D --> E[Return TravelResult Object];
    end

    subgraph Visualization
        E --> F[UIManager.showTravelAnimation];
        F --> G[TravelAnimationService: Canvas Overlay];
        G -- 2.5s Delay --> H[Animation Complete];
    end

    subgraph Resolution
        H --> I[Execute Result Callback];
        I --> J[UIManager.render: New Location];
        I --> K{Event Triggered?};
        K -- Yes --> L[Show Event Modal];
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
        H --> I[DynamicValueResolver: Calculate Quantities];
        I --> J[eventEffectResolver: Apply Effects];
        J --> K((Mutate GameState));
    end
2.10 Tutorial Trigger & Interaction Flow
The interaction loop between Logic (TutorialService) and View (UITutorialManager).

Code snippet
graph TD
    subgraph Triggering
        A[User Action / Screen Load] --> B[TutorialService.checkState];
        B --> C{Matches Trigger?};
        C -- Yes --> D[Set activeBatchId / activeStepId];
        D --> E[Mutate GameState (NavLock)];
    end

    subgraph Visualization
        E --> F[UIManager.render];
        F --> G[UITutorialManager.showTutorialToast];
        G --> H[Calculate Popper.js Position];
        G --> I[Render SVG Highlights];
        H & I --> J[DOM Update];
    end

    subgraph Progression
        J --> K[User Clicks 'Next' or 'Action'];
        K --> L[TutorialService.advanceStep];
        L --> M{Next Step Exists?};
        M -- Yes --> D;
        M -- No --> N[End Batch & Clear Lock];
    end

2.10 Tutorial Trigger & Interaction Flow
The interaction loop between Logic (TutorialService) and View (UITutorialManager).

Code snippet
graph TD
    subgraph Triggering
        A[User Action / Screen Load] --> B[TutorialService.checkState];
        B --> C{Matches Trigger?};
        C -- Yes --> D[Set activeBatchId / activeStepId];
        D --> E[Mutate GameState (NavLock)];
    end

    subgraph Visualization
        E --> F[UIManager.render];
        F --> G[UITutorialManager.showTutorialToast];
        G --> H[Calculate Popper.js Position];
        G --> I[Render SVG Highlights];
        H & I --> J[DOM Update];
    end

    subgraph Progression
        J --> K[User Clicks 'Next' or 'Action'];
        K --> L[TutorialService.advanceStep];
        L --> M{Next Step Exists?};
        M -- Yes --> D;
        M -- No --> N[End Batch & Clear Lock];
    end

2.11 Mission System Architecture
Flow from static Registry definition to dynamic player state and UI interaction.

Code snippet
graph TD
    subgraph Definition
        A[Mission Modules] --> B[missionRegistry.js];
        B --> C[DB.MISSIONS (Facade)];
    end

    subgraph Availability Check
        C --> D[MissionService.getAvailableMissions];
        D --> E{Check Prerequisites};
        E -- Met --> F[Available Pool];
        E -- Not Met --> G[Hidden/Locked];
    end

    subgraph Lifecycle
        F --> H[User Accepts Mission];
        H --> I[SimulationService.grantMissionCargo];
        I --> J[Set activeMissionId];
        J --> K((Mutate GameState));
    end

    subgraph Completion
        K --> L[UIMissionControl: Render Sticky Bar];
        L --> M[User Delivers Goods];
        M --> N[MissionService.completeActiveMission];
        N --> O[Grant Rewards / Remove Cargo];
        O --> P[Add to completedMissionIds];
    end