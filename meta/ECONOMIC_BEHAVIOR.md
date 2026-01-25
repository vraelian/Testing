{
type: file_update,
fileName: meta/ECONOMIC_BEHAVIOR.md,
fullContent:
CURRENT ECONOMIC BEHAVIOR
Orbital Trading Gameplay Data
Last Edit: 1/25/26, ver. 34.70
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
Mechanic: When a player makes a trade, the market's natural "Mean Reversion" (the 4% pull back to the local average) is disabled for a long duration.
Technical Detail: When applyMarketImpact is called, it sets a priceLockEndDay on the inventory item.
Jan-Jun (Day 1-182): 75 to 120 days (2.5 - 4 months).
Jul-Dec (Day 183-365): 105 to 195 days (3.5 - 6.5 months).
Effect: In evolveMarketPrices, the system checks if this.gameState.day < inventoryItem.priceLockEndDay. If true, reversionEffect is set to 0. This "locks" the price at the new level created by the player's trade, allowing them to travel and return to exploit the price they created.
**Note:** Active Intel Deals also trigger a form of price lock where the price fluctuates by only ±3% around the deal price.
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
(See existing file for basic behavior examples...)

V. Commodity Behavior
(See existing file for full Commodity Tier list...)

VI. Ship Upgrade Economy
The Upgrade System introduces a secondary economy layer, turning ships into customizable assets. Upgrades have fixed costs based on their Tier, but they directly influence a ship's resale value and the player's operating margins.

1. Tiered Pricing Structure
Upgrades are categorized into five tiers of rarity and power.
Tier I (Common): 5,000 - 40,000 Credits. Entry-level modifications.
Tier II (Rare): 15,000 - 120,000 Credits. Advanced specialized equipment.
Tier III (Very Rare): 45,000 - 480,000 Credits. Experimental military-grade technology.
Tier IV (Prototype): 270,000 - 12,500,000 Credits. Unstable, high-performance experimental tech.
Tier V (Luminary): 810,000 - 25,000,000 Credits. Unique, "best-in-class" artifacts.

2. Resale Value Logic
Ships are now valued based on the sum of their hull and their installed components.
Base Calculation: (Ship Base Price + Sum of Installed Upgrade Values)
Depreciation: The total is multiplied by the standard depreciation factor (0.75).
Implication: Players do not lose the full cost of an upgrade when selling a ship; they recover 75% of the upgrade's value, making experimentation financially viable.
Destructive Replacement: However, if a player installs an upgrade into a full slot (3/3), the replaced upgrade is destroyed (0% recovery).

3. Economic Modifiers
Specific upgrades directly alter the player's profit margins and operating costs.
Signal Hacker (Buy Price): Reduces purchase prices (Tier I: 0.5% -> Tier V: 3.3%).
Guild Badge (Sell Price): Increases sell prices (Tier I: 0.5% -> Tier V: 3.3%).
Fuel Pass (Service Cost): Reduces refueling costs (Tier I: 10% -> Tier V: 50%).
Syndicate Badge (Debt): Reduces monthly debt interest (Tier I: 20% -> Tier V: 66%).
Engine Mod (Trade-Off): Increases travel speed (10-40%) but increases fuel consumption (15-60%).

VII. Service Economies & Quirks (See existing file...)

VIII. Station-Specific Market Quirks
Unique economic rules that apply only to specific stations, encouraging specialized trade routes.

* **Sol Station (Solar Forge):** +25% Sell Price for Graphene Lattices & Plasteel.
* **Mercury (Desperate Thirst):** Pays 40% more for Water Ice.
* **Venus (Data Haven):** Intel is 50% cheaper and deals last 2x longer.
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
}