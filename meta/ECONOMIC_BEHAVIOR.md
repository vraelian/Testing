// meta/ECONOMIC_BEHAVIOR.md

CURRENT ECONOMIC BEHAVIOR
Orbital Trading Gameplay Data
Last Edit: 3/10/26, ver. Balance v2

This document provides a complete breakdown of the game's current economic model, including the core price mechanics, local market influences, and the specific forces that govern the player-driven simulation.

I. Core Price Mechanics Explained
These are the foundational rules that establish the baseline price of a commodity before any player actions are taken.
Galactic Average: This is the foundational, system-wide average price for a commodity. Think of it as the "default" price before any local factors.
Local Price Target: This is the new price baseline that each location's market thinks it should have. It's calculated by taking the Galactic Average and pulling it 50% of the way toward its "ideal" import/export price.
An Exporter (e.g., modifier of 2.0) has a local target price that is significantly lower than the Galactic Average.
An Importer (e.g., modifier of 0.5) has a local target price that is significantly higher than the Galactic Average.
Mean Reversion: This is the "gravitational pull" (currently set to 2.5% strength) that slowly pulls a commodity's current price back toward its new Local Price Target each week. This system ensures that import/export locations will always trend toward the prices you expect, creating stable and logical trade routes. It now takes roughly 120 to 180 in-game days (4 to 6 months) for a crashed market to fully restabilize.

II. Local Price Influences by Location
This is the full list of price influences for every market.
Sol Station
Exports (Price Reverts Toward a Lower Baseline): Antimatter
Imports (Price Reverts Toward a Higher Baseline): Graphene Lattices, Plasteel

Mercury
Exports (Price Reverts Toward a Lower Baseline): Plasteel
Imports (Price Reverts Toward a Higher Baseline): Water Ice (Strong Import)

Venus
Exports (Price Reverts Toward a Lower Baseline): Cloned Organs, Neural Processors
Imports (Price Reverts Toward a Higher Baseline): Sentient AI Cores, Atmo Processors

Earth
Exports (Price Reverts Toward a Lower Baseline): Hydroponics, Cybernetics
Imports (Price Reverts Toward a Higher Baseline): Cloned Organs, Xeno-Geologicals

The Moon
Exports (Price Reverts Toward a Lower Baseline): Plasteel, Graphene Lattices
Imports (Price Reverts Toward a Higher Baseline): Water Ice, Hydroponics

Mars
Exports (Price Reverts Toward a Lower Baseline): Plasteel, Xeno-Geologicals
Imports (Price Reverts Toward a Higher Baseline): Hydroponics, Water Ice

The Belt
Exports (Price Reverts Toward a Lower Baseline): Water Ice, Xeno-Geologicals
Imports (Price Reverts Toward a Higher Baseline): Hydroponics, Cybernetics

The Exchange
Exports (Price Reverts Toward a Lower Baseline): Sentient AI Cores, Cloned Organs
Imports (Price Reverts Toward a Higher Baseline): Antimatter, Xeno-Geologicals

Jupiter
Exports (Price Reverts Toward a Lower Baseline): Refined Propellant
Imports (Price Reverts Toward a Higher Baseline): Plasteel, Atmo Processors

Saturn
Exports (Price Reverts Toward a Lower Baseline): Cybernetics
Imports (Price Reverts Toward a Higher Baseline): Cryo-Sleep Pods, Cloned Organs

Uranus
Exports (Price Reverts Toward a Lower Baseline): Neural Processors
Imports (Price Reverts Toward a Higher Baseline): Sentient AI Cores, Atmo Processors

Neptune
Exports (Price Reverts Toward a Lower Baseline): Cryo-Sleep Pods, Graphene Lattices
Imports (Price Reverts Toward a Higher Baseline): Plasteel, Refined Propellant

Kepler's Eye
Exports (Price Reverts Toward a Lower Baseline): Antimatter
Imports (Price Reverts Toward a Higher Baseline): Folded-Space Drives, Neural Processors

Pluto
Exports (Price Reverts Toward a Lower Baseline): Graphene Lattices, Xeno-Geologicals
Imports (Price Reverts Toward a Higher Baseline): Antimatter, Cybernetics

III. Player-Driven Market Dynamics & Simulation
Beyond the baseline mechanics, the market is governed by a set of interconnected, player-driven systems. These forces are designed to make the market a dynamic entity that the player actively manipulates. These forces are processed during the weekly TimeService.advanceDays simulation tick.

