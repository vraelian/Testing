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

### ADR-004: Market Screen Refactor (GDD D-01: Wrap & Fork)

* **Status**: Accepted (2025-10-18) - Implemented for Metal Update V1
* **Context**: The Market screen needed to accommodate a new category of items (Materials) alongside existing Commodities. The previous single-list structure was insufficient. Event handling for market cards also needed to differentiate between item types.
* **Decision**:
    1.  **UI Structure**: The Market screen's content area was wrapped in a carousel structure (`#market-carousel-container`, `#market-carousel-slider`) containing separate sub-screens (`#market-materials-screen`, `#market-commodities-screen`). A pager control (`#market-pager-container`) was added for navigation between these sub-screens, mimicking the Hangar/Shipyard UI pattern.
    2.  **Event Handling**: `MarketEventHandler.js` was modified ("forked") to check the `data-item-type` attribute ('commodity' or 'material') on clicked elements. Logic within methods like `handleConfirmTrade` and `handleSetMaxTrade` now branches based on this type, calling different `SimulationService` methods (`sellItem` vs. `sellMaterial`).
* **Consequences**:
    * **Pro**: Provides a scalable structure for adding more market categories in the future.
    * **Pro**: Maintains UI consistency by reusing the established pager/carousel pattern.
    * **Pro**: Keeps event handling logic centralized within `MarketEventHandler` while allowing type-specific behavior.
    * **Con**: Increases complexity slightly within `MarketEventHandler` due to conditional branching. Requires careful testing to prevent regressions in commodity trading.

---

### ADR-005: UI Update Pattern (GDD D-03: Push/Pull Hybrid)

* **Status**: Accepted (2025-10-18) - Implemented for Metal Update V1 (Scrap Bar)
* **Context**: Some UI elements need to update immediately in response to game actions (e.g., the Scrap Bar updating during repair ticks), not just when the entire screen re-renders via the standard `GameState` subscription loop. Relying solely on the main render loop for frequent, small updates could be inefficient or cause noticeable lag.
* **Decision**: A hybrid "Push/Pull" approach was adopted for specific, high-frequency UI updates like the Scrap Bar:
    1.  **Pull (Standard):** The `UIManager.render()` function includes logic to draw the UI element correctly based on the `GameState` when the screen initially loads or is re-rendered (e.g., navigating to the Services screen).
    2.  **Push (Optimized):** A dedicated public method (e.g., `UIManager.updateScrapBar()`) is created in `UIManager`. This method directly targets and updates *only* the specific DOM elements needing change (e.g., the scrap bar fill width and text content).
    3.  **Trigger:** The service responsible for the state change (e.g., `PlayerActionService.repairTick`) calls the dedicated "push" method on `UIManager` *after* updating `GameState`, but *only if* the relevant screen is currently active.
* **Consequences**:
    * **Pro**: Ensures immediate visual feedback for actions without needing a full screen re-render, improving perceived responsiveness.
    * **Pro**: More performant for frequent updates compared to constantly re-rendering large parts of the DOM.
    * **Pro**: Maintains the unidirectional flow principle, as `UIManager` still reads from `GameState` during the "push" update, and the "push" is triggered *after* the state mutation occurs in the logic layer.
    * **Con**: Requires careful implementation to ensure the "push" logic correctly reflects the current state and doesn't introduce inconsistencies. Adds slightly more complexity to `UIManager`.