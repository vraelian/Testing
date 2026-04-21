// meta/MATH_REGISTRY.md

Orbital Trading: Math Registry
Last Edit: 4/20/26, ver. [37.84]

1. Market Simulation Formulas
1.1 Target Price Calculation
The baseline price a market "wants" to have before player influence.

JavaScript
TargetPrice = GalacticAverage * (1 + (ImportExportMod * 0.5))
ImportExportMod: Defined in constants.js (e.g., +0.5 for Import, -0.5 for Export).

Note: The 0.5 multiplier pulls the price 50% of the way toward the ideal extreme.

1.2 Availability Ratio
Determines how scarce an item is relative to the market's expectation.

JavaScript
AvailabilityRatio = CurrentStock / TargetStock

1.3 Availability Effect (The Price Driver)
The primary formula converting scarcity into a price multiplier.

JavaScript
AvailabilityEffect = 1 + ((1 - AvailabilityRatio) * AVAILABILITY_PRESSURE_STRENGTH)
AVAILABILITY_PRESSURE_STRENGTH: 0.50 (High impact).

Result: If Ratio is 0.5 (Half stock), Price increases by 25%.

1.4 Final Price Calculation
JavaScript
FinalPrice = TargetPrice * AvailabilityEffect * RandomFluctuation * SystemStateModifier * StatusEffectPriceMod
RandomFluctuation: ±5-10% daily noise.
MEAN_REVERSION_STRENGTH: 0.025 (2.5% daily pull toward TargetPrice).
MARKET_PRESSURE_DECAY: 0.65 (Decay rate for player-driven availability margins).
SystemStateModifier: Procedural multiplier from active Economic Weather.
StatusEffectPriceMod: Multipliers derived from transient Ship Status Effects (e.g., Guild Smuggling tags).

1.5 Profit Projection Calculation
Determines the expected return on cargo inventory before executing a trade, accounting for dynamic fleet overhead.

JavaScript
ExpectedRevenue = CurrentMarketSellPrice * TotalFleetQuantity
TotalCostBasis = AverageFleetCostPerUnit * TotalFleetQuantity
EstimatedProfit = ExpectedRevenue - TotalCostBasis - ProjectedConvoyTax

2. Travel, Fuel & Entropy Formulas
2.1 Fuel Consumption (Burn)
How much fuel is removed from the tank per trip.

JavaScript
FuelBurn = DistanceAU * BASE_FUEL_BURN * (1 + ShipBurnMod + EngineUpgradeMod + StatusEffectBurnMod)
BASE_FUEL_BURN: Defined per ship class (reduced by 50% system-wide for travel baseline cost adjustments).
EngineUpgradeMod: Typically positive (increases burn) for speed upgrades (e.g., +0.20).
StatusEffectBurnMod: Volatile modifiers applied by temporary Ship Status Effects (e.g., Engine Overcharge).

2.2 Travel Time
How many days a trip takes.

JavaScript
TravelDays = (DistanceAU / ShipSpeed) * (1 - TravelSpeedBonus - StatusEffectSpeedMod)
TravelSpeedBonus: Accumulated from Age Perks or Upgrades.
StatusEffectSpeedMod: Temporary bonuses or penalties from Ship Status Effects.

2.3 Distance-Based Hull Entropy
Hull deterioration is decoupled from dynamic travel time and relies on the static base time of a route as a proxy for "distance". The result is flattened and ceiling-rounded to safely apply to sub-1000 HP ship pools.

JavaScript
BaseTravelTime = TRAVEL_DATA[Origin][Destination].time
HullDecay = Math.ceil(BaseTravelTime * HULL_DECAY_PER_TRAVEL_DAY * HullStressMod * 0.8 * StatusEffectHullMod)
HullStressMod: Derived from Engine Mods. Faster engines multiply structural stress (e.g., +15% to +60%).
HULL_DECAY_PER_TRAVEL_DAY: Increased by an additional 5% to 1.1135 (from 1.0605) to force more frequent maintenance stops.
StatusEffectHullMod: Vulnerability or shielding applied by temporary Ship Status Effects.

2.4 Fuel-Coupled Event Delays
When a random event introduces a time delay, it consumes standard travel fuel proportional to the route's base burn rate.

JavaScript
DailyFuelRate = BaseFuelCost / BaseTravelTime
EventDelayFuelCost = DailyFuelRate * EventDelayDays * PlayerBuildModifiers

2.5 Time-Cost Repairs (Drydocking)
Repairing a ship at a station consumes both credits and time.

JavaScript
Time Cost = 1 In-Game Day per Repair Tick 

2.6 Convoy Tax (Fleet Overhead)
Operating multiple ships imposes a linear fractional offset against fuel burn and hull decay during travel.

JavaScript
ConvoyTaxRate = InactiveShipsCount * 0.02
ConvoyFuelTax = Math.max(0, Math.ceil(TravelFuelCost * ConvoyTaxRate))

3. Ship Economy & Tier-Scaled Upkeep
3.1 Algorithmic Ship Pricing
The base price of a ship is strictly determined by its physical capacity and a tiered luxury multiplier.

JavaScript
BaseValue = (CargoCapacity * 300) + (MaxHealth * 200) + (MaxFuel * 100)
FinalPrice = BaseValue * ClassMultiplier
Class Multipliers: C = 1, B = 5, A = 25, S = 250, Z = 1500, O = 2500.

