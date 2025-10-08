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

### 4. Implementation of an Interactive D3.js Map Screen

**Decision Date:** 2025-10-07

**Decision:** The original text-based navigation/status screen was deprecated and replaced with a new, interactive Map Screen built using the D3.js library.

**Reason:** The previous implementation was purely functional but lacked visual engagement and failed to provide a strong sense of place within the solar system. The new D3-based map offers several advantages:
1.  **Improved UX:** It provides a clear, visual representation of the game world, making navigation more intuitive and immersive.
2.  **Enhanced Interactivity:** The map serves as a hub for location-based information, with clickable points of interest that reveal detailed modals about each market.
3.  **Scalability:** The SVG-based nature of D3 allows the map to be easily extended with new locations, trade routes, or visual indicators in the future.
This change shifts the primary navigation paradigm from a list to a visual map, fundamentally improving the player's connection to the game world.