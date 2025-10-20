# Orbital Trading - GameState Schema
**Version:** 1.0
**Source:** `main.js (app.init)` / `js/services/GameState.js`

This document defines the structure of the central `GameState` object. It is the "source of truth" for all data in the application.

---

- `player`: {object} - Contains all data specific to the player.
  - `credits`: {number} - Player's current currency.
  - `currentLocation`: {string} - `systemId` of the player's current star system.
  - `currentShipId`: {string} - `shipId` of the player's actively controlled ship.
  - `cargo`: {object} - A map of commodities in the *active* ship's cargo hold.
    - `[commodityId: string]`: {number} - The quantity of the commodity.
  - `ships`: {object} - A map of all ships owned by the player.
    - `[shipId: string]`: {object} - The player ship object.
      - `id`: {string} - Unique identifier (e.g., "ship_0").
      - `type`: {string} - The `shipId` from `database.js` (e.g., "StarHopper").
      - `name`: {string} - The player-given name (e.g., "Serenity").
      - `cargoCapacity`: {number} - Maximum cargo units for this ship.
      - `fuel`: {number} - Current fuel units.
      - `fuelCapacity`: {number} - Maximum fuel units.
      - `hull`: {number} - Current hull integrity.
      - `cargo`: {object} - This ship's specific cargo hold.
        - `[commodityId: string]`: {number} - The quantity.
  - `transactionHistory`: {Array<object>} - A log of all financial transactions.
    - `{object}`:
      - `date`: {string} - ISO 8601 timestamp of the transaction.
      - `type`: {string} - "buy" or "sell".
      - `amount`: {number} - Credits value (positive for sell, negative for buy).
      - `description`: {string} - Human-readable log (e.g., "Bought 10 Water").
  - `cargoHoldFull`: {boolean} - A derived flag set by `PlayerActionService` for UI warnings.
  - `log`: {Array<string>} - A general-purpose log for player-facing messages.

- `market`: {object} - Contains all data related to the galactic economy.
  - `prices`: {object} - A map of current commodity prices by system.
    - `[systemId: string]`: {object}
      - `[commodityId: string]`: {number} - The current price.
  - `inventory`: {object} - A map of current commodity inventory by system.
    - `[systemId: string]`: {object}
      - `[commodityId: string]`: {number} - The current available quantity.
  - `priceHistory`: {object} - A log of prices for charts.
    - `[systemId: string]`: {object}
      - `[commodityId: string]`: {Array<number>} - An array of the last N prices.
  - `marketPressure`: {object} - Tracks player impact on local markets.
    - `[systemId: string]`: {object}
      - `[commodityId: string]`: {number} - The pressure value (decays over time).

- `time`: {object} - Contains global time and date information.
  - `currentDate`: {string} - ISO 8601 timestamp of the current game date.
  - `lastUpdate`: {string} - ISO 8601 timestamp of the last simulation tick.

- `navigation`: {object} - Contains player travel and routing data.
  - `routes`: {Array<object>} - A list of planned warp jumps.
    - `{object}`:
      - `systemId`: {string} - The destination system.
      - `eta`: {string} - ISO 8601 timestamp of arrival.
  - `currentRoute`: {object | null} - The currently active travel route.
    - `systemId`: {string} - The destination system.
    - `eta`: {string} - ISO 8601 timestamp of arrival.
    - `travelTime`: {number} - Total duration of the trip in seconds.
    - `startTime`: {number} - `Date.now()` timestamp when travel began.

- `missions`: {object} - Tracks mission states.
  - `active`: {Array<string>} - A list of `missionId`s the player has accepted.
  - `completed`: {Array<string>} - A list of `missionId`s the player has completed.
  - `objectives`: {object} - A map of progress for active mission objectives.
    - `[missionId: string]`: {object}
      - `[objectiveId: string]`: {object}
        - `status`: {string} - "incomplete" or "complete".
        - `progress`: {number} - Current progress (e.g., 5 out of 10).

- `ui`: {object} - Contains the state of the user interface.
  - `activeScreen`: {string} - The key of the currently visible screen (e.g., "market", "hangar").
  - `toastMessages`: {Array<object>} - A queue of active toast notifications.
    - `{object}`:
      - `id`: {number} - Unique ID for the toast.
      - `message`: {string} - The text to display.
      - `type`: {string} - "success", "error", "info".
      - `duration`: {number} - Milliseconds to display.

- `events`: {object} - Tracks dynamic world events.
  - `activeEvents`: {Array<object>} - A list of currently active global events.
    - `{object}`:
      - `id`: {string} - Unique event ID.
      - `name`: {string} - Player-facing event name.
      - `description`: {string} - Player-facing description.
      - `effects`: {object} - The game logic modifiers.
      - `duration`: {number} - (Optional) Duration in game days.
      - `startTime`: {string} - (Optional) ISO 8601 timestamp when it started.
  - `eventHistory`: {Array<object>} - A log of past events.

- `settings`: {object} - Player-configurable settings.
  - `eventFrequency`: {number} - (Currently unused).
  - `simulationSpeed`: {number} - (Currently unused).

- `debug`: {object} - Contains all values from the debug panel.
  - `priceVolatility`: {number}
  - `meanReversion`: {number}
  - `marketPressureDecay`: {number}
  - `inventoryReplenishRate`: {number}
  - `baseEventChance`: {number}
  - `...`: (and all other CSS variable controls)
}