3.2 Dynamic Hull Repair Cost
Repairs scale proportionally to the value of the ship rather than relying on a flat fee.

JavaScript
CostPerHP = Math.max(1, ShipBasePrice * 0.0029) * LocationModifier * PerkModifiers
(Note: Base multiplier increased by 31.8% to 0.0029 to enforce late-game wealth sinking).

3.3 Dynamic Fuel Cost
Fuel purchases at starports are subjected to a Fuel Grade Multiplier based on the ship's class, alongside a 50% base pump reduction.

JavaScript
FinalPumpPrice = ((BaseLocationFuelPrice / 10) * 0.50) * FuelClassMultiplier
Fuel Class Multipliers: C = 1, B = 5, A = 25, S = 150, Z/O = 500.

3.4 Upgrade Hardware Cost & Resale
The dynamic cost formula for ship upgrades (Balance v2 Hybrid Pricing).

JavaScript
UpgradeCost = FixedBaseCost + (ShipBasePrice * TierMultiplier)
TierMultiplier scales from 0.05 (Tier I) up to 0.30 (Tier V).
SellValue = (BaseHullPrice + TotalUpgradeValue) * DEPRECIATION_FACTOR
DEPRECIATION_FACTOR: 0.75 (Player loses 25% of value).

4. Event System RNG & Dynamic Scaling
4.1 Weighted Selection
Events are chosen based on a "lottery ticket" system.

JavaScript
EventChance = (BaseWeight + (PlayerTags * TagMultiplier)) * SystemStateEventModifier
The system sums the total weight of all valid events.
A random number 0..TotalWeight is rolled.
The selector iterates through events until the running sum exceeds the roll.
*Note: Story Events triggered by explicit Mission Flags bypass this system entirely, forced into the queue sequentially.*

4.2 Outcome Resolution
For weighted choices within an event:

JavaScript
OutcomeRoll = Math.random() * 100
Outcomes are defined with weight ranges (e.g., Success: 70, Fail: 30).
If OutcomeRoll < 70, Success triggers.

4.3 Wealth-Scaled Penalties (Hazards)
For event fines and bureaucratic hazards, penalizing the player based on liquidity.

JavaScript
Penalty = LiquidCredits * HazardSeverity%
(Hard capped at 9% for the most catastrophic outcomes to preserve progression feasibility).

4.4 Ship-Class Scaled Rewards (Opportunities)
For positive windfalls and opportunities, dynamic resolution uses the active ship's algorithmic Class Multiplier.

JavaScript
Reward = BaseValue * ActiveShipClassMultiplier
(Via the scaleWith: 'SHIP_CLASS_SCALAR' directive).

5. Sol Station Directorate Engine
5.1 Entropy Calculation
The daily decay rate of station caches is dynamically altered by the sum of slotted officer buffs.

JavaScript
BASE_DECAY_K = 0.0000014
CurrentEntropy = BaseEntropy * (1 + Sum(OfficerEntropyBuffs) - Sum(LevelEntropyReductions))

5.2 Resource Consumption & Capacity Modifiers
Officers dynamically alter the mathematics of how much specific commodities the station can hold and how fast they burn per tick via both additive and multiplicative modifiers.

JavaScript
EffectiveCapacity = BaseCapacity + Sum(OfficerCapacityMods) + Sum(LevelCapacityMods)
EffectiveConsumptionRate = CurrentEntropy * Math.max(0, 1 - OfficerConsumptionReductions)

5.3 Antimatter & Credit Yields
Output yields during 'Commerce' and 'Production' modes are directly scaled by the Directorate roster.

JavaScript
DailyCreditYield = BaseYield * (1 + Sum(OfficerCreditMults) + Sum(LevelCreditMults)) * EfficiencyCurve
DailyAMYield = BaseAMYield * (1 + Sum(OfficerAMMults) + Sum(LevelAMMults)) * EfficiencyCurve

5.4 Synthesis Pipeline Conversion
The mathematical translation of standard commodities into Antimatter via the active processing pipeline.

JavaScript
SynthesisYield = (InputCommodityVolume * CommodityTierValueMultiplier) * StationEfficiencyCurve
PipelineDuration = BaseSynthesisDays * Math.max(0.2, (1 - OfficerSynthesisSpeedBuffs))

6. Debt & Bankruptcy Formulas
6.1 Guild vs. Syndicate Interest Rates
Loans utilize divergent mathematical compounding rules based on the originating entity.

JavaScript
GuildInterest = Principal * 0.02 // (2% standard 30-day term)
SyndicateInterest = Principal * 0.07 // (7% predatory 15-day term)

6.2 Bankruptcy Insolvency Threshold
The debt-to-asset ratio evaluated daily to trigger repo events.

JavaScript
TotalLiquidity = PlayerCredits + (TotalFleetResaleValue * 0.5)
IsInsolvent = TotalDebt > (TotalLiquidity * 1.5)

6.3 Terminal Economic Softlock (Vagrancy/Indentured Servitude)
Evaluated to determine if the player is mathematically trapped without any options to generate capital, triggering a forced recovery state (Indentured Servitude).

JavaScript
MinEscapeCost = MissingFuelAmount * LocalFuelPrice
TotalLiquidCapital = PlayerCredits + (TotalFleetCargoValue)
IsSoftlocked = (TotalLiquidCapital < MinEscapeCost) && (FleetSize === 1) && (ActiveZeroCostMissions === 0)