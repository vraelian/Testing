# Architectural Decision Records (ADRs)

This document records the key architectural decisions made during the development of Orbital Trading. Understanding the "why" behind these decisions is crucial for maintaining a consistent and robust codebase.

---

### ADR-001: Service-Oriented Architecture & Unidirectional Data Flow

* **Status**: Accepted (2025-07-XX)
* **Context**: The initial prototype had game logic loosely distributed, making state management and debugging difficult. A predictable and traceable state mutation model was required to build a stable application.
* **Decision**: The application was architected around a strict unidirectional data flow model (`Input -> Logic -> State -> Render`). All mutable game data is held in a single `GameState` object. Game logic is encapsulated in specialized, single-responsibility services that are coordinated by a central `SimulationService` facade. The `UIManager` reads from the `GameState` to render the UI, but never modifies it directly.
* **Consequences**:
    * **Pro**: State changes are highly predictable and easy to trace back to the service that initiated them.
    * **Pro**: Prevents complex, circular dependencies and potential race conditions.
    * **Pro**: Simplifies debugging by creating a single source of truth for all game data.
    * **Con**: Can introduce boilerplate, as even minor state changes must flow through the entire service -> state -> UI loop.

---

### ADR-002: SimulationService as a Facade & EventManager Refactor

* **Status**: Accepted (2025-09-29)
* **Context**: As new features were added, `SimulationService` was becoming a "god object" with too many direct responsibilities (player actions, time progression, travel, etc.). Similarly, the `EventManager` contained a large, monolithic click handler with complex conditional logic.
* **Decision**: `SimulationService` was refactored into a lean **Facade**. Its direct logic was extracted into new, specialized services (`PlayerActionService`, `TravelService`, `TimeService`, etc.). `EventManager` was refactored to delegate input handling to context-specific modules (`MarketEventHandler`, `CarouselEventHandler`, etc.).
* **Consequences**:
    * **Pro**: Enforces the Single Responsibility Principle, making the codebase significantly more modular and organized.
    * **Pro**: Logic for a specific domain (e.g., travel) is now located in a single, predictable place.
    * **Pro**: Reduces the cognitive load required to understand and modify any single part of the system.
    * **Con**: Increases the number of files and the initial setup complexity in `SimulationService`'s constructor.

---

### ADR-003: Decommissioning of `SystemSurgeEffect`

* **Status**: Accepted (2025-10-10)
* **Context**: The `SystemSurgeEffect` was a visual effect intended to celebrate major player achievements. However, it suffered from persistent and critical rendering bugs on the primary target platform (iOS PWA) that proved difficult to resolve.
* **Decision**: The entire feature was surgically removed from the codebase. This included its dedicated JavaScript and CSS files, all HTML containers, and every line of code that triggered the effect from other services (`GameState`, `MissionService`, `DebugService`).
* **Consequences**:
    * **Pro**: Eliminates a source of critical, user-facing bugs, immediately improving application stability.
    * **Pro**: Creates a clean slate, free of legacy code, for a future, more robust and performant replacement effect.
    * **Con**: Temporarily removes a "juice" or "reward" feature from the player experience.

---

### ADR-004: Robust "Hold-to-Act" Event Handling

* **Status**: Accepted (2025-10-22)
* **Context**: The "hold-to-act" buttons (Refuel, Repair) on the Services screen exhibited "sticky" or "toggle" behavior on the primary test target (iOS Simulator / WKWebView). A `mousedown`/`touchstart` would trigger the action, but the UI re-render (caused by the resulting state change) would destroy the original button element. This prevented the corresponding `mouseup`/`touchend` event from ever being received, leaving the action "stuck" in an active loop.
* **Decision**: A persistent, delegated, and capture-phase event model was implemented in `HoldEventHandler.js`.
    1.  **Use Pointer Events**: Switched from separate `mouse` and `touch` events to the modern **Pointer Events API** (`pointerdown`, `pointerup`, `pointercancel`) for unified and more reliable input handling.
    2.  **Delegated "Start"**: A single, persistent `pointerdown` listener is attached to `document.body`. This listener never gets destroyed and delegates the event to the correct handler based on `e.target`.
    3.  **Capture-Phase "Stop"**: Single, persistent `pointerup` and `pointercancel` listeners are attached to the `window` object using the **`{ capture: true }`** option. This ensures the "stop" event is intercepted *before* the UI re-render can stop its propagation.
    4.  **State-Based Logic**: The `_start...` and `_stop...` functions no longer add/remove listeners. They *only* set internal state flags (e.g., `this.activeElementId`), which the persistent global listeners check.
