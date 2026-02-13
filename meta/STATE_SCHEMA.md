# Orbital Trading: State Schema Definition

## 1. Root State Object

The `GameState` class manages a monolithic state object. All properties below are children of this root.

| Property | Type | Description |
| --- | --- | --- |
| `day` | Number | Current game day (starts at 1). |
| `currentLocationId` | String | ID of the player's current location (e.g., 'loc_mars'). |
| `activeNav` | String | ID of the currently active main navigation tab. |
| `activeScreen` | String | ID of the currently active sub-screen. |
| `isGameOver` | Boolean | Flag indicating if the session has ended. |
| `introSequenceActive` | Boolean | Flag for the initial prologue sequence. |
| `player` | Object | **(See Section 2)** All player-specific data. |
| `market` | Object | **(See Section 3)** All economic data. |
| `intelMarket` | Object | **(See Section 4)** Dynamic intel packets for sale. |
| `activeIntelDeal` | Object | **(See Section 5)** Currently active trade advantage. |
| **`pendingTravel`** | **Object** | **Transient state for event consequences during travel.** |
| `tutorials` | Object | **(See Section 6)** State regarding the tutorial overlay system. |
| `missions` | Object | **(See Section 8)** State regarding active and completed missions. |
| `solStation` | Object | **(See Section 7)** State for the Sol Station Endgame Engine. |
| `uiState` | Object | Ephemeral UI state (scroll positions, active tabs). |

**Pending Travel Structure (`state.pendingTravel`)**
This object buffers data during the async travel/event loop.

* `destinationId`: The intended target location ID.
* `travelTimeAdd`: Additional days added to the trip by an event.
* `travelTimeAddPercent`: Percentage modifier for trip duration.
* `eventHullDamagePercent`: Accumulated hull damage from event outcomes.
* `setTravelTime`: Hard override for travel duration (if > 0).

---

## 2. Player State (`state.player`)

Contains all progression, assets, and statistics for the user.

| Property | Type | Description |
| --- | --- | --- |
| `name` | String | Player's chosen name. |
| `playerAge` | Number | Current age (starts at 24). |
| `lastBirthdayYear` | Number | Year of the last processed birthday event. |
| `credits` | Number | Current currency balance. |
| `debt` | Number | Outstanding loan principal. |
| `monthlyInterestAmount` | Number | Amount of interest added every 30 days. |
| `loanStartDate` | Number | Day the loan was taken (for garnishment logic). |
| `revealedTier` | Number | Highest commodity tier visible (1-7). |
| `visualSeed` | Number | Incrementing integer used to seed procedural asset variations. |
| **`statModifiers`** | **Object** | **Accumulated passive bonuses from Age/Era System.** |
|   `profitBonus` | Number | % Bonus to trade profits (e.g., 0.01 = 1%). |
|   `intelCost` | Number | % Discount on Intel purchases. |
|   `purchaseCost` | Number | % Discount on Commodity purchases. |
|   `intelDuration` | Number | % Increase to Intel deal duration. |
|   `fuelCost` | Number | % Discount on station refueling. |
|   `repairCost` | Number | % Discount on station repairs. |
|   `commoditySupply` | Number | % Increase to global market inventory. |
|   `shipPrice` | Number | % Discount on ship purchases. |
|   `travelSpeed` | Number | % Reduction in travel time calculations. |
|   `shipSpawnRate` | Number | % Increased chance for Rare Ships in shipyard. |
|   `upgradeSpawnRate` | Number | % Increased chance for upgrades in Tuning Shop. |
| **`serviceTokens`** | **Object** | **Counters for free service vouchers (Era 3).** |
|   `fuel` | Number | Count of free fuel fills available. |
|   `repair` | Number | Count of free hull repairs available. |
| `activeShipId` | String | ID of the currently piloted ship. |
| `ownedShipIds` | Array<String> | List of all ship IDs owned by the player. |
| `shipStates` | Object | Map of `shipId` -> `{ health, fuel, hullAlerts, upgrades[] }`. |
| `inventories` | Object | Map of `shipId` -> `{ commodityId: { quantity, avgCost } }`. |
| `unlockedLicenseIds` | Array<String> | List of trade licenses owned. |
| `unlockedLocationIds` | Array<String> | List of locations visited/unlocked. |
| `seenEvents` | Array<String> | List of unique Event IDs already triggered. |