1. Force: Availability Pressure (The Delayed Market Shock)
This is the new, unified force that replaces the old "Player Pressure" and "Scarcity Pressure." It is the primary driver of all player-initiated price changes.
Mechanic: This force directly simulates supply and demand. When a player buys or sells, they immediately change the item's quantity at that market. This change in stock is the only thing that drives the price change.
Technical Detail: In evolveMarketPrices, the system calculates an availabilityRatio (current quantity / targetStock). This ratio is used to create an availabilityEffect.
The 7-Day Delay (Anti-Abuse): This effect is intentionally delayed. The game checks if 7 days have passed since the lastPlayerInteractionTimestamp. The availabilityEffect is only calculated after this 7-day window, preventing players from manipulating a price and exploiting it in the same visit.
The Strength (High Impact): This effect is controlled by AVAILABILITY_PRESSURE_STRENGTH (currently 0.50). This high value makes market manipulation feel powerful and rewarding.

2. Force: Price Lock (The Core Loop)
This is the system that makes market manipulation viable.
Mechanic: When a player makes a trade, the market's natural "Mean Reversion" (the 2.5% pull back to the local average) is disabled for a long duration.
Technical Detail: When applyMarketImpact is called, it sets a priceLockEndDay on the inventory item using a dynamic, distance-scaled formula: Base Lock (60 days) + (Location Distance * 0.20) ± 10% Jitter.
Effect: In evolveMarketPrices, the system checks if this.gameState.day < inventoryItem.priceLockEndDay. If true, reversionEffect is set to 0. This "locks" the price at the new level created by the player's trade. Because the lock scales with distance, fringe outer-rim markets will lock prices for significantly longer (e.g., Pluto for ~276 days) than inner-system hubs (e.g., Earth for ~96 days), aligning the opportunity window with actual travel times.

3. Force: Depletion Bonus (The Panic)
A special, one-time bonus for buying out a significant portion of a market's stock, simulating a supply panic.
Trigger: When a purchase reduces inventoryItem.quantity to <= 0 and the amount purchased was >= 8% of the item's calculated targetStock.
Effect: Initiates a macroeconomic panic era. evolveMarketPrices applies a 1.5x priceHikeMultiplier continuously until the market's stock naturally replenishes to at least 60% of its target capacity (which typically takes about 9 weeks).

4. Force: Asymmetric Saturation (The Glut)
The inverse of the Depletion Panic. A punitive mechanic that prevents players from dumping massive fleet-sized inventories onto a single market without consequence.
Trigger: When a player's sale pushes a market's inventory above 300% (3.0x) of its targetStock, an isSaturated flag is triggered.
Effect: While saturated, the market refuses to pay standard rates, applying a massive 0.25x multiplier to the commodity's price (a 75% crash) that persists regardless of standard Mean Reversion or pressure calculations. Recovery only happens when the inventory sheds down below 200%.

5. Force: Inventory Replenishment (The Bottleneck)
The market's supply-side response. This is the primary balancing factor that bottlenecks market manipulation.
Mechanic: The market slowly restocks (or sheds) its inventory to move back toward its targetStock. The market only moves 10% of the difference each week. MARKET_PRESSURE_DECAY is tuned to 0.65, aggressively decaying artificial margins by the 4th consecutive trip (the 4-Trip Crash).

6. Force: Market Memory (The Reset)
The passive fail-safe that prevents the universe from being permanently altered.
Mechanic: If the player has not traded that specific item at that specific location for a full year (365 days), the item's state is completely reset (pressure, locks, and panic states are wiped).

IV. The "Packing Peanut" Volume Constraints (Geometric Pricing)
To prevent the "late-game singularity" where exponential wealth trivializes the game, the economy utilizes strict Volume over Value constraints coupled with Geometric Pricing.
Tier Stratification: Prices scale geometrically (e.g., Tier 1 Water Ice at ~50cr, Tier 6 Sentient AI at ~20,000,000cr). 
Inverted Availability: The most expensive goods have their canonical availability artificially choked (e.g., Sentient AI is capped at 10-24 units system-wide). Cheap goods have massive canonical availability (up to 450 units).
The Cargo Constraint: Because ship cargo capacities are strictly hard-capped below 1,000 slots, a Capital ship hauling 850 units can never fill its entire hold with Tier 6 goods. The player is forced to purchase the highly profitable, low-availability top-tier goods, and use lower-tier goods (Water Ice, Plasteel) as bulk "packing peanuts" to maximize the efficiency of their massive cargo bays. Every tier remains relevant from the early game to the endgame.