* **Consequences**:
    * **Pro**: Creates an extremely robust event handling model that is immune to UI re-renders, permanently fixing the "sticky button" bug.
    * **Pro**: Simplifies the handler logic by removing the need to manually manage listener lifecycles.
    * **Pro**: Consolidates mouse and touch logic into a single, cleaner API.

---

### ADR-005: Economic Model Refactor to "Delayed Supply"

* **Status**: Accepted (2025-10-30)
* **Context**: The previous economic model used two separate forces: an immediate `availabilityEffect` (from stock changes) and a delayed `pressureEffect` (a direct player penalty). This created a "double-dip," was logically redundant, and hard to tune.
* **Decision**: The model was unified into a single force. The old `pressureEffect` and immediate `availabilityEffect` were removed from the price calculation. The *new* model uses a single **`availabilityEffect`** (derived from the `availabilityRatio` of current stock vs. target stock) as the sole driver of player-initiated price changes. To prevent same-day abuse, this new `availabilityEffect` is now **delayed by 7 days** (inheriting the delay logic from the old system). The strength of this effect was also tuned to `0.50` to make it a viable core gameplay loop.
* **Consequences**:
    * **Pro**: Simplifies the economic model to a single, clean cause-and-effect (trade -> delayed price change).
    * **Pro**: Eliminates the "double-dip," making the market's reaction more logical and easier to balance.
    * **Pro**: Still achieves the primary goal of preventing same-day/same-visit market manipulation.
    * **Pro**: The `marketPressure` variable is retained, but as correctly noted in `ECONOMIC_BEHAVIOR.md`, it is now used *exclusively* for its non-price-related logic (influencing `targetStock` in replenishment), not for price calculation.

---

### ADR-006: Intel System Refactor to "Local Data Broker"

* **Status**: Accepted (2025-11-04)
* **Context**: The original `IntelScreen.js` was a static, non-interactive lore repository. A new, recyclable gameplay loop and credit-sink was needed to drive player engagement and travel.
* **Decision**: Refactored the Intel system into a two-tab component ('Codex' for lore, 'Intel Market' for gameplay). A new `IntelService` was created to procedurally generate, price, and manage 'Intel Packets'. A dedicated `IntelMarketRenderer` was created to dynamically build the 'shop' UI, separating dynamic content from the static `IntelScreen` shell. This implements the 'Local Data Broker' feature.
* **Consequences**:
    * **Pro**: Separates logic (`IntelService`) from static presentation (`IntelScreen`) and dynamic presentation (`IntelMarketRenderer`), avoiding a monolithic component.
    * **Pro**: Creates a systemic, scalable, and recyclable gameplay loop.
    * **Pro**: Provides a scalable, dynamic credit-sink based on player wealth.
    * **Pro**: Creates a strong, non-arbitrary incentive for player travel.
    * **Con**: Increases the number of services and adds new dependencies to `TimeService` and `MarketService`.

---

### ADR-007: Dynamic Viewport "Letterbox" Scaling

* **Status**: Accepted (2025-11-16)
* **Context**: The game's UI is designed for a tall phone screen aspect ratio (e.g., iPhone Pro Max, ~926px). On shorter devices (e.g., iPhone SE) or in mobile browsers where the URL bar reduces the `visualViewport`, the UI was "crushed" and clipped.
* **Decision**: Implemented a dynamic scaling mechanism to ensure layout integrity.
    1.  **CSS Foundation**: `body` is set to `display: flex`, `align-items: center`, `justify-content: center`, and `height: 100dvh`. `css/global.css` padding for `.game-container` was corrected to use `env(safe-area-inset-top)`.
    2.  **JS Scaling Logic**: The `setAppHeight` function in `js/main.js` now runs on load and resize. It compares the `window.visualViewport.height` to a fixed `DESIGN_TARGET_HEIGHT` of 926px.
    3.  **Scaling (If Shorter)**: If `visualHeight < DESIGN_TARGET_HEIGHT`, a CSS `transform: scale()` is applied to the `.game-container`, and `transform-origin` is set to `top center`. The `body`'s `align-items` is set to `flex-start` to align the scaled container to the top of the viewport.
    4.  **No Scaling (If Taller)**: If `visualHeight >= DESIGN_TARGET_HEIGHT`, the `transform` is set to `none`, and the `body`'s `align-items` is set to `center` to vertically center the container.
