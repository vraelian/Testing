# Orbital Trading - Core Data Flow

## System Architecture

-   **Model**: Unidirectional Data Flow
-   **Description**: Ensures predictable and traceable state mutations.
-   **Primary Services**:
    1.  **EventManager**: Universal input layer.
    2.  **SimulationService**: Central game logic and state mutation engine.
    3.  **GameState**: The single source of truth for all dynamic data.
    4.  **UIManager**: The output layer, responsible for rendering the game state.
    5.  **EffectsManager**: A dedicated service within the UIManager for handling visual effects.

---

## Core Data Flows

### Flow: Core Logic Loop

1.  **Actor**: `User`
    -   **Action**: Interacts with a UI element.
    -   **Target**: `DOM`
    -   **Details**: Typically a click on an element with a `data-action` attribute.

2.  **Actor**: `EventManager`
    -   **Action**: Captures the DOM event.
    -   **Target**: `SimulationService`
    -   **Details**: Reads `data-action` and related attributes, then calls the corresponding method in the SimulationService.

3.  **Actor**: `SimulationService`
    -   **Action**: Executes game logic.
    -   **Target**: `GameState`
    -   **Details**: Validates the action, calculates the outcome, and calls `GameState.setState()` to mutate the state. This is the sole point of state mutation.

4.  **Actor**: `GameState`
    -   **Action**: Notifies subscribers of a state change.
    -   **Target**: `UIManager`
    -   **Details**: The `setState` method triggers the `_notify` method, which calls the render function subscribed by the UIManager.

5.  **Actor**: `UIManager`
    -   **Action**: Re-renders the UI.
    -   **Target**: `DOM`
    -   **Details**: Reads the entire updated state from GameState and redraws the necessary UI components to reflect the new state.

### Flow: Visual Effects Side-Flow

1.  **Actor**: `SimulationService` (or other logic service)
    -   **Action**: Determines a visual effect is required.
    -   **Target**: `UIManager`
    -   **Details**: Calls `uiManager.triggerEffect()` with the effect name and configuration options.

2.  **Actor**: `UIManager`
    -   **Action**: Delegates the effect request.
    -   **Target**: `EffectsManager`
    -   **Details**: Forwards the effect name and options to its internal EffectsManager instance.

3.  **Actor**: `EffectsManager`
    -   **Action**: Instantiates and plays the requested effect.
    -   **Target**: `DOM`
    -   **Details**: The manager queues the request, creates an instance of the corresponding effect class (e.g., `SystemSurgeEffect`), and executes its `play()` method. The effect runs independently of the main UI render loop.