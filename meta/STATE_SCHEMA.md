# Game State Schema

The `GameState` object is the single source of truth for the application. It is a JSON-serializable object that contains all mutable data.

## Root Structure
```javascript
{
  day: Integer,                // Current game day (starts at 1)
  currentLocationId: String,   // ID of the player's current location (e.g., "terra")
  activeNav: String,           // ID of the currently active main nav tab (e.g., "nav-starport")
  activeScreen: String,        // ID of the currently active screen (e.g., "market")
  isGameOver: Boolean,         // Flag to block actions if game is lost
  introSequenceActive: Boolean,// Flag for the tutorial/intro flow
  
  player: { ... },             // Player specific data (see below)
  market: { ... },             // Economy data (prices, inventory)
  missions: { ... },           // Active and completed missions
  tutorials: { ... },          // Tutorial progress tracking
  intelMarket: { ... },        // Available intel packets per location
  activeIntelDeal: Object,     // The currently active market override (or null)
  
  uiState: {                   // Transient UI state (scroll positions, toggle states)
    hangarShipyardToggleState: "hangar" | "shipyard",
    hangarActiveIndex: Integer,
    shipyardActiveIndex: Integer,
    activeIntelTab: String,
    marketCardMinimized: { [commodityId]: Boolean }
  }
}
Player State (gameState.player)
JavaScript

{
  name: String,
  credits: Integer,
  debt: Integer,
  playerAge: Integer,
  
  // Progression
  revealedTier: Integer,       // Highest commodity tier visible (1-3)
  unlockedLicenseIds: Array,   // List of owned licenses
  unlockedLocationIds: Array,  // List of discovered locations
  
  // Ships & Assets
  activeShipId: String,        // ID of the currently boarded ship
  ownedShipIds: [String],      // Array of IDs of all owned ships
  visualSeed: Integer,         // Counter for deterministic asset rotation
  
  // Ship State Dictionary
  // Keys are Ship IDs (e.g., "Wanderer.Ship")
  shipStates: {
    "Wanderer.Ship": {
      health: Number,          // Current hull points
      fuel: Number,            // Current fuel points
      hullAlerts: Object,      // Tracks if low-health warnings have been shown
      upgrades: [String]       // Array of Upgrade IDs (Max length 3). e.g., ["UPGRADE_01", "UPGRADE_03"]
    }
  },
  
  // Inventory Dictionary
  // Nested by ShipID, then CommodityID
  inventories: {
    "Wanderer.Ship": {
      "food_rations": {
        quantity: Integer,
        avgCost: Number
      }
    }
  }
}
Market State (gameState.market)
JavaScript

{
  // Current Prices (Location -> Commodity -> Price)
  prices: {
    "terra": {
      "food_rations": 105,
      "electronics": 450
    }
  },
  
  // Current Inventory (Location -> Commodity -> Data)
  inventory: {
    "terra": {
      "food_rations": {
        quantity: Integer,
        marketPressure: Number, // Influence on future stock
        lastPlayerInteractionTimestamp: Integer // Day of last trade
      }
    }
  },
  
  // Shipyard Stock (Location -> Data)
  shipyardStock: {
    "terra": {
      day: Integer,            // Day last updated
      shipsForSale: [String]   // Array of Ship IDs available
    }
  }
}
Intel State (gameState.intelMarket)
JavaScript

{
  // Keyed by Location ID
  "terra": [
    {
      id: String,              // UUID
      dealLocationId: String,  // Where the deal is
      commodityId: String,     // What commodity
      discountPercent: Number, // e.g., 0.40
      pricePaid: Number,       // Credits spent to buy this (if purchased)
      expiryDay: Integer,      // When it disappears from the list
      isPurchased: Boolean     // True if bought
    }
  ]
}