Orbital Trading - GameState Schema
Version: 2.2 Source: js/services/GameState.js (see startNewGame method)

This document defines the structure of the central GameState object, which is instantiated in main.js and managed by GameState.js. It is the "source of truth" for all dynamic, mutable data in the application.

day: {number} - The current in-game day.

lastInterestChargeDay: {number} - The day on which player debt interest was last calculated.

lastMarketUpdateDay: {number} - The day on which market prices and inventories were last updated.

currentLocationId: {string} - The LOCATION_ID where the player is currently docked.

activeNav: {string} - The NAV_ID of the currently active main navigation tab (e.g., "ship", "starport").

activeScreen: {string} - The SCREEN_ID of the currently active screen (e.g., "map", "market").

isGameOver: {boolean} - Flag indicating if the game over state has been triggered.

subNavCollapsed: {boolean} - Flag tracking the UI state of the sub-navigation bar.

introSequenceActive: {boolean} - Flag indicating if the introductory tutorial/sequence is active.

lastActiveScreen: {object} - A map storing the last active screen for each main navigation tab.

[NAV_ID: string]: {string} - The SCREEN_ID to return to (e.g., ship: "map").

pendingTravel: {object | null} - If not null, contains details of the player's active travel.

fromId: {string} - The LOCATION_ID of the departure location.

toId: {string} - The LOCATION_ID of the destination.

departureDay: {number} - The game day on which travel started.

arrivalDay: {number} - The game day on which travel will end.

duration: {number} - The total number of days for the trip.

player: {object} - Contains all data specific to the player.

name: {string} - The player's chosen name.

playerTitle: {string} - The player's current title (e.g., "Captain").

playerAge: {number} - The player's current age.

lastBirthdayYear: {number} - The in-game year of the player's last birthday.

birthdayProfitBonus: {number} - A temporary credit bonus awarded on their birthday.

introStep: {number} - A counter tracking progress through the intro sequence.

credits: {number} - Player's current currency.

debt: {number} - Player's outstanding loan amount.

monthlyInterestAmount: {number} - The amount of interest added to the debt each cycle.

loanStartDate: {number | null} - The day on which the loan was taken.

seenGarnishmentWarning: {boolean} - Flag tracking if the player has been warned about wage garnishment.

revealedTier: {number} - The highest market tier the player has unlocked.

unlockedLicenseIds: {Array<string>} - A list of LICENSE_IDs the player has purchased.

unlockedLocationIds: {Array<string>} - A list of LOCATION_IDs the player is allowed to visit.

seenCommodityMilestones: {Array<string>} - A log of commodity trade value milestones achieved.

financeLog: {Array<object>} - A log of all financial transactions.

{object}:

day: {number} - The day of the transaction.

type: {string} - "buy", "sell", "interest", "loan", "payment", "ship", "fee", "bonus".

amount: {number} - Credits value (positive for income, negative for expense).

description: {string} - Human-readable log (e.g., "Bought 10 Water").

activePerks: {object} - (Currently unused) A map of active player perks.

seenEvents: {Array<string>} - A list of EVENT_IDs the player has already encountered.

activeShipId: {string} - The SHIP_ID of the player's currently active ship.

ownedShipIds: {Array<string>} - A list of SHIP_IDs for all ships the player owns.

shipStates: {object} - A map of the dynamic state for each ship the player owns.

[SHIP_ID: string]: {object}

health: {number} - Current hull integrity.

fuel: {number} - Current fuel units.

hullAlerts: {object} - Flags for triggering hull damage warnings.

one: {boolean} - Flag for first damage warning.

two: {boolean} - Flag for second (critical) damage warning.

inventories: {object} - A map of cargo inventories, keyed by SHIP_ID.

[SHIP_ID: string]: {object}

[COMMODITY_ID: string]: {object}

quantity: {number} - The quantity of the commodity held.

avgCost: {number} - The average purchase price for the units held, for profit tracking.

debugEventIndex: {number} - A developer tool for forcing specific events.

market: {object} - Contains all data related to the galactic economy.

prices: {object} - A map of current commodity prices by location.