* **Consequences**:
    * **Pro**: Guarantees the game's UI fits proportionally on any screen shorter than the 926px design target, preventing all clipping and layout breakage.
    * **Pro**: Maintains the intended 1:1 layout on the target device (iPhone Pro Max) and taller screens (where it is vertically centered).
    * **Pro**: Uses `visualViewport` to correctly adapt to dynamic browser UI changes (URL bar, keyboard).
    * **Con**: Results in black bars (letterboxing) on shorter devices, as the UI does not reflow. This is the accepted trade-off for layout integrity.

---

### ADR-008: iOS-Targeted Rendering & Performance Standards

* **Status**: Accepted (2025-11-21)
* **Context**: The Hangar/Shipyard screen, containing lists of complex ship cards, exhibited significant frame rate drops and scrolling lag on the primary target device (iPhone/iOS). The use of "expensive" CSS properties (`background-blend-mode`, `box-shadow` animations, 3D transforms) and synchronous drag handlers saturated the GPU compositor and main thread.
* **Decision**: A strict "Performance-First" rendering strategy was adopted for all scrollable/draggable UI components:
    1.  **CSS Virtualization ("Virtualization-Lite")**: All list items in a carousel or scroll view must utilize `contain: paint layout style` and `content-visibility: auto`. This allows the browser to skip rendering work for off-screen elements without the complexity of JavaScript-based virtualization libraries.
    2.  **Decoupled Input Handling**: All high-frequency input handlers (drag, swipe, scroll) must use `requestAnimationFrame` to decouple the input event rate (which can be >120Hz) from the render update rate, preventing layout thrashing.
    3.  **GPU-Friendly Animations**: Animations are restricted to Composite-only properties (`transform`, `opacity`). "Expensive" effects like pulses must be achieved by animating the `opacity` of a static, pre-rendered pseudo-element, rather than animating `box-shadow` or `border-color` directly.
    4.  **3D Context Budget**: The use of `perspective` and `transform-style: preserve-3d` is strictly limited to active, single elements. Applying 3D contexts to entire lists is prohibited to prevent memory explosion.
* **Consequences**:
    * **Pro**: Achieves native-like 60fps (or 120fps) scrolling performance on iOS devices.
    * **Pro**: Significantly reduces battery drain and device heat.
    * **Con**: Requires more disciplined CSS authoring and strict avoidance of certain "convenient" modern CSS features (like mix-blend-modes) in scrollable areas.

---

### ADR-009: Deterministic "Modulo" Asset Variants

* **Status**: Accepted (2025-11-24)
* **Context**: As the game's art assets expanded, ships needed multiple visual variants (e.g., different paint jobs or configurations). Tracking these specific filenames or adding a complex "skin inventory" system was deemed unnecessary overhead for the current phase.
* **Decision**: A lightweight, deterministic system was implemented using the `AssetService`.
    1.  **Player State**: A single integer, `visualSeed`, was added to the player's state.
    2.  **Modulo Logic**: The UI (via `AssetService`) calculates which variant to display using the formula: `seed % variantCount`. The `variantCount` is defined per ship in `assets_config.js`.
    3.  **Cycling**: The seed increments indefinitely, ensuring that as the player progresses (or triggers a debug command), the visuals cycle predictably through available options (A -> B -> C -> A...).
* **Consequences**:
    * **Pro**: Extremely low state overhead (one integer).
    * **Pro**: Guarantees perfect distribution of variants without random number generation quirks.
    * **Pro**: Simplifies testing; a single button press ("Cycle Ship Pics") verifies all asset paths.
    * **Pro**: Decouples the save state from physical file paths; if assets are added/removed, the logic adapts automatically.

---

### ADR-010: Automated "Sibling Repo" Deployment Workflow

* **Status**: Accepted (2025-11-28)
* **Context**: The project maintains two repositories: a source repo (`Testing`) and a live distribution repo (`OrbitalTrading`). As the asset library grew (specifically ship images), the manual "drag-and-drop" upload method via the GitHub web interface became unviable due to file count/size limits. Additionally, the manual process of moving build tools in and out of the project root to perform obfuscation was error-prone and tedious.
* **Decision**: A local shell script (`publish_game.sh`) was implemented to automate the entire deployment pipeline.
    1.  **Tool Borrowing**: Temporarily moves obfuscation tools (`build.js`, `package.json`, etc.) from a sibling directory into the project root.
    2.  **Build Execution**: Runs `npm run build` to generate the obfuscated `dist` folder.
    3.  **Sibling Deployment**: Uses `cp -R` to overwrite the contents of the local sibling `OrbitalTrading` repository with the new `dist` files (preserving Xcode configuration files).
    4.  **Git Automation**: Automatically stages, commits, and pushes the changes in the `OrbitalTrading` repo to GitHub.
    5.  **Cleanup**: Moves the build tools and the generated `dist` folder back to their storage directory, restoring the source workspace to its clean state.
