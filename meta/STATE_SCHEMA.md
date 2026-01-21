# Orbital Trading: State Schema Definition

## 1. Root State Object
The `GameState` class manages a monolithic state object. All properties below are children of this root.

| Property | Type | Description |
| :--- | :--- | :--- |
| `day` | Number | Current game day (starts at 1). |
| `currentLocationId` | String | ID of the player's current location (e.g., 'loc_mars'). |
| `activeNav` | String | ID of the currently active main navigation tab. |
| `activeScreen` | String | ID of the currently active sub-screen. |
| `isGameOver` | Boolean | Flag indicating if the session has ended. |
| `introSequenceActive` | Boolean | Flag for the initial prologue sequence. |
| `player` | Object | **(See Section 2)** All player-specific data. |
| `market` | Object | **(See Section 3)** All economic data. |
| `intelMarket` | Object | **(See Section 4)** Dynamic intel packets for sale. |
| `activeIntelDeal` | Object | **(See Section 4)** Currently active trade advantage. |
| **`pendingTravel`** | **Object** | **Transient state for event consequences during travel.** |
| `tutorials` | Object | State regarding the tutorial overlay system. |
| `missions` | Object | State regarding active and completed missions. |
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
| :--- | :--- | :--- |
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
| &nbsp;&nbsp;`profitBonus` | Number | % Bonus to trade profits (e.g., 0.01 = 1%). |
| &nbsp;&nbsp;`intelCost` | Number | % Discount on Intel purchases. |
| &nbsp;&nbsp;`purchaseCost` | Number | % Discount on Commodity purchases. |
| &nbsp;&nbsp;`intelDuration` | Number | % Increase to Intel deal duration. |
| &nbsp;&nbsp;`fuelCost` | Number | % Discount on station refueling. |
| &nbsp;&nbsp;`repairCost` | Number | % Discount on station repairs. |
| &nbsp;&nbsp;`commoditySupply` | Number | % Increase to global market inventory. |
| &nbsp;&nbsp;`shipPrice` | Number | % Discount on ship purchases. |
| &nbsp;&nbsp;`travelSpeed` | Number | % Reduction in travel time calculations. |
| &nbsp;&nbsp;`shipSpawnRate` | Number | % Increased chance for Rare Ships in shipyard. |
| &nbsp;&nbsp;`upgradeSpawnRate` | Number | % Increased chance for upgrades in Tuning Shop. |
| **`serviceTokens`** | **Object** | **Counters for free service vouchers (Era 3).** |
| &nbsp;&nbsp;`fuel` | Number | Count of free fuel fills available. |
| &nbsp;&nbsp;`repair` | Number | Count of free hull repairs available. |
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
| :--- | :--- | :--- |
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

## 4. Intel State
New data structures for the "Local Data Broker" system.

**`state.intelMarket`**
* Map of `locationId` -> `Array<IntelPacket>`.
* **IntelPacket**: `{ id, commodityId, dealLocationId, discountPercent, durationDays, cost, isPurchased }`.

**`state.activeIntelDeal`**
* Represents the currently active market advantage.
* **Structure**: `{ locationId, commodityId, overridePrice, expiryDay, sourcePacketId }`.
* *Note: Only one deal can be active at a time.*