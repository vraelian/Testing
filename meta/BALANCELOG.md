# Orbital Trading - Balance Log v2

## Overview & Qualitative Vision
Balance v2 represents a comprehensive overhaul of the quantitative economics in *Orbital Trading*. The goal of this pass was to remove "whack-a-mole" tuning by instituting a strict parametric engine anchored by algebra. The target experience is a structured **~26-hour campaign** where progression feels meaningful, loss aversion remains present at all tiers, and the late game cleanly pivots from pure arbitrage to industrial simulation without sequence-breaking the mathematical curve.

### Core Pacing Anchor: The "120-Trip" Rule
All progression math is reverse-engineered from Mihaly Csikszentmihalyi’s concept of *Flow*. To perfectly balance challenge and reward, a player should be able to afford the next tier of progression (a new ship or major upgrade) after an average of **120 successful, optimized trade runs** yielding a 10% to 15% profit margin.

---

## 1. The Faucet: Commodity Values & Supply Bottlenecks
**Objective:** Prevent the "late-game singularity" where exponential price growth combined with massive cargo holds allowed players to make trillions in a single trip, breaking the game.
**Methodology:** Applied *Queuing Theory* (Little's Law) by throttling the input rate (supply) rather than limiting the container size (cargo holds). 

* **Price Compression (`database.js`):** * Tier 1 (Ice/Plasteel) anchored at 15–160cr base. (Yields ~210–540 cr/trip).
    * Tier 2 to Tier 5 follow a controlled geometric curve.
    * Tier 6 (Xeno/AI) capped at ~75,000–150,000cr base. (Yields ~3.5M–5M cr/trip at optimal margins).
    * Tier 7 (Antimatter/Folded Drives) strictly removed from the standard supply pool. They act exclusively as Sol Station outputs and late-game cash-outs, priced at 1.5M–6M base.
* **Supply Pyramid (`canonicalAvailability`):** * T1 goods generate in high volume (80–150 units).
    * T6 goods (Sentient AI, Xeno-Geologicals) are hard-capped at 15–40 units system-wide. This ensures a player with a 750-cargo Capital ship cannot fill their entire hold with T6 goods, forcing them to mix bulk goods and naturally bottle-necking their wealth generation.

## 2. The Governor: Market Resistance & Friction
**Objective:** Stop players from milking a single hyper-profitable "gold rush" route forever, enforcing exploration and "Triangular Trade Routes."
**Methodology:** Mimicked *Price Elasticity of Demand* using logistic degradation and spatial friction.

* **`MARKET_PRESSURE_DECAY` (Updated to 0.65 from 0.70):** * *Rationale:* Forces an aggressive "4-Trip Crash." An optimal 15% margin degrades to ~11% on trip 2, ~6% on trip 3, and plummets to ~1% (barely covering fuel) by trip 4. 
* **`MEAN_REVERSION_STRENGTH` (Updated to 0.025 from 0.04):** * *Rationale:* Slows down market recovery. It now takes roughly 120 to 180 in-game days (4 to 6 months) for a crashed market to fully restabilize to the galactic average. Because travel takes months, the player is organically forced to plot new routes to let their previous markets recover.

## 3. The Sinks: Volumetric Upkeep & Capital Ships
**Objective:** Drain excess wealth proportionally to the player's progression tier so operating costs remain a relevant strategic factor.
**Methodology:** Maintained flat unit costs (e.g., 75cr/HP repair) but exponentially scaled the physical volume of late-game assets.

* **Ship Parameter Scaling (`ship_database.js`):**
    * *Class C (Starter):* 30–100 HP | 90–150 Fuel
    * *Class B/A:* 200–1500 HP | 200–1800 Fuel
    * *Class S:* 3000–5000 HP | 3500–5500 Fuel
    * *Class O (Capital):* 18,000–35,000 HP | 28,000–55,000 Fuel
    * *Rationale:* Capital ships are framed as optional, luxury conveniences. They sit outside the mandatory 120-trip progression curve. Their gargantuan HP and Fuel pools mean that standard percentage-based travel decay will inherently cost hundreds of thousands of credits to maintain, turning them into massive volumetric wealth sinks.

## 4. Hardware Upgrades: Hybrid Pricing
**Objective:** Ensure that ship upgrades are always a major, semi-permanent financial commitment, regardless of whether they are applied to a 25k starter ship or a 1.5 Billion credit capital ship.
**Methodology:** Replaced flat-fee upgrades with a dynamic Hybrid Formula in `GameAttributes.js`.

* **The Formula:** `UpgradeCost = FixedBaseCost + (HostShipBasePrice * TierModifier%)`
    * *Tier 1:* 5,000cr + 5% Ship Value
    * *Tier 2:* 15,000cr + 10% Ship Value
    * *Tier 3:* 45,000cr + 15% Ship Value
    * *Tier 4:* 125,000cr + 20% Ship Value
    * *Tier 5:* 400,000cr + 30% Ship Value
    * *Rationale:* The `FixedBaseCost` prevents early-game players from slapping top-tier upgrades onto cheap ships for a negligible fee. The `TierModifier%` ensures that equipping a Tier 5 module on a Sovereign (55M base) costs over 16.9 Million credits, serving as a vital mid-to-late game credit sink.

## 5. Externalities: Wealth-Scaled Hazards
**Objective:** Implement Kahneman and Tversky’s *Prospect Theory* (Loss Aversion) to ensure veteran players still feel threatened by random events, without relying on combat or piracy tropes.
**Methodology:** Converted flat credit fines to percentage-based liquidity garnishments in `events_hazards.js`, `events_bureaucracy.js`, and `events_traffic.js`.

* **Liquid Wealth Scaling:** * Minor Infractions (Tariffs): `-0.02` (2%)
    * Major Bureaucracy (Failed audits, quarantine bypass): `-0.04` to `-0.08` (4% - 8%)
    * Catastrophic Violations (Bribing blockades, failed licensing disputes): `-0.09` (9%)
    * *Rationale:* A 9% hard cap ensures that severe penalties sting significantly (e.g., losing 90 million if holding 1 billion liquid) without ruining a player's ability to recover. This dynamically maintains danger regardless of progression tier. Players can actively engage in the "Poverty Gambit"—hiding wealth in physical cargo to lower their liquid cash and bypass heavy fines.

## 6. The Macro Vacuum: Sol Station Engine
**Objective:** Transition the final 25% of the campaign from purely repetitive A-to-B arbitrage (which induces cognitive fatigue) into industrial resource management, providing a localized purpose for the player's massive endgame fleet.
**Methodology:** Exponentially scaled the `LEVEL_REGISTRY` in `solProgressionRegistry.js` (Levels 1-50).

* **Endgame Scaling:**
    * *Levels 1-15 (Establishment):* Requires T1-T3 commodities and 25k to 5M credits.
    * *Levels 16-35 (Industrialization):* Requires T4-T5 commodities and 6.5M to 450M credits.
    * *Levels 36-50 (Dominance):* Requires massive influxes of T6 commodities (e.g., up to 150 Sentient AI) and costs culminating in **25 Billion Credits** at Level 50.
    * *Rationale:* Acts as the ultimate gameplay vacuum, smoothly absorbing the absurd cargo/credit outputs of Progression Tiers 5 and 6. T7 commodities are deliberately excluded from these requirements, cementing their role as the ultimate economic reward generated by the station itself.