* **Consequences**:
    * **Pro**: Bypasses GitHub web interface limits entirely, allowing for unlimited asset expansion.
    * **Pro**: Reduces the deployment time from minutes of manual work to seconds.
    * **Pro**: Eliminates human error in the build/transfer process (e.g., forgetting to move a file).
    * **Pro**: strict separation of concerns; the "clean" source repo remains free of build artifacts and tooling config files when not actively building.

---

### ADR-011: Responsive Mobile Interaction Isolation

* **Status**: Accepted (2026-01-11)
* **Context**: Small interactive elements (specifically attribute pills) nested within the draggable Carousel component exhibited inconsistent responsiveness. Mobile touch-starts were being misinterpreted as the beginning of a drag operation, and proactive tooltip clearing in the input layer caused a race condition that required double-taps to activate tooltips.
* **Decision**: A multi-layered interaction isolation strategy was implemented.
    1.  **Semantic Button Upgrade**: Attribute pills were upgraded from `div` to `<button>` elements to utilize native browser event prioritization for interactive targets.
    2.  **Input Layer Suppression**: Modified `EventManager.js` to explicitly block the `CarouselEventHandler` from initializing a drag state if an actionable element (`[data-action]`) is targeted.
    3.  **Contextual Tooltip Cleanup**: Updated the global `touchstart` wrapper to suppress proactive tooltip clearing when touching interactive elements, ensuring the subsequent `click` handler can properly manage the toggle state.
    4.  **Performance Overrides**: Applied `touch-action: manipulation` and `-webkit-tap-highlight-color: transparent` to all small interactive pills to eliminate the 300ms iOS tap delay.
* **Consequences**:
    * **Pro**: Guarantees native-like 1:1 responsiveness for all ship card interactions.
    * **Pro**: Eliminates "double-tap" logic bugs by stabilizing the tooltip lifecycle.
    * **Pro**: Prevents carousel jitter and accidental swiping during detailed interaction.
    * **Pro**: Maintains existing carousel performance for background/non-interactive card areas.

---

### ADR-012: Modular Ship Upgrades & Destructive Replacement

* **Status**: Accepted (2026-01-11)
* **Context**: The game's previous system used static "Attributes" hardcoded to specific ship classes. This limited player customization and economic strategy. A more flexible system was needed where upgrades could be acquired, installed, and traded.
* **Decision**: Transitioned to a "Modular Upgrade" system with a specific "Destructive Replacement" constraint.
    1.  **Mutable State**: Upgrades are no longer static DB properties but are stored in the `shipState.upgrades` array (max 3).
    2.  **Economic Integration**: Upgrades have intrinsic credit values. When a ship is sold, the value of its installed upgrades is added to the base price before depreciation is applied.
    3.  **Destructive Replacement**: To enforce strategic decision-making without complex inventory management, a ship is limited to 3 slots. Installing a 4th upgrade forces the player to select and permanently destroy an existing one.
    4.  **Registry Pattern**: `GameAttributes.js` was refactored from a static logic map to an `Upgrade Registry`, defining metadata and neutralizing legacy attribute logic.
* **Consequences**:
    * **Pro**: Greatly expands player agency and customization options.
    * **Pro**: Adds a new layer to the economy (upgrading ships to increase resale value).
    * **Pro**: "Destructive Replacement" creates high-stakes decisions without the UI clutter of a "spare parts" inventory.
    * **Con**: Requires safeguarding against accidental destruction (mitigated by the Triple-Confirmation modal).

---

### ADR-013: CSS-Driven News Ticker Layout (Infinite Loop)