V. Ship Economy & Tier-Scaled Upkeep
The game relies on Tier-Scaled Upkeep rather than Volumetric Sinks to drain late-game wealth, keeping absolute stat numbers readable while enforcing exponential costs.

1. Algorithmic Ship Pricing
Ship base prices are no longer arbitrary; they are strictly calculated based on the utility of their metal. Cargo capacity is weighted highest (300cr/unit), followed by Hull (200cr/unit) and Fuel (100cr/unit). This base sum is then multiplied by an exponential Class Multiplier (up to 2,500x for Capital ships) to generate prices reaching nearly 1 Billion credits.

2. Tier-Scaled Service Costs (Upkeep)
Because Capital ships are capped at low physical limits (< 1,000 HP/Fuel), flat service fees would render upkeep mathematically invisible to a billionaire player. 
Fuel Grading: Station fuel prices are multiplied by the ship's class tier (e.g., Class C pays 1x the base pump price, Class O Capital ships pay 500x the base pump price for highly refined propellant).
Dynamic Drydocking: Hull repair is no longer a flat 75cr/HP. It is dynamically calculated as ShipBasePrice * 0.0001 per HP. A single scratch on a 1 Billion credit Citadel costs 100,000 credits to buff out.

3. Ship Upgrade Economy (Hybrid Pricing)
Upgrades utilize a Hybrid Pricing Formula: Fixed Base Cost + a percentage of the host ship's value. 
Tier I: 5,000 + 5% Ship Value. 
Tier V: 400,000 + 30% Ship Value.
Because of the hard caps on physical stats (<1000), percentage-based upgrades (e.g., +20% Cargo) are exponentially valuable. An upgrade that grants a 10% fuel discount instantly saves a Capital ship tens of millions of credits per refuel tick.

VI. Station-Specific Market Quirks
Unique economic rules that apply only to specific stations, encouraging specialized trade routes.
* Sol Station (Solar Forge): +25% Sell Price for Graphene Lattices & Plasteel.
* Mercury (Desperate Thirst): Pays 40% more for Water Ice.
* Venus (Data Haven): Intel is 50% cheaper and deals last 30% longer.
* Earth (High Demand): Cloned Organs & Xeno-Geologicals sell for 10% more.
* The Moon (Orbital Shipyards): 20% discount on all ship repairs.
* Mars (Colonial Expansion): +10% Sell Price for Water Ice and Hydroponics.
* The Belt (Lawless Zone): 5% discount on Water Ice & Xeno-Geological purchases.
* The Exchange (Black Market): Prices fluctuate dramatically (3x Volatility).
* Jupiter (Gas Giant Refinery): Fuel is sold at a 50% discount.
* Saturn (Luxury Tax): +20% Sell Price for Organs/Cryo Pods, but 200% Service Costs.
* Uranus (Quantum Research): Increased chance for advanced ship upgrades in the tuning shop.
* Neptune (Military Logistics): 10% Bulk Discount on Propellant & Plasteel (when buying >50 units).
* Kepler's Eye (Financial Hub): 15% Discount on all financing and debt payments. Double intel packet generation.
* Pluto (Fringe Outpost): +25% Sell Price on Cybernetics & Antimatter. Supplies are scarce.

VII. Sol Station Directorate (Macro-Economic Impact)
The officers slotted into the Sol Station Engineering Interface act as dynamic macro-economic levers that shape the player's arbitrage strategy system-wide.
1. Systemic Supply Bottlenecks
Officers with severe negative consumptionMods (e.g., hyper-burning Plasteel or Water Ice) will aggressively drain the station's maintenance caches. Because players must replenish these to maintain Integrity, they must purchase massive quantities from the inner system. This fundamentally alters the global availability ratios, driving up localized prices for those specific commodities universally as the player hoards them for donation.
2. Capacity Buffers
Officers with high capacityMods drastically increase the "runway" a station has before reaching critical entropy. This allows the player to embark on longer deep-space trade routes without the station starving while they are gone, effectively expanding the viable geographic radius of arbitrage loops.
3. Volumetric Scaling
The station's endgame requirements are volumetrically scaled down (maxing at ~4,000 units for Level 50) to perfectly align with Capital ship constraints, ensuring progression requires multiple focused supply runs.