[LOCATION_ID: string]: {object}

[COMMODITY_ID: string]: {number} - The current price.

inventory: {object} - A map of current commodity inventory by location.

[LOCATION_ID: string]: {object}

[COMMODITY_ID: string]: {object}

quantity: {number} - The current available quantity.

marketPressure: {number} - A value from -1 to 1 tracking player impact on this item.

lastPlayerInteractionTimestamp: {number} - The day the player last traded this item here.

hoverUntilDay: {number} - The day until which this item's price is artificially modified by an event.

rivalArbitrage: {object} - Tracks AI rival activity.

isActive: {boolean} - Whether a rival is currently targeting this item.

endDay: {number} - The day this rival activity will cease.

priceLockEndDay: {number} - The day until which natural mean reversion is disabled for this item.

isDepleted: {boolean} - Flag indicating if the item was bought out, triggering a price hike.

depletionDay: {number} - The day the depletion event was triggered.

depletionBonusDay: {number} - The day the depletion cooldown was set (prevents spamming).

galacticAverages: {object} - A map of the baseline average price for each commodity.

[COMMODDITY_ID: string]: {number} - The calculated average price.

priceHistory: {object} - A log of the last N prices for charts.

[LOCATION_ID: string]: {object}

[COMMODITY_ID: string]: {Array<number>} - An array of recent prices.

shipyardStock: {object} - A map of ships available for sale at each location.

[LOCATION_ID: string]: {object}

day: {number} - The day the stock was last refreshed.

shipsForSale: {Array<string>} - A list of SHIP_IDs available for purchase.

intelMarket: {object} - The master "inventory" for all Data Brokers, keyed by locationId.

[LOCATION_ID: string]: {Array<object>} - An array of `intelPacket` objects available at this location.

{intelPacket}:
id: {string} - Unique packet ID.
locationId: {string} - The location of the deal.
commodityId: {string} - The commodity of the deal.
discountPercent: {float} - The hidden discount (e.g., 0.40).
durationDays: {integer} - The hidden duration.
valueMultiplier: {float} - Scaling factor for price calculation.
messageKey: {string} - Key to look up text in `intelContent.js`.
isPurchased: {boolean} - State flag, `false` by default.

activeIntelDeal: {object | null} - Stores the single active, purchased deal. If `null`, the Intel Market is "unlocked".

locationId: {string} - The location where the deal is active.
commodityId: {string} - The commodity affected by the deal.
overridePrice: {number} - The pre-calculated, locked-in price for the commodity.
expiryDay: {number} - The game-day this deal expires.
sourceSaleLocationId: {string} - The LOCATION_ID of the market where the packet was sold.

tutorials: {object} - State of the Tutorial Toast System (TTS).

activeBatchId: {string | null} - The ID of the tutorial batch currently being displayed.

activeStepId: {string | null} - The ID of the specific tutorial step currently being displayed.

seenBatchIds: {Array<string>} - A list of tutorial batch IDs the player has already completed.

skippedTutorialBatches: {Array<string>} - A list of batch IDs the player has explicitly skipped.

navLock: {string | null} - If set, locks the UI to a specific NAV_ID or SCREEN_ID for a tutorial step.

missions: {object} - Tracks mission states.

activeMissionId: {string | null} - The MISSION_ID of the player's currently accepted mission.

completedMissionIds: {Array<string>} - A list of MISSION_IDs the player has completed.

missionProgress: {object} - A map for tracking progress on specific mission objectives.

activeMissionObjectivesMet: {boolean} - A flag set to true when all objectives for the active mission are complete.

uiState: {object} - Contains the transient state of various UI components.

marketCardMinimized: {object} - A map tracking the minimized state of market cards.

[COMMODITY_ID: string]: {boolean} - True if the card is minimized.

hangarShipyardToggleState: {string} - The active tab on the Hangar screen ("hangar" or "shipyard").

hangarActiveIndex: {number} - The index of the ship carousel slide in "hangar" mode.

shipyardActiveIndex: {number} - The index of the ship carousel slide in "shipyard" mode.