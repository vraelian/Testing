CURRENT ECONOMIC BEHAVIOR
Orbital Trading Gameplay Data
Last Edit: 1/9/26, ver. 33.77
This document provides a complete breakdown of the game's current economic model, including the core price mechanics, local market influences, and the specific forces that govern the player-driven simulation.

I. Core Price Mechanics Explained
These are the foundational rules that establish the baseline price of a commodity before any player actions are taken.
Galactic Average: This is the foundational, system-wide average price for a commodity. Think of it as the "default" price before any local factors.
Local Price Target: This is the new price baseline that each location's market thinks it should have. It's calculated by taking the Galactic Average and pulling it 50% of the way toward its "ideal" import/export price.
An Exporter (e.g., modifier of 2.0) has a local target price that is significantly lower than the Galactic Average.
An Importer (e.g., modifier of 0.5) has a local target price that is significantly higher than the Galactic Average.
Mean Reversion: This is the "gravitational pull" (currently set to 4% strength) that slowly pulls a commodity's current price back toward its new Local Price Target each week. This new system ensures that import/export locations will always trend toward the prices you expect, creating stable and logical trade routes.

II. Local Price Influences by Location
This is the full list of price influences for every market.
Venus
Exports (Price Reverts Toward a Lower Baseline):
Cloned Organs
Neural Processors
Imports (Price Reverts Toward a Higher Baseline):
Sentient AI Cores
Earth
Exports (Price Reverts Toward a Lower Baseline):
Hydroponics
Imports (Price Reverts Toward a Higher Baseline):
Cloned Organs
Xeno-Geologicals
The Moon
Exports (Price Reverts Toward a Lower Baseline):
Plasteel
Refined Propellant
Graphene Lattices
Imports (Price Reverts Toward a Higher Baseline):
Water Ice
Hydroponics
Mars
Exports (Price Reverts Toward a Lower Baseline):
Plasteel
Imports (Price Reverts Toward a Higher Baseline):
Hydroponics
Cryo-Sleep Pods
Water Ice
Graphene Lattices
The Belt
Exports (Price Reverts Toward a Lower Baseline):
Water Ice
Xeno-Geologicals
Imports (Price Reverts Toward a Higher Baseline):
Hydroponics
Cybernetics
The Exchange
Neutral Location: This location has no local modifiers. All prices will revert directly toward the Galactic Average.
Jupiter
Exports (Price Reverts Toward a Lower Baseline):
Refined Propellant
Atmo Processors
Imports (Price Reverts Toward a Higher Baseline):
Neural Processors
Saturn
Imports (Price Reverts Toward a Higher Baseline):
Cryo-Sleep Pods
Cloned Organs
Uranus
Exports (Price Reverts Toward a Lower Baseline):
Atmo Processors
Imports (Price Reverts Toward a Higher Baseline):
Sentient AI Cores
Neural Processors
Neptune
Imports (Price Reverts Toward a Higher Baseline):
Plasteel (Note: This is a strong import with a 0.1 modifier, so prices will trend very high)
Refined Propellant
Kepler's Eye
Neutral Location: This location has no local modifiers. All prices will revert directly toward the Galactic Average.
Pluto
Exports (Price Reverts Toward a Lower Baseline):
Water Ice
Xeno-Geologicals
Imports (Price Reverts Toward a Higher Baseline):
Hydroponics
Cybernetics
Cloned Organs

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
Mechanic: When a player makes a trade, the market's natural "Mean Reversion" (the 4% pull back to the local average) is disabled for a long duration.
Technical Detail: When applyMarketImpact is called, it sets a priceLockEndDay on the inventory item.
Jan-Jun (Day 1-182): 75 to 120 days (2.5 - 4 months).
Jul-Dec (Day 183-365): 105 to 195 days (3.5 - 6.5 months).
Effect: In evolveMarketPrices, the system checks if this.gameState.day < inventoryItem.priceLockEndDay. If true, reversionEffect is set to 0. This "locks" the price at the new level created by the player's trade, allowing them to travel and return to exploit the price they created.
3. Force: Depletion Bonus (The Panic)
A special, one-time bonus for buying out a significant portion of a market's stock, simulating a supply panic.
Technical Detail: This is a multi-part check originating in PlayerActionService.buyItem.
Trigger: When a purchase reduces inventoryItem.quantity to <= 0.
Threshold Check: The game checks if the amount purchased was >= 8% of the item's calculated targetStock.
Cooldown Check: It then checks if 365 days have passed since the last bonus (depletionBonusDay).
Effect: If all checks pass, isDepleted and depletionDay are set. For the next 7 days, evolveMarketPrices applies a 1.5x priceHikeMultiplier to the availabilityEffect, causing the price to rise 50% faster than normal.
4. Force: Inventory Replenishment (The Bottleneck)
The market's supply-side response. This is the primary balancing factor that bottlenecks market manipulation.
Mechanic: The market slowly restocks (or sheds) its inventory to move back toward its targetStock.
Technical Detail: In replenishMarketInventory, the market only moves 10% of the difference (targetStock - currentStock) each week.
Effect: This slow 10% rate acts as the main "cooldown" for the manipulation loop. A player can lock a price, but they must wait for stock to slowly recover (or be shed, in a surplus) before they can trade against that locked price again.
Role of marketPressure: The marketPressure variable (set during a trade) is now used exclusively by this system. Negative pressure (from player buying) will dynamically increase the market's targetStock, simulating the market adapting to new demand.
5. Force: Market Memory (The Reset)
The passive fail-safe that prevents the universe from being permanently altered.
Mechanic: This is the "garbage collector" for markets the player abandons.
Technical Detail: In replenishMarketInventory, the system checks if lastPlayerInteractionTimestamp is older than 120 days.
Effect: If the player has not traded that specific item at that specific location for 120 days, the item's state is completely reset.
marketPressure is reset to 0.
priceLockEndDay is reset to 0, re-enabling Mean Reversion.
depletionBonusDay is reset to 0, allowing the bonus to be triggered again.

