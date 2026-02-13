// meta/MATH_REGISTRY.md

Orbital Trading: Math Registry

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
FinalPrice = TargetPrice * AvailabilityEffect * RandomFluctuation
RandomFluctuation: ±5-10% daily noise.

2. Travel, Fuel & Entropy Formulas
2.1 Fuel Consumption (Burn)
How much fuel is removed from the tank per trip.

JavaScript
FuelBurn = DistanceAU * BASE_FUEL_BURN * (1 + ShipBurnMod + EngineUpgradeMod)
BASE_FUEL_BURN: Defined per ship class.

EngineUpgradeMod: Typically positive (increases burn) for speed upgrades (e.g., +0.20).

2.2 Travel Time
How many days a trip takes.

JavaScript
TravelDays = (DistanceAU / ShipSpeed) * (1 - TravelSpeedBonus)
TravelSpeedBonus: Accumulated from Age Perks or Upgrades.

2.3 Distance-Based Hull Entropy
Hull deterioration is decoupled from dynamic travel time and relies on the static base time of a route as a proxy for "distance".

JavaScript
BaseTravelTime = TRAVEL_DATA[Origin][Destination].time
HullDecay = BaseTravelTime * HULL_DECAY_PER_TRAVEL_DAY * HullStressMod
HullStressMod: Derived from Engine Mods. Faster engines multiply structural stress (e.g., +15% to +60%).

2.4 Fuel-Coupled Event Delays
When a random event introduces a time delay, it consumes standard travel fuel proportional to the route's base burn rate.

JavaScript
DailyFuelRate = BaseFuelCost / BaseTravelTime
EventDelayFuelCost = DailyFuelRate * EventDelayDays * PlayerBuildModifiers

2.5 Time-Cost Repairs (Drydocking)
Repairing a ship at a station consumes both credits and time.

JavaScript
Time Cost = 1 In-Game Day per Repair Tick 
(A Repair Tick typically restores 5% of Max Hull, or 1% if precision topping-off is required).

3. Ship Economy
3.1 Resale Value
The credit value returned when selling a ship.

JavaScript
SellValue = (BaseHullPrice + TotalUpgradeValue) * DEPRECIATION_FACTOR
DEPRECIATION_FACTOR: 0.75 (Player loses 25% of value).

TotalUpgradeValue: The sum of the purchase price of all installed upgrades.

3.2 Destructive Replacement
When installing an upgrade into a full (3/3) ship:

JavaScript
NewShipValue = OldShipValue - DestroyedUpgradeValue + NewUpgradeValue
Note: The DestroyedUpgradeValue is lost completely; it is not refunded.

4. Event System RNG
4.1 Weighted Selection
Events are chosen based on a "lottery ticket" system.

JavaScript
EventChance = BaseWeight + (PlayerTags * TagMultiplier)
The system sums the total weight of all valid events.

A random number 0..TotalWeight is rolled.

The selector iterates through events until the running sum exceeds the roll.

4.2 Outcome Resolution
For weighted choices within an event:

JavaScript
OutcomeRoll = Math.random() * 100
Outcomes are defined with weight ranges (e.g., Success: 70, Fail: 30).

If OutcomeRoll < 70, Success triggers.