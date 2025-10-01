# Orbital Trading - Core Data Flow (Post-Refactor)

## System Architecture

-   **Model**: Unidirectional Data Flow
-   **Description**: A predictable and traceable state mutation model. `SimulationService` acts as a central **Facade** that delegates logic to specialized services.
-   **Primary Services**:
    1.  **EventManager**: The universal input layer. Captures DOM events and delegates them to the appropriate specialized **Handler Service** or the **SimulationService**.
        -   **Handler Services**: `ActionClickHandler`, `MarketEventHandler`, `HoldEventHandler`, `CarouselEventHandler`, and `TooltipHandler` process raw user input into specific game actions.
    2.  **SimulationService (Facade)**: The central coordinator. It receives calls from `EventManager` and delegates them to the appropriate specialized service. It is the only service that should directly call `GameState.setState()`.
    3.  **Specialized Services**:
        -   `IntroService`: Manages the new game introduction sequence.
        -   `PlayerActionService`: Handles immediate player actions (buy, sell, refuel, etc.).
        -   `TravelService`: Manages all logic related to interstellar travel and events.
        -   `TimeService`: Controls the passage of game time and time-based events.
    4.  **GameState**: The single source of truth for all dynamic data.
    5.  **UIManager**: The output layer, responsible for rendering the game state.
    6.  **EffectsManager**: A dedicated service within the UIManager for handling visual effects.

---

## Core Data Flows

### Flow: Core Logic Loop

1.  **Actor**: `User`
    -   **Action**: Interacts with a UI element (e.g., clicks a "Buy" button).
    -   **Target**: `DOM`

2.  **Actor**: `EventManager`
    -   **Action**: Captures the DOM event.
    -   **Target**: `Specialized Handler` (e.g., `ActionClickHandler`)
    -   **Details**: The `EventManager`'s global listeners pass the event to the relevant handler based on the event type (e.g., 'click', 'mousedown').

3.  **Actor**: `Specialized Handler` (e.g., `ActionClickHandler`)
    -   **Action**: Interprets the event and calls the appropriate high-level service.
    -   **Target**: `SimulationService (Facade)`
    -   **Details**: Reads the `data-action` attribute and calls the corresponding public method on the `SimulationService` facade (e.g., `simulationService.buyItem(...)`).

4.  **Actor**: `SimulationService (Facade)`
    -   **Action**: Delegates the call to the appropriate specialized service.
    -   **Target**: `PlayerActionService` (in this example)
    -   **Details**: The facade's `buyItem` method simply calls `this.playerActionService.buyItem(...)`.

5.  **Actor**: `PlayerActionService` (or other specialized service)
    -   **Action**: Executes the core game logic.
    -   **Target**: `GameState`
    -   **Details**: The service validates the action, calculates the outcome (e.g., deducts credits, adds cargo), and then calls `GameState.setState()` to mutate the state. This is the **sole point of state mutation**.

6.  **Actor**: `GameState`
    -   **Action**: Notifies subscribers of the state change.
    -   **Target**: `UIManager`
    -   **Details**: The `setState` method triggers the `_notify` method, which calls the `render` function subscribed by the `UIManager`.

7.  **Actor**: `UIManager`
    -   **Action**: Re-renders all necessary UI components.
    -   **Target**: `DOM`
    -   **Details**: Reads the entire updated state from `GameState` to ensure the UI is a perfect reflection of the current game state.