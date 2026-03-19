// meta/ECONOMIC_BEHAVIOR.md

CURRENT ECONOMIC BEHAVIOR
Orbital Trading Gameplay Data
Last Edit: 3/14/26, ver. Balance v2

This document provides a complete breakdown of the game's current economic model, including the core price mechanics, local market influences, system-wide macro conditions, and the specific forces that govern the player-driven simulation.

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

III. System States (Economic Weather)
A macro-economic layer that applies procedural, system-wide modifiers dynamically to augment or disrupt the baseline market math over set durations.
Mechanic: The SystemStateService evaluates condition cycles weekly. Active "weather" (e.g., 'Solar Flare', 'Guild Strike', 'Economic Boom') overrides global parameters.
Impact: Weather forces can universally inflate commodity prices (e.g., +15% to all goods), suppress shipyard inventories, severely limit fuel supplies causing station pump prices to skyrocket, or dynamically inject weighted parameters into the RandomEventService to guarantee specific event types (e.g., Pirate activity surges during 'Lawless' states).

IV. Player-Driven Market Dynamics & Simulation
Beyond the baseline mechanics, the market is governed by a set of interconnected, player-driven systems.

1. Force: Availability Pressure (The Delayed Market Shock)
This is the primary driver of all player-initiated price changes.
Mechanic: When a player buys or sells, they immediately change the item's quantity at that market. This change in stock drives the price change via the availabilityRatio.
The 7-Day Delay (Anti-Abuse): This effect is delayed. The game checks if 7 days have passed since the last interaction. The availabilityEffect is only calculated after this 7-day window, preventing same-visit exploitation.
The Strength: Controlled by AVAILABILITY_PRESSURE_STRENGTH (0.50), making market manipulation feel powerful.

2. Force: Price Lock (The Core Loop)
Mechanic: When a player makes a trade, the market's natural "Mean Reversion" is disabled for a long duration based on distance.
Technical Detail: The priceLockEndDay is set using: Base Lock (60 days) + (Location Distance * 0.20) ± 10% Jitter. This allows fringe outer-rim markets to lock prices for significantly longer (e.g., Pluto for ~276 days) than inner-system hubs (e.g., Earth for ~96 days).

3. Force: Depletion Bonus (The Panic)
A special, one-time bonus for buying out a significant portion of a market's stock.
Trigger: Purchasing reduces quantity to <= 0 and the amount purchased was >= 8% of targetStock.
Effect: Applies a 1.5x priceHikeMultiplier continuously until the market naturally replenishes to at least 60% of capacity.

4. Force: Asymmetric Saturation (The Glut)
A punitive mechanic preventing players from dumping massive fleet-sized inventories onto a single market.
Trigger: A player's sale pushes a market's inventory above 300% (3.0x) of its targetStock.
Effect: Applies a massive 0.25x multiplier to the commodity's price (a 75% crash) that persists regardless of standard Mean Reversion. Recovery only happens when the inventory sheds below 200%.

5. Force: Inventory Replenishment (The Bottleneck)
The market slowly restocks (or sheds) its inventory to move back toward its targetStock by 10% each week. MARKET_PRESSURE_DECAY aggressively decays artificial margins by the 4th consecutive trip.

V. The "Packing Peanut" Volume Constraints (Geometric Pricing)
To prevent the "late-game singularity", the economy utilizes strict Volume over Value constraints coupled with Geometric Pricing.
Tier Stratification: Prices scale geometrically (e.g., Tier 1 Water Ice at ~50cr, Tier 6 Sentient AI at ~20,000,000cr). 
Inverted Availability: Expensive goods have their canonical availability artificially choked (e.g., Sentient AI capped at 10-24 units system-wide). Cheap goods have massive availability.
The Cargo Constraint: Because ship cargo capacities are strictly hard-capped below 1,000 slots, players must use lower-tier goods (Water Ice, Plasteel) as bulk "packing peanuts" to maximize the efficiency of their massive cargo bays alongside highly profitable top-tier goods.

VI. Ship Economy & Tier-Scaled Upkeep
The game relies on Tier-Scaled Upkeep to drain late-game wealth, keeping absolute stat numbers readable while enforcing exponential costs.
Algorithmic Ship Pricing: Ship base prices are derived from utility: Cargo (300cr), Hull (200cr), and Fuel (100cr) multiplied by an exponential Class Multiplier (up to 2,500x).
Tier-Scaled Service Costs (Upkeep): Fuel costs apply exponential class multipliers (up to 500x for Capital ships). Repair costs scale algorithmically off the ship's base price (`ShipPrice * 0.0001`).
Upgrade Economy (Hybrid Pricing): Upgrades cost a Fixed Base + a percentage of the host ship's value.

VII. Debt & Bankruptcy Dynamics
The financial system imposes severe, game-altering consequences for over-leveraging capital.
1. Bifurcated Debt Structures
Guild Debt is highly regulated, offering lower interest (2%) but implementing strict 30-day garnishments that automatically deduct from player liquidity.
Syndicate Debt is high-risk, high-interest (7%) and lacks automatic garnishment, relying instead on punitive "Repo Strikes" if payments are ignored.
2. Solvency & The Repo Loop
The BankruptcyService continually evaluates the player's debt-to-liquidity ratio. If a player holding Syndicate Debt enters insolvency (debt exceeds 150% of liquid assets plus fleet value), a Repo Strike is issued.
3. Asset Forfeiture
Maxing out Repo Strikes forces a Syndicate Repo Event: the service identifies the highest value asset (a fleet ship or an installed Tier IV/V upgrade), forces a hostile liquidation, and seizes the credits to instantly clear the balance, destroying player progression.

VIII. Sol Station Directorate (Macro-Economic Impact)
The officers slotted into the Sol Station Engineering Interface act as dynamic macro-economic levers that shape the player's arbitrage strategy system-wide.
1. Systemic Supply Bottlenecks: Officers with severe negative consumptionMods will aggressively drain the station's maintenance caches. Because players must replenish these to maintain Integrity, they must purchase massive quantities from the inner system, driving up localized prices globally.
2. Capacity Buffers: Officers with high capacityMods drastically increase the "runway" a station has before reaching critical entropy, expanding the viable geographic radius of arbitrage loops.
3. Volumetric Scaling: The station's endgame requirements are volumetrically scaled down (maxing at ~4,000 units for Level 50) to perfectly align with Capital ship constraints, ensuring progression requires multiple focused supply runs.