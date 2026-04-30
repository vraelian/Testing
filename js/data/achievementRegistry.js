// js/data/achievementRegistry.js

/**
 * Procedural Master Registry for all 55 game session achievements.
 * Evaluates completion logic natively via standard UI reads and binds rewards.
 */

export const REWARD_TYPES = {
    CREDITS: 'CREDITS',
    VOUCHER_FUEL: 'VOUCHER_FUEL',
    VOUCHER_REPAIR: 'VOUCHER_REPAIR',
    SHIP: 'SHIP',
    LICENSE: 'LICENSE',
    UNLOCK_LOCATION: 'UNLOCK_LOCATION'
};

const MASK = "[???]";

export const ACHIEVEMENT_REGISTRY = [
    // ---------------------------------------------------------
    // CATEGORY I: NAVIGATION
    // ---------------------------------------------------------
    {
        id: 'ach_nav_inner_skimmer',
        categoryId: 'Navigation',
        title: 'Inner-System Skimmer',
        description: (state) => `Complete 150 jumps to Mercury, Venus, Earth, Mars, or Luna.`,
        metricKey: 'jumpsInnerSystem',
        targetValue: 150,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 15000
    },
    {
        id: 'ach_nav_void_crawler',
        categoryId: 'Navigation',
        title: 'Deep Void Crawler',
        description: (state) => `Complete 150 jumps to Jupiter, Saturn, Uranus, Neptune, Kepler's Eye, or Pluto.`,
        metricKey: 'jumpsOuterSystem',
        targetValue: 150,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 25000
    },
    {
        id: 'ach_nav_fumes_rider',
        categoryId: 'Navigation',
        title: 'Fumes Rider',
        description: (state) => `Arrive at a destination with less than 5% fuel remaining 35 times.`,
        metricKey: 'arriveLowFuel',
        targetValue: 35,
        rewardType: REWARD_TYPES.VOUCHER_FUEL,
        rewardPayload: 10
    },
    {
        id: 'ach_nav_red_liner',
        categoryId: 'Navigation',
        title: 'Red-Liner',
        description: (state) => `Initiate a transit with less than 20% hull integrity 35 times.`,
        metricKey: 'transitLowHull',
        targetValue: 35,
        rewardType: REWARD_TYPES.VOUCHER_REPAIR,
        rewardPayload: 5
    },
    {
        id: 'ach_nav_asteroid_rat',
        categoryId: 'Navigation',
        title: 'Asteroid Rat',
        description: (state) => state.player.unlockedLocationIds.includes('loc_belt') ? `Travel to the Asteroid Belt 75 times.` : `Travel to the ${MASK} 75 times.`,
        metricKey: 'jumpsBelt',
        targetValue: 75,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 10000
    },
    {
        id: 'ach_nav_sluggish_hauler',
        categoryId: 'Navigation',
        title: 'Sluggish Hauler',
        description: (state) => `Perform 250 jumps while your active fleet cargo capacity is at 100%.`,
        metricKey: 'jumpsMaxCapacity',
        targetValue: 250,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 50000
    },
    {
        id: 'ach_nav_lightweight',
        categoryId: 'Navigation',
        title: 'Lightweight Runner',
        description: (state) => `Perform 30 jumps with entirely empty cargo holds across the fleet.`,
        metricKey: 'jumpsEmptyHold',
        targetValue: 30,
        rewardType: REWARD_TYPES.VOUCHER_FUEL,
        rewardPayload: 5
    },
    {
        id: 'ach_nav_station_hopper',
        categoryId: 'Navigation',
        title: 'Station Hopper',
        description: (state) => `Perform 30 short-range jumps taking 1-2 days.`,
        metricKey: 'jumpsShort',
        targetValue: 30,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 5000
    },
    {
        id: 'ach_nav_long_hauler',
        categoryId: 'Navigation',
        title: 'The Long Hauler',
        description: (state) => `Perform 30 long-range jumps taking 100+ days.`,
        metricKey: 'jumpsLong',
        targetValue: 30,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 30000
    },
    {
        id: 'ach_nav_hull_survivor',
        categoryId: 'Navigation',
        title: 'Hull-Breach Survivor',
        description: (state) => `Arrive at a destination with exactly 1% hull remaining.`,
        metricKey: 'arriveCriticalHull',
        targetValue: 1,
        rewardType: REWARD_TYPES.VOUCHER_REPAIR,
        rewardPayload: 2
    },
    {
        id: 'ach_dock_jupiter',
        categoryId: 'Navigation',
        title: 'Jovian Siphoner',
        description: (state) => state.player.unlockedLocationIds.includes('loc_jupiter') ? `Dock at Jupiter 50 times.` : `Dock at ${MASK} 50 times.`,
        metricKey: 'docked_loc_jupiter',
        targetValue: 50,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 5000
    },
    {
        id: 'ach_dock_saturn',
        categoryId: 'Navigation',
        title: 'Ring Skimmer',
        description: (state) => state.player.unlockedLocationIds.includes('loc_saturn') ? `Dock at Saturn 50 times.` : `Dock at ${MASK} 50 times.`,
        metricKey: 'docked_loc_saturn',
        targetValue: 50,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 5000
    },
    {
        id: 'ach_dock_pluto',
        categoryId: 'Navigation',
        title: 'Plutonian Exile',
        description: (state) => state.player.unlockedLocationIds.includes('loc_pluto') ? `Dock at Pluto 50 times.` : `Dock at ${MASK} 50 times.`,
        metricKey: 'docked_loc_pluto',
        targetValue: 50,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 5000
    },
    {
        id: 'ach_dock_kepler',
        categoryId: 'Navigation',
        title: 'Kepler’s Scholar',
        description: (state) => state.player.unlockedLocationIds.includes('loc_kepler') ? `Dock at Kepler's Eye 50 times.` : `Dock at ${MASK} 50 times.`,
        metricKey: 'docked_loc_kepler',
        targetValue: 50,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 5000
    },
    {
        id: 'ach_dock_mercury',
        categoryId: 'Navigation',
        title: 'Mercurian Miner',
        description: (state) => state.player.unlockedLocationIds.includes('loc_mercury') ? `Dock at Mercury 50 times.` : `Dock at ${MASK} 50 times.`,
        metricKey: 'docked_loc_mercury',
        targetValue: 50,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 5000
    },
    {
        id: 'ach_dock_venus',
        categoryId: 'Navigation',
        title: 'Venusian Socialite',
        description: (state) => state.player.unlockedLocationIds.includes('loc_venus') ? `Dock at Venus 50 times.` : `Dock at ${MASK} 50 times.`,
        metricKey: 'docked_loc_venus',
        targetValue: 50,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 5000
    },
    {
        id: 'ach_dock_mars',
        categoryId: 'Navigation',
        title: 'Martian Dust-Off',
        description: (state) => state.player.unlockedLocationIds.includes('loc_mars') ? `Dock at Mars 50 times.` : `Dock at ${MASK} 50 times.`,
        metricKey: 'docked_loc_mars',
        targetValue: 50,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 5000
    },
    {
        id: 'ach_dock_luna',
        categoryId: 'Navigation',
        title: 'Lunar Hopper',
        description: (state) => state.player.unlockedLocationIds.includes('loc_luna') ? `Dock at Luna 50 times.` : `Dock at ${MASK} 50 times.`,
        metricKey: 'docked_loc_luna',
        targetValue: 50,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 5000
    },
    {
        id: 'ach_dock_sol',
        categoryId: 'Navigation',
        title: 'Sol Engineer',
        // PHASE 3 FIX: Masking string references loc_sun rather than loc_sol to match ID
        description: (state) => state.player.unlockedLocationIds.includes('loc_sun') ? `Dock at Sol Station 50 times.` : `Dock at ${MASK} 50 times.`,
        metricKey: 'docked_loc_sun',
        targetValue: 50,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 10000
    },
    {
        id: 'ach_dock_exchange',
        categoryId: 'Navigation',
        title: 'Illicit Trader',
        description: (state) => state.player.unlockedLocationIds.includes('loc_exchange') ? `Dock at The Exchange 50 times.` : `Dock at ${MASK} 50 times.`,
        metricKey: 'docked_loc_exchange',
        targetValue: 50,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 10000
    },
    {
        id: 'ach_dock_neptune',
        categoryId: 'Navigation',
        title: 'Militant Visitor',
        description: (state) => state.player.unlockedLocationIds.includes('loc_neptune') ? `Dock at Neptune 50 times.` : `Dock at ${MASK} 50 times.`,
        metricKey: 'docked_loc_neptune',
        targetValue: 50,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 5000
    },
    {
        id: 'ach_dock_uranus',
        categoryId: 'Navigation',
        title: 'Science Advocate',
        description: (state) => state.player.unlockedLocationIds.includes('loc_uranus') ? `Dock at Uranus 50 times.` : `Dock at ${MASK} 50 times.`,
        metricKey: 'docked_loc_uranus',
        targetValue: 50,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 5000
    },

    // ---------------------------------------------------------
    // CATEGORY II: TRADING
    // ---------------------------------------------------------
    {
        id: 'ach_trade_antimatter',
        categoryId: 'Trading',
        title: 'Antimatter Addict',
        description: (state) => `Execute a buy or sell order for Antimatter 30 times.`,
        metricKey: 'tradeAntimatter',
        targetValue: 30,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 150000
    },
    {
        id: 'ach_trade_water_baron',
        categoryId: 'Trading',
        title: 'Water Baron',
        description: (state) => `Sell 5k cumulative units of Water to Outer-Rim stations.`,
        metricKey: 'soldWaterOuter',
        targetValue: 5000,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 20000
    },
    {
        id: 'ach_trade_intel_broker',
        categoryId: 'Trading',
        title: 'Intel Broker',
        description: (state) => `Execute 30 trades while a Local Data Broker Intel advantage is active.`,
        metricKey: 'intelDealsExecuted',
        targetValue: 30,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 50000
    },
    {
        id: 'ach_trade_intelligent',
        categoryId: 'Trading',
        title: 'Intelligent',
        description: (state) => `Purchase 20 distinct Intel packets from Data Brokers.`,
        metricKey: 'intelDealsPurchased',
        targetValue: 20,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 10000
    },
    {
        id: 'ach_trade_monopolist',
        categoryId: 'Trading',
        title: 'Monopolist',
        description: (state) => `Trade only 1 specific commodity type exclusively for 20 consecutive travel jumps.`,
        metricKey: 'consecutiveMonoTrades',
        targetValue: 20,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 30000
    },
    {
        id: 'ach_trade_local_legend',
        categoryId: 'Trading',
        title: 'Local Legend',
        description: (state) => `Execute 100 successful trades explicitly at Earth.`,
        metricKey: 'tradesAt_loc_earth',
        targetValue: 100,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 10000
    },
    {
        id: 'ach_trade_black_market',
        categoryId: 'Trading',
        title: 'Black Market Regular',
        description: (state) => state.player.unlockedLocationIds.includes('loc_exchange') ? `Execute 100 successful trades explicitly at The Exchange.` : `Execute 100 successful trades explicitly at ${MASK}.`,
        metricKey: 'tradesAt_loc_exchange',
        targetValue: 100,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 25000
    },
    {
        id: 'ach_trade_hoarder',
        categoryId: 'Trading',
        title: 'Hoarder',
        description: (state) => `Maintain a fleet cargo capacity at exactly 100% full for 365 consecutive in-game days.`,
        metricKey: 'consecutiveDaysFullHold',
        targetValue: 365,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 75000
    },
    {
        id: 'ach_trade_master_arbitrage',
        categoryId: 'Trading',
        title: 'Master Arbitrage',
        description: (state) => `Net over 100k Credits in profit from a single transaction.`,
        metricKey: 'highestSingleTradeProfit',
        targetValue: 100000,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 50000
    },

    // ---------------------------------------------------------
    // CATEGORY III: FINANCE
    // ---------------------------------------------------------
    {
        id: 'ach_fin_interest_farmer',
        categoryId: 'Finance',
        title: 'Interest Farmer',
        description: (state) => `Pay a cumulative total of 1m Credits in debt interest over your lifetime.`,
        metricKey: 'lifetimeInterestPaid',
        targetValue: 1000000,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 500000
    },
    {
        id: 'ach_fin_tycoon',
        categoryId: 'Finance',
        title: 'Credit Tycoon',
        description: (state) => `Hoard a liquid balance of 100m Credits.`,
        metricKey: 'peakCredits_Tycoon',
        targetValue: 100000000,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 1000000
    },
    {
        id: 'ach_fin_billionaire',
        categoryId: 'Finance',
        title: 'The Billionaire Club',
        description: (state) => `Hoard a liquid balance of 1b Credits.`,
        metricKey: 'peakCredits_Billion',
        targetValue: 1000000000,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 5000000
    },
    {
        id: 'ach_fin_century_deal',
        categoryId: 'Finance',
        title: 'Deal of the Century',
        description: (state) => `Buy a commodity at 50% below Galactic Average, and sell it for 50% above.`,
        metricKey: 'centuryDeals',
        targetValue: 1,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 100000
    },
    {
        id: 'ach_fin_arbitrageur',
        categoryId: 'Finance',
        title: 'The Arbitrageur',
        description: (state) => `Execute 1k distinct commercial trades.`,
        metricKey: 'totalTradesExecuted',
        targetValue: 1000,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 50000
    },

    // ---------------------------------------------------------
    // CATEGORY IV: FLEET & ASSETS
    // ---------------------------------------------------------
    {
        id: 'ach_fleet_liquidated',
        categoryId: 'Fleet',
        title: 'Liquidated',
        description: (state) => `Sell 5 vessels to Shipyards.`,
        metricKey: 'shipsSold',
        targetValue: 5,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 50000
    },
    {
        id: 'ach_fleet_armada',
        categoryId: 'Fleet',
        title: 'Armada Commander',
        description: (state) => `Maintain a fleet of 10 concurrently owned vessels.`,
        metricKey: 'maxFleetSize',
        targetValue: 10,
        rewardType: REWARD_TYPES.VOUCHER_REPAIR,
        rewardPayload: 5
    },
    {
        id: 'ach_fleet_class_s',
        categoryId: 'Fleet',
        title: 'Class S Certified',
        description: (state) => `Acquire and command a Class S vessel.`,
        metricKey: 'ownedClass_S',
        targetValue: 1,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 20000
    },
    {
        id: 'ach_fleet_class_o',
        categoryId: 'Fleet',
        title: 'Class O Commander',
        description: (state) => `Acquire and command a Class O vessel.`,
        metricKey: 'ownedClass_O',
        targetValue: 1,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 40000
    },
    {
        id: 'ach_fleet_class_z',
        categoryId: 'Fleet',
        title: 'Class Z Authority',
        description: (state) => `Acquire and command a Class Z vessel.`,
        metricKey: 'ownedClass_Z',
        targetValue: 1,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 80000
    },
    {
        id: 'ach_fleet_class_f',
        categoryId: 'Fleet',
        title: 'Class F Sovereign',
        description: (state) => `Acquire and command a Class F Capital vessel.`,
        metricKey: 'ownedClass_F',
        targetValue: 1,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 250000
    },
    {
        id: 'ach_fleet_fully_decked',
        categoryId: 'Fleet',
        title: 'Fully Decked',
        description: (state) => `Successfully fill all 3 hardware upgrade slots on a single vessel.`,
        metricKey: 'maxUpgradesInstalled',
        targetValue: 3,
        rewardType: REWARD_TYPES.VOUCHER_REPAIR,
        rewardPayload: 2
    },
    {
        id: 'ach_fleet_rustbucket',
        categoryId: 'Fleet',
        title: 'Loyal Rustbucket',
        description: (state) => `Retain ownership of your starting vessel for 10 in-game years without selling it.`,
        metricKey: 'daysOwnedStartingShip',
        targetValue: 3650,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 100000
    },
    {
        id: 'ach_fleet_tech_hoarder',
        categoryId: 'Fleet',
        title: 'Tech Hoarder',
        description: (state) => `Spend 5m Credits exclusively on hardware upgrades.`,
        metricKey: 'spentOnUpgrades',
        targetValue: 5000000,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 200000
    },
    {
        id: 'ach_fleet_pristine',
        categoryId: 'Fleet',
        title: 'Pristine Condition',
        description: (state) => `Spend 1m Credits purely on Starport hull repair services.`,
        metricKey: 'spentOnRepairs',
        targetValue: 1000000,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 50000
    },

    // ---------------------------------------------------------
    // CATEGORY V: WORLD & PROGRESSION
    // ---------------------------------------------------------
    {
        id: 'ach_prog_patron',
        categoryId: 'Progression',
        title: 'The Patron',
        // PHASE 3 FIX: Masking string references loc_sun rather than loc_sol to match ID
        description: (state) => state.player.unlockedLocationIds.includes('loc_sun') ? `Donate a cumulative 10k resource units to Sol Station progression caches.` : `Donate a cumulative 10k resource units to ${MASK} progression caches.`,
        metricKey: 'solDonationsTotal',
        targetValue: 10000,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 150000
    },
    {
        id: 'ach_prog_spark',
        categoryId: 'Progression',
        title: 'First Spark',
        description: (state) => `Successfully synthesize a unit of Antimatter via the Sol Station pipeline.`,
        metricKey: 'antimatterSynthesizedTotal',
        targetValue: 1,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 200000
    },
    {
        id: 'ach_prog_sol_10',
        categoryId: 'Progression',
        title: 'Sol Station Lv. 10',
        description: (state) => `Assist Sol Station in reaching Progression Level 10.`,
        metricKey: 'peakSolLevel',
        targetValue: 10,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 50000
    },
    {
        id: 'ach_prog_sol_50',
        categoryId: 'Progression',
        title: 'Sol Station Lv. 50',
        description: (state) => `Assist Sol Station in reaching maximum Progression Level 50.`,
        metricKey: 'peakSolLevel50',
        targetValue: 50,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 2500000
    },
    {
        id: 'ach_prog_licensed',
        categoryId: 'Progression',
        title: 'Fully Licensed',
        description: (state) => `Successfully unlock all official trade licenses.`,
        metricKey: 'licensesOwned',
        targetValue: 6, // FIX: Adjusted to exactly 6 to match T2 through T7 mathematical bounds
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 100000
    },
    {
        id: 'ach_prog_centenarian',
        categoryId: 'Progression',
        title: 'Centenarian',
        description: (state) => `Survive and trade into your 100th year of life.`,
        metricKey: 'peakAge',
        targetValue: 100,
        rewardType: REWARD_TYPES.VOUCHER_FUEL,
        rewardPayload: 20
    },
    {
        id: 'ach_prog_long_watch',
        categoryId: 'Progression',
        title: 'The Long Watch',
        description: (state) => `Play for a total of 50 in-game years (18.2k days).`,
        metricKey: 'gameDaysPlayed',
        targetValue: 18250,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 500000
    },
    {
        id: 'ach_prog_traveler',
        categoryId: 'Progression',
        title: 'Traveler',
        description: (state) => `Spend a cumulative total of 5k days in warp transit.`,
        metricKey: 'totalTravelDays',
        targetValue: 5000,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 10000
    },
    {
        id: 'ach_prog_completionist',
        categoryId: 'Progression',
        title: 'The Completionist',
        description: (state) => `Claim the rewards for all other 54 available game milestones.`,
        metricKey: 'achievementsClaimed',
        targetValue: 54,
        rewardType: REWARD_TYPES.CREDITS,
        rewardPayload: 10000000
    }
];