---

## 3. Market State (`state.market`)

The economic simulation data.

| Property | Type | Description |
| --- | --- | --- |
| `prices` | Object | Map of `locationId` -> `commodityId` -> `currentPrice`. |
| `inventory` | Object | Map of `locationId` -> `commodityId` -> `InventoryItem`. |
| `shipyardStock` | Object | Map of `locationId` -> `{ day, shipsForSale[] }`. |
| `priceHistory` | Object | Historical price data for graphing. |

**InventoryItem Structure:**

* `quantity`: Current stock level.
* `marketPressure`: Accumulator for player-driven price changes.
* `lastPlayerInteractionTimestamp`: Day of last trade (controls decay).
* `priceLockEndDay`: Day when the "Price Lock" effect expires.
* `isDepleted`: Flag for "Panic Buy" price hikes.
* `depletionDay`: Day the depletion triggered.

---

## 4. UI State (`state.uiState`)

Ephemeral data used to persist UI context across re-renders.

| Property | Type | Description |
| --- | --- | --- |
| `marketCardMinimized` | Object | Map of commodity IDs to boolean (true = minimized). |
| `hangarShipyardToggleState` | String | 'hangar' or 'shipyard'. |
| `hangarActiveIndex` | Number | Index of the currently viewed ship in the carousel. |
| `shipyardActiveIndex` | Number | Index of the currently viewed ship in the shipyard. |
| `activeIntelTab` | String | ID of the active Intel tab ('intel-codex-content' vs 'market'). |
| `servicesTab` | String | ID of the active Services sub-tab ('supply' vs 'tuning'). |
| `activeMissionTab` | String | ID of the active Mission tab ('terminal' vs 'log'). |

---

## 5. Intel State

New data structures for the "Local Data Broker" system.

**`state.intelMarket`**

* Map of `locationId` -> `Array<IntelPacket>`.
* **IntelPacket**: `{ id, commodityId, dealLocationId, discountPercent, durationDays, cost, isPurchased }`.

**`state.activeIntelDeal`**

* Represents the currently active market advantage.
* **Structure**: `{ locationId, commodityId, overridePrice, expiryDay, sourcePacketId }`.
* *Note: Only one deal can be active at a time.*

---

## 6. Tutorial State (`state.tutorials`)

Manages the progress and locking mechanisms for interactive tutorials.

| Property | Type | Description |
| --- | --- | --- |
| `activeBatchId` | String | ID of the currently running tutorial sequence (e.g., 'intro_basics'). |
| `activeStepId` | String | ID of the current step within the batch. |
| `seenBatchIds` | Array<String> | List of tutorial IDs the player has already completed. |
| `skippedTutorialBatches` | Array<String> | List of tutorial IDs the player explicitly skipped. |
| `navLock` | Object | `{ navId, screenId }` - If set, restricts navigation to this target. |

---

## 7. Sol Station State (`state.solStation`)

Manages the Endgame Engine mechanics.

| Property | Type | Description |
| --- | --- | --- |
| `unlocked` | Boolean | Whether the player has acquired access (default: false). |
| `mode` | String | Current mode: 'STABILITY', 'COMMERCE', 'PRODUCTION'. |
| `health` | Number | Aggregate health (0-100) based on cache fill %. |
| `caches` | Object | Map of `tierX` -> `{ current, max }` for Tier 1-6. |
| `officers` | Array | List of assigned officer objects `{ slotId, assignedOfficerId }`. |
| `stockpile` | Object | `{ credits, antimatter }` generated resources waiting for pickup. |

---

## 8. Mission State (`state.missions`)

Manages the active concurrent missions and their granular progress.

| Property | Type | Description |
| --- | --- | --- |
| `activeMissionIds` | Array<String> | List of currently accepted mission IDs (Max 4). |
| `completedMissionIds` | Array<String> | History of all completed missions. |
| `trackedMissionId` | String | The specific mission ID currently pinned to the HUD. |
| `missionProgress` | Object | Map of `missionId` -> `{ objectives, isCompletable }`. |

**MissionProgress Structure:**

* `isCompletable`: Boolean flag indicating if all objectives are met.
* `objectives`: Map of `objectiveId` -> `{ current, target }`.
}