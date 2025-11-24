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