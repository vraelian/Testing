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