// meta/ECONOMIC_BEHAVIOR.md

CURRENT ECONOMIC BEHAVIOR
Orbital Trading Gameplay Data
Last Edit: 3/6/26, ver. Balance v2

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
Exports (Price Reverts Toward a Lower Baseline):
Antimatter
Imports (Price Reverts Toward a Higher Baseline):
Graphene Lattices
Plasteel
Mercury
Exports (Price Reverts Toward a Lower Baseline):
Plasteel
Imports (Price Reverts Toward a Higher Baseline):
Water Ice (Strong Import)
Venus
Exports (Price Reverts Toward a Lower Baseline):
Cloned Organs
Neural Processors
Imports (Price Reverts Toward a Higher Baseline):
Sentient AI Cores
Atmo Processors
Earth
Exports (Price Reverts Toward a Lower Baseline):
Hydroponics
Cybernetics
Imports (Price Reverts Toward a Higher Baseline):
Cloned Organs
Xeno-Geologicals
The Moon
Exports (Price Reverts Toward a Lower Baseline):
Plasteel
Graphene Lattices
Imports (Price Reverts Toward a Higher Baseline):
Water Ice
Hydroponics
Mars
Exports (Price Reverts Toward a Lower Baseline):
Plasteel
Xeno-Geologicals
Imports (Price Reverts Toward a Higher Baseline):
Hydroponics
Water Ice
The Belt
Exports (Price Reverts Toward a Lower Baseline):
Water Ice
Xeno-Geologicals
Imports (Price Reverts Toward a Higher Baseline):
Hydroponics
Cybernetics
The Exchange
Exports (Price Reverts Toward a Lower Baseline):
Sentient AI Cores
Cloned Organs
Imports (Price Reverts Toward a Higher Baseline):
Antimatter
Xeno-Geologicals
Jupiter
Exports (Price Reverts Toward a Lower Baseline):
Refined Propellant
Imports (Price Reverts Toward a Higher Baseline):
Plasteel
Atmo Processors
Saturn
Exports (Price Reverts Toward a Lower Baseline):
Cybernetics
Imports (Price Reverts Toward a Higher Baseline):
Cryo-Sleep Pods
Cloned Organs
Uranus
Exports (Price Reverts Toward a Lower Baseline):
Neural Processors
Imports (Price Reverts Toward a Higher Baseline):
Sentient AI Cores
Atmo Processors
Neptune
Exports (Price Reverts Toward a Lower Baseline):
Cryo-Sleep Pods
Graphene Lattices
Imports (Price Reverts Toward a Higher Baseline):
Plasteel
Refined Propellant
Kepler's Eye
Exports (Price Reverts Toward a Lower Baseline):
Antimatter
Imports (Price Reverts Toward a Higher Baseline):
Folded-Space Drives
Neural Processors
Pluto
Exports (Price Reverts Toward a Lower Baseline):
Graphene Lattices
Xeno-Geologicals
Imports (Price Reverts Toward a Higher Baseline):
Antimatter
Cybernetics

III. Player-Driven Market Dynamics & Simulation
Beyond the baseline mechanics, the market is governed by a set of interconnected, player-driven systems. These forces are designed to make the market a dynamic entity that the player actively manipulates. These forces are processed during the weekly TimeService.advanceDays simulation tick.

1. Force: Availability Pressure (The Delayed Market Shock)
This is the new, unified force that replaces the old "Player Pressure" and "Scarcity Pressure." It is the primary driver of all player-initiated price changes.
Mechanic: This force directly simulates supply and demand. When a player buys or sells, they immediately change the item's quantity at that market. This change in stock is the only thing that drives the price change.
Technical Detail: In evolveMarketPrices, the system calculates an availabilityRatio (current quantity / targetStock). This ratio is used to create an availabilityEffect.
The 7-Day Delay (Anti-Abuse): This effect is intentionally delayed. The game checks if 7 days have passed since the lastPlayerInteractionTimestamp. The availabilityEffect is only calculated after this 7-day window, preventing players from manipulating a price and exploiting it in the same visit.
The Strength (High Impact): This effect is controlled by AVAILABILITY_PRESSURE_STRENGTH (currently 0.50). This high value makes market manipulation feel powerful and rewarding.
Example (Sell): Doubling a market's stock (a 2.0 ratio) will cause the price to crash by 50% after the 7-day delay.
Example (Buy): Buying half a market's stock (a 0.5 ratio) will cause the price to spike by 25% after the 7-day delay.