* **Status**: Accepted (2026-01-15)
* **Context**: The scrolling news ticker exhibited persistent "jitters" (pixel jumps) and "blinks" (layer repaints) at the end of each animation loop. This was caused by sub-pixel discrepancies between JavaScript width calculations and CSS `%` transforms, as well as hardware compositing issues on WebKit.
* **Decision**: Enforce a strict CSS-driven layout strategy.
    1.  **Single Source of Truth**: `NewsTickerService` returns a single, non-duplicated string.
    2.  **Flexbox Wrapper**: Content is wrapped in a dedicated `.ticker-block` flex item.
    3.  **CSS Duplication**: The UI creates a specific DOM structure `[Block A][Block B]`. This guarantees that `Width(Parent) === 2 * Width(Block)`.
    4.  **Blind Animation**: The CSS animation moves `translateX(-50%)`. Because of the rigid DOM structure, `-50%` is mathematically guaranteed to equal the exact width of Block A, ensuring a seamless visual loop without sub-pixel rounding errors.
    5.  **Hardware Acceleration**: Strict use of `will-change: transform` and `backface-visibility: hidden` to prevent layout thrashing and repaints.
* **Consequences**:
    * **Pro**: Eliminates visual jitter caused by JS/CSS measurement mismatches.
    * **Pro**: Prevents "blinking" on loop reset by keeping the layer promoted to the GPU.
    * **Con**: Creates a slightly more complex DOM structure (`.news-ticker-content > .ticker-block`).

---

### ADR-014: Persistent Asset Architecture (IndexedDB "Locker")

* **Status**: Accepted (2026-01-15)
* **Context**: On iOS devices (the primary target), the OS aggressively evicts web cache to save space. This resulted in persistent "pop-in" or missing assets for the player, breaking immersion. Standard browser caching was unreliable.
* **Decision**: Implemented a manual "Locker" system using **IndexedDB**.
    1.  **`AssetStorageService`**: A low-level wrapper handles reading/writing raw `Blob` data to an IndexedDB store named `OrbitalAssetsDB`.
    2.  **Hydration**: On game start (and key events like travel), `AssetService` "hydrates" critical assets. It checks IDB first. If missing, it fetches from the network, saves the Blob to IDB, and creates a `blob:` URL.
    3.  **Memory Cache**: `AssetService` maintains a `Map` of file paths to `blob:` URLs for instant, synchronous access during rendering.
* **Consequences**:
    * **Pro**: Assets act like "installed" data (`Documents & Data` on iOS) and are protected from cache eviction.
    * **Pro**: Zero-latency rendering for hydrated assets (no network request, even to localhost).
    * **Pro**: Enables seamless offline play after initial load.
    * **Con**: Increases initial memory usage slightly due to Blob URLs. Requires manual management of the asset lifecycle.

---

### ADR-015: Split Fuel Economy Logic

* **Status**: Accepted (2026-01-15)
* **Context**: The `MOD_FUEL_COST` attribute was overloading two distinct mechanics: travel efficiency (burn rate) and service cost (station prices). This meant "Engine Mods" (which increase burn) inadvertently made refueling more expensive per unit, creating a "double tax" on the player.
* **Decision**: The logic was split into two distinct attribute types:
    1.  **`MOD_FUEL_BURN`**: Multiplies the amount of fuel consumed during travel (TravelService). Affected by Engine Mods.
    2.  **`MOD_FUEL_PRICE`**: Multiplies the credit cost of purchasing fuel at a station (PlayerActionService). Affected by Fuel Pass.
* **Consequences**:
    * **Pro**: Decouples mechanics, allowing for finer balance control.
    * **Pro**: Fixes the "Double Tax" bug, making Engine Mods a fair trade-off (Speed vs. Efficiency) rather than a pure penalty.
    * **Pro**: Clarifies the UI stats for the player.

---

### ADR-016: Client-Side Economy Simulation (The Bot)

* **Status**: Accepted (2026-01-17)
* **Context**: Validating the new "Delayed Supply" economic model (ADR-005) required long-term data on price stability and exploitability. Manual playtesting was too slow, and external modeling tools could not accurately replicate the game's specific logic/state coupled with the random event system.
* **Decision**: Implemented an internal "Headless Player" state machine (`AutomatedPlayerService.js`).
    1.  **Integration**: The bot runs within the live game client, utilizing the exact same `SimulationService` and `GameState` as a human player.
    2.  **Architecture**: It bypasses the `EventManager` and Input Layer entirely, calling service methods directly to execute trades and travel.
    3.  **Behavior**: The bot uses a goal-oriented action planning (GOAP) approach, dynamically switching between strategies (e.g., "Crash Market", "Deplete Stock", "Maintenance") based on current resources and market conditions.
