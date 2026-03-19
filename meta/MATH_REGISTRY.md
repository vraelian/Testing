// meta/MATH_REGISTRY.md

# Orbital Trading: Math Registry
Last Edit: [Current Date], ver. Balance v2

## 1. Market Simulation Formulas
**1.1 Target Price Calculation**
The baseline price a market "wants" to have before player influence.
```javascript
TargetPrice = GalacticAverage * (1 + (ImportExportMod * 0.5))
Note: The 0.5 multiplier pulls the price 50% of the way toward the ideal extreme.

1.2 Availability Ratio & Effect
Determines scarcity and converts it into a price multiplier.

JavaScript
AvailabilityRatio = CurrentStock / TargetStock
AvailabilityEffect = 1 + ((1 - AvailabilityRatio) * AVAILABILITY_PRESSURE_STRENGTH)
1.3 Final Price Calculation

JavaScript
FinalPrice = TargetPrice * AvailabilityEffect * RandomFluctuation * SystemStateModifier
MEAN_REVERSION_STRENGTH: 0.025 (2.5% daily pull toward TargetPrice).

MARKET_PRESSURE_DECAY: 0.65 (Decay rate for player-driven availability margins).

1.4 Dynamic Fleet Cost Averaging
Calculated globally across all active ships in a player's fleet when purchasing new commodities to prevent margin obfuscation.

JavaScript
NewAverageCost = ((TotalFleetQuantity * CurrentAverageCost) + (PurchasedQuantity * CurrentMarketPrice)) / (TotalFleetQuantity + PurchasedQuantity)
1.5 Profit Projection Calculation
Accounts for dynamic fleet overhead prior to executing a transaction.

JavaScript
ExpectedRevenue = CurrentMarketSellPrice * TotalFleetQuantity
TotalCostBasis = AverageFleetCostPerUnit * TotalFleetQuantity
EstimatedProfit = ExpectedRevenue - TotalCostBasis - ProjectedConvoyTax
2. Travel, Fuel & Entropy Formulas
2.1 Fuel Consumption (Burn)

JavaScript
FuelBurn = DistanceAU * BASE_FUEL_BURN * (1 + ShipBurnMod + EngineUpgradeMod)
2.2 Travel Time & Distance-Based Hull Entropy
Hull deterioration is mathematically decoupled from time to prevent "speed min-maxing". The static base route time is used as a proxy for physical distance.

JavaScript
TravelDays = (DistanceAU / ShipSpeed) * (1 - TravelSpeedBonus)
BaseTravelTime = TRAVEL_DATA[Origin][Destination].time
HullDecay = Math.ceil(BaseTravelTime * HULL_DECAY_PER_TRAVEL_DAY * HullStressMod * 0.8)
HullStressMod: Derived from Engine Mods. Faster engines multiply structural stress (e.g., +15% to +60%).

2.3 Fuel-Coupled Event Delays
When random events introduce delays, they actively drain fuel reserves based on the route's natural burn rate.

JavaScript
DailyFuelRate = BaseFuelCost / BaseTravelTime
EventDelayFuelCost = DailyFuelRate * EventDelayDays * PlayerBuildModifiers
2.4 Convoy Tax (Fleet Overhead)
Operating multiple ships imposes a scaling fractional offset against fuel burn and hull decay during travel.

JavaScript
ConvoyTaxRate = InactiveShipsCount * 0.02
ConvoyFuelTax = Math.max(0, Math.ceil(TravelFuelCost * ConvoyTaxRate))
3. Ship Economy & Tier-Scaled Upkeep
3.1 Algorithmic Ship Pricing
The base value of a ship strictly adheres to utility constraints (<=1000) scaled by an exponential class tier.

JavaScript
BaseValue = (CargoCapacity * 300) + (MaxHealth * 200) + (MaxFuel * 100)
FinalPrice = BaseValue * ClassMultiplier
Class Multipliers: C = 1, B = 5, A = 25, S = 250, Z = 1500, O = 2500.

3.2 Dynamic Hull Repair Cost
Repairs scale proportionally to the algorithmic value of the ship to drain late-game wealth.

JavaScript
CostPerHP = Math.max(1, ShipBasePrice * 0.0001) * LocationModifier * PerkModifiers
3.3 Dynamic Fuel Cost
Fuel purchases at starports are subjected to a Fuel Grade Multiplier based on the ship's class.

JavaScript
FinalPumpPrice = BaseLocationFuelPrice * FuelClassMultiplier
Fuel Class Multipliers: C = 1, B = 5, A = 25, S = 150, Z/O = 500.

3.4 Upgrade Hardware Cost & Resale (Hybrid Pricing)

JavaScript
UpgradeCost = FixedBaseCost + (ShipBasePrice * TierMultiplier)
SellValue = (BaseHullPrice + TotalUpgradeValue) * DEPRECIATION_FACTOR
DEPRECIATION_FACTOR: 0.75 (Player loses 25% of value).

4. Event System RNG & Dynamic Scaling
4.1 Weighted Selection

JavaScript
EventChance = (BaseWeight + (PlayerTags * TagMultiplier)) * SystemStateEventModifier
System sums total weight, rolls 0..TotalWeight, and iterates until the sum exceeds the roll.

4.2 Wealth-Scaled Penalties & Class-Scaled Rewards

JavaScript
HazardPenalty = LiquidCredits * HazardSeverityPercentage // (Hard capped at 9%)
OpportunityReward = BaseValue * ActiveShipClassMultiplier
5. Sol Station Directorate Engine
5.1 Entropy Calculation & Resource Consumption

JavaScript
BASE_DECAY_K = 0.0000014
CurrentEntropy = BaseEntropy * (1 + Sum(OfficerEntropyBuffs) - Sum(LevelEntropyReductions))
EffectiveConsumptionRate = CurrentEntropy * Math.max(0, 1 - OfficerConsumptionReductions)
EffectiveCapacity = BaseCapacity + Sum(OfficerCapacityMods) + Sum(LevelCapacityMods)
5.2 Antimatter, Credit Yields, and Synthesis

JavaScript
DailyCreditYield = BaseYield * (1 + Sum(OfficerCreditMults) + Sum(LevelCreditMults)) * EfficiencyCurve
SynthesisYield = (InputCommodityVolume * CommodityTierValueMultiplier) * StationEfficiencyCurve
PipelineDuration = BaseSynthesisDays * Math.max(0.2, (1 - OfficerSynthesisSpeedBuffs))
6. Debt & Bankruptcy Formulas
6.1 Interest Compounding & Solvency Thresholds

JavaScript
GuildInterest = Principal * 0.02 // (2% standard 30-day term)
SyndicateInterest = Principal * 0.07 // (7% predatory 15-day term)

TotalLiquidity = PlayerCredits + (TotalFleetResaleValue * 0.5)
IsInsolvent = TotalDebt > (TotalLiquidity * 1.5)