2. Force: Price Lock (The Core Loop)
This is the system that makes market manipulation viable.
Mechanic: When a player makes a trade, the market's natural "Mean Reversion" (the 2.5% pull back to the local average) is disabled for a long duration.
Technical Detail: When applyMarketImpact is called, it sets a priceLockEndDay on the inventory item using a dynamic, distance-scaled formula: `Base Lock (60 days) + (Location Distance * 0.20) ± 10% Jitter`.
Effect: In evolveMarketPrices, the system checks if this.gameState.day < inventoryItem.priceLockEndDay. If true, reversionEffect is set to 0. This "locks" the price at the new level created by the player's trade. Because the lock scales with distance, fringe outer-rim markets will lock prices for significantly longer (e.g., Pluto for ~276 days) than inner-system hubs (e.g., Earth for ~96 days), aligning the opportunity window with actual travel times.
**Note:** Active Intel Deals also trigger a form of price lock where the price fluctuates by only ±3% around the deal price.

3. Force: Depletion Bonus (The Panic)
A special, one-time bonus for buying out a significant portion of a market's stock, simulating a supply panic.
Technical Detail: This is a multi-part check originating in PlayerActionService.buyItem.
Trigger: When a purchase reduces inventoryItem.quantity to <= 0.
Threshold Check: The game checks if the amount purchased was >= 8% of the item's calculated targetStock.
Cooldown Check: It then checks if 365 days have passed since the last bonus (depletionBonusDay).
Effect: If all checks pass, `isDepleted` and `depletionDay` are set. This initiates a macroeconomic panic era. `evolveMarketPrices` applies a 1.5x `priceHikeMultiplier` continuously until the market's stock naturally replenishes to at least 60% of its target capacity (which typically takes about 9 weeks). This ensures the panic lasts long enough to remain viable after a deep-space round trip.

4. Force: Asymmetric Saturation (The Glut)
The inverse of the Depletion Panic. A punitive mechanic that prevents players from dumping massive fleet-sized inventories onto a single market without consequence.
Trigger: When a player's sale pushes a market's inventory above 300% (3.0x) of its targetStock, an `isSaturated` flag is triggered.
Effect: While saturated, the market refuses to pay standard rates, applying a massive 0.25x multiplier to the commodity's price (a 75% crash) that persists regardless of standard Mean Reversion or pressure calculations.
Recovery: The market sheds its excess inventory week by week. The saturation embargo is only lifted when the inventory naturally decays below 200% (2.0x) of its target capacity, forcing fleet haulers to diversify their drop-off locations.

5. Force: Inventory Replenishment (The Bottleneck)
The market's supply-side response. This is the primary balancing factor that bottlenecks market manipulation.
Mechanic: The market slowly restocks (or sheds) its inventory to move back toward its targetStock.
Technical Detail: In replenishMarketInventory, the market only moves 10% of the difference (targetStock - currentStock) each week. `MARKET_PRESSURE_DECAY` is tuned to 0.65, aggressively decaying artificial margins by the 4th consecutive trip (the 4-Trip Crash).
Effect: This slow rate acts as the main "cooldown" for the manipulation loop. A player can lock a price, but they must wait for stock to slowly recover (or be shed, in a surplus) before they can trade against that locked price again.
Role of marketPressure: The marketPressure variable (set during a trade) is now used exclusively by this system. Negative pressure (from player buying) will dynamically increase the market's targetStock, simulating the market adapting to new demand.

6. Force: Market Memory (The Reset)
The passive fail-safe that prevents the universe from being permanently altered.
Mechanic: This is the "garbage collector" for markets the player abandons.
Technical Detail: In replenishMarketInventory, the system checks if lastPlayerInteractionTimestamp is older than 365 days.
Effect: If the player has not traded that specific item at that specific location for a full year (365 days), the item's state is completely reset. This extended duration allows players to undertake massive multi-system arbitrage routes across the outer rim without their inner-system economic footprint being erased.
marketPressure is reset to 0.
priceLockEndDay is reset to 0, re-enabling Mean Reversion.
depletionBonusDay is reset to 0, allowing the bonus to be triggered again.
isDepleted is set to false.
isSaturated is set to false.

IV. How The Market Behaves (Simple Terms)
(See existing file for basic behavior examples...)

V. Commodity Behavior
(See existing file for full Commodity Tier list...)

VI. Ship Upgrade Economy
The Upgrade System introduces a secondary economy layer, turning ships into customizable assets. Upgrades have dynamic costs based on their Tier and the host ship, directly influencing a ship's resale value and the player's operating margins.

