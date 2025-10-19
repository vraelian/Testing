# Orbital Trading - Core Data Flow

## System Architecture

The application is built on a strict **unidirectional data flow** model. This ensures that the state of the game is always predictable and that data mutations are traceable.

-   **Input Layer (`EventManager` & Handlers)**: Captures all user interactions and translates them into specific, semantic game actions.
-   **Logic Layer (`SimulationService` & Sub-Services)**: Executes the core game logic in response to actions from the input layer. This is the only layer authorized to request a state change.
-   **State Layer (`GameState`)**: The single source of truth. It holds all mutable game data and notifies the UI layer when changes occur.
-   **Output Layer (`UIManager`)**: Renders the UI based on the current data from the `GameState`. It is a "dumb" layer that only reads state and displays it.

---

## Core Logic Loop Flowchart

```mermaid
graph TD
    subgraph Input Layer
        A[User Interaction e.g., Click] --> B{EventManager};
        B --> C[Specialized Handler e.g., MarketEventHandler];
    end

    subgraph Logic Layer
        C --> D[SimulationService Facade];
        D --> E[Specialized Service e.g., PlayerActionService];
    end

    subgraph State Layer
        E -- 1. Executes logic & computes new state --> F((GameState));
    end

    subgraph Output Layer
        F -- 2. Notifies subscribers of change --> G[UIManager];
        G -- 3. Reads new state & re-renders UI --> H[DOM];
    end

    H --> A;

    style F fill:#2a9d8f,stroke:#fff,stroke-width:2px
    style G fill:#f4a261,stroke:#fff,stroke-width:2px
}