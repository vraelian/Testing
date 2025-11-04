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
* **Context**: The previous economic model used two separate forces to calculate price changes from player trades: an immediate `availabilityEffect` (from stock changes) and a delayed `pressureEffect` (a direct player penalty). This created a "double-dip," was logically redundant, and hard to tune.
* **Decision**: The `pressureEffect` was removed from the price calculation entirely. The `availabilityEffect` (the core supply/demand force) is now the *sole* driver of player-initiated price changes. To prevent same-day abuse, this `availabilityEffect` is now delayed by 7 days, inheriting the delay logic from the old `pressureEffect`. The strength of this effect was also tuned to `0.50` to make it a viable core gameplay loop.
* **Consequences**:
    * **Pro**: Simplifies the economic model to a single, clean cause-and-effect (supply change -> delayed price change).
    * **Pro**: Eliminates the "double-dip," making the market's reaction more logical and easier to balance.
    * **Pro**: Still achieves the primary goal of preventing same-day/same-visit market manipulation.
    * **Pro**: The `marketPressure` variable is retained for its non-price-related logic (influencing `targetStock` in replenishment), maintaining system integrity.

---

### ADR-006: Intel System Refactor to "Local Data Broker"

* **Status**: Accepted (2025-11-04)
* [cite_start]**Context**: The original `IntelScreen.js` was a static, non-interactive lore repository[cite: 3882]. [cite_start]A new, recyclable gameplay loop and credit-sink was needed to drive player engagement and travel[cite: 3609, 3885].
* [cite_start]**Decision**: Refactored the Intel system into a two-tab component ('Codex' for lore, 'Intel Market' for gameplay)[cite: 3611]. [cite_start]A new `IntelService` was created to procedurally generate, price, and manage 'Intel Packets'[cite: 3674, 3971]. [cite_start]A dedicated `IntelMarketRenderer` was created to dynamically build the 'shop' UI, separating dynamic content from the static `IntelScreen` shell [cite: 3677, 3975-3977]. [cite_start]This implements the 'Local Data Broker' feature[cite: 3608].
* **Consequences**:
    * [cite_start]**Pro**: Separates logic (`IntelService`) from static presentation (`IntelScreen`) and dynamic presentation (`IntelMarketRenderer`), avoiding a monolithic component [cite: 3990-3991].
    * [cite_start]**Pro**: Creates a systemic, scalable, and recyclable gameplay loop [cite: 3617-3618, 3895].
    * [cite_start]**Pro**: Provides a scalable, dynamic credit-sink based on player wealth [cite: 3623, 3905-3907].
    * [cite_start]**Pro**: Creates a strong, non-arbitrary incentive for player travel[cite: 3620, 3901].
    * [cite_start]**Con**: Increases the number of services and adds new dependencies to `TimeService` and `MarketService` [cite: 3679-3680].