/ meta/UI_LIBRARY.md

# Orbital Trading: UI Component Library & Style Guide

## 1. Design System Core

### 1.1 Typography
* **Primary Font:** Oxanium (Variable Weight) - All UI text, data readouts.
* **Accent Font:** Zorque (Regular) - Logos, Section Headers, Hero numbers.

### 1.2 Color Palette (CSS Variables)
* `--bg-color`: App background (Deep Space Black).
* `--panel-bg`: Component background (Semi-transparent dark grey).
* `--color-text-primary`: Main text (White/Off-White).
* `--color-text-secondary`: Labels and dim text (Light Grey).
* `--color-accent`: Primary action color (Cyan/Blue).
* `--color-success`: Positive values/Profits (Green).
* `--color-danger`: Negative values/Costs/Alerts (Red).
* `--color-warning`: Cautions (Yellow/Orange).
* `--color-border`: Standard border color.

### 1.3 Z-Index Registry
* `0`: Base (Background, Canvas Starfield)
* `10`: Content (Main Screen Containers)
* `50`: Chrome (Top Bar, Bottom Nav, Sticky HUD)
* `800`: Help Anchor ('?' Button)
* `900`: Modal Mask
* `1000`: Modal (Active Dialogs)
* `2000`: Toast (Notifications)
* `2500`: Cinematic Skip Buttons

## 2. Component Blueprints

### 2.1 Standard Card (.card)
Used for Commodities, Ships, and Missions.

### 2.2 Action Button (.btn)
Interactive elements must always use `.btn` and MUST include `type="button"`.

### 2.3 Modal Dialog (.modal)
The `UIModalEngine` dynamically mutates the header into a flexbox layout if a `portraitId` is detected, injecting `.portrait-thumbnail` mapped to the sprite sheet.

### 2.4 Contextual Help Modal (.help-modal-container)
Strictly containerized, fixed-aspect-ratio modal utilizing horizontal micro-pagination via CSS `transform: translateX()`.

### 2.5 Universal Toast Notification (.toast-message)
A strictly timed, non-blocking alert system featuring an animated visual fuse (`toast-fuse-burn`).

### 2.6 Mission HUD Sticky Bar & Synthesized Objectives
Anchored beneath the sub-navigation bar, this component tracks live mission progress and provides immediate action vectors.

```html
<div class="mission-sticky-hud">
    <div class="hud-objective-text">DELIVER PLASTEEL: 45/100</div>
    <div class="hud-progress-track">
        <div class="hud-progress-fill" style="width: 45%;"></div>
    </div>
</div>

<div class="mission-sticky-hud state-synthesized">
    <div class="hud-objective-text text-warning">TRAVEL TO: MARS PORT</div>
    <div class="hud-action-indicator animate-pulse">>></div>
</div>

<div class="mission-sticky-hud state-ready">
    <button class="btn btn-gold-transaction" type="button" data-action="turn-in-mission">
        COMPLETE CONTRACT
    </button>
</div>
2.7 Mission UI Button Hierarchy
Progression: btn btn-pulse-green (Safe, forward-moving).

Destructive: bg-red-800/80 border-red-500 (Static red, no pulse).

Transaction (Deposit Freight): Unique Gold style bg-amber-600/80 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)] text-white font-bold (Distinct, non-pulsing transaction indicator).


```json
// meta/lexicon.json (Updated Segments)

{
  "key_concepts": {
    "Just-In-Time_Commits": "A performance strategy ensuring high-frequency math calculations at the Sol Station are only written to the main persistent GameState at optimal junctures (e.g., when the user closes a UI view), preventing DOM layout thrashing.",
    "View-Model_Interpolation": "The mechanism paired with JIT Commits that renders smoothed visual updates for players based on a deferred state buffer rather than immediate global state flushes.",
    "Fleet_Trading": "The ability to manage, cycle through, and coordinate multiple stored ships simultaneously. Facilitates massive arbitrage hauls at the cost of elevated logistical demands and calculated average cost basis.",
    "Convoy_Tax": "A linear percentage offset applied to fuel burn and hull decay during travel to naturally balance the economic advantages of multi-ship fleets.",
    "Tier-Scaled_Upkeep": "The core endgame wealth tax mechanism where service costs (fuel, repair) and upgrade hardware prices scale exponentially based on a vessel's algorithmically determined base price and class multiplier.",
    "Freight_Depositing": "The mechanic allowing piecemeal fulfillment of massive cargo requirements at a destination by surgically iterating through fleet holds to drain specific commodities without monopolizing total fleet capacity.",
    "Synthesized_Objective": "The UI logic that dynamically overrides the mission sticky bar to instruct 'Travel to [Location]' when all item prerequisites are met but the player is not currently at the required turn-in destination."
  },
  "service_summaries": {
    "AutomatedPlayerService": {
      "description": "An internal 'Headless Player' bot designed for client-side economic simulation and validation. Uses Goal-Oriented Action Planning (GOAP) to bypass the UI input layer and execute trades directly against the simulation to test inflation and exploit margins.",
      "dependencies": [
        "GameState",
        "SimulationService",
        "Logger"
      ],
      "key_functions": {
        "startBotLoop": "Initiates the high-speed autonomous execution loop.",
        "determineStrategy": "Analyzes market data to flip between 'Crash Market', 'Deplete Stock', or 'Maintenance' modes.",
        "executeDirectAction": "Fires commands directly into PlayerActionService or TravelService."
      },
      "mutates_state": [
        "GameState (Global)"
      ]
    },
    "MissionTriggerEvaluator": {
      "description": "Stateless logic engine for evaluating whether a mission's prerequisites have been met, gating visibility on the Terminal screen.",
      "dependencies": [
        "GameState"
      ],
      "key_functions": {
        "evaluate": "Returns true if all trigger conditions in the mission definition pass."
      },
      "mutates_state": []
    },
    "MissionObjectiveEvaluator": {
      "description": "Stateless logic engine for tracking active mission progress. Dynamically aggregates active fleet cargo holdings alongside deposited freight values.",
      "dependencies": [
        "GameState"
      ],
      "key_functions": {
        "evaluateProgress": "Calculates the current completion percentage and triggers the 'Synthesized Objective' UI state if applicable."
      },
      "mutates_state": []
    }
  }
}