1. Tiered Pricing Structure (Hybrid Formula)
Upgrades utilize a Hybrid Pricing Formula: Fixed Base Cost + a percentage of the host ship's value. This ensures upgrades are affordable for early ships but serve as massive credit sinks for Capital vessels.
Tier I (Basic): 5,000 + 5% Ship Value. Entry-level modifications.
Tier II (Standard): 15,000 + 10% Ship Value. Advanced specialized equipment.
Tier III (Advanced): 45,000 + 15% Ship Value. Experimental military-grade technology.
Tier IV (Elite): 125,000 + 20% Ship Value. Unstable, high-performance experimental tech.
Tier V (Experimental): 400,000 + 30% Ship Value. Unique, "best-in-class" artifacts.

2. Resale Value Logic
Ships are valued based on the sum of their hull and their installed components.
Base Calculation: (Ship Base Price + Sum of Installed Upgrade Purchase Values)
Depreciation: The total is multiplied by the standard depreciation factor (0.75).
Implication: Players do not lose the full cost of an upgrade when selling a ship; they recover 75% of the upgrade's value, making experimentation financially viable.
Destructive Replacement: However, if a player installs an upgrade into a full slot (3/3), the replaced upgrade is destroyed (0% recovery).

3. Economic Modifiers
Specific upgrades directly alter the player's profit margins and operating costs.
Signal Hacker (Buy Price): Reduces purchase prices (Tier I: 0.5% -> Tier V: 3.3%).
Guild Badge (Sell Price): Increases sell prices (Tier I: 0.5% -> Tier V: 3.3%).
Fuel Pass (Service Cost): Reduces refueling costs (Tier I: 10% -> Tier V: 50%).
Syndicate Badge (Debt): Reduces monthly debt interest (Tier I: 20% -> Tier V: 66%).
Engine Mod (Trade-Off): Increases travel speed (10-40%) but increases fuel consumption and hull stress (15-60%).

VII. Service Economies & Quirks (See existing file...)

VIII. Station-Specific Market Quirks
Unique economic rules that apply only to specific stations, encouraging specialized trade routes.

* **Sol Station (Solar Forge):** +25% Sell Price for Graphene Lattices & Plasteel.
* **Mercury (Desperate Thirst):** Pays 40% more for Water Ice.
* **Venus (Data Haven):** Intel is 50% cheaper and deals last 30% longer.
* **Earth (High Demand):** Cloned Organs & Xeno-Geologicals sell for 10% more.
* **The Moon (Orbital Shipyards):** 20% discount on all ship repairs.
* **Mars (Colonial Expansion):** +10% Sell Price for Water Ice and Hydroponics.
* **The Belt (Lawless Zone):** (Classified).
* **The Exchange (Black Market):** Prices fluctuate dramatically (3x Volatility).
* **Jupiter (Gas Giant Refinery):** Fuel is sold at a 50% discount.
* **Saturn (Luxury Tax):** +20% Sell Price for Organs/Cryo Pods, but 200% Service Costs.
* **Uranus (Quantum Research):** Increased chance for advanced ship upgrades in the tuning shop.
* **Neptune (Military Logistics):** 10% Bulk Discount on Propellant & Plasteel (when buying >50 units).
* **Kepler's Eye (Financial Hub):** 15% Discount on all financing and debt payments.
* **Pluto (Fringe Outpost):** +25% Sell Price on Cybernetics & Antimatter. Supplies are scarce.

IX. Sol Station Directorate (Macro-Economic Impact)
The officers slotted into the Sol Station Engineering Interface act as dynamic macro-economic levers that shape the player's arbitrage strategy system-wide.
1. Systemic Supply Bottlenecks
Officers with severe negative `consumptionMods` (e.g., hyper-burning Plasteel or Water Ice) will aggressively drain the station's maintenance caches. Because players must replenish these to maintain Integrity, they must purchase massive quantities from the inner system. This fundamentally alters the global availability ratios, driving up localized prices for those specific commodities universally as the player hoards them for donation.
2. Capacity Buffers
Officers with high `capacityMods` drastically increase the "runway" a station has before reaching critical entropy. This allows the player to embark on longer deep-space trade routes without the station starving while they are gone, effectively expanding the viable geographic radius of arbitrage loops.
3. Wealth Generation Swings
Slotting officers with massive `creditMult` or `amMult` bonuses transforms the station into an exponential raw wealth engine, but typically at the cost of extreme resource consumption, transitioning the late-game loop from "Arbitrage Trader" to "Station Feeder".