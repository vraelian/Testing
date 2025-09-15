# Orbital Trading - Core Data Flow

This document outlines the primary data flow and application architecture for Orbital Trading, providing a high-level overview of how user actions translate into game state changes and UI updates.

## Architectural Overview

The game operates on a unidirectional data flow model, ensuring that state mutations are predictable and easy to trace. The core of this model involves four key services:

1.  **EventManager**: The universal input layer.
2.  **SimulationService**: The central game logic and state mutation engine.
3.  **GameState**: The single source of truth for all dynamic data.
4.  **UIManager**: The output layer, responsible for rendering the game state.

## Core Data Flow Loop

All player interactions follow this fundamental sequence:

1.  **User Input**: The process begins when a player interacts with a UI element, typically by clicking a button that has a `data-action` attribute (e.g., `<button data-action="buy-item">`).

2.  **EventManager Captures Input**: The central click handler in `EventManager.js` (`_handleClick`) captures this event. It reads the `data-action` attribute and any associated data (like `data-good-id` or `data-ship-id`).

3.  **Action is Delegated to SimulationService**: The `EventManager` translates the user's input into a specific, high-level command and calls the corresponding method in the `SimulationService`. For example, a "buy-item" action calls `simulationService.buyItem()`.

4.  **SimulationService Mutates State**: The `SimulationService` contains all the core game logic. It validates the action (e.g., "Can the player afford this?"), calculates the outcome, and then directly modifies the game's state by calling `GameState.setState()`. This is the *only* place where the game's state should be changed.

5.  **GameState Notifies UIManager**: The `GameState` service holds a list of subscribers. When `setState()` is called, it notifies all subscribers that a change has occurred. The `UIManager` is the primary subscriber.

6.  **UIManager Re-Renders UI**: Upon notification from the `GameState`, the `UIManager.render()` function is triggered. It re-reads the entire updated game state and re-draws the necessary components on the screen, ensuring the player always sees the most current information.