* **Consequences**:
    * **Pro**: Provides 100% accurate validation of the economy, as it uses the actual production code.
    * **Pro**: Allows for rapid "10-Year" simulations (running at ~100ms per day) to detect long-term inflation or deflation trends.
    * **Pro**: Exposes edge cases in the logic layer that UI restrictions might otherwise hide.
    * **Con**: Adds a large service file that is strictly for debug/dev purposes (must be excluded from production build or flagged off).

---

### ADR-017: Canvas-Driven Transition Overlays

* **Status**: Accepted (2026-01-17)
* **Context**: The travel sequence required a high-fidelity visual transition to mask the data loading/processing time and provide immersion. CSS-based animations were insufficient for complex particle effects (starfields) and caused layout thrashing when manipulating large DOM overlays.
* **Decision**: Implemented a dedicated `TravelAnimationService` using the **HTML5 Canvas API**.
    1.  **Blocking Overlay**: The transition acts as a modal, blocking all interaction and effectively pausing the "Game Loop" while the "Visual Loop" runs.
    2.  **Canvas Rendering**: Starfields, engine particles, and celestial objects are rendered via `requestAnimationFrame` on a `<canvas>` element, separate from the main DOM tree.
    3.  **Asynchronous Handoff**: The `SimulationService` calculates the *result* of travel instantly, but the `UIManager` defers the screen update until the `TravelAnimationService` signals completion via a callback.
* **Consequences**:
    * **Pro**: High-performance rendering of particle effects (60fps) without touching the DOM.
    * **Pro**: cleanly separates the "Simulation" (instant) from the "Experience" (time-based).
    * **Pro**: Allows for complex, procedurally generated visuals (randomized star fields) that would be impossible with static CSS assets.
    * **Con**: Requires manual management of the Canvas context and resize events.

---

### ADR-018: Procedural "3-Era" Age Progression System

* **Status**: Accepted (2026-01-20)
* **Context**: The original "Age Event" system relied on static, hand-written narrative events in `age_events.js` (e.g., "Captain Who?" at Day 366). This approach was not scalable for a "forever game" loop, lacked granular progression (only 2 events existed), and was disconnected from the core simulation stats.
* **Decision**: Replaced static events with a procedural **"3-Era Age Engine"** managed entirely within `TimeService.js`.
    1.  **Era 1 (Prime Years, 25-99)**: Cyclic, small stat efficiency boosts (Profit -> Intel -> Fuel) triggered every birthday.
    2.  **Era 2 (Transhumanist, 100-199)**: Cybernetic augmentations triggered every 5 years, modifying global simulation parameters (Supply, Spawn Rates).
    3.  **Era 3 (Ancient, 200+)**: "Guild Tribute" grants triggered every 5 years, providing free service vouchers (Fuel/Repair) to sustain infinite play.
* **Consequences**:
    * **Pro**: Infinite, scalable progression without writing new content.
    * **Pro**: Deeply integrates player age into the economic simulation (e.g., actually modifying global supply vs. just giving a text popup).
    * **Pro**: Allows for the deprecation of `age_events.js` and legacy tracking variables like `birthdayProfitBonus`.
    * **Con**: Reduces narrative flavor text in favor of systemic tooltips.

---

### ADR-019: Data-Driven Event System (Registry Pattern)

* **Status**: Accepted (2026-01-21)
* **Context**: The existing event system logic was often hard-coded or required modifying service files to add new content, making it difficult to scale or balance the "Travel Event" pool. A more data-centric approach was needed to allow for rapid content iteration and complex branching without touching logic code.
* **Decision**: Implemented a **Registry & Resolver** pattern (Event System 2.0).
    1.  **Registry (`events.js`)**: All event content (text, choices, conditions) is defined in a static JSON-like schema. It is purely passive data.
    2.  **Stateless Resolvers**: Logic is moved to specialized, stateless services. `ConditionEvaluator` validates requirements (Items, Perks). `OutcomeResolver` processes the player's choice and determines the result (Deterministic vs. Weighted RNG).
    3.  **Decoupled Effects**: The `eventEffectResolver` applies the final state mutations (Credits, Hull, Fuel) based on the outcome, completely separating the "Why" (Event) from the "How" (Effect).
* **Consequences**:
    * **Pro**: Massive scalability; new events can be added by simply creating a new object in the registry.
    * **Pro**: Supports complex dependency chains (e.g., "Must have X item AND Y perk") via the generic `requirements` array.
    * **Pro**: Enables "Weighted RNG" outcomes (Risk vs. Reward) purely through configuration.
    * **Con**: Adds a layer of abstraction; debugging a specific event requires checking both the data definition and the resolver logic.