IV. How The Market Behaves (Simple Terms)
Here is a simple breakdown of those forces with examples.
Availability Pressure (The Shock): You sell 1,000 "Plasteel" on Mars, doubling its stock.
For the next 7 days, nothing happens to the price (this prevents you from buying it right back).
On Day 7, the price crashes by 50%.
Price Lock (Your Loop): You sell 1,000 "Plasteel" on Mars, crashing the price.
That price will stay crashed (it won't recover from natural Mean Reversion) for a random 3-6 months.
This allows you to travel, then return to buy it back at the low price you created.
Depletion Bonus (The Panic): You buy the entire large stock of "Cybernetics" (e.g., 50 units) on Earth.
For the next 7 days, the price for "Cybernetics" on Earth will rise 50% faster than normal.
This won't happen if you just buy the last 2 units, and it can only happen once per year.
Replenishment (The Bottleneck): A market wants 1,000 "Plasteel" but has 1,200 (a surplus of 200).
It will not shed 200 units at once.
It will only shed 10% of the 200-unit gap, losing 20 units per week.
This is the "race": the price crash from your sale slowly gets weaker each week as the surplus shrinks.
Market Memory (The Reset): You crash the "Plasteel" price on Mars, then fly to the outer system and don't come back.
After 120 days of you not trading Plasteel on Mars, the market "forgets" you, and the price returns to normal.

V. Commodity Behavior
This is the full spectrum of default economic behaviors for all commodities, based on the definitions in js/data/database.js.
Section 1: Overview of Core Economic Parameters
This details the three fundamental parameters that define the economic behavior of a commodity before any local market modifiers (like import/export specialties) or system states are applied.
Base Price Range: This array [min, max] defines the foundational value of a commodity. The game's MarketService uses this range to establish a "Galactic Average" price, which serves as the baseline from which all local prices are derived.
Volatility: This decimal number represents the commodity's inherent price instability. A higher volatility value means the commodity's price will experience larger and more frequent fluctuations, making it a riskier but potentially more profitable asset.
Canonical Availability: This array [min, max] defines the default quantity of a commodity that a "neutral" market (one with no specialty modifiers for this item) will attempt to stock. This represents the item's general abundance or scarcity.
Section 2: Commodity Economic Behavior by Tier
The following is the complete breakdown of the default economic profiles for every tradable commodity, organized by tier.
Tier 1: Basic Materials
Water Ice
Base Price Range: [15, 80]
Volatility: 0.01 (Very Low)
Canonical Availability: [80, 150] (Abundant)
Plasteel
Base Price Range: [100, 280]
Volatility: 0.015 (Very Low)
Canonical Availability: [80, 150] (Abundant)
Tier 2: Industrial & Agricultural Goods
Hydroponics
Base Price Range: [850, 2400]
Volatility: 0.025 (Low)
Canonical Availability: [40, 70] (Common)
Cybernetics
Base Price Range: [1200, 3800]
Volatility: 0.03 (Low)
Canonical Availability: [40, 70] (Common)
Tier 3: Refined & Processed Goods
Refined Propellant
Base Price Range: [14000, 38000]
Volatility: 0.035 (Low-Medium)
Canonical Availability: [25, 50] (Uncommon)
Neural Processors
Base Price Range: [18000, 52000]
Volatility: 0.045 (Medium)
Canonical Availability: [25, 50] (Uncommon)
Tier 4: Advanced & Civilian Goods
Graphene Lattices
Base Price Range: [180000, 420000]
Volatility: 0.05 (Medium)
Canonical Availability: [20, 40] (Scarce)
Cryo-Sleep Pods
Base Price Range: [250000, 750000]
Volatility: 0.075 (High)
Canonical Availability: [15, 30] (Scarce)
Tier 5: High-Tech & Bio-Engineering
Atmo Processors
Base Price Range: [2800000, 8500000]
Volatility: 0.08 (High)
Canonical Availability: [10, 20] (Very Scarce)
Cloned Organs
Base Price Range: [3500000, 11000000]
Volatility: 0.09 (Very High)
Canonical Availability: [10, 20] (Very Scarce)
Tier 6: Exotic & Restricted Tech
Xeno-Geologicals
Base Price Range: [24000000, 70000000]
Volatility: 0.1 (Extremely High)
Canonical Availability: [2, 10] (Rare)
Sentient AI Cores
Base Price Range: [32000000, 95000000]
Volatility: 0.125 (Extremely High)
Canonical Availability: [2, 10] (Rare)
Tier 7: "Endgame" & Exotic Matter
Antimatter
Base Price Range: [280000000, 800000000]
Volatility: 0.15 (Hyper-Volatile)
Canonical Availability: [2, 10] (Exotic)
Folded-Space Drives
Base Price Range: [350000000, 1100000000]
Volatility: 0.15 (Hyper-Volatile)
Canonical Availability: [2, 10] (Exotic)
Section 3: Observable Patterns & Logic
Based on this data, a clear "full spectrum" pattern emerges:
Price & Tier: Commodity prices increase exponentially with each tier, establishing a clear progression of value.
Volatility & Tier: Volatility directly correlates with tier. Low-tier goods are stable and predictable, while high-tier "luxury" or "exotic" goods are highly volatile, making them high-risk, high-reward speculative assets.
Availability & Tier: Canonical availability is inversely proportional to tier. Tier 1 goods are abundant, while Tier 6 and 7 goods are exceptionally rare, reinforcing their high value.