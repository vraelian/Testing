# Architectural Decision Records (ADRs)

This document records the key architectural decisions made during the development of Orbital Trading. Understanding the "why" behind these decisions is crucial for maintaining a consistent and robust codebase.

---

### 1. Unidirectional Data Flow Model

**Decision Date:** 2025-08-26

**Decision:** The project strictly adheres to a unidirectional data flow model (Input -> Logic -> State -> Render).

**Reason:** This model ensures that all state mutations are predictable and easily traceable. By centralizing state changes within `GameState` and having a single trigger point (`GameState.setState()`), we prevent complex, circular dependencies where a UI update could accidentally trigger more logic. This makes debugging significantly more straightforward and the overall application more stable.

---

### 2. SimulationService as a Facade

**Decision Date:** 2025-09-28

**Decision:** `SimulationService.js` was refactored from a monolithic "do-everything" class into a lean **Facade**.

**Reason:** The original `SimulationService` had too many disparate responsibilities (e.g., handling player actions, time progression, travel, and the intro sequence), which violated the Single Responsibility Principle and made the file difficult to maintain. The Facade pattern was chosen because it maintains a simple, consistent API for the `EventManager` while delegating all complex work to new, specialized services (`PlayerActionService`, `TravelService`, etc.). This dramatically improves code organization and makes it much easier to locate and modify specific pieces of game logic.

---

### 3. Decoupling Event Handling with Specialized Modules

**Decision Date:** 2025-09-30

**Decision:** The monolithic `EventManager` was refactored into a coordinator class that delegates to specialized, single-responsibility handler modules (e.g., `MarketEventHandler`, `CarouselEventHandler`).

**Reason:** To improve code readability, maintainability, and separation of concerns in alignment with the project's architectural principles. The original `EventManager` violated the Single Responsibility Principle, making it difficult to modify and debug. The new structure isolates the logic for complex UI components like the market and carousel, making them easier to manage and extend.

---