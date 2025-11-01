/**
 * @file Contains message templates for the NewsTickerService,
 * specifically for dynamically generated intel.
 */

/**
 * Messages for free, present-location intel, tiered by discount percentage.
 * @type {Object<string, string[]>}
 */
export const FREE_INTEL_MESSAGES = {
    // Tier 0: No significant discount
    "tier0": [
        "Market conditions nominal."
    ],
    // Tier 1: 5-10% Below Average
    "tier1": [
        "Minor price drop for {Commodity Name}.",
        "Low prices reported for {Commodity Name}.",
        "{Commodity Name} trending below average.",
        "{Commodity Name}: Favorable pricing reported.",
        "Good time to buy {Commodity Name}.",
        "It's a buyer's market for {Commodity Name}."
    ],
    // Tier 2: 11-20% Below Average
    "tier2": [
        "{Commodity Name} prices are looking good.",
        "{Commodity Name} is on sale.",
        "Exceptional pricing available for {Commodity Name}.",
        "Act now for the best price on {Commodity Name}.",
        "Get your cheap {Commodity Name} now!",
        "{Commodity Name} is trading far below average.",
        "Get {Commodity Name} for cheap while you can.",
        "Traders are eyeing cheap {Commodity Name}.",
        "Now is the time to acquire {Commodity Name}.",
        "Capitalize on falling {Commodity Name} prices.",
        "Solid discount on {Commodity Name}."
    ],
    // Tier 3: 21-30% Below Average
    "tier3": [
        "Don't miss out: {Commodity Name} is a bargain.",
        "Prime buying opportunity for {Commodity Name}.",
        "{Commodity Name}: Prices slashed!",
        "{Commodity Name} is a 'hot buy' right now.",
        "{Commodity Name} is a steal at this price.",
        "Significant price drop for {Commodity Name}.",
        "Traders report massive discounts on {Commodity Name}.",
        "Unbeatable deals on {Commodity Name} right now.",
        "Deep discounts on {Commodity Name}!",
        "{Commodity Name} value has dropped significantly.",
        "{Commodity Name} prices are tumbling."
    ],
    // Tier 4: 31-50% Below Average
    "tier4": [
        "{Commodity Name} prices are nosediving.",
        "{Commodity Name} prices have plummeted!",
        "Major price correction for {Commodity Name}.",
        "Fire sale! Get your {Commodity Name} while it lasts.",
        "{Commodity Name} prices are getting crushed.",
        "{Commodity Name} is practically a giveaway."
    ],
    // Tier 5: 51%+ Below Average
    "tier5": [
        "{Commodity Name}: Prices have never been lower.",
        "Historic lows for {Commodity Name}.",
        "{Commodity Name} prices hit rock-bottom!",
        "{Commodity Name} prices are in freefall.",
        "Price crash reported for {Commodity Name}.",
        "Market update: {Commodity Name} valuation has collapsed.",
        "{Commodity Name} is being sold for scrap prices.",
        "{Commodity Name}: Total market collapse!",
        "{Commodity Name} is virtually worthless."
    ]
};

/**
 * Messages for purchased, solar-system-wide intel.
 * Applies to deals 30% or more below galactic average.
 * @type {string[]}
 */
export const PURCHASED_INTEL_MESSAGES = [
    "Prime buying opportunity for {Commodity Name} at {Location Name}!",
    "{Location Name} reports massive discounts on {Commodity Name}!",
    "{Commodity Name} is a steal at {Location Name} right now!",
    "Don't miss out: {Commodity Name} is a bargain at {Location Name}!",
    "{Location Name}: Prices slashed on {Commodity Name}!",
    "Head to {Location Name} for deep discounts on {Commodity Name}!",
    "Traders flocking to {Location Name} for cheap {Commodity Name}!",
    "Significant price drops for {Commodity Name} at {Location Name}!",
    "{Location Name} is the hot spot to buy {Commodity Name}!",
    "Unbeatable deals on {Commodity Name} available at {Location Name}!",
    "{Location Name} is dumping its {Commodity Name} stock!",
    "Get to {Location Name}! {Commodity Name} prices are nosediving!",
    "{Commodity Name} prices have plummeted at {Location Name}!",
    "{Location Name} is practically giving away {Commodity Name}!",
    "Fire sale on {Commodity Name} at {Location Name}!",
    "{Commodity Name} prices are getting crushed at {Location Name}!",
    "{Commodity Name} market is in a freefall at {Location Name}!",
    "Rumor: A major holder just dumped {Commodity Name} at {Location Name}!",
    "{Commodity Name} selling for practically nothing at {Location Name}!",
    "Price crash! {Commodity Name} is worthless at {Location Name}!",
    "The {Commodity Name} market has collapsed at {Location Name}!",
    "Historic lows for {Commodity Name} reported at {Location Name}!",
    "{Location Name}: {Commodity Name} prices have hit rock-bottom!",
    "Total market failure for {Commodity Name} at {Location Name}!",
    "{Location Name} can't get rid of its {Commodity Name}!",
    "{Commodity Name}: Prices have never been lower at {Location Name}!",
    "{Commodity Name} is being sold for scrap prices at {Location Name}!",
    "{Location Name}'s {Commodity Name} valuation has